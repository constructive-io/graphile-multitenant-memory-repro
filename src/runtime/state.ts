import { readJson, object, string, boolean, isMissingFile } from '../json.js';
import { projectPath } from '../paths.js';

export type ComparisonProfile =
  'stock' | 'checkout' | 'common-base' | 'pr2' | 'local-scoped';
export function parseProfile(value: unknown): ComparisonProfile {
  if (
    value === 'stock' ||
    value === 'checkout' ||
    value === 'common-base' ||
    value === 'pr2' ||
    value === 'local-scoped'
  )
    return value;
  throw new Error('Unknown Crystal comparison profile');
}
export interface CrystalState {
  checkout: string;
  profile: ComparisonProfile;
  sha: string;
  dirty: boolean;
  originalLink: string;
  linkedAt: string;
}
export function parseCrystalState(value: unknown): CrystalState {
  const row = object(value);
  return {
    checkout: string(row.checkout),
    profile: parseProfile(row.profile ?? 'checkout'),
    sha: string(row.sha),
    dirty: boolean(row.dirty),
    originalLink: string(row.originalLink),
    linkedAt: string(row.linkedAt),
  };
}
export const stateFile = projectPath('.crystal-state.json');
export function readCrystalState(): CrystalState | null {
  try {
    return parseCrystalState(readJson(stateFile));
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

export function activeProfile(): ComparisonProfile {
  const state = readCrystalState();
  const requested = process.env.BENCH_PROFILE;
  if (requested === undefined) return state?.profile ?? 'stock';
  if (requested !== 'stock' && requested !== 'local-scoped')
    throw new Error('BENCH_PROFILE must be stock or local-scoped');
  if (state)
    throw new Error('Restore registry stock before selecting BENCH_PROFILE');
  return requested;
}
