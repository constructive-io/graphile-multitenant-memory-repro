import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tenantSql } from '../src/fixture/tenant.js';
import { hiddenDependenciesSql } from '../src/fixture/hidden.js';
import {
  pointsFor,
  parseSelection,
  scenarioOrder,
  selectScenarios,
  scenarios,
  validatePoint,
} from '../src/benchmark/scenarios.js';
import { workerEnvironment } from '../src/benchmark/process.js';
import { cliPath, projectRoot } from '../src/paths.js';
import { verifiedBuild } from '../src/measurement/build.js';
import { readSample } from '../src/report/read.js';
import { syntheticIdentity, syntheticSample } from './helpers/results.js';

test('scenario registration selects 21 memory workers and preserves optional matrices', () => {
  assert.equal(parseSelection('memory'), 'memory');
  assert.deepEqual(selectScenarios('memory'), ['a', 'b']);
  assert.equal(
    selectScenarios('memory').flatMap((kind) => pointsFor(kind, {})).length * 3,
    21,
  );
  assert.deepEqual(pointsFor('a', {}), [1, 20, 60, 150]);
  assert.deepEqual(pointsFor('b', {}), [1, 10, 50]);
  assert.deepEqual(selectScenarios('all'), ['a', 'b', 'rotation', 'c', 'd']);
  assert.deepEqual(selectScenarios('b'), ['b', 'rotation']);
  assert.equal(
    scenarioOrder.flatMap((kind) => pointsFor(kind, {})).length * 3,
    42,
  );
  assert.equal(scenarios.a.totalTenants(150), 151);
  assert.equal(scenarios.b.totalTenants(50), 60);
  assert.equal(scenarios.rotation.capacity(10), 10);
  assert.equal(scenarios.c.operationsCacheMaxLength(5000), 5100);
  assert.deepEqual(pointsFor('a', { BENCH_A: '1,20' }), [1, 20]);
  assert.throws(() => pointsFor('a', { BENCH_A: '1,invalid' }));
  assert.throws(() => validatePoint('b', 61));
  assert.throws(() => validatePoint('rotation', 1));
});
test('compiled worker paths and isolated production environment', () => {
  assert(cliPath('worker').startsWith(`${projectRoot}/dist/src/cli/`));
  const env = workerEnvironment();
  assert.equal(env.NODE_ENV, 'production');
  assert.equal(env.GRAPHILE_ENV, 'production');
  for (const key of Object.keys(env))
    assert(
      [
        'PATH',
        'NODE_ENV',
        'GRAPHILE_ENV',
        'BENCH_PG_PORT',
        'BENCH_DATABASE_URL',
        'BENCH_PROFILE',
      ].includes(key),
    );
  const build = verifiedBuild();
  assert.match(build.sourceSha256, /^[0-9a-f]{64}$/);
  assert.match(build.emittedSha256, /^[0-9a-f]{64}$/);
});
test('synthetic SQL stays byte-equivalent to source 4221f1f for all supported tenant fixtures', () => {
  // Captured from the original generator, before any TypeScript changes.
  const hash = createHash('sha256');
  for (let index = 0; index < 1000; index++) hash.update(tenantSql(index));
  assert.equal(
    hash.digest('hex'),
    '33afef0a027ecea0c22c3232841aa121d7069fddb7820025b8e10fa14b61bda1',
  );
  assert.equal(
    createHash('sha256').update(hiddenDependenciesSql).digest('hex'),
    '79436ee1f26613fc3fd8cf56412e0ee69e7cb6867e912dc914de831444235f20',
  );
});
test('legacy-format parsing preserves supplied identity without inventing build metadata', () => {
  const directory = mkdtempSync(join(tmpdir(), 'graphile-synthetic-legacy-'));
  try {
    const path = join(directory, 'a-1-r1.json');
    writeFileSync(
      path,
      JSON.stringify(syntheticSample('a', 1, 0, { legacy: true })),
    );
    const sample = readSample(path);
    assert.equal(sample.environment.gitSha, syntheticIdentity.gitSha);
    assert.equal(sample.environment.build, undefined);
    assert.equal(sample.environment.pid, undefined);
  } finally {
    rmSync(directory, { recursive: true });
  }
});
