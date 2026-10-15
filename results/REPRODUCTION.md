# Reproduce the focused memory comparison

The current evidence compares published registry **stock** with **local-scoped**
on the same dependency graph. Local scoped is the repository's attributed PR2
adaptation, with `catalogTypes=all` and no capability extensions. The report and
raw JSON identify the exact committed source and emitted build; later result-only
commits do not change those measured inputs.

## Fresh measurements

Use Node 24+, pnpm 11.19.0 and the PostgreSQL 17.7 Compose service. From a fresh
clone, install and build before running tests or workers:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm format:check
pnpm db:up
```

Use two unused run names. The following creates 21 stock and 21 local samples.
Preflight runs the entire correctness suite in production mode and records its
receipt. Run all commands serially, with no competing builds or benchmark jobs.

```sh
BENCH_PROFILE=stock pnpm preflight stock-next
BENCH_PROFILE=local-scoped pnpm preflight local-next
BENCH_PROFILE=stock BENCH_RUN=stock-next pnpm bench:memory
BENCH_PROFILE=local-scoped BENCH_RUN=local-next pnpm bench:memory
pnpm verify-results stock-next --matrix memory
pnpm verify-results local-next --matrix memory
pnpm report stock-next local-next results
```

The runner resets its guarded synthetic database once per point. A uses N=1/20/60/150
other tenants (N+1 total) and one unqueried retained target. B uses M=1/10/50 retained
instances in a fixed 60-tenant fixture, warming each with the same correctness query.
Each point uses three fresh processes. There is no C, D or rotation measurement in
this result set, and no claim about retained operation-plan memory or snapshot
object ownership.

The existing collection contract is unchanged: disposable five-request warmup,
awaited release, a 5.5-second quiet period and three forced GCs at each memory stage;
workers use `--expose-gc --max-old-space-size=10000` in production mode. HTTP clients
run separately and exit before collection. Baseline, retained and released memory,
GC pauses, package paths/versions, source SHA, build hashes and activation are saved
in every raw JSON. Tests retain the release/lease, RLS, invalidation and cache cases.

## Verify and regenerate the published comparison

These commands only read the checked-in raw measurements and regenerate derived
verification and report files; they do not reset the database or run benchmarks:

```sh
pnpm verify-results stock --matrix memory
pnpm verify-results local-scoped --matrix memory
pnpm report stock local-scoped results
```

[COMPARISON.md](COMPARISON.md) is the single report. Each profile directory contains
its 21 raw samples, `manifest-memory.json`, correctness `preflight.json` and
`validation.txt`, and `verification.json`. Root JSON receipts contain comparison
verification and derived metrics. Source/build/format check results are recorded
in `checks.json`.

The verifier requires the exact A/B point set and repetitions, distinct worker
PIDs, invariant A SDL, complete release accounting and matching recorded provenance.
The comparison also requires the expected stock/local activation, identical source,
build and dependencies, and correctness receipts older than every measured worker.
It rejects uncommitted source by default. Overall `gitDirty` may be true because
new output is untracked while the narrower measured `sourceDirty` remains false.

The recorded run used a cgroup with a four-CPU quota and 16 GiB limit. Its snapshots in
[checks.json](checks.json) show no new memory-limit or OOM events. Cumulative CPU
throttling increased by 13.39 seconds during the stock interval and 0.62 seconds
during the local-scoped interval. These cgroup counters cannot identify which
process caused a delay; the serial, unpaired build timings remain descriptive
observations from three repetitions.

All previous tracked result files were removed before this run; they remain
recoverable from [the prior Git commit](https://github.com/Zetazzz/graphile-multitenant-memory-repro/tree/20cd35cb7561aa679718be85c79db001038231c3/results).
No old measurement values were relabelled or reused in this comparison.
