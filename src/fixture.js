import { makePool, tenantName } from './config.js';

export function tenantSql(index) {
  const s = tenantName(index);
  const base = `id integer PRIMARY KEY, owner_id integer NOT NULL, tenant_key text NOT NULL DEFAULT '${s}'`;
  const tables = ['accounts', 'projects', 'tasks', 'notes', 'tags', 'task_tags', 'events', 'attachments', 'settings', 'inherited_records'];
  return `
CREATE SCHEMA ${s};
CREATE TYPE ${s}.task_state AS ENUM ('open', 'done');
CREATE DOMAIN ${s}.short_text AS text CHECK (length(VALUE) < 200);
CREATE TABLE ${s}.accounts (${base}, name ${s}.short_text NOT NULL);
CREATE TABLE ${s}.projects (${base}, account_id integer NOT NULL REFERENCES ${s}.accounts, name text NOT NULL);
CREATE TABLE ${s}.tasks (${base}, project_id integer NOT NULL REFERENCES ${s}.projects, title text NOT NULL,
  state ${s}.task_state NOT NULL DEFAULT 'open', priority text NOT NULL REFERENCES bench_types.priority,
  score bench_types.score NOT NULL, score_window bench_types.score_range, labels text[] NOT NULL, scores bench_types.score[]);
CREATE TABLE ${s}.notes (${base}, task_id integer NOT NULL REFERENCES ${s}.tasks, body text NOT NULL);
CREATE TABLE ${s}.tags (${base}, name text NOT NULL);
CREATE TABLE ${s}.task_tags (${base}, task_id integer NOT NULL REFERENCES ${s}.tasks, tag_id integer NOT NULL REFERENCES ${s}.tags);
CREATE TABLE ${s}.events (${base}, task_id integer NOT NULL REFERENCES ${s}.tasks, kind text NOT NULL);
CREATE TABLE ${s}.attachments (${base}, task_id integer NOT NULL REFERENCES ${s}.tasks, filename text NOT NULL);
CREATE TABLE ${s}.settings (${base}, value jsonb NOT NULL);
CREATE TABLE ${s}.inherited_records (PRIMARY KEY (id), label text NOT NULL) INHERITS (bench_types.record_base);
CREATE INDEX ON ${s}.projects (account_id);
CREATE INDEX ON ${s}.tasks (project_id);
CREATE INDEX ON ${s}.notes (task_id);
CREATE INDEX ON ${s}.task_tags (task_id);
CREATE INDEX ON ${s}.task_tags (tag_id);
CREATE INDEX ON ${s}.events (task_id);
CREATE INDEX ON ${s}.attachments (task_id);
ALTER TABLE ${s}.inherited_records ALTER tenant_key SET DEFAULT '${s}';
CREATE FUNCTION ${s}.echo_score(value bench_types.score) RETURNS bench_types.score LANGUAGE sql IMMUTABLE AS 'SELECT value';
CREATE FUNCTION ${s}.echo_window(value bench_types.score_range) RETURNS bench_types.score_range LANGUAGE sql IMMUTABLE AS 'SELECT value';
CREATE FUNCTION ${s}.echo_mood(value bench_types.mood) RETURNS bench_types.mood LANGUAGE sql IMMUTABLE AS 'SELECT value';
CREATE FUNCTION ${s}.request_identity() RETURNS text LANGUAGE sql STABLE AS
  $$SELECT current_user || ':' || current_setting('jwt.claims.tenant', true) || ':' || current_setting('jwt.claims.user_id', true)$$;
CREATE FUNCTION ${s}.slow_identity(seconds double precision) RETURNS text LANGUAGE plpgsql VOLATILE AS
  $$BEGIN PERFORM pg_sleep(LEAST(seconds, 2)); RETURN ${s}.request_identity(); END$$;
${tables.map(t => `ALTER TABLE ${s}.${t} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${s}.${t} FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_owner ON ${s}.${t} TO bench_reader USING
  (tenant_key = current_setting('jwt.claims.tenant', true) AND owner_id::text = current_setting('jwt.claims.user_id', true));`).join('\n')}
INSERT INTO ${s}.accounts SELECT i,i,'${s}','Synthetic account '||i FROM generate_series(1,2) i;
INSERT INTO ${s}.projects SELECT i,i,'${s}',i,'Synthetic project '||i FROM generate_series(1,2) i;
INSERT INTO ${s}.tasks SELECT i,i,'${s}',i,'Synthetic task '||i,'open','normal',42,'[1,9)',ARRAY['synthetic','example'],ARRAY[1,2]::bench_types.score[] FROM generate_series(1,2) i;
INSERT INTO ${s}.notes SELECT i,i,'${s}',i,'Synthetic note '||i FROM generate_series(1,2) i;
INSERT INTO ${s}.tags SELECT i,i,'${s}','Synthetic tag '||i FROM generate_series(1,2) i;
INSERT INTO ${s}.task_tags SELECT i,i,'${s}',i,i FROM generate_series(1,2) i;
INSERT INTO ${s}.events SELECT i,i,'${s}',i,'created' FROM generate_series(1,2) i;
INSERT INTO ${s}.attachments SELECT i,i,'${s}',i,'example.txt' FROM generate_series(1,2) i;
INSERT INTO ${s}.settings SELECT i,i,'${s}','{"synthetic":true}'::jsonb FROM generate_series(1,2) i;
INSERT INTO ${s}.inherited_records SELECT i,i,'${s}','Inherited example '||i FROM generate_series(1,2) i;
GRANT USAGE ON SCHEMA ${s} TO bench_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA ${s} TO bench_reader;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${s} TO bench_reader;
`;
}

export async function resetFixture(totalTenants) {
  if (!Number.isInteger(totalTenants) || totalTenants < 1 || totalTenants > 1000) throw new Error('Invalid fixture size');
  const pool = makePool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(2228)');
    const schemas = await client.query("SELECT nspname FROM pg_namespace WHERE nspname ~ '^tenant_[0-9]{3,4}$' OR nspname = 'bench_types'");
    for (const { nspname } of schemas.rows) await client.query(`DROP SCHEMA "${nspname}" CASCADE`);
    await client.query(`DO $$BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='bench_reader') THEN CREATE ROLE bench_reader NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; END$$;
CREATE SCHEMA bench_types;
CREATE DOMAIN bench_types.score AS integer CHECK (VALUE >= 0 AND VALUE <= 100);
CREATE TYPE bench_types.score_range AS RANGE (subtype = float8);
CREATE TYPE bench_types.mood AS ENUM ('calm', 'busy');
CREATE TABLE bench_types.priority (value text PRIMARY KEY, description text);
COMMENT ON TABLE bench_types.priority IS E'@enum\nSynthetic task priority';
INSERT INTO bench_types.priority VALUES ('normal','Normal priority'),('urgent','Urgent priority');
CREATE TABLE bench_types.record_base (id integer NOT NULL, owner_id integer NOT NULL, tenant_key text NOT NULL);
ALTER TABLE bench_types.record_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE bench_types.record_base FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_owner ON bench_types.record_base TO bench_reader USING
  (tenant_key = current_setting('jwt.claims.tenant', true) AND owner_id::text = current_setting('jwt.claims.user_id', true));
GRANT USAGE ON SCHEMA bench_types TO bench_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA bench_types TO bench_reader;`);
    for (let i = 0; i < totalTenants; i++) await client.query(tenantSql(i));
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); await pool.end(); }
}
