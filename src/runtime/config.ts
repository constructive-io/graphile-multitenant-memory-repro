import pg from 'pg';
export const databaseUrl =
  process.env.BENCH_DATABASE_URL ??
  `postgres://bench_admin:synthetic-local-only@127.0.0.1:${process.env.BENCH_PG_PORT ?? 55432}/graphile_memory_bench`;
export function assertSyntheticDatabase(url = databaseUrl) {
  const u = new URL(url);
  if (
    !['postgres:', 'postgresql:'].includes(u.protocol) ||
    u.search ||
    u.hash ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) ||
    u.pathname !== '/graphile_memory_bench' ||
    u.username !== 'bench_admin'
  ) {
    throw new Error(
      'Only the isolated loopback graphile_memory_bench database as bench_admin is allowed',
    );
  }
}
assertSyntheticDatabase();
export const makePool = () =>
  new pg.Pool({ connectionString: databaseUrl, max: 4 });
export function tenantName(index: number) {
  if (!Number.isInteger(index) || index < 0 || index > 9999)
    throw new Error('Invalid tenant index');
  return `tenant_${String(index).padStart(3, '0')}`;
}
export const validTenant = (name: unknown): name is string =>
  typeof name === 'string' && /^tenant_\d{3,4}$/.test(name);
