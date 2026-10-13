import { readFileSync } from 'node:fs';

// Explicit, isolated source-checkout comparisons. Registry stock has no profile file.
let state;
try { state = JSON.parse(readFileSync('.crystal-state.json', 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
export const comparisonProfile = state?.profile ?? (state ? 'checkout' : 'stock');
if (!['stock', 'checkout', 'common-base', 'pr2', 'pr3'].includes(comparisonProfile)) {
  throw new Error('Unknown Crystal comparison profile');
}
export const comparisonPresets = [];
if (comparisonProfile === 'pr3') {
  const { PgScopedIntrospectionPreset } = await import('postgraphile/graphile-build-pg');
  if (!PgScopedIntrospectionPreset) throw new Error('PR3 preset export is unavailable');
  comparisonPresets.push(PgScopedIntrospectionPreset);
}
export const comparisonOptions = ['pr2', 'pr3'].includes(comparisonProfile)
  ? { gather: { pgScopedIntrospection: { main: true } } }
  : {};

export function verifyComparisonPreset(preset) {
  const pluginPresent = preset.plugins.some(plugin => plugin.name === 'PgScopedIntrospectionPlugin');
  const scoped = preset.gather?.pgScopedIntrospection?.main === true;
  if (pluginPresent !== (comparisonProfile === 'pr3')) throw new Error('Unexpected scoped plugin activation');
  if (scoped !== ['pr2', 'pr3'].includes(comparisonProfile)) throw new Error('Unexpected scoped gather activation');
  return { profile: comparisonProfile, scoped, pluginPresent, catalogTypes: scoped ? 'all' : null, capabilityExtensions: [] };
}
