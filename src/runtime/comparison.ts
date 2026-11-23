import type {} from 'postgraphile';
import { activeProfile, readCrystalState } from './state.js';
import { PostGraphileAmberPreset } from 'postgraphile/presets/amber';
import { PgIntrospectionPlugin as PublishedIntrospectionPlugin } from 'postgraphile/graphile-build-pg';
import type { ComparisonProfile } from './state.js';
import { object } from '../json.js';
import {
  postgraphileSource,
  type PostgraphileSource,
} from './postgraphile-source.js';

/**
 * `BENCH_MULTIPASS` is accepted only with the upstream snapshot, where it must be
 * explicit: it is the single intended difference between the two snapshot modes.
 */
export function selectMultipass(
  source: PostgraphileSource,
  value: string | undefined,
): boolean | null {
  if (source === 'default') {
    if (value !== undefined)
      throw new Error(
        'BENCH_MULTIPASS applies only to the upstream snapshot; use `pnpm test:upstream` or `node --import ./dist/src/runtime/use-upstream-snapshot.js`',
      );
    return null;
  }
  if (value !== '0' && value !== '1')
    throw new Error(
      'Select multipass for the upstream snapshot explicitly: BENCH_MULTIPASS=0 or BENCH_MULTIPASS=1',
    );
  return value === '1';
}

export const comparisonProfile = activeProfile();
export const dependencySource = postgraphileSource();
export const multipass = selectMultipass(
  dependencySource,
  process.env.BENCH_MULTIPASS,
);
if (dependencySource === 'upstream-snapshot') {
  if (readCrystalState())
    throw new Error(
      'Restore registry stock before selecting the upstream snapshot',
    );
  // The local candidate is written against the default graph's internals.
  if (comparisonProfile !== 'stock')
    throw new Error('The upstream snapshot runs only with BENCH_PROFILE=stock');
}
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
// The snapshot's option; the default graph's types do not declare it.
type MultipassGather = GraphileBuild.GatherOptions & {
  pgMultipassIntrospection: boolean;
};
export const comparisonOptions: { gather?: ScopedGather | MultipassGather } =
  multipass !== null
    ? { gather: { pgMultipassIntrospection: multipass } }
    : scopedProfile
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
  // Recorded only when the upstream snapshot is selected.
  postgraphileSource?: PostgraphileSource;
  multipass?: boolean;
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
  if (multipass === null) {
    if (gather.pgMultipassIntrospection !== undefined)
      throw new Error('Unexpected multipass gather option');
  } else if (gather.pgMultipassIntrospection !== multipass)
    throw new Error('Multipass gather option differs from BENCH_MULTIPASS');
  return {
    profile: comparisonProfile,
    localPlugin: localPlugin !== null,
    scoped,
    pluginPresent,
    catalogTypes: scoped ? 'all' : null,
    capabilityExtensions: [],
    ...(multipass === null
      ? {}
      : { postgraphileSource: dependencySource, multipass }),
  };
}
