// Cache mutations are serialized; request execution runs outside this queue.
// A lease pins an entry until its asynchronous work completes, including aborts.
export interface Releasable {
  release(): PromiseLike<void> | void;
}
export interface CacheStats {
  builds: number;
  releases: number;
  peakSize: number;
}
interface Entry<T> {
  value: T | null;
  active: number;
  drained: (() => void) | null;
}
export interface Lease<T> {
  value: T;
  done(): void;
}
export class TenantLRU<T extends Releasable> {
  entries = new Map<string, Entry<T>>();
  stats = { builds: 0, releases: 0, peakSize: 0 };
  #tail = Promise.resolve();
  #closed = false;
  constructor(
    readonly capacity: number,
    readonly build: (key: string) => Promise<T>,
  ) {
    if (!Number.isInteger(capacity) || capacity < 1)
      throw new Error('Capacity must be positive');
  }
  #exclusive<R>(fn: () => Promise<R>): Promise<R> {
    const task = this.#tail.then(fn);
    this.#tail = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }
  async #remove(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return;
    if (entry.active)
      await new Promise<void>((resolve) => {
        entry.drained = resolve;
      });
    if (!entry.value) throw new Error('Cannot remove a released entry');
    await entry.value.release();
    this.entries.delete(key);
    entry.value = null;
    this.stats.releases++;
  }
  acquire(key: string): Promise<Lease<T>> {
    return this.#exclusive(async () => {
      if (this.#closed) throw new Error('Cache is closed');
      let entry = this.entries.get(key);
      if (!entry) {
        if (this.entries.size >= this.capacity) {
          const oldest = this.entries.keys().next();
          if (!oldest.done) await this.#remove(oldest.value);
        }
        entry = { value: await this.build(key), active: 0, drained: null };
        this.entries.set(key, entry);
        this.stats.builds++;
        this.stats.peakSize = Math.max(this.stats.peakSize, this.entries.size);
      }
      this.entries.delete(key);
      this.entries.set(key, entry);
      entry.active++;
      if (!entry.value) throw new Error('Cannot lease a released entry');
      let live = true;
      return {
        value: entry.value,
        done() {
          if (!live) return;
          live = false;
          entry.active--;
          if (!entry.active && entry.drained) {
            entry.drained();
            entry.drained = null;
          }
        },
      };
    });
  }
  invalidate(key: string) {
    return this.#exclusive(() => this.#remove(key));
  }
  clear() {
    return this.#exclusive(async () => {
      for (const key of this.entries.keys()) await this.#remove(key);
    });
  }
  close() {
    return this.#exclusive(async () => {
      this.#closed = true;
      for (const key of this.entries.keys()) await this.#remove(key);
    });
  }
  async use<R>(key: string, fn: (value: T) => R | Promise<R>): Promise<R> {
    const lease = await this.acquire(key);
    try {
      return await fn(lease.value);
    } finally {
      lease.done();
    }
  }
}
