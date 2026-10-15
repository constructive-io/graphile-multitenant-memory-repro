import assert from 'node:assert/strict';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { readSample, readAnalysis } from './read.js';
import { object, array, string, readJson } from '../json.js';
import { projectPath } from '../paths.js';
import { scenarios, selectScenarios } from '../benchmark/scenarios.js';
import type { MatrixSelection } from '../benchmark/scenarios.js';
export function verifyResults(
  run: string,
  output?: string | false,
  review = false,
  selection?: MatrixSelection,
) {
  const dir = projectPath('results', run);
  if (selection === undefined) {
    const available = (['all', 'memory'] as const).filter((kind) =>
      existsSync(`${dir}/manifest-${kind}.json`),
    );
    assert.equal(
      available.length,
      1,
      'Expected exactly one all or memory manifest; select --matrix explicitly when both exist',
    );
    selection = available[0];
  }
  const manifest = object(readJson(`${dir}/manifest-${selection}.json`));
  assert.equal(
    manifest.status,
    'complete',
    'Acceptance requires a completed matrix manifest',
  );
  assert.equal(manifest.scenario, selection, 'Manifest selection mismatch');
  assert.equal(manifest.repeats, 3);
  const selected = selectScenarios(selection);
  assert.deepEqual(array(manifest.selected).map(string), selected);
  const expected = Object.fromEntries(
    selected.map((kind) => [kind, [...scenarios[kind].points]]),
  );
  const expectedNames = Object.entries(expected)
    .flatMap(([kind, values]) =>
      values.flatMap((value) =>
        [1, 2, 3].map((r) => `${kind}-${value}-r${r}.json`),
      ),
    )
    .sort();
  assert.deepEqual(array(manifest.points).map(string).sort(), expectedNames);
  const files = readdirSync(dir)
    .filter(
      (n) =>
        /^(a|b|c|d|rotation)-.*\.json$/.test(n) &&
        !n.endsWith('.analysis.json'),
    )
    .sort();
  assert.deepEqual(files, expectedNames);
  const samples = files.map((n) => readSample(`${dir}/${n}`));
  const first = samples[0].environment;
  for (const [i, r] of samples.entries()) {
    const identity = files[i].match(/^(a|b|c|d|rotation)-(\d+)-r(\d+)\.json$/);
    assert(identity);
    assert.equal(r.scenario, identity[1], `${files[i]}: scenario`);
    assert.equal(r.value, Number(identity[2]), `${files[i]}: value`);
    assert.equal(r.environment.sourceDirty, first.sourceDirty, files[i]);
    assert(
      review || !r.environment.sourceDirty,
      `${files[i]}: uncommitted results require --review`,
    );
    assert.equal(r.environment.gitSha, first.gitSha);
    for (const key of [
      'node',
      'v8',
      'postgres',
      'postgresSettings',
      'dependencies',
      'crystal',
      'comparisonProfile',
      'localImplementation',
      'nodeEnv',
      'graphileEnv',
      'quietMs',
      'gcPasses',
    ] as const)
      assert.deepEqual(r.environment[key], first[key], `${files[i]}: ${key}`);
    assert.equal(r.environment.quietMs, 5500);
    assert.equal(r.environment.nodeEnv, 'production');
    assert.equal(r.statsAfter.builds, r.statsAfter.releases);
    assert.equal(r.baseline.gcPausesMs.length, 3);
    assert.equal(r.retained.gcPausesMs.length, 3);
    if (selection === 'memory') {
      assert(r.scenario === 'a' || r.scenario === 'b');
      assert.equal(r.environment.graphileEnv, 'production');
      assert.equal(r.environment.gcPasses, 3);
      assert.deepEqual(r.warmup, { instances: 1, requests: 5 });
      assert.equal(r.capacity, scenarios[r.scenario].capacity(r.value));
      assert.equal(r.afterRelease.gcPausesMs.length, 3);
      assert.equal(r.heapDelta, r.retained.heapUsed - r.baseline.heapUsed);
      if (r.scenario === 'b')
        assert.equal(r.heapPerInstance, r.heapDelta / r.value);
      assert.equal(r.statsLoaded.builds - r.statsLoaded.releases, r.capacity);
      assert.equal(r.statsAfter.builds, r.statsLoaded.builds);
      assert.equal(r.statsAfter.releases, r.statsLoaded.releases + r.capacity);
    }
    for (const key of ['heapUsed', 'rss', 'peakRssBytes'] as const)
      assert(Number.isFinite(r.retained[key]) && r.retained[key] > 0);
    if (r.scenario === 'a' || r.scenario === 'd')
      assert.equal(r.totalTenants, r.value + 1);
    if (r.scenario === 'b') {
      assert.equal(r.totalTenants, 60);
      assert.equal(r.loadedInstances, r.value);
    }
    if (r.scenario === 'c') {
      assert.equal(r.cacheBefore.plans, 1);
      assert.equal(r.cacheAfter.plans, r.value + 1);
      assert.equal(r.cacheAfter.operations, r.value + 1);
      assert.equal(r.cacheAfter.capacity, r.value + 100);
      assert.equal(r.cacheAfter.errors, 0);
    }
    if (r.scenario === 'rotation') {
      assert.equal(r.rounds.length, 5);
      for (const [j, round] of r.rounds.entries()) {
        assert.equal(round.size, 10);
        assert.equal(round.completedBuilds, (j + 1) * 60);
        assert.equal(round.stats.builds - round.stats.releases, 10);
        assert.equal(round.stats.builds - r.statsBefore.builds, (j + 1) * 60);
      }
    }
    if (r.scenario === 'd') {
      const analysis = readAnalysis(`${dir}/${files[i]}.analysis.json`);
      assert.match(analysis.sha256, /^[0-9a-f]{64}$/);
      assert(
        analysis.nodeCount >= analysis.reachable && analysis.reachable > 0,
      );
      assert(analysis.constructors.length > 0);
      assert(Array.isArray(analysis.signatures));
    }
  }
  const processIds = samples.flatMap((row) =>
    row.environment.pid === undefined ? [] : [row.environment.pid],
  );
  if (selection === 'memory' || processIds.length) {
    assert.equal(
      processIds.length,
      samples.length,
      'Do not mix historical and new worker formats',
    );
    assert.equal(
      new Set(processIds).size,
      samples.length,
      'Each sample must have an independent worker PID',
    );
    for (const row of samples) {
      assert.deepEqual(row.environment.execArgv, [
        '--expose-gc',
        '--max-old-space-size=10000',
      ]);
      assert.deepEqual(
        row.environment.build,
        first.build,
        'All workers must run the same compiled source',
      );
      assert(row.environment.build, 'Missing compiled build receipt');
    }
  }
  const hashes = [
    ...new Set(
      samples.flatMap((r) =>
        r.scenario === 'a' || r.scenario === 'd' ? [r.sdlHash] : [],
      ),
    ),
  ];
  assert.equal(hashes.length, 1, 'SDL must be invariant in measured A and D');
  const verification = {
    status: first.sourceDirty ? 'review-only' : 'passed',
    ...(first.sourceDirty ? { reviewOnly: true } : {}),
    sourceSha: first.gitSha,
    sourceDirty: first.sourceDirty,
    selection,
    workers: samples.length,
    repetitions: 3,
    matrix: expected,
    sdlHash: hashes[0],
    postgresSettings: first.postgresSettings,
    dependencies: Object.fromEntries(
      Object.entries(first.dependencies).map(([k, v]) => [k, v.version]),
    ),
    crystal: first.crystal,
    comparisonProfile: first.comparisonProfile ?? 'stock',
  };
  if (output !== false) {
    writeFileSync(
      output ?? `${dir}/verification.json`,
      JSON.stringify(verification, null, 2) + '\n',
    );
    console.log(JSON.stringify(verification, null, 2));
  }

  return verification;
}
