// Reuse published catalogue types and hydration through the same dependency graph.
export * from 'postgraphile/graphile-build-pg/pg-introspection';
export { makeIntrospectionQuery } from './introspection.js';
export {
  makeSchemaScopedIntrospectionPlan,
  makeSchemaScopedIntrospectionQuery,
  validateSchemaScopedIntrospection,
  type SchemaScopedIntrospectionOptions,
  type SchemaScopedIntrospectionPlan,
  type SchemaScopedIntrospectionQuery,
  type SchemaScopedIntrospectionScope,
  type ScopedCatalogTypes,
} from './scopedIntrospection.js';
