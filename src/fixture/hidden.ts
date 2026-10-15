// Dependencies deliberately live outside the exposed tenant schemas.
export const hiddenDependenciesSql = `DO $$BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='bench_reader') THEN CREATE ROLE bench_reader NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; END$$;
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
GRANT SELECT ON ALL TABLES IN SCHEMA bench_types TO bench_reader;`;
