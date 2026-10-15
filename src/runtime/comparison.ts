import type {} from 'postgraphile';
import { activeProfile } from './state.js';
import { PostGraphileAmberPreset } from 'postgraphile/presets/amber';
import { PgIntrospectionPlugin as PublishedIntrospectionPlugin } from 'postgraphile/graphile-build-pg';
import type { ComparisonProfile } from './state.js';
import { object } from '../json.js';

export const comparisonProfile = activeProfile();
// Local code loads only for the explicitly selected candidate, keeping stock intact.
const localPlugin =
  comparisonProfile === 'local-scoped'
    ? (
        await import('../../plugins/graphile-build/graphile-build-pg/src/plugins/PgIntrospectionPlugin.js')
      ).PgIntrospectionPlugin
    : null;
const scopedProfile =
  comparisonProfile === 'pr2' || comparisonProfile === 'local-scoped';
// Extra gather keys are intentionally limited to the pinned scoped comparison.
type ScopedGather = GraphileBuild.GatherOptions & {
  pgScopedIntrospection: { main: true };
};
export const comparisonOptions: { gather?: ScopedGather } = scopedProfile
  ? { gather: { pgScopedIntrospection: { main: true } } }
  : {};
export const runtimePreset: GraphileConfig.Preset = localPlugin
  ? {
      extends: [PostGraphileAmberPreset],
      disablePlugins: ['PgIntrospectionPlugin'],
      plugins: [localPlugin],
      ...comparisonOptions,
    }
  : { extends: [PostGraphileAmberPreset], ...comparisonOptions };
export interface ComparisonActivation {
  profile: ComparisonProfile;
  localPlugin?: boolean;
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
  if (pluginPresent) throw new Error('Unexpected scoped plugin activation');
  const introspectionPlugins = preset.plugins.filter(
    (plugin) =>
      plugin.name === 'PgIntrospectionPlugin' ||
      plugin.name === 'LocalPgIntrospectionPlugin',
  );
  if (
    introspectionPlugins.length !== 1 ||
    introspectionPlugins[0] !== (localPlugin ?? PublishedIntrospectionPlugin)
  )
    throw new Error('Expected exactly the selected introspection plugin');
  if (scoped !== scopedProfile)
    throw new Error('Unexpected scoped gather activation');
  return {
    profile: comparisonProfile,
    localPlugin: localPlugin !== null,
    scoped,
    pluginPresent,
    catalogTypes: scoped ? 'all' : null,
    capabilityExtensions: [],
  };
}
