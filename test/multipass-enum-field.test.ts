// Regression test for graphile/crystal#3288, fixed upstream in
// 5.3.0-aardvark.next-20261126000638: a function that returns an enum from a
// hidden schema is the only object in the exposed schema, so nothing exposed
// refers to a pg_catalog type. The expectations are the same with and without
// multipass introspection.
//
// Run with the upstream snapshot (see README):
//   BENCH_MULTIPASS=0 NODE_ENV=production GRAPHILE_ENV=production pnpm repro:enum-field
//   BENCH_MULTIPASS=1 NODE_ENV=production GRAPHILE_ENV=production pnpm repro:enum-field
import test from 'node:test';
import assert from 'node:assert/strict';
import { makePool } from '../src/runtime/config.js';
import { startServer } from '../src/runtime/server.js';
import { graphqlRequest } from '../src/benchmark/client.js';
import { array, object, string } from '../src/json.js';
import { dependencySource, multipass } from '../src/runtime/comparison.js';

const mode =
  dependencySource === 'upstream-snapshot'
    ? `upstream snapshot, multipass ${multipass ? 'on' : 'off'}`
    : 'default graph';

const fixture = `
DO $$BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bench_reader') THEN
    CREATE ROLE bench_reader NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END$$;
CREATE SCHEMA repro_hidden;
CREATE TYPE repro_hidden.mood AS ENUM ('CALM', 'ALERT');
CREATE SCHEMA tenant_000;
CREATE FUNCTION tenant_000.current_mood() RETURNS repro_hidden.mood
  LANGUAGE sql STABLE AS $$ SELECT 'ALERT'::repro_hidden.mood $$;
GRANT USAGE ON SCHEMA repro_hidden, tenant_000 TO bench_reader;
`;

test(`enum-returning function is exposed and returns ALERT (${mode})`, async (t) => {
  const pool = makePool();
  const drop = () =>
    pool.query('DROP SCHEMA IF EXISTS tenant_000, repro_hidden CASCADE');
  let server: Awaited<ReturnType<typeof startServer>> | undefined;
  // Every cleanup step runs even if an earlier one fails, so an open pool never
  // keeps the test process alive.
  t.after(async () => {
    try {
      await server?.close();
    } finally {
      await drop().finally(() => pool.end());
    }
  });
  await drop();
  await pool.query(fixture);

  // Precondition: the exposed schema holds exactly one argument-less function
  // returning the hidden enum, so no exposed object reaches a pg_catalog type.
  const contents = (
    await pool.query(`SELECT
      (SELECT count(*)::int FROM pg_class WHERE relnamespace = 'tenant_000'::regnamespace) AS relations,
      (SELECT count(*)::int FROM pg_type WHERE typnamespace = 'tenant_000'::regnamespace) AS types,
      (SELECT array_agg(p.oid::regprocedure::text || ' -> ' || p.prorettype::regtype::text)
         FROM pg_proc p WHERE p.pronamespace = 'tenant_000'::regnamespace) AS functions`)
  ).rows[0];
  assert.deepEqual(contents, {
    relations: 0,
    types: 0,
    functions: ['tenant_000.current_mood() -> repro_hidden.mood'],
  });

  // The repository's GraphQL entry point: Host-routed grafserv over HTTP.
  server = await startServer({ capacity: 1, totalTenants: 1, notify: false });
  const { port } = server;

  // Both observations are reported separately: schema shape and execution.
  await t.test('Query exposes currentMood', async () => {
    const introspection = await graphqlRequest(
      port,
      'tenant_000',
      '{ __type(name: "Query") { fields { name } } }',
    );
    assert.equal(introspection.status, 200, JSON.stringify(introspection.body));
    assert.equal(
      introspection.body.errors,
      undefined,
      JSON.stringify(introspection.body),
    );
    const fields = array(
      object(object(introspection.body.data).__type).fields,
    ).map((field) => string(object(field).name));
    assert(
      fields.includes('currentMood'),
      `Query.currentMood is missing; Query fields: ${JSON.stringify(fields)}`,
    );
  });

  await t.test('{ currentMood } returns ALERT', async () => {
    const result = await graphqlRequest(port, 'tenant_000', '{ currentMood }');
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.deepEqual(result.body, { data: { currentMood: 'ALERT' } });
  });
});
