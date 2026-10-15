import assert from 'node:assert/strict';
import { registerHooks, createRequire } from 'node:module';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const localLoads: string[] = [];
registerHooks({
  load(url, context, nextLoad) {
    if (/\/dist\/plugins\/(graphile-build|utils)\//.test(url))
      localLoads.push(fileURLToPath(url));
    return nextLoad(url, context);
  },
});
const { verifyComparisonPreset } =
  await import('../../src/runtime/comparison.js');
const { buildInstance } = await import('../../src/runtime/instance.js');
const { resetFixture } = await import('../../src/fixture/index.js');
const { makePool } = await import('../../src/runtime/config.js');
await resetFixture(2);
const pool = makePool();
const instance = await buildInstance('tenant_000', pool);
const pgl = instance.pgl;
try {
  const preset = pgl.getResolvedPreset();
  const activation = verifyComparisonPreset(preset);
  const root = createRequire(import.meta.url);
  const published = createRequire(root.resolve('postgraphile'));
  const pgBuild = createRequire(published.resolve('graphile-build-pg'));
  const graphileBuild = createRequire(published.resolve('graphile-build'));
  const graphql = createRequire(published.resolve('grafast'));
  const identities = {
    graphileBuild:
      published('graphile-build').gatherConfig ===
      pgBuild('graphile-build').gatherConfig,
    grafast: published('grafast').Step === pgBuild('grafast').Step,
    dataplanPg:
      published('@dataplan/pg').PgExecutor ===
      pgBuild('@dataplan/pg').PgExecutor,
    graphileConfig:
      published('graphile-config').resolvePreset ===
      graphileBuild('graphile-config').resolvePreset,
    graphql:
      published('graphql').GraphQLSchema === graphql('graphql').GraphQLSchema,
    pgIntrospection:
      published('pg-introspection').parseIntrospectionResults ===
      pgBuild('pg-introspection').parseIntrospectionResults,
  };
  for (const [name, equal] of Object.entries(identities))
    assert(equal, `${name} identity differs`);
  if (activation.profile !== 'local-scoped') assert.equal(localLoads.length, 0);
  else {
    assert.equal(activation.profile, 'local-scoped');
    assert.equal(activation.localPlugin, true);
    assert(
      localLoads.some((path) =>
        path.endsWith('/plugins/PgIntrospectionPlugin.js'),
      ),
    );
    assert(localLoads.some((path) => path.endsWith('/scopedIntrospection.js')));
    const local =
      await import('../../plugins/utils/pg-introspection/src/index.js');
    assert.equal(
      local.parseIntrospectionResults,
      published('pg-introspection').parseIntrospectionResults,
    );
  }
  const resolution = Object.fromEntries(
    [
      'postgraphile',
      'graphile-build',
      'graphile-build-pg',
      'grafast',
      '@dataplan/pg',
      'pg-introspection',
      'graphql',
      'graphile-config',
    ].map((name) => [name, realpathSync(published.resolve(name))]),
  );
  const before = root('postgraphile/graphile-build-pg').PgIntrospectionPlugin;
  assert.equal(before.name, 'PgIntrospectionPlugin');
  const source = readFileSync(published.resolve('graphile-build-pg'), 'utf8');
  assert(!source.includes('LocalPgIntrospectionPlugin'));
  console.log(
    JSON.stringify(
      {
        activation,
        sdlHash: instance.sdlHash,
        localLoads,
        resolution,
        identities,
        plugins: preset.plugins
          .filter((p) => p.name.includes('Introspection'))
          .map((p) => p.name),
      },
      null,
      2,
    ),
  );
} finally {
  await pgl.release();
  await pool.end();
}
