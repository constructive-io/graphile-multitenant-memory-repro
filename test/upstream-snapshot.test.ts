// PostGraphile source selection. Under `pnpm test` this checks the default graph;
// under `pnpm test:upstream` (BENCH_MULTIPASS=0 or 1) it checks that the pinned
// upstream snapshot is what actually runs, and that `pgMultipassIntrospection`
// is the only switch between the two snapshot modes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { postgraphile } from 'postgraphile';
import { makePgService } from 'postgraphile/adaptors/pg';
import { projectPath, projectRoot } from '../src/paths.js';
import { array, boolean, object, readJson, string } from '../src/json.js';
import { dependencies } from '../src/measurement/provenance.js';
import { resetFixture } from '../src/fixture/index.js';
import { makePool } from '../src/runtime/config.js';
import {
  comparisonProfile,
  dependencySource,
  multipass,
  runtimePreset,
  selectMultipass,
  verifyComparisonPreset,
} from '../src/runtime/comparison.js';
import {
  postgraphileSourceArgs,
  upstreamSnapshotDirectory,
} from '../src/runtime/postgraphile-source.js';

const upstream = dependencySource === 'upstream-snapshot';
const mode = upstream
  ? `upstream snapshot, multipass ${multipass ? 'on' : 'off'}`
  : 'default graph';
const pins = object(
  object(
    readJson(
      projectPath(upstream ? 'upstream-snapshot/package.json' : 'package.json'),
    ),
  ).dependencies,
);
const graphRoot = realpathSync(
  upstream
    ? `${upstreamSnapshotDirectory()}/node_modules`
    : projectPath('node_modules'),
);
const inGraph = (path: string) => path.startsWith(`${graphRoot}/`);

test('multipass is selected explicitly and only for the upstream snapshot', () => {
  assert.equal(selectMultipass('default', undefined), null);
  assert.throws(
    () => selectMultipass('default', '1'),
    /applies only to the upstream snapshot/,
  );
  for (const value of [undefined, '', 'true', 'on'])
    assert.throws(
      () => selectMultipass('upstream-snapshot', value),
      /BENCH_MULTIPASS=0 or BENCH_MULTIPASS=1/,
    );
  assert.equal(selectMultipass('upstream-snapshot', '0'), false);
  assert.equal(selectMultipass('upstream-snapshot', '1'), true);
  assert.equal(multipass === null, !upstream);
});

test(`resolved PostGraphile graph matches its pins (${mode})`, () => {
  const resolved = dependencies();
  const pinned = upstream
    ? [
        'postgraphile',
        'grafast',
        'graphile-build',
        'graphile-build-pg',
        '@dataplan/pg',
        'pg-introspection',
      ]
    : ['postgraphile'];
  for (const name of pinned)
    assert.equal(resolved[name].version, string(pins[name]), name);
  for (const name of [
    'postgraphile',
    'grafast',
    'graphile-build',
    'graphile-build-pg',
    '@dataplan/pg',
    'pg-introspection',
    'graphql',
  ])
    assert(
      inGraph(resolved[name].path),
      `${name} resolved outside the selected graph`,
    );
  assert.deepEqual(
    postgraphileSourceArgs().length > 0 ? postgraphileSourceArgs()[0] : null,
    upstream ? '--import' : null,
  );
});

test(`introspection path (${mode})`, async () => {
  await resetFixture(1);
  const pool = makePool();
  const seen = { hook: false, policies: null as number | null, queries: 0 };
  // Records what the upstream PgIntrospectionPlugin actually does; the default
  // graph predates this hook, so it is never called there.
  const observer = {
    name: 'IntrospectionPathObserver',
    version: '0.0.0',
    gather: {
      hooks: {
        pgIntrospection_options(_info: unknown, event: any) {
          seen.hook = true;
          const policies = event.options.multipass?.policies;
          seen.policies = Array.isArray(policies) ? policies.length : null;
          const runQuery = event.options.runQuery;
          event.options.runQuery = (...args: unknown[]) => {
            seen.queries++;
            return runQuery(...args);
          };
        },
      },
    },
  } as unknown as GraphileConfig.Plugin;
  const pgl = postgraphile({
    extends: [runtimePreset],
    plugins: [observer],
    pgServices: [
      makePgService({ pool, schemas: ['tenant_000'], pubsub: false }),
    ],
    grafserv: { watch: false },
  });
  try {
    const activation = verifyComparisonPreset(pgl.getResolvedPreset());
    // The default graph may run either profile; the snapshot accepts only stock.
    assert.equal(activation.profile, comparisonProfile);
    assert.equal(activation.localPlugin, comparisonProfile === 'local-scoped');
    const schema = await pgl.getSchema();
    assert(
      schema.getQueryType()?.getFields().allTasks,
      'tenant tables exposed',
    );
    if (!upstream) {
      assert.equal(seen.hook, false);
      assert.equal(activation.multipass, undefined);
    } else if (multipass) {
      assert.equal(activation.multipass, true);
      assert(
        (seen.policies ?? 0) > 0,
        'upstream multipass policies are active',
      );
      assert(
        seen.queries >= 2,
        `multipass runs several catalogue passes (saw ${seen.queries})`,
      );
    } else {
      assert.equal(activation.multipass, false);
      assert.equal(seen.policies, null);
      assert.equal(seen.queries, 1, 'a single catalogue query');
    }
  } finally {
    await pgl.release();
    await pool.end();
  }
});

test(`a child process resolves one package graph from the same source (${mode})`, () => {
  const child = spawnSync(
    process.execPath,
    [
      ...postgraphileSourceArgs(),
      projectPath('dist/test/helpers/activation.js'),
    ],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        BENCH_PROFILE: 'stock',
        NODE_ENV: 'production',
        GRAPHILE_ENV: 'production',
      },
    },
  );
  assert.equal(child.status, 0, child.stderr);
  const row = object(JSON.parse(child.stdout));
  const activation = object(row.activation);
  assert.equal(activation.profile, 'stock');
  assert.equal(activation.localPlugin, false);
  assert.equal(activation.multipass, upstream ? multipass : undefined);
  assert.equal(array(row.localLoads).length, 0);
  assert(Object.values(object(row.identities)).every(boolean));
  for (const [name, path] of Object.entries(object(row.resolution)))
    assert(
      inGraph(string(path)),
      `${name} resolved outside the selected graph`,
    );
  assert.deepEqual(array(row.plugins).map(string), ['PgIntrospectionPlugin']);
});
