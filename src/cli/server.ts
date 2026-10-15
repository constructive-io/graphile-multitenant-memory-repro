import { startServer } from '../runtime/server.js';
const server = await startServer({
  port: Number(process.env.PORT ?? 5678),
  totalTenants: Number(process.env.TENANTS ?? 2),
  capacity: Number(process.env.CAPACITY ?? 10),
});
console.log(`Synthetic server listening on 127.0.0.1:${server.port}`);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await server.close();
  });
