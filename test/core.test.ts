import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TenantLRU } from '../src/runtime/lru.js';
import { assertSyntheticDatabase, tenantName } from '../src/runtime/config.js';
import { readJson, object, string } from '../src/json.js';
import { projectPath } from '../src/paths.js';
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// Each dependency path is checked on its own, so a failure in one cannot hide the others.
test('default manifest: private, exact minimal runtime dependencies', () => {
  const p = object(readJson(projectPath('package.json')));
  assert.equal(p.private, true);
  assert.equal(p.license, 'MIT');
  assert.deepEqual(Object.keys(object(p.dependencies)).sort(), [
    'express',
    'pg',
    'postgraphile',
  ]);
  for (const v of Object.values(object(p.dependencies)))
    assert.match(string(v), /^\d+\.\d+\.\d+$/);
});
test('upstream snapshot manifest: one exact prerelease graph, narrowly exempted', () => {
  const p = object(readJson(projectPath('upstream-snapshot/package.json')));
  assert.equal(p.private, true);
  assert.equal(p.license, 'MIT');
  const deps = object(p.dependencies);
  assert.deepEqual(Object.keys(deps).sort(), [
    '@dataplan/pg',
    'grafast',
    'graphile-build',
    'graphile-build-pg',
    'graphile-utils',
    'pg',
    'pg-introspection',
    'postgraphile',
  ]);
  // The adaptor's pg matches the default graph; every Graphile package is pinned
  // to the same upstream snapshot build.
  const rootDeps = object(
    object(readJson(projectPath('package.json'))).dependencies,
  );
  assert.equal(string(deps.pg), string(rootDeps.pg));
  const stamps = new Set<string>();
  const exact: string[] = [];
  for (const [name, value] of Object.entries(deps)) {
    if (name === 'pg') continue;
    const version = string(value);
    const match = /^\d+\.\d+\.\d+-[a-z]+\.next-(\d{14})$/.exec(version);
    assert(match, `${name}@${version} must be an exact upstream snapshot`);
    stamps.add(match[1]);
    exact.push(`${name}@${version}`);
  }
  assert.equal(stamps.size, 1, 'All Graphile packages must share one snapshot');
  // Only these exact releases may skip pnpm's minimum release age check.
  const workspace = readFileSync(
    projectPath('upstream-snapshot/pnpm-workspace.yaml'),
    'utf8',
  );
  const exempt = [...workspace.matchAll(/^ {2}- "(.+)"$/gm)].map((m) => m[1]);
  assert.deepEqual(exempt.sort(), exact.sort());
});
test('database guard and tenant names', () => {
  assert.throws(() =>
    assertSyntheticDatabase(
      'postgres://bench_admin:x@remote/graphile_memory_bench',
    ),
  );
  assert.throws(() =>
    assertSyntheticDatabase('postgres://bench_admin:x@localhost/production'),
  );
  assert.throws(() =>
    assertSyntheticDatabase(
      'postgres://bench_admin:x@localhost/graphile_memory_bench?host=remote',
    ),
  );
  assert.throws(() =>
    assertSyntheticDatabase(
      'socket://bench_admin:x@localhost/graphile_memory_bench',
    ),
  );
  assert.throws(() => tenantName(-1));
});
test('coalesces concurrent first builds and waits for leases plus asynchronous release', async () => {
  const released: string[] = [];
  const cache = new TenantLRU(1, async (key) => {
    await pause(5);
    return {
      key,
      release: async () => {
        await pause(10);
        released.push(key);
      },
    };
  });
  const leases = await Promise.all(
    Array.from({ length: 10 }, () => cache.acquire('a')),
  );
  assert.equal(cache.stats.builds, 1);
  let completed = false;
  const waiting = cache.acquire('b').then((lease) => {
    completed = true;
    return lease;
  });
  await pause(10);
  assert.equal(completed, false);
  for (const lease of leases) lease.done();
  const b = await waiting;
  assert.deepEqual(released, ['a']);
  b.done();
  await cache.close();
  assert.deepEqual(released, ['a', 'b']);
  assert.equal(cache.entries.size, 0);
  await assert.rejects(cache.acquire('c'), /closed/);
});
test('failed build does not poison future builds or close', async () => {
  let attempt = 0;
  const cache = new TenantLRU(1, async () => {
    if (!attempt++) throw new Error('synthetic failure');
    return { release: async () => {} };
  });
  await assert.rejects(cache.acquire('a'), /synthetic/);
  await cache.use('a', async () => {});
  assert.equal(cache.stats.builds, 1);
  await cache.close();
});
