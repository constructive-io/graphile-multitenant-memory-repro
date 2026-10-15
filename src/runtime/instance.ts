import type { Pool } from 'pg';
import type {} from './types.js';
import { postgraphile } from 'postgraphile';
import { PostGraphileAmberPreset } from 'postgraphile/presets/amber';
import { makePgService } from 'postgraphile/adaptors/pg';
import { grafserv } from 'postgraphile/grafserv/express/v4';
import { printSchema, lexicographicSortSchema } from 'postgraphile/graphql';
import { createHash } from 'node:crypto';
import { validTenant } from './config.js';
import {
  comparisonPresets,
  comparisonOptions,
  verifyComparisonPreset,
} from './comparison.js';
export async function buildInstance(
  tenant: string,
  pool: Pool,
  operationsCacheMaxLength = 100,
) {
  if (!validTenant(tenant)) throw new Error('Invalid tenant');
  const start = performance.now();
  const pgl = postgraphile({
    extends: [PostGraphileAmberPreset, ...comparisonPresets],
    ...comparisonOptions,
    pgServices: [
      makePgService({
        pool,
        schemas: [tenant],
        pubsub: false,
        pgSettings(ctx) {
          const identity = ctx.expressv4?.req.benchIdentity;
          if (!identity || identity.tenant !== tenant)
            throw new Error('Missing or mismatched request identity');
          return {
            role: 'bench_reader',
            'jwt.claims.tenant': identity.tenant,
            'jwt.claims.user_id': identity.user,
          };
        },
      }),
    ],
    grafserv: {
      graphiql: false,
      websockets: false,
      watch: false,
      graphqlPath: '/graphql',
      parseAndValidateCacheSize: operationsCacheMaxLength,
      allowedRequestContentTypes: ['application/json'],
    },
  });
  try {
    const comparisonActivation = verifyComparisonPreset(
      pgl.getResolvedPreset(),
    );
    const schema = await pgl.getSchema();
    if (!schema.extensions.grafast)
      Object.assign(schema.extensions, { grafast: {} });
    if (!schema.extensions.grafast)
      throw new Error('Missing Grafast extensions');
    schema.extensions.grafast.operationsCacheMaxLength =
      operationsCacheMaxLength;
    const serv = pgl.createServ(grafserv);
    await serv.ready();
    // Public legacy API returns the handler promise, allowing leases to cover execution.
    // Express routing alone does not expose completion after an aborted response.
    const handler = serv.createHandler();
    const buildMs = performance.now() - start;
    const sdlHash = createHash('sha256')
      .update(printSchema(lexicographicSortSchema(schema)))
      .digest('hex');
    return {
      pgl,
      serv,
      schema,
      handler,
      sdlHash,
      buildMs,
      comparisonActivation,
      release: () => pgl.release(),
    };
  } catch (e) {
    await pgl.release();
    throw e;
  }
}
