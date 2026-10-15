// Adapted from Crystal PR2; see UPSTREAM.md and graphile-build/graphile-build-pg/LICENSE.md.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { postgraphile } from 'postgraphile';
import { gather } from 'postgraphile/graphile-build';
import type { SchemaScopedIntrospectionOptions } from '../utils/pg-introspection/src/index.js';
import { makeIntrospectionQuery } from '../utils/pg-introspection/src/index.js';

import { PgIntrospectionPlugin } from '../graphile-build/graphile-build-pg/src/plugins/PgIntrospectionPlugin.js';
import { PostGraphileAmberPreset } from 'postgraphile/presets/amber';

interface IntrospectionQuery {
  text: string;
  values?: unknown[];
}

type ServiceConfig = boolean | SchemaScopedIntrospectionOptions;

async function captureIntrospectionQuery(
  configByService?: Readonly<Record<string, ServiceConfig>>,
  {
    serviceName = 'main',
    schemas = ['app_public'],
    onQuery,
  }: {
    serviceName?: string;
    schemas?: string[];
    onQuery?: (query: IntrospectionQuery) => void;
  } = {},
): Promise<IntrospectionQuery> {
  let capturedQuery: IntrospectionQuery | undefined;
  const queryCaptured = new Error('query captured');
  const pgService = {
    name: serviceName,
    schemas,
    withPgClientKey: 'withPgClient',
    pgSettingsKey: 'pgSettings',
    adaptorSettings: {},
    adaptor: {
      createWithPgClient() {
        return async (
          _pgSettings: Record<string, string | undefined> | null,
          callback: (client: never) => Promise<unknown>,
        ) =>
          callback({
            query(query: IntrospectionQuery) {
              onQuery?.(query);
              capturedQuery = query;
              throw queryCaptured;
            },
          } as never);
      },
    },
  } as unknown as GraphileConfig.PgServiceConfiguration;
  const IntrospectionConsumerPlugin: GraphileConfig.Plugin = {
    name: 'IntrospectionConsumerPlugin',
    after: ['PgIntrospectionPlugin'],
    gather: {
      async main(_output, info) {
        await info.helpers.pgIntrospection.getIntrospection();
      },
    },
  };

  const pgl = postgraphile({ extends: [PostGraphileAmberPreset] });
  try {
    await gather({
      lib: pgl.getResolvedPreset().lib,
      plugins: [PgIntrospectionPlugin, IntrospectionConsumerPlugin],
      pgServices: [pgService],
      ...(configByService
        ? { gather: { pgScopedIntrospection: configByService } }
        : null),
    });
  } catch (error) {
    if (error !== queryCaptured) throw error;
  } finally {
    await pgl.release();
  }

  if (!capturedQuery) {
    throw new Error('PostgreSQL introspection query was not executed');
  }
  return capturedQuery;
}

for (const config of [undefined, false]) {
  test(`local plugin uses stock introspection for ${config}`, async () => {
    assert.deepEqual(
      await captureIntrospectionQuery(
        config === undefined ? undefined : { main: config },
      ),
      { text: makeIntrospectionQuery() },
    );
  });
}
test('local plugin defaults and parameterized service configuration', async () => {
  assert.deepEqual((await captureIntrospectionQuery({ main: true })).values, [
    ['app_public'],
    [],
  ]);
  const query = await captureIntrospectionQuery({
    main: {
      catalogTypes: 'dependency-closure',
      capabilityExtensions: ['pg_trgm'],
    },
  });
  assert.doesNotMatch(
    query.text,
    /or pg_type.typnamespace = 'pg_catalog'::regnamespace/,
  );
  assert.deepEqual(query.values, [['app_public'], ['pg_trgm']]);
});
test('local plugin rejects unknown services before querying', async () => {
  await assert.rejects(
    captureIntrospectionQuery({ analytics: {} }),
    /unknown PostgreSQL service\(s\): analytics/,
  );
});
for (const entry of [
  { schemas: [], config: true, reason: 'requires at least one schema' },
  {
    schemas: ['pg_catalog'],
    config: true,
    reason: 'cannot expose system schema',
  },
  {
    schemas: ['app_public'],
    config: JSON.parse('{"catalogTypes":"dependancy-closure"}'),
    reason: 'catalogTypes must be',
  },
]) {
  test(`local plugin identifies bad service configuration: ${entry.reason}`, async () => {
    let queries = 0;
    await assert.rejects(
      captureIntrospectionQuery(
        { analytics: entry.config },
        {
          serviceName: 'analytics',
          schemas: entry.schemas,
          onQuery: () => {
            queries++;
          },
        },
      ),
      (error) => {
        assert(error instanceof Error);
        assert.match(
          error.message,
          /plan construction failed for PostgreSQL service 'analytics'/,
        );
        assert.match(error.message, new RegExp(entry.reason));
        assert(error.cause instanceof Error);
        return true;
      },
    );
    assert.equal(queries, 0);
  });
}
