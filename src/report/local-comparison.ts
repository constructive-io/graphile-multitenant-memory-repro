import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { projectPath } from '../paths.js';
import { object, string, number, readJson } from '../json.js';
import { readSample } from './read.js';
import { verifyResults } from './verify-results.js';
import type { WorkerResult } from '../benchmark/results.js';

export function compareLocal(
  names: string[],
  output: string,
  review = false,
): void {
  assert.equal(
    names.length,
    2,
    'Pass stock and local-scoped result directories',
  );
  assert(output, 'Pass a new output directory');
  mkdirSync(output, { recursive: true });
  const profiles = ['stock', 'local-scoped'];
  const groups = names.map((name, index) => {
    const dir = projectPath('results', name);
    const verification = verifyResults(
      name,
      resolve(output, `${profiles[index]}-verification.json`),
      review,
    );
    assert.equal(verification.comparisonProfile, profiles[index]);
    assert.equal(
      verification.crystal,
      null,
      'Standalone runs must use registry dependencies',
    );
    const samples = readdirSync(dir)
      .filter((n) => /^(a|b|c|d|rotation)-\d+-r\d+\.json$/.test(n))
      .sort()
      .map((n) => readSample(`${dir}/${n}`));
    const receipt = object(readJson(`${dir}/preflight.json`));
    assert.equal(receipt.status, verification.status);
    assert.equal(receipt.profile, profiles[index]);
    assert.equal(receipt.testExitCode, 0);
    assert.equal(receipt.sourceDirty, verification.sourceDirty);
    assert.equal(receipt.provenanceUnchanged, true);
    assert.equal(receipt.sourceUnchanged, true);
    assert.equal(receipt.benchmarkSha, verification.sourceSha);
    assert.deepEqual(receipt.build, samples[0].environment.build);
    assert.deepEqual(receipt.dependencies, verification.dependencies);
    const firstMeasurement = Math.min(
      ...samples.map((s) => Date.parse(s.environment.recordedAt)),
    );
    assert(
      Date.parse(string(receipt.recordedAt)) <= firstMeasurement,
      'Tests must precede measured workers',
    );
    for (const sample of samples) {
      assert.equal(sample.comparisonActivation.profile, profiles[index]);
      assert.equal(sample.comparisonActivation.scoped, index === 1);
      assert.equal(sample.comparisonActivation.localPlugin, index === 1);
      assert.equal(sample.comparisonActivation.pluginPresent, false);
      assert.equal(
        sample.comparisonActivation.catalogTypes,
        index === 1 ? 'all' : null,
      );
      assert.deepEqual(sample.comparisonActivation.capabilityExtensions, []);
      if (index === 1) {
        assert(sample.environment.localImplementation);
        assert.equal(
          sample.environment.localImplementation.upstreamSha,
          '434a1f6deddda7786fa2497ad30ca01d598135a1',
        );
        assert(
          sample.environment.localImplementation.pluginPath.endsWith(
            '/dist/graphile-build/graphile-build-pg/src/plugins/PgIntrospectionPlugin.js',
          ),
        );
        assert(
          sample.environment.localImplementation.scopedPath.endsWith(
            '/dist/utils/pg-introspection/src/scopedIntrospection.js',
          ),
        );
      } else assert.equal(sample.environment.localImplementation, undefined);
    }
    return { name, verification, samples };
  });
  const [stock, local] = groups;
  for (const key of [
    'sourceSha',
    'sourceDirty',
    'matrix',
    'dependencies',
    'postgresSettings',
    'sdlHash',
  ] as const)
    assert.deepEqual(
      stock.verification[key],
      local.verification[key],
      `Profile mismatch: ${key}`,
    );
  const reference = stock.samples[0].environment;
  for (const group of groups)
    for (const sample of group.samples) {
      for (const key of [
        'build',
        'node',
        'v8',
        'postgres',
        'platform',
        'arch',
        'cpuModel',
        'cpus',
        'quietMs',
        'gcPasses',
        'nodeEnv',
        'graphileEnv',
        'dependencies',
      ] as const)
        assert.deepEqual(
          sample.environment[key],
          reference[key],
          `Environment mismatch: ${key}`,
        );
    }
  const allPids = groups.flatMap((g) =>
    g.samples.map((s) => s.environment.pid),
  );
  assert(!allPids.includes(undefined));
  assert.equal(
    new Set(allPids).size,
    84,
    'Every worker must be a fresh process',
  );
  const median = (values: number[]) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const rows: {
    scenario: string;
    value: number;
    stock: Record<string, number>;
    local: Record<string, number>;
  }[] = [];
  const metrics = (samples: WorkerResult[]) => ({
    heapMiB: median(samples.map((s) => s.retained.heapUsed)) / 2 ** 20,
    baselineMiB: median(samples.map((s) => s.baseline.heapUsed)) / 2 ** 20,
    heapDeltaMiB:
      median(
        samples.map((s) =>
          'heapDelta' in s
            ? s.heapDelta
            : s.retained.heapUsed - s.baseline.heapUsed,
        ),
      ) /
      2 ** 20,
    rssMiB: median(samples.map((s) => s.retained.rss)) / 2 ** 20,
    releaseDeltaMiB:
      median(
        samples.map((s) => s.afterRelease.heapUsed - s.baseline.heapUsed),
      ) /
      2 ** 20,
    gcMedianMs: median(samples.map((s) => median(s.retained.gcPausesMs))),
    buildMs: median(samples.map((s) => ('buildMs' in s ? s.buildMs : 0))),
  });
  for (const [scenario, values] of Object.entries(stock.verification.matrix))
    for (const value of values) {
      rows.push({
        scenario,
        value,
        stock: metrics(
          stock.samples.filter(
            (s) => s.scenario === scenario && s.value === value,
          ),
        ),
        local: metrics(
          local.samples.filter(
            (s) => s.scenario === scenario && s.value === value,
          ),
        ),
      });
    }
  const reviewOnly = stock.verification.sourceDirty;
  const lines = [
    '# Registry stock versus local scoped introspection',
    '',
    reviewOnly
      ? '**Review-only: uncommitted source.** These fresh observations retain sourceDirty=true and their exact source/emitted build hashes. They do not satisfy the default clean-source acceptance gate.'
      : 'Fresh full matrices from committed source.',
    '',
    `84 independent workers, three repetitions per point, 12 separate snapshot analyses. Source base commit: \`${stock.verification.sourceSha}\`; source content hash: \`${reference.build?.sourceSha256}\`.`,
    '',
    'The registry dependency graph is identical in both groups. Stock uses the original Amber introspection plugin; local-scoped replaces that plugin with this repository’s PR2 adaptation, catalogTypes=all, no capability extensions. Historical checkout measurements are not evidence for this local implementation.',
    '',
    `Detailed reports: [stock](./${relative(output, projectPath('results', stock.name, 'REPORT.md'))}), [local scoped](./${relative(output, projectPath('results', local.name, 'REPORT.md'))}).`,
    '',
    '| Scenario | Point | Stock / local retained MiB | Stock / local incremental MiB | Stock / local RSS MiB | Stock / local build ms | Stock / local GC median ms |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (r) =>
        `| ${r.scenario} | ${r.value} | ${r.stock.heapMiB.toFixed(2)} / ${r.local.heapMiB.toFixed(2)} | ${r.stock.heapDeltaMiB.toFixed(2)} / ${r.local.heapDeltaMiB.toFixed(2)} | ${r.stock.rssMiB.toFixed(2)} / ${r.local.rssMiB.toFixed(2)} | ${r.stock.buildMs.toFixed(2)} / ${r.local.buildMs.toFixed(2)} | ${r.stock.gcMedianMs.toFixed(2)} / ${r.local.gcMedianMs.toFixed(2)} |`,
    ),
    '',
    'D is diagnostic: snapshots perturb release measurements and are excluded from ordinary release comparisons. A zero build time means that scenario does not record build timing. C incremental heap includes operation ASTs, SQL, plans and cache overhead; it is not a pure plan-object size. Timing, RSS and GC are environment-sensitive; three-run medians are not confidence intervals. Release deltas and every raw metric remain in the individual reports and local-metrics.json.',
    '',
  ];
  writeFileSync(resolve(output, 'COMPARISON.md'), lines.join('\n'));
  writeFileSync(
    resolve(output, 'local-metrics.json'),
    JSON.stringify(rows, null, 2) + '\n',
  );
  writeFileSync(
    resolve(output, 'comparison-verification.json'),
    JSON.stringify(
      {
        status: reviewOnly ? 'review-only' : 'passed',
        reviewOnly,
        workers: number(allPids.length),
        build: reference.build,
        groups: groups.map((g) => g.verification),
      },
      null,
      2,
    ) + '\n',
  );
}
