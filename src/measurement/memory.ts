import { setTimeout as delay } from 'node:timers/promises';
export const QUIET_MS = 5500;
export async function collectMemory() {
  if (!global.gc) throw new Error('Use --expose-gc');
  await delay(QUIET_MS);
  const gcPausesMs = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    global.gc();
    gcPausesMs.push(performance.now() - start);
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  return {
    ...process.memoryUsage(),
    peakRssBytes: process.resourceUsage().maxRSS * 1024,
    gcPausesMs,
  };
}

export type MemorySample = Awaited<ReturnType<typeof collectMemory>>;
