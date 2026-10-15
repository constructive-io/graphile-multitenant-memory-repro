import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { array, number, object, readJson, string } from '../src/json.js';
import { compareLocal } from '../src/report/local-comparison.js';
import { writeSyntheticResults } from './helpers/results.js';

const save = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value));
function edit(path: string, update: (row: Record<string, unknown>) => void) {
  const row = object(readJson(path));
  update(row);
  save(path, row);
}
function preflight(directory: string) {
  const sample = object(readJson(join(directory, 'a-1-r1.json')));
  const env = object(sample.environment);
  save(join(directory, 'preflight.json'), {
    status: env.sourceDirty ? 'review-only' : 'passed',
    profile: env.comparisonProfile,
    crystal: null,
    recordedAt: '1999-12-31T23:59:00.000Z',
    testExitCode: 0,
    sourceDirty: env.sourceDirty,
    provenanceUnchanged: true,
    sourceUnchanged: true,
    benchmarkSha: env.gitSha,
    build: env.build,
    dependencies: Object.fromEntries(
      Object.entries(object(env.dependencies)).map(([name, value]) => [
        name,
        object(value).version,
      ]),
    ),
  });
}
function fixture(t: TestContext, sourceDirty = false) {
  const directory = mkdtempSync(join(tmpdir(), 'graphile-local-report-'));
  t.after(() => rmSync(directory, { recursive: true }));
  const stock = join(directory, 'stock');
  const scoped = join(directory, 'local-scoped');
  const output = join(directory, 'report');
  writeSyntheticResults(stock, 'memory', { profile: 'stock', sourceDirty });
  const local = writeSyntheticResults(scoped, 'memory', {
    profile: 'local-scoped',
    sourceDirty,
  });
  for (const path of local.samplePaths)
    edit(path, (row) => {
      const env = object(row.environment);
      env.pid = number(env.pid) + 1000;
    });
  preflight(stock);
  preflight(scoped);
  return { stock, scoped, output, localPaths: local.samplePaths };
}
function memoryHeap(value: unknown, heap: number) {
  const sample = object(value);
  sample.heapUsed = heap;
  sample.heapTotal = heap * 2;
  sample.rss = heap * 3;
  sample.peakRssBytes = heap * 4;
}

test('memory comparison aggregates worker deltas, reports ranges, and links all 42 raw samples', (t) => {
  const run = fixture(t);
  const baselines = [10, 100, 1000];
  const increments = [30, 5, 10];
  const releaseDeltas = [1, -2, 0.5];
  const pauses = [
    [1, 2, 100],
    [3, 4, 200],
    [5, 6, 300],
  ];
  for (let index = 0; index < 3; index++)
    edit(join(run.scoped, `a-1-r${index + 1}.json`), (row) => {
      memoryHeap(row.baseline, baselines[index] * 2 ** 20);
      memoryHeap(
        row.retained,
        (baselines[index] + increments[index]) * 2 ** 20,
      );
      memoryHeap(
        row.afterRelease,
        (baselines[index] + releaseDeltas[index]) * 2 ** 20,
      );
      row.heapDelta = increments[index] * 2 ** 20;
      row.buildMs = [5, 20, 8][index];
      object(row.retained).gcPausesMs = pauses[index];
    });
  compareLocal([run.stock, run.scoped], run.output);
  assert.deepEqual(readdirSync(run.output).sort(), [
    'COMPARISON.md',
    'comparison-verification.json',
    'local-metrics.json',
  ]);
  const metrics = object(readJson(join(run.output, 'local-metrics.json')));
  assert.equal(metrics.selection, 'memory');
  const rows = array(metrics.rows).map(object);
  assert.equal(rows.length, 7);
  const a1 = rows.find((row) => row.scenario === 'a' && row.value === 1)!;
  assert.equal(object(object(a1.incrementalHeapMiB).scoped).median, 10);
  assert.equal(object(object(a1.releaseMinusBaselineMiB).scoped).median, 0.5);
  assert.equal(object(object(a1.forcedGcMs).scoped).median, 4);
  assert.deepEqual(object(a1.buildMs), {
    stock: { median: 10, min: 10, max: 10 },
    scoped: { median: 8, min: 5, max: 20 },
    delta: -2,
    percent: -20,
  });
  const b50 = rows.find((row) => row.scenario === 'b' && row.value === 50)!;
  assert.equal(object(b50.perInstanceMiB).percent, -50);
  assert.equal(
    object(object(b50.perInstanceMiB).stock).median,
    100_000 / 2 ** 20,
  );
  const report = readFileSync(join(run.output, 'COMPARISON.md'), 'utf8');
  const rawLinks = [
    ...report.matchAll(/\]\(([^)]*\/(?:a|b)-\d+-r[123]\.json)\)/g),
  ].map((match) => match[1]);
  assert.equal(rawLinks.length, 42);
  assert.equal(new Set(rawLinks).size, 42);
  rawLinks.forEach((path) => assert(existsSync(resolve(run.output, path))));
  assert.match(report, /21 per profile/);
  assert.match(report, /Appendix: build timing/);
  assert.doesNotMatch(
    report,
    /REPORT\.md|84 independent|12 separate snapshot|historical/i,
  );
  const receipt = object(
    readJson(join(run.output, 'comparison-verification.json')),
  );
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.selection, 'memory');
  assert.equal(receipt.workers, 42);
  for (const group of array(receipt.groups).map(object)) {
    assert.equal(group.workers, 21);
    assert.equal(array(group.inputs).length, 24);
    for (const input of array(group.inputs).map(object)) {
      const path = resolve(run.output, string(input.path));
      assert.equal(
        input.sha256,
        createHash('sha256').update(readFileSync(path)).digest('hex'),
      );
    }
  }
});

test('memory comparison rejects mismatched provenance before writing reports or run receipts', async (t) => {
  const mutations: {
    name: string;
    update: (row: Record<string, unknown>) => void;
  }[] = [
    {
      name: 'source SHA',
      update: (row) => {
        object(row.environment).gitSha = '9'.repeat(40);
      },
    },
    {
      name: 'build hash',
      update: (row) => {
        object(object(row.environment).build).sourceSha256 = '9'.repeat(64);
      },
    },
    {
      name: 'dependency version',
      update: (row) => {
        object(object(object(row.environment).dependencies).grafast).version =
          'different';
      },
    },
    {
      name: 'SDL hash',
      update: (row) => {
        if (row.scenario === 'a') row.sdlHash = '9'.repeat(64);
      },
    },
    {
      name: 'host memory',
      update: (row) => {
        object(row.environment).totalMemory = 42;
      },
    },
  ];
  for (const mutation of mutations)
    await t.test(mutation.name, (subtest) => {
      const run = fixture(subtest);
      run.localPaths.forEach((path) => edit(path, mutation.update));
      preflight(run.scoped);
      assert.throws(() => compareLocal([run.stock, run.scoped], run.output));
      assert.equal(existsSync(run.output), false);
      assert.equal(existsSync(join(run.stock, 'verification.json')), false);
      assert.equal(existsSync(join(run.scoped, 'verification.json')), false);
    });
});

test('memory comparison preserves recorded implementation paths from before the plugins move', (t) => {
  const run = fixture(t);
  for (const path of run.localPaths)
    edit(path, (row) => {
      const implementation = object(
        object(row.environment).localImplementation,
      );
      for (const key of ['pluginPath', 'scopedPath'])
        implementation[key] = string(implementation[key]).replace(
          '/dist/plugins/',
          '/dist/',
        );
    });
  const before = run.localPaths.map((path) => readFileSync(path, 'utf8'));
  compareLocal([run.stock, run.scoped], run.output);
  assert.deepEqual(
    run.localPaths.map((path) => readFileSync(path, 'utf8')),
    before,
  );
});

test('memory comparison requires complete selected workers, unique processes, and correct activation', async (t) => {
  const cases: {
    name: string;
    change: (run: ReturnType<typeof fixture>) => void;
  }[] = [
    {
      name: 'missing repetition',
      change: (run) => rmSync(join(run.scoped, 'a-1-r3.json')),
    },
    {
      name: 'extra scenario',
      change: (run) =>
        save(
          join(run.scoped, 'c-10-r1.json'),
          readJson(join(run.scoped, 'a-1-r1.json')),
        ),
    },
    {
      name: 'duplicate process across groups',
      change: (run) =>
        edit(join(run.scoped, 'a-1-r1.json'), (row) => {
          object(row.environment).pid = 10_000;
        }),
    },
    {
      name: 'disabled local activation',
      change: (run) =>
        edit(join(run.scoped, 'a-1-r1.json'), (row) => {
          object(row.comparisonActivation).scoped = false;
        }),
    },
    {
      name: 'unexpected implementation location',
      change: (run) => {
        for (const path of run.localPaths)
          edit(path, (row) => {
            object(object(row.environment).localImplementation).pluginPath =
              '/unexpected/PgIntrospectionPlugin.js';
          });
      },
    },
    {
      name: 'forged incremental heap',
      change: (run) =>
        edit(join(run.scoped, 'a-1-r1.json'), (row) => {
          row.heapDelta = 1;
        }),
    },
    {
      name: 'preflight after measurement',
      change: (run) =>
        edit(join(run.scoped, 'preflight.json'), (row) => {
          row.recordedAt = '2001-01-01T00:00:00.000Z';
        }),
    },
    {
      name: 'preflight checkout',
      change: (run) =>
        edit(join(run.scoped, 'preflight.json'), (row) => {
          row.crystal = {};
        }),
    },
  ];
  for (const entry of cases)
    await t.test(entry.name, (subtest) => {
      const run = fixture(subtest);
      entry.change(run);
      assert.throws(() => compareLocal([run.stock, run.scoped], run.output));
      assert.equal(existsSync(run.output), false);
    });
});

test('memory comparison preserves review-only provenance and rejects full-matrix input', (t) => {
  const run = fixture(t, true);
  assert.throws(
    () => compareLocal([run.stock, run.scoped], run.output),
    /uncommitted/,
  );
  compareLocal([run.stock, run.scoped], run.output, true);
  const receipt = object(
    readJson(join(run.output, 'comparison-verification.json')),
  );
  assert.equal(receipt.status, 'review-only');
  assert.equal(receipt.sourceDirty, true);
  assert.match(
    readFileSync(join(run.output, 'COMPARISON.md'), 'utf8'),
    /Review-only/,
  );
  const other = join(run.output, 'all');
  writeSyntheticResults(other, 'all');
  assert.throws(() =>
    compareLocal([other, run.scoped], join(run.output, 'rejected')),
  );
});
