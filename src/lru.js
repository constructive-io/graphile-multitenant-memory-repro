// Cache mutations are serialized; request execution runs outside this queue.
// A lease pins an entry until its asynchronous work completes, including aborts.
export class TenantLRU {
  entries = new Map();
  stats = { builds: 0, releases: 0, peakSize: 0 };
  #tail = Promise.resolve();
  #closed = false;
  constructor(capacity, build) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Capacity must be positive');
    this.capacity = capacity;
    this.build = build;
  }
  #exclusive(fn) {
    const task = this.#tail.then(fn);
    this.#tail = task.then(() => undefined, () => undefined);
    return task;
  }
  async #remove(key) {
    const entry = this.entries.get(key);
    if (!entry) return;
    if (entry.active) await new Promise(resolve => { entry.drained = resolve; });
    await entry.value.release();
    this.entries.delete(key);
    entry.value = null;
    this.stats.releases++;
  }
  acquire(key) {
    return this.#exclusive(async () => {
      if (this.#closed) throw new Error('Cache is closed');
      let entry = this.entries.get(key);
      if (!entry) {
        if (this.entries.size >= this.capacity) await this.#remove(this.entries.keys().next().value);
        entry = { value: await this.build(key), active: 0, drained: null };
        this.entries.set(key, entry);
        this.stats.builds++;
        this.stats.peakSize = Math.max(this.stats.peakSize, this.entries.size);
      }
      this.entries.delete(key);
      this.entries.set(key, entry);
      entry.active++;
      let live = true;
      return { value: entry.value, done() {
        if (!live) return;
        live = false;
        entry.active--;
        if (!entry.active && entry.drained) { entry.drained(); entry.drained = null; }
      } };
    });
  }
  invalidate(key) { return this.#exclusive(() => this.#remove(key)); }
  clear() { return this.#exclusive(async () => { for (const key of this.entries.keys()) await this.#remove(key); }); }
  close() { return this.#exclusive(async () => { this.#closed = true; for (const key of this.entries.keys()) await this.#remove(key); }); }
  async use(key, fn) {
    const lease = await this.acquire(key);
    try { return await fn(lease.value); } finally { lease.done(); }
  }
}
