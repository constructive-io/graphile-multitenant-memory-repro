# Supplemental interleaved timing controls

This targeted run supplements the full matrices; it is not another complete matrix
and contains no diagnostic snapshot analyses. The raw files, worker order, start/end
timestamps, PIDs and content receipts are recorded in [manifest.json](manifest.json).
[summary.json](summary.json) contains every series range and median plus paired ratios.

## Observations

All 21 workers completed with distinct PIDs, clean source, matching recorded
environments, unchanged build receipts and successful cache checks. Copies of all
raw worker files, the manifest and summary are byte-identical to their originals;
[preservation.json](preservation.json) records their hashes.

Times below are **median [minimum–maximum] milliseconds**, with three workers per
series. Paired ratios follow repetition order, not sorted timing order.

| Workload | Old stock | Current stock | Median change | Current / old paired ratios |
| --- | ---: | ---: | ---: | --- |
| B10 buildMs | 2,783.48 [2,735.88–3,425.88] | 3,100.14 [2,916.43–3,746.56] | +11.38% | 1.0936, 1.0478, 1.1331 |
| B50 buildMs | 13,729.22 [13,016.05–19,395.25] | 16,916.65 [14,968.41–22,715.26] | +23.22% | 1.2997, 1.0903, 1.1712 |
| C5000 loadMs | 36,537.55 [24,231.00–48,240.50] | 34,880.73 [25,241.69–52,959.16] | -4.53% | 0.9547, 1.0417, 1.0978 |

Current local C5000 load time was **29,051.52 [23,891.40–37,464.00] ms**, a -16.71% median change relative to current stock.
Its local/stock paired load ratios were **1.0741, 1.1509, 0.4511**.

| Memory metric | Old stock | Current stock | Current local |
| --- | ---: | ---: | ---: |
| B10 increment/instance, MiB | 25.170349 | 25.167478 | — |
| B50 increment/instance, MiB | 24.881384 | 24.879827 | — |
| C5000 increment/operation, KiB | 299.705814 | 299.415047 | 299.841203 |

The source comparison retains positive B10/B50 timing gaps; inspection did not
identify a cause. C5000 varies substantially within each series and its profile
comparison depends on both repetition and aggregation. These controls do **not**
establish timing equivalence or remove the slower observations from the full
matrices. Memory continuity is much tighter than timing continuity. Per-worker
process/plan baselines, RSS, release memory and explicit-GC timings are retained
in the raw files and summary.

## Resource observations

The bridge added no memory-limit or OOM events: all `memory.events` counters stayed unchanged (cumulative `max=21917`, `oom=0`, `oom_kill=0`).
Earlier cumulative snapshots record `max=0` before the matrices, `max=7419` in
the later after-matrices receipt, and `max=21917` before this bridge. Those samples
do not isolate which earlier workload incurred each event; no OOM was recorded.
The recorded CPU quota was 400,000 microseconds
per 100,000-microsecond period (four CPU equivalents).
The cgroup accumulated 649 throttled periods and 51.750 seconds of reported throttled time during this run.
These cumulative resource observations do not isolate host scheduling or prove
that throttling caused a particular timing difference. Before/after memory and
CPU receipts are retained alongside this report.

## Protocol

Two independently installed, clean clones were used: old TypeScript source
`fbcb21cdd054deb5f7fdcfb68c22cb200bd20e9c` and current source
`f11869bd11d8715c6129e791bdddf8607ee89a43`. Both used their own registry installation,
identical dependency locks, Node/V8 versions, recorded PostgreSQL settings, and
production mode. Neither was linked to an external checkout. Current-local differs only by selecting
`BENCH_PROFILE=local-scoped`; it uses the same current build as current-stock.

The driver checked unchanged source/build receipts before and after the run and
verified each worker's source, profile and dependency provenance. It also checked
byte-identical fixtures, scenario definitions, stage implementation and GC protocol
between commits. No build, test suite or other benchmark ran concurrently.

There are 21 fresh workers: three repetitions of old-stock and current-stock at
B10 and B50, then three repetitions of old-stock, current-stock and current-local
at C5000. Pair order alternates for B, with the initial order reversed at B50.
C order rotates so each series occupies each position once. Fixtures reset once
per point: 60 tenants for each B point and two for C. Original worker code preserves
warmup, 5.5-second quiet periods, three forced GCs, separate HTTP client processes,
release and cache checks. C verifies one warmup plan, 5,001 final plans/operations,
capacity 5,100 and zero errors.

To reproduce these selected points after building both commits, use their existing
compiled worker CLI in the order and profiles listed in the manifest. From the
old clone run `pnpm db:fixture 60` before each B point and `pnpm db:fixture 2` before
C5000. Create a new output directory first (`mkdir /absolute/new-output`); the
worker does not create its parent directory and refuses to overwrite a file.
Then from the clone for each listed worker, use a new absolute output path:

```sh
env -i PATH="$PATH" NODE_ENV=production GRAPHILE_ENV=production \
  node --expose-gc --max-old-space-size=10000 dist/src/cli/worker.js \
  b 10 /absolute/new-output/old-b-10-r1.json
```

Substitute scenario/value/output for each manifest entry. For current workers,
add `BENCH_PROFILE=stock` or `BENCH_PROFILE=local-scoped` to that environment.
If using a documented database override, also pass `BENCH_PG_PORT` or
`BENCH_DATABASE_URL` to both fixture and worker commands. Keep all workers serial and retain their JSON.

## Interpretation limits

B build time sums instance readiness measurements. C load time includes client
startup, HTTP, execution, planning and automatic GC; it does not isolate planning.
The explicit forced-GC metric is measured separately after the quiet period.
Three repetitions and alternating/rotating order can expose variability, but do
not establish statistical equivalence or identify its cause. Source comparisons
use current-stock divided by old-stock; profile comparisons use current-local
divided by current-stock. Ratios above one mean larger measured values.

## Source-path review

[stock-path-audit.json](stock-path-audit.json) records byte-identical dependency
locks and 11 core dependency entry files across the clones. Current stock supplies
the same Amber configuration, skips local imports, and adds one plugin-array
filter/identity check inside the build timer. No additional schema or SQL workload
was found. Expanded provenance hashing happens before warmup and baseline
collection. This inspection did not establish the cause of any timing difference.
