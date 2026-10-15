import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  unlinkSync,
} from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cliPath } from '../src/paths.js';
import { verifyResults } from '../src/report/verify-results.js';
import { object, array } from '../src/json.js';
import type { MatrixSelection } from '../src/benchmark/scenarios.js';
import { writeSyntheticResults } from './helpers/results.js';
import type { SyntheticResultOptions } from './helpers/results.js';

function withResults(
  action: (
    directory: string,
    fixture: ReturnType<typeof writeSyntheticResults>,
  ) => void,
  selection: MatrixSelection = 'memory',
  options: SyntheticResultOptions = {},
) {
  const directory = mkdtempSync(join(tmpdir(), 'graphile-synthetic-results-'));
  try {
    action(directory, writeSyntheticResults(directory, selection, options));
  } finally {
    rmSync(directory, { recursive: true });
  }
}
function editJson(
  path: string,
  mutate: (row: Record<string, unknown>) => void,
) {
  const row = object(JSON.parse(readFileSync(path, 'utf8')));
  mutate(row);
  writeFileSync(path, JSON.stringify(row));
}

test('memory verification accepts exactly 21 workers by inferred or explicit selection', () => {
  withResults((directory) => {
    const inferred = verifyResults(directory, false);
    const explicit = verifyResults(directory, false, false, 'memory');
    assert.deepEqual(inferred, explicit);
    assert.equal(inferred.status, 'passed');
    assert.equal(inferred.selection, 'memory');
    assert.equal(inferred.workers, 21);
    assert.deepEqual(inferred.matrix, {
      a: [1, 20, 60, 150],
      b: [1, 10, 50],
    });
    assert.equal(existsSync(join(directory, 'verification.json')), false);
  });
});
test('optional full verification still accepts 42 workers and snapshot analyses', () => {
  withResults((directory) => {
    const verification = verifyResults(directory, false);
    assert.equal(verification.selection, 'all');
    assert.equal(verification.workers, 42);
    assert.deepEqual(Object.keys(verification.matrix), [
      'a',
      'b',
      'rotation',
      'c',
      'd',
    ]);
  }, 'all');
});
test('uncommitted results cannot pass default acceptance and retain truthful review provenance', () => {
  withResults(
    (directory) => {
      const output = join(directory, 'review-verification.json');
      assert.throws(
        () => verifyResults(directory, output),
        /uncommitted results require --review/,
      );
      assert.equal(existsSync(output), false);
      const verification = verifyResults(directory, output, true);
      assert.equal(verification.status, 'review-only');
      assert.equal(verification.sourceDirty, true);
      assert.equal(verification.workers, 21);
      assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')), verification);
    },
    'memory',
    { sourceDirty: true },
  );
});

for (const [name, mutate] of [
  ['incomplete status', (row) => (row.status = 'running')],
  ['wrong selection', (row) => (row.scenario = 'all')],
  ['wrong repetition count', (row) => (row.repeats = 2)],
  ['extra scenario', (row) => (row.selected = ['a', 'b', 'rotation'])],
  ['missing point', (row) => array(row.points).pop()],
  ['duplicate point', (row) => array(row.points).push(array(row.points)[0])],
] satisfies [string, (row: Record<string, unknown>) => unknown][]) {
  test(`memory verification rejects a manifest with ${name}`, () => {
    withResults((directory, fixture) => {
      editJson(fixture.manifestPath, mutate);
      assert.throws(() => verifyResults(directory, false));
    });
  });
}
test('memory verification requires a manifest and unambiguous inference', () => {
  withResults((directory, fixture) => {
    const manifest = readFileSync(fixture.manifestPath);
    unlinkSync(fixture.manifestPath);
    assert.throws(() => verifyResults(directory, false), /one all or memory/);
    writeFileSync(fixture.manifestPath, manifest);
    writeFileSync(join(directory, 'manifest-all.json'), manifest);
    assert.throws(() => verifyResults(directory, false), /select --matrix/);
    assert.equal(verifyResults(directory, false, false, 'memory').workers, 21);
  });
});
for (const extra of ['b-50-r4.json', 'rotation-10-r1.json', 'a-invalid.json']) {
  test(`memory verification rejects extra sample ${extra}`, () => {
    withResults((directory, fixture) => {
      writeFileSync(
        join(directory, extra),
        readFileSync(fixture.samplePaths[0]),
      );
      assert.throws(() => verifyResults(directory, false));
    });
  });
}
test('memory verification rejects a missing sample', () => {
  withResults((directory, fixture) => {
    unlinkSync(fixture.samplePaths[0]);
    assert.throws(() => verifyResults(directory, false));
  });
});
for (const [name, mutate] of [
  ['mismatched scenario', (row) => (row.scenario = 'd')],
  ['mismatched point', (row) => (row.value = 2)],
  ['different source', (row) => (object(row.environment).gitSha = 'different')],
  ['different runtime', (row) => (object(row.environment).node = 'different')],
  [
    'different dependency',
    (row) =>
      (object(
        object(object(row.environment).dependencies).postgraphile,
      ).version = 'different'),
  ],
  ['duplicate PID', (row) => (object(row.environment).pid = 10_000)],
  ['missing PID', (row) => delete object(row.environment).pid],
  ['missing build receipt', (row) => delete object(row.environment).build],
  [
    'different compiled source',
    (row) => (object(object(row.environment).build).sourceSha256 = 'different'),
  ],
  [
    'different process flags',
    (row) => (object(row.environment).execArgv = ['--expose-gc']),
  ],
  ['different SDL', (row) => (row.sdlHash = 'different')],
] satisfies [string, (row: Record<string, unknown>) => unknown][]) {
  test(`memory verification rejects ${name}`, () => {
    withResults((directory, fixture) => {
      editJson(fixture.samplePaths[1], mutate);
      assert.throws(() => verifyResults(directory, false));
    });
  });
}
test('memory verification requires independent-worker metadata in every sample', () => {
  withResults(
    (directory) => {
      assert.throws(
        () => verifyResults(directory, false),
        /Do not mix historical and new worker formats/,
      );
    },
    'memory',
    { legacy: true },
  );
});
for (const [name, mutate] of [
  [
    'non-production Graphile environment',
    (row) => (object(row.environment).graphileEnv = 'development'),
  ],
  ['wrong GC pass count', (row) => (object(row.environment).gcPasses = 2)],
  ['wrong warmup', (row) => (object(row.warmup).requests = 4)],
  ['wrong capacity', (row) => (row.capacity = 2)],
  [
    'missing release GC passes',
    (row) => (object(row.afterRelease).gcPausesMs = []),
  ],
  ['incorrect heap delta', (row) => (row.heapDelta = 0)],
  [
    'incorrect B per-instance heap',
    (row) => {
      if (row.scenario === 'b') row.heapPerInstance = 0;
    },
  ],
  [
    'incorrect retained instance count',
    (row) =>
      (object(row.statsLoaded).releases = object(row.statsLoaded).builds),
  ],
  [
    'extra builds after release',
    (row) => {
      object(row.statsAfter).builds = 1000;
      object(row.statsAfter).releases = 1000;
    },
  ],
] satisfies [string, (row: Record<string, unknown>) => unknown][]) {
  test(`memory verification rejects ${name}`, () => {
    withResults((directory, fixture) => {
      for (const path of fixture.samplePaths) editJson(path, mutate);
      assert.throws(() => verifyResults(directory, false));
    });
  });
}
test('verification CLI accepts memory flags and rejects malformed options', () => {
  withResults((directory) => {
    execFileSync(process.execPath, [
      cliPath('verify-results'),
      directory,
      '--matrix',
      'memory',
    ]);
    const verification = object(
      JSON.parse(readFileSync(join(directory, 'verification.json'), 'utf8')),
    );
    assert.equal(verification.workers, 21);
    assert.equal(verification.selection, 'memory');
    for (const args of [
      ['--matrix'],
      ['--matrix', 'a'],
      ['--unknown'],
      ['--matrix', 'memory', '--matrix', 'memory'],
    ]) {
      const result = spawnSync(process.execPath, [
        cliPath('verify-results'),
        directory,
        ...args,
      ]);
      assert.notEqual(result.status, 0);
    }
  });
});
