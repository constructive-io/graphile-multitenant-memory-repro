import { tenantName } from '../runtime/config.js';

const tenantTables = [
  'accounts',
  'projects',
  'tasks',
  'notes',
  'tags',
  'task_tags',
  'events',
  'attachments',
  'settings',
  'inherited_records',
];

export function tenantSql(index: number): string {
  const schema = tenantName(index);
  return (
    tenantDefinitions(schema) + tenantPolicies(schema) + tenantRows(schema)
  );
}

function tenantDefinitions(schema: string): string {
  const identityColumns = `id integer PRIMARY KEY, owner_id integer NOT NULL, tenant_key text NOT NULL DEFAULT '${schema}'`;
  return `
CREATE SCHEMA ${schema};
CREATE TYPE ${schema}.task_state AS ENUM ('open', 'done');
CREATE DOMAIN ${schema}.short_text AS text CHECK (length(VALUE) < 200);
CREATE TABLE ${schema}.accounts (${identityColumns}, name ${schema}.short_text NOT NULL);
CREATE TABLE ${schema}.projects (${identityColumns}, account_id integer NOT NULL REFERENCES ${schema}.accounts, name text NOT NULL);
CREATE TABLE ${schema}.tasks (${identityColumns}, project_id integer NOT NULL REFERENCES ${schema}.projects, title text NOT NULL,
  state ${schema}.task_state NOT NULL DEFAULT 'open', priority text NOT NULL REFERENCES bench_types.priority,
  score bench_types.score NOT NULL, score_window bench_types.score_range, labels text[] NOT NULL, scores bench_types.score[]);
CREATE TABLE ${schema}.notes (${identityColumns}, task_id integer NOT NULL REFERENCES ${schema}.tasks, body text NOT NULL);
CREATE TABLE ${schema}.tags (${identityColumns}, name text NOT NULL);
CREATE TABLE ${schema}.task_tags (${identityColumns}, task_id integer NOT NULL REFERENCES ${schema}.tasks, tag_id integer NOT NULL REFERENCES ${schema}.tags);
CREATE TABLE ${schema}.events (${identityColumns}, task_id integer NOT NULL REFERENCES ${schema}.tasks, kind text NOT NULL);
CREATE TABLE ${schema}.attachments (${identityColumns}, task_id integer NOT NULL REFERENCES ${schema}.tasks, filename text NOT NULL);
CREATE TABLE ${schema}.settings (${identityColumns}, value jsonb NOT NULL);
CREATE TABLE ${schema}.inherited_records (PRIMARY KEY (id), label text NOT NULL) INHERITS (bench_types.record_base);
CREATE INDEX ON ${schema}.projects (account_id);
CREATE INDEX ON ${schema}.tasks (project_id);
CREATE INDEX ON ${schema}.notes (task_id);
CREATE INDEX ON ${schema}.task_tags (task_id);
CREATE INDEX ON ${schema}.task_tags (tag_id);
CREATE INDEX ON ${schema}.events (task_id);
CREATE INDEX ON ${schema}.attachments (task_id);
ALTER TABLE ${schema}.inherited_records ALTER tenant_key SET DEFAULT '${schema}';
CREATE FUNCTION ${schema}.echo_score(value bench_types.score) RETURNS bench_types.score LANGUAGE sql IMMUTABLE AS 'SELECT value';
CREATE FUNCTION ${schema}.echo_window(value bench_types.score_range) RETURNS bench_types.score_range LANGUAGE sql IMMUTABLE AS 'SELECT value';
CREATE FUNCTION ${schema}.echo_mood(value bench_types.mood) RETURNS bench_types.mood LANGUAGE sql IMMUTABLE AS 'SELECT value';
CREATE FUNCTION ${schema}.request_identity() RETURNS text LANGUAGE sql STABLE AS
  $$SELECT current_user || ':' || current_setting('jwt.claims.tenant', true) || ':' || current_setting('jwt.claims.user_id', true)$$;
CREATE FUNCTION ${schema}.slow_identity(seconds double precision) RETURNS text LANGUAGE plpgsql VOLATILE AS
  $$BEGIN PERFORM pg_sleep(LEAST(seconds, 2)); RETURN ${schema}.request_identity(); END$$;
`;
}

function tenantPolicies(schema: string): string {
  return tenantTables
    .map(
      (t) => `ALTER TABLE ${schema}.${t} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${schema}.${t} FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_owner ON ${schema}.${t} TO bench_reader USING
  (tenant_key = current_setting('jwt.claims.tenant', true) AND owner_id::text = current_setting('jwt.claims.user_id', true));`,
    )
    .join('\n');
}

function tenantRows(schema: string): string {
  return `
INSERT INTO ${schema}.accounts SELECT i,i,'${schema}','Synthetic account '||i FROM generate_series(1,2) i;
INSERT INTO ${schema}.projects SELECT i,i,'${schema}',i,'Synthetic project '||i FROM generate_series(1,2) i;
INSERT INTO ${schema}.tasks SELECT i,i,'${schema}',i,'Synthetic task '||i,'open','normal',42,'[1,9)',ARRAY['synthetic','example'],ARRAY[1,2]::bench_types.score[] FROM generate_series(1,2) i;
INSERT INTO ${schema}.notes SELECT i,i,'${schema}',i,'Synthetic note '||i FROM generate_series(1,2) i;
INSERT INTO ${schema}.tags SELECT i,i,'${schema}','Synthetic tag '||i FROM generate_series(1,2) i;
INSERT INTO ${schema}.task_tags SELECT i,i,'${schema}',i,i FROM generate_series(1,2) i;
INSERT INTO ${schema}.events SELECT i,i,'${schema}',i,'created' FROM generate_series(1,2) i;
INSERT INTO ${schema}.attachments SELECT i,i,'${schema}',i,'example.txt' FROM generate_series(1,2) i;
INSERT INTO ${schema}.settings SELECT i,i,'${schema}','{"synthetic":true}'::jsonb FROM generate_series(1,2) i;
INSERT INTO ${schema}.inherited_records SELECT i,i,'${schema}','Inherited example '||i FROM generate_series(1,2) i;
GRANT USAGE ON SCHEMA ${schema} TO bench_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA ${schema} TO bench_reader;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${schema} TO bench_reader;
`;
}
