import express from 'express';
import { createServer } from 'node:http';
import type { ErrorRequestHandler } from 'express';
import type { ServerOptions } from './types.js';
import pg from 'pg';
import { makePool, databaseUrl, validTenant, tenantName } from './config.js';
import { TenantLRU } from './lru.js';
import { buildInstance } from './instance.js';

export async function startServer({
  capacity = 10,
  totalTenants = 2,
  port = 0,
  notify = true,
  operationsCacheMaxLength = 100,
}: ServerOptions = {}) {
  const pool = makePool();
  const allowed = new Set(
    Array.from({ length: totalTenants }, (_, i) => tenantName(i)),
  );
  const cache = new TenantLRU(capacity, (tenant) =>
    buildInstance(tenant, pool, operationsCacheMaxLength),
  );
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(async (req, res, next) => {
    try {
      const host = req.headers.host ?? '';
      const match = /^(tenant_\d{3,4})\.localhost(?::\d{1,5})?$/.exec(host);
      if (!match || !allowed.has(match[1]))
        return res.status(404).json({ error: 'Unknown tenant host' });
      const user = req.headers['x-bench-user'];
      if (user !== '1' && user !== '2')
        return res
          .status(401)
          .json({ error: 'Use synthetic x-bench-user 1 or 2' });
      req.benchIdentity = Object.freeze({ tenant: match[1], user });
      await cache.use(match[1], (instance) => {
        const execution: unknown = instance.handler(req, res, next);
        if (
          !execution ||
          (typeof execution !== 'object' && typeof execution !== 'function') ||
          !('then' in execution) ||
          typeof execution.then !== 'function'
        )
          throw new Error('Grafserv handler must return an execution promise');
        return execution;
      });
    } catch (e) {
      next(e);
    }
  });
  const errorHandler: ErrorRequestHandler = (
    error: unknown,
    _req,
    res,
    next,
  ) => {
    if (!res.headersSent)
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    else next(error);
  };
  app.use(errorHandler);
  const server = createServer(app);
  let listener: pg.Client | undefined;
  let notificationError: unknown;
  try {
    await pool.query('SELECT 1');
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    if (notify) {
      listener = new pg.Client({ connectionString: databaseUrl });
      await listener.connect();
      listener.on('error', (error) => {
        notificationError = error;
      });
      listener.on('notification', (message) => {
        if (validTenant(message.payload) && allowed.has(message.payload))
          cache.invalidate(message.payload).catch((error) => {
            notificationError = error;
          });
      });
      await listener.query('LISTEN bench_schema_changed');
    }
  } catch (error) {
    if (listener) await listener.end().catch(() => {});
    if (server.listening)
      await new Promise<void>((resolve) => server.close(() => resolve()));
    await cache.close();
    await pool.end();
    throw error;
  }
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Expected a TCP address');
  return {
    cache,
    pool,
    server,
    port: address.port,
    get notificationError() {
      return notificationError;
    },
    async close() {
      if (listener) await listener.end();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await cache.close();
      await pool.end();
    },
  };
}
