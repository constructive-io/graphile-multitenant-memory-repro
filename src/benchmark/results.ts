import type { CacheStats } from '../runtime/lru.js';
import type { ComparisonActivation } from '../runtime/comparison.js';
import type { MemorySample } from '../measurement/memory.js';
import type { RecordedEnvironment } from '../measurement/provenance.js';
import type { CacheCounts } from '../measurement/cache-probe.js';

export interface RotationRound {
  round: number;
  completedBuilds: number;
  size: number;
  stats: CacheStats;
  memory: MemorySample;
  heapDelta: number;
}
export type StageResult =
  | {
      scenario: 'a' | 'd';
      sdlHash: string;
      buildMs: number;
      retained: MemorySample;
      heapDelta: number;
      snapshot?: string;
    }
  | {
      scenario: 'b';
      buildMs: number;
      retained: MemorySample;
      heapDelta: number;
      heapPerInstance: number;
      loadedInstances: number;
    }
  | { scenario: 'rotation'; rounds: RotationRound[]; retained: MemorySample }
  | {
      scenario: 'c';
      planBaseline: MemorySample;
      cacheBefore: CacheCounts;
      cacheAfter: CacheCounts;
      loadMs: number;
      retained: MemorySample;
      heapDelta: number;
      heapPerPlan: number;
    };
export interface CommonResult {
  value: number;
  totalTenants: number;
  capacity: number;
  environment: RecordedEnvironment;
  warmup: { instances: number; requests: number };
  comparisonActivation: ComparisonActivation;
  baseline: MemorySample;
  statsBefore: CacheStats;
  statsLoaded: CacheStats;
  afterRelease: MemorySample;
  statsAfter: CacheStats;
}
export type WorkerResult = CommonResult & StageResult;
