# Reproduce the focused memory comparison

**The recorded comparison shows lower retained heap for Scoped, with usually
slower builds.** At 150 other schemas, incremental heap fell from 58.28 MiB to
3.92 MiB (93.28%); at 50 retained tenant instances, it fell from 1244.02 MiB to
195.26 MiB (84.30%). These are medians of three workers per point. The 93.28%
figure applies only to incremental heap above baseline, not total heap or RSS.

Read the [comparison report](COMPARISON.md#conclusion) for conclusions and tables.
Use [existing-data regeneration](#verify-and-regenerate-the-published-comparison)
to review the same 42 samples without measuring again, or
[fresh measurements](#fresh-measurements) to collect a new run. To audit the
recorded result, follow the report's [run identity](COMPARISON.md#verified-run-identity),
[raw sample links](COMPARISON.md#raw-measurements) and the receipt descriptions below.

The human names **Stock** and **Scoped** map to `BENCH_PROFILE=stock` and
`BENCH_PROFILE=local-scoped`, respectively. Stock uses published PostGraphile
Amber; Scoped replaces its introspection plugin with the repository's attributed
PR2 adaptation, using `catalogTypes=all` and no capability extensions. Both use the
same dependency graph. The raw JSON and report identify the measured source and
emitted build at
[`b9aa76d027d35e14e00a648cf219025df39f1c5d`](https://github.com/Zetazzz/graphile-multitenant-memory-repro/tree/b9aa76d027d35e14e00a648cf219025df39f1c5d),
before local sources moved under `plugins/`. Later edits to documentation and
report generation do not change those measured inputs or their historical hashes.

## What the two scenarios measure

| Scenario                      | Fixed                                                                                | Varies                                                          | Purpose                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A — Unrelated schema growth   | One built, unqueried target instance                                                 | Other schemas: N = 1, 20, 60, 150; N + 1 tenants in the fixture | Isolate the memory retained by one target as unrelated catalogue schemas grow |
| B — Retained tenant instances | A 60-tenant fixture, with the same correctness query warming every retained instance | Tenant instances: M = 1, 10, 50 held simultaneously             | Measure total retention as more tenant instances stay alive                   |

A's other schemas are synthetic tenant schemas; its target SDL must remain
identical across points and profiles. B's average per-instance increment includes
shared runtime costs. The human labels leave machine identifiers A/B, N/M and raw
JSON fields (`scenario`, `value`, `totalTenants`, `loadedInstances`) unchanged.

**Incremental heap** is retained `heapUsed` minus the same worker's post-warmup
baseline `heapUsed`, computed before taking the median. **Total heap** is the
retained-stage `heapUsed` for the whole process, including its baseline, rather
than V8's `heapTotal` capacity. **RSS** is whole-process resident memory and includes
native allocations and allocator overhead as well as the JavaScript heap. All
three measures cover only the server's Node worker, excluding separate HTTP client
and PostgreSQL processes. Values use MiB (2^20 bytes); differences are Scoped minus
Stock, and percentages use Stock as the denominator. At 150 other schemas, total
heap fell by 62.16% and RSS by 64.96%, distinct from the 93.28% incremental-heap
reduction.

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

Use two unused run names. The following creates 21 Stock and 21 Scoped samples.
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

The runner resets its guarded synthetic database once per point and uses three
fresh processes at each point in the table above, for **42 raw samples total**.
There is no C, D or rotation measurement in this result set, and no claim about
retained operation-plan memory or snapshot object ownership. Run names and raw
workers refuse to overwrite existing evidence; commit source changes before
preflight and use a clean, freshly built source tree.

The existing collection contract is unchanged: disposable five-request warmup,
awaited release, a 5.5-second quiet period and three forced GCs at each memory stage;
workers use `--expose-gc --max-old-space-size=10000` in production mode. HTTP clients
run separately and exit before collection. Baseline, retained and released memory,
GC pauses, package paths/versions, source SHA, build hashes and activation are saved
in every raw JSON. Baseline collection happens after the disposable warmup instance
has been released; retained collection happens while the measured instances remain
alive; released collection follows their awaited disposal. The current readability
revision preserves this protocol and does not rerun the benchmark.

## Correctness coverage and limits

Both measured profiles passed the full production-mode correctness preflight;
their original `preflight.json` and `validation.txt` record the outcome. The suite
checks [HTTP tenant/user isolation and transaction-local RLS settings](../test/integration.test.ts),
hidden cross-schema dependencies, host/user rejection, plan-cache growth and replay,
DDL/NOTIFY rebuilding, and disposal waiting for SQL after a client abort.
[Lifecycle tests](../test/core.test.ts) also cover coalesced first builds, active
leases, awaited release and failed-build recovery.

The [scoped integration fixture](../test/scoped-integration.test.ts) checks matching
SDL hashes and the `__typename` result, dependency metadata for types, functions,
foreign keys, inheritance and indexes, extension metadata/capabilities, and failure
for a missing root schema. That fixture uses `catalogTypes=dependency-closure` with
`pg_trgm` capability extensions, which is broader configuration coverage than the
measured `catalogTypes=all` profile with no capability extensions. Its direct
runtime comparison does not establish equivalence for every query.

[Scoped query](../test/scoped-introspection.test.ts) and
[service tests](../test/scoped-service.test.ts) cover parameterized names, invalid
configuration and missing dependency rejection; [activation tests](../test/activation.test.ts)
check profile selection and package identity. [Report tests](../test/local-comparison.test.ts)
and [provenance tests](../test/review-provenance.test.ts) exercise aggregation,
complete-worker validation and rejection of inconsistent evidence.

These are finite synthetic tests, not exhaustive coverage of PostgreSQL schemas,
extensions or application behavior. Cache and lifecycle tests do not turn this A/B
run into a rotation or cached-operation memory study. The measurements do not
establish indefinite memory bounds, exclusive object ownership, automatic-GC
latency or production request latency.

## Verify and regenerate the published comparison

After installation and build, these commands read the checked-in raw measurements
and regenerate derived verification and report files; they do not reset the
database or run benchmarks:

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
The comparison also requires the expected Stock/Scoped activation, identical source,
build and dependencies, and correctness receipts older than every measured worker.
It rejects measurements recorded from uncommitted source by default. Overall `gitDirty` may be true because
new output is untracked while the narrower measured `sourceDirty` remains false.

The recorded run used a cgroup with a four-CPU quota and 16 GiB limit. Its snapshots in
[checks.json](checks.json) show no new memory-limit or OOM events. Cumulative CPU
throttling increased by 13.39 seconds during the Stock interval and 0.62 seconds
during the Scoped interval. These cgroup counters cannot identify which
process caused a delay; the serial, unpaired build timings remain descriptive
observations from three repetitions. Scoped's median build was slower at six of
seven points; A with 150 other schemas was the exception. Three repetitions are
a limited sample, not confidence intervals, statistical equivalence or a broad
latency guarantee. Peak RSS includes discarded warmup, and high released RSS by
itself does not demonstrate a retained JavaScript leak.

All previous tracked result files were removed before this run; they remain
recoverable from [the prior Git commit](https://github.com/Zetazzz/graphile-multitenant-memory-repro/tree/20cd35cb7561aa679718be85c79db001038231c3/results).
No old measurement values were relabelled or reused in this comparison.
