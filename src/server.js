import express from 'express';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { makePool, databaseUrl, validTenant, tenantName } from './config.js';
import { TenantLRU } from './lru.js';
import { buildInstance } from './instance.js';

export async function startServer({ capacity = 10, totalTenants = 2, port = 0, notify = true, operationsCacheMaxLength = 100 } = {}) {
  const pool = makePool();
  const allowed = new Set(Array.from({ length: totalTenants }, (_, i) => tenantName(i)));
  const cache = new TenantLRU(capacity, tenant => buildInstance(tenant, pool, operationsCacheMaxLength));
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(async (req, res, next) => {
    try {
      const host = req.headers.host ?? '';
      const match = /^(tenant_\d{3,4})\.localhost(?::\d{1,5})?$/.exec(host);
      if (!match || !allowed.has(match[1])) return res.status(404).json({ error: 'Unknown tenant host' });
      const user = req.headers['x-bench-user'];
      if (!['1', '2'].includes(user)) return res.status(401).json({ error: 'Use synthetic x-bench-user 1 or 2' });
      req.benchIdentity = Object.freeze({ tenant: match[1], user });
      await cache.use(match[1], instance => {
        const execution = instance.handler(req, res, next);
        if (!execution || typeof execution.then !== 'function') throw new Error('Grafserv handler must return an execution promise');
        return execution;
      });
    } catch (e) { next(e); }
  });
  app.use((error, req, res, next) => { if (!res.headersSent) res.status(500).json({ error: error.message }); else next(error); });
  const server = createServer(app);
  let listener;
  let notificationError;
  try {
    await pool.query('SELECT 1');
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
    if (notify) {
      listener = new pg.Client({ connectionString: databaseUrl });
      await listener.connect();
      listener.on('error', error => { notificationError = error; });
      listener.on('notification', message => {
        if (validTenant(message.payload) && allowed.has(message.payload)) cache.invalidate(message.payload).catch(error => { notificationError = error; });
      });
      await listener.query('LISTEN bench_schema_changed');
    }
  } catch (error) {
    if (listener) await listener.end().catch(() => {});
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await cache.close();
    await pool.end();
    throw error;
  }
  return { cache, pool, server, port: server.address().port, get notificationError() { return notificationError; },
    async close() {
      if (listener) await listener.end();
      await new Promise(resolve => server.close(resolve));
      await cache.close();
      await pool.end();
    },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = await startServer({ port: Number(process.env.PORT ?? 5678), totalTenants: Number(process.env.TENANTS ?? 2), capacity: Number(process.env.CAPACITY ?? 10) });
  console.log(`Synthetic server listening on 127.0.0.1:${server.port}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); });
}
