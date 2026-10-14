import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { resetFixture } from '../src/fixture/index.js';
import { startServer } from '../src/runtime/server.js';
import {
  graphqlRequest,
  checkedRequest,
  smokeData,
} from '../src/benchmark/client.js';
import { cacheCounts, planQuery } from '../src/measurement/cache-probe.js';
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate: () => boolean | Promise<boolean>) {
  for (let i = 0; i < 200; i++) {
    if (await predicate()) return;
    await pause(10);
  }
  throw new Error('Condition timed out');
}

test('real HTTP: cross-schema dependencies, RLS, cache, invalidation and active eviction', async (t) => {
  await resetFixture(3);
  const server = await startServer({
    capacity: 2,
    totalTenants: 3,
    operationsCacheMaxLength: 1200,
  });
  t.after(() => server.close());
  assert.equal(server.cache.stats.builds, 0);
  await t.test(
    'lazy coalescing and concurrent tenant/user isolation',
    async () => {
      const results = await Promise.all(
        Array.from({ length: 16 }, (_, i) =>
          checkedRequest(
            server.port,
            `tenant_00${i % 2}`,
            undefined,
            String(((i >> 1) % 2) + 1),
          ),
        ),
      );
      for (let i = 0; i < results.length; i++) {
        const tenant = `tenant_00${i % 2}`;
        const user = ((i >> 1) % 2) + 1;
        const data = smokeData(results[i]);
        assert.equal(data.requestIdentity, `bench_reader:${tenant}:${user}`);
        assert.equal(data.allTasks.nodes.length, 1);
        assert.equal(data.allTasks.nodes[0].ownerId, user);
        assert.equal(data.allTasks.nodes[0].tenantKey, tenant);
        assert.equal(data.allTasks.nodes[0].priority, 'normal');
        assert.deepEqual(data.allTasks.nodes[0].scoreWindow, {
          start: { value: 1 },
          end: { value: 9 },
        });
        assert.deepEqual(data.allTasks.nodes[0].scores, [1, 2]);
        assert.equal(data.allInheritedRecords.nodes[0].ownerId, user);
        assert.equal(data.echoScore, 17);
        assert.equal(data.echoMood, 'calm');
      }
      assert.equal(server.cache.stats.builds, 2);
      const range = await checkedRequest(
        server.port,
        'tenant_000',
        '{ echoWindow(value: {start: {value: 2, inclusive: true}, end: {value: 8, inclusive: false}}) { start { value inclusive } end { value inclusive } } }',
      );
      assert.deepEqual(range.echoWindow, {
        start: { value: 2, inclusive: true },
        end: { value: 8, inclusive: false },
      });
      await server.cache.use('tenant_000', async ({ schema }) => {
        const queryType = schema.getQueryType();
        assert(queryType);
        const fields = queryType.getFields();
        assert(
          !fields.allPriorities && !fields.allRecordBases,
          'Hidden tables must not be exposed as roots',
        );
        assert(schema.getType('BenchTypesPriority'));
      });
      assert.equal(
        (await graphqlRequest(server.port, 'unknown', '{requestIdentity}'))
          .status,
        404,
      );
      assert.equal(
        (
          await graphqlRequest(
            server.port,
            'tenant_000',
            '{requestIdentity}',
            '3',
          )
        ).status,
        401,
      );
    },
  );
  await t.test(
    'transaction-local settings do not survive in the shared pool',
    async () => {
      const c = await server.pool.query(
        "SELECT current_user AS role, current_setting('jwt.claims.tenant',true) AS tenant, current_setting('jwt.claims.user_id',true) AS user",
      );
      assert.equal(c.rows[0].role, 'bench_admin');
      assert(!c.rows[0].tenant && !c.rows[0].user);
      const conn = await server.pool.connect();
      try {
        await conn.query('BEGIN');
        await conn.query('SET LOCAL ROLE bench_reader');
        assert.equal(
          (await conn.query('SELECT * FROM tenant_000.tasks')).rowCount,
          0,
        );
        assert.equal(
          (await conn.query('SELECT * FROM bench_types.record_base')).rowCount,
          0,
        );
        await conn.query(
          "SELECT set_config('jwt.claims.tenant','tenant_000',true), set_config('jwt.claims.user_id','1',true)",
        );
        assert.equal(
          (await conn.query('SELECT * FROM bench_types.record_base')).rowCount,
          1,
        );
      } finally {
        await conn.query('ROLLBACK');
        conn.release();
      }
    },
  );
  await t.test(
    'distinct plan counts grow and replay reuses plans',
    async () => {
      const before = await server.cache.use('tenant_000', (i) =>
        cacheCounts(i.schema),
      );
      for (let i = 0; i < 12; i++)
        await checkedRequest(server.port, 'tenant_000', planQuery(i));
      const after = await server.cache.use('tenant_000', (i) =>
        cacheCounts(i.schema),
      );
      assert.equal(after.plans - before.plans, 12);
      assert.equal(after.operations - before.operations, 12);
      assert.equal(after.capacity, 1200);
      for (let i = 0; i < 12; i++)
        await checkedRequest(server.port, 'tenant_000', planQuery(i));
      assert.deepEqual(
        await server.cache.use('tenant_000', (i) => cacheCounts(i.schema)),
        after,
      );
    },
  );
  await t.test('NOTIFY drains, releases, and rebuilds after DDL', async () => {
    const old = await server.cache.use('tenant_000', (i) => i.sdlHash);
    const releases = server.cache.stats.releases;
    await server.pool.query(
      "ALTER TABLE tenant_000.tasks ADD COLUMN synthetic_extra text; NOTIFY bench_schema_changed, 'tenant_000'",
    );
    await until(() => server.cache.stats.releases > releases);
    await checkedRequest(
      server.port,
      'tenant_000',
      '{ allTasks { nodes { syntheticExtra } } }',
    );
    assert.notEqual(
      await server.cache.use('tenant_000', (i) => i.sdlHash),
      old,
    );
    assert.equal(server.notificationError, undefined);
  });
  await t.test(
    'client abort cannot release a running operation early',
    async () => {
      const query = 'mutation { slowIdentity(input:{seconds:0.3}) { result } }';
      const body = JSON.stringify({ query });
      const req = request({
        hostname: '127.0.0.1',
        port: server.port,
        path: '/graphql',
        method: 'POST',
        headers: {
          host: 'tenant_000.localhost',
          'x-bench-user': '1',
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
      });
      req.on('error', () => {});
      req.end(body);
      await until(
        async () =>
          (
            await server.pool.query(
              "SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event='PgSleep' AND query LIKE '%slow_identity%' AND state='active'",
            )
          ).rows[0].n > 0,
      );
      req.destroy();
      const start = performance.now();
      await server.cache.invalidate('tenant_000');
      assert(
        performance.now() - start > 150,
        'Release must wait for SQL after socket abort',
      );
      assert(!server.cache.entries.has('tenant_000'));
      await checkedRequest(server.port, 'tenant_002');
      assert(server.cache.entries.size <= 2);
    },
  );
});
