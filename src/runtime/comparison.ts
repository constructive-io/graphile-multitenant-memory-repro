import type {} from 'postgraphile';
import { readCrystalState } from './state.js';
import type { ComparisonProfile } from './state.js';
import { object } from '../json.js';

const state = readCrystalState();
export const comparisonProfile = state?.profile ?? 'stock';
export const comparisonPresets: GraphileConfig.Preset[] = [];
if (comparisonProfile === 'pr3') {
  // The optional export is absent from registry stock; check the runtime boundary.
  const exports = await import('postgraphile/graphile-build-pg');
  if (!('PgScopedIntrospectionPreset' in exports))
    throw new Error('PR3 preset export is unavailable');
  comparisonPresets.push(object(exports.PgScopedIntrospectionPreset));
}
// Extra gather keys are intentionally limited to the pinned scoped comparison.
type ScopedGather = GraphileBuild.GatherOptions & {
  pgScopedIntrospection: { main: true };
};
export const comparisonOptions: { gather?: ScopedGather } = [
  'pr2',
  'pr3',
].includes(comparisonProfile)
  ? { gather: { pgScopedIntrospection: { main: true } } }
  : {};
export interface ComparisonActivation {
  profile: ComparisonProfile;
  scoped: boolean;
  pluginPresent: boolean;
  catalogTypes: 'all' | null;
  capabilityExtensions: string[];
}
export function verifyComparisonPreset(
  preset: GraphileConfig.ResolvedPreset,
): ComparisonActivation {
  const pluginPresent = preset.plugins.some(
    (plugin) => plugin.name === 'PgScopedIntrospectionPlugin',
  );
  const gather = object(preset.gather ?? {});
  const scoped =
    gather.pgScopedIntrospection !== undefined &&
    object(gather.pgScopedIntrospection).main === true;
  if (pluginPresent !== (comparisonProfile === 'pr3'))
    throw new Error('Unexpected scoped plugin activation');
  if (scoped !== ['pr2', 'pr3'].includes(comparisonProfile))
    throw new Error('Unexpected scoped gather activation');
  return {
    profile: comparisonProfile,
    scoped,
    pluginPresent,
    catalogTypes: scoped ? 'all' : null,
    capabilityExtensions: [],
  };
}
