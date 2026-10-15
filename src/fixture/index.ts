import { makePool } from '../runtime/config.js';
import { tenantSql } from './tenant.js';
import { hiddenDependenciesSql } from './hidden.js';

export async function resetFixture(totalTenants: number) {
  if (
    !Number.isInteger(totalTenants) ||
    totalTenants < 1 ||
    totalTenants > 1000
  )
    throw new Error('Invalid fixture size');
  const pool = makePool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(2228)');
    const schemas = await client.query<{ nspname: string }>(
      "SELECT nspname FROM pg_namespace WHERE nspname ~ '^tenant_[0-9]{3,4}$' OR nspname = 'bench_types'",
    );
    for (const { nspname } of schemas.rows)
      await client.query(`DROP SCHEMA "${nspname}" CASCADE`);
    await client.query(hiddenDependenciesSql);
    for (let i = 0; i < totalTenants; i++) await client.query(tenantSql(i));
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}
