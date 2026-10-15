# TypeScript refactor validation

Measured refactor source: `66b157deefa9ba682822f39e17b05387a1d3b94f`.
Original delivered HEAD: `4221f1fb2ae47efbd57b1a07eb56f4383b21fe32`.
The original formal samples keep their own recorded source SHAs, including
`62a71b2f41f708dcabd7e8bc8da5ab9442bd99ba` for the scoped comparison.

## Implementation and measurement boundary

All implementation, executable adapters and tests are now strict TypeScript under
`src/` and `test/`. There is no parallel top-level scripts source directory and no
JavaScript configuration exception. Native ES2023 ESM output runs directly in Node;
TypeScript compilation and build-receipt validation finish before measured stages.
No loader, tsx, source-map hook, bundler or downlevel async helper is used in workers.

The scenario registry preserves the original points and A → B → rotation → C → D
order. Workers preserve discarded five-request warmup, release, 5.5-second quiet
periods and three forced GCs with event-loop turns. All worker invocations use fresh
processes with `--expose-gc --max-old-space-size=10000` and production environments.
Load children remain separate; snapshots and analysis remain outside ordinary
samples. Leases, mutation serialization, asynchronous release and retry semantics
are unchanged. Promise-returning queue methods remain direct returns.

Fixture SQL was split into reset, tenant definitions/policies/rows and hidden
dependency modules. All 1,000 supported tenant SQL strings and hidden dependency SQL
are byte-identical to the original generator; the test stores original SHA-256
fingerprints. RLS, hidden FK/enum/domain/range/function/inheritance dependencies,
NOTIFY rebuilding, aborted-request leases and real operation-cache counts remain
correctness gates.

Constructive's perf-harness was inspected only for its typed definition,
CLI/orchestration, worker/measurement and report responsibilities. No Constructive
code, imports, dependencies, fixture/schema content or real data is included.
Runtime dependencies and their resolved versions are unchanged. New exact dev
pins are TypeScript, formatter and Node/Express/pg declarations; pnpm's peer path
suffix changes for Node declarations do not change runtime package versions.

## Environment and build preparation

This restored environment did not contain the previous benchmark or Crystal
checkouts. The benchmark was cloned at the delivered HEAD; the common-base and PR2
were restored at their recorded exact SHAs. Their source trees and identical
upstream yarn.lock blob `30ce8fb20d27a304158469c1cf4ccb98d8e2320d` remained clean.
Both upstream checkouts built with TypeScript 5.9.3 using their own build commands.
The harness did not patch upstream implementation.

The pinned PostgreSQL 17.7 Docker Compose image runs on loopback port 55432, with
`max_locks_per_transaction=512`. No Constructive database was used. Node remains
24.19.0 / V8 13.6.233.17-node.51, and pnpm remains 11.19.0. Environment records in
each sample are authoritative; OS CPU enumeration does not describe CPU quota.
The restored cgroup reports a four-CPU quota and 16 GiB memory limit.

Yarn installation initially hit network timeouts. It completed with the existing
proxy settings and npm registry endpoint. Native sqlite3 installation was skipped
with upstream Yarn's `--mode=skip-build`; this unrelated optional development
module is not used by the benchmark. The actual Graphile build used upstream
`ruru-components build-package`, `ruru build-package`, then root `tsc -b`; both
completed successfully. UI webpack emitted size warnings. No source/lockfile was
changed and no runtime package was substituted.

This cloud environment has no writable home cache, so package commands used:

```sh
export XDG_DATA_HOME=/workspace/.cache
export XDG_CACHE_HOME=/workspace/.cache
export pnpm_config_store_dir=/workspace/.pnpm-store
```

These are local cache paths, not repository dependencies or measured worker inputs.

## Completed checks before full matrices

- `pnpm typecheck`, `pnpm build`, `pnpm format:check`: passed.
- `NODE_ENV=production GRAPHILE_ENV=production pnpm test`: 16 passed, zero skipped.
- An independent clean local clone of `66b157d` completed
  `pnpm install --frozen-lockfile`, typecheck, build and the same 16 tests; its Git
  working tree remained clean. Logs are saved beside this record.
- Existing stock/common-base/PR2 reports regenerated exactly from historical JSON.
  The original comparison tables also regenerated exactly before the addition of
  destination-relative output links. All 126 historical samples passed the migrated
  full-matrix verifier using separate verification output files.
- All 238 previously tracked result/evidence files remain byte-identical to
  `4221f1f`; see [history-preservation.json](./history-preservation.json).
- Stock smoke: N=1 and 150, K=10, and one N=1 snapshot. All four fresh workers passed,
  including cache capacity/count/replay checks and snapshot analysis. This smoke
  deliberately is not a full stock matrix. Its report and preflight receipt are in
  [refactor-stock-smoke-2026-10-14](../refactor-stock-smoke-2026-10-14/REPORT.md).

## Timing investigation and same-environment bridge

The first stock N=150 smoke retained 85.20 MiB and took 1973 ms to build, compared
with 87.02 MiB and 609 ms in historical repetition 1. This was investigated instead
of treating historical numbers as validation of the refactored implementation.
An unmodified original JavaScript checkout at `4221f1f` then ran the same N=150
point, followed by a separate TypeScript run, serially in this restored environment.

| N=150 stock check | Retained MiB | Baseline-subtracted MiB | Build ms |
| --- | --- | --- | --- |
| Original JavaScript, same-environment bridge | 87.0802 | 58.2719 | 1166.15 |
| Refactored TypeScript, following bridge | 87.2520 | 58.2688 | 731.37 |

The two bridge runs have identical SDL and runtime dependency versions. Their
baseline-subtracted heap differs by about -0.0031 MiB; the retained-heap difference
is primarily the changed baseline/module footprint. These are single supplemental
observations, not confidence intervals or replacements for the formal matrices.
The original implementation also ran slower than the historical repetition, and
the refactored build time varied substantially between its two observations.
Timing/GC/RSS deltas therefore require caution about host scheduling, database/cache
state and measurement variance; the evidence does not isolate a compiler effect.
Both bridge directories retain their own source identity and raw observations.

## Completed full matrices

The harness changed its runtime module layout, process entry points and provenance
work, so fresh full common-base and PR2 matrices were necessary. Both completed at
the measured source SHA above, with source and emitted build hashes held fixed:
42 workers per profile, 84 total, including six snapshot workers per profile and
12 separately generated analyses. All 84 worker PIDs are distinct. Each group
passed its 16-test preflight and the complete-matrix verifier, followed by the
controlled-comparison verifier. No tests were skipped.

- [Common-base results](../refactor-common-base-2026-10-14/REPORT.md)
- [PR2 results](../refactor-pr2-2026-10-14/REPORT.md)
- [Fresh controlled comparison](./COMPARISON.md)
- [Historical versus refactored measurements](./REFACTOR-COMPARISON.md)
- [All old/new metric deltas](./refactor-deltas.json)
- [Controlled-comparison verification](./comparison-verification.json)

The run names record the start date, October 14; the final PR2 work completed on
October 15 UTC. All runs retain their actual timestamps. These commands ran
serially after compilation, with the cache exports above:

```sh
pnpm crystal:link /workspace/graphile-crystal-common-base common-base
pnpm preflight refactor-common-base-2026-10-14
BENCH_RUN=refactor-common-base-2026-10-14 pnpm bench:all
pnpm verify-results refactor-common-base-2026-10-14
pnpm report refactor-common-base-2026-10-14
pnpm crystal:stock

pnpm crystal:link /workspace/graphile-crystal-pr2 pr2
pnpm preflight refactor-pr2-2026-10-14
BENCH_RUN=refactor-pr2-2026-10-14 pnpm bench:all
pnpm verify-results refactor-pr2-2026-10-14
pnpm report refactor-pr2-2026-10-14
pnpm crystal:stock

pnpm compare refactor-common-base-2026-10-14 refactor-pr2-2026-10-14 results/refactor-validation
pnpm compare:refactor crystal-common-base refactor-common-base-2026-10-14 crystal-pr2 refactor-pr2-2026-10-14 results/refactor-validation
```

An independent local clone of the committed source was checked using
`pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`
and `NODE_ENV=production GRAPHILE_ENV=production pnpm test`. Its logs are preserved
here. Source and emitted hashes are recorded in every new preflight and worker.
The later documentation/evidence commit does not change the measured implementation.
Overall Git dirty state can reflect new reports; `sourceDirty` is false in every
formal worker and explicitly distinguishes source from evidence files.

## Numeric assessment and limitations

The fresh measurements preserve the main scoped-introspection findings. Median
retained heap at N=150 is 87.20 MiB for common-base and 32.80 MiB for PR2, a 62.39%
reduction in total process heap. At 50 retained instances, baseline-subtracted
heap is 1243.91 versus 193.04 MiB. All target SDL hashes match the historical
hash, and N=150 snapshot catalog-object counts and retained signature sizes agree
with the historical results. The five-pass rotation trajectories retain their
shape; the final-minus-third-pass medians are 0.57 and 0.59 MiB.

Relative to historical runs, ordinary baseline heap increased by about 0.17–0.18
MiB. That is consistent with the additional harness modules/provenance; it is not
presented as an upstream change. Common-base A=150 incremental heap changed by
+0.010 MiB, and B=50 by -0.029 MiB. PR2 B=50 increased by 0.452 MiB (0.23%). At
K=5000, incremental heap per cached operation changed from 299.40 to 299.55 KiB
for common-base and from 299.06 to 299.82 KiB for PR2. Every worker still retained
exactly 5001 successful plans in an actual capacity-5100 cache, with replay reuse.
These results support the same memory conclusions; they do not claim identical
absolute allocations after a module-layout refactor.

Timing is less stable. Common-base A=150 median build time increased 10.92%, while
PR2 decreased 13.34%; B=50 increased about 5% in both profiles. D build medians
changed more, including +53.97% at PR2 N=1. At K=5000, median explicit GC pauses
increased from 631.06 to 797.13 ms for common-base (+26.32%) and from 625.88 to
886.09 ms for PR2 (+41.58%). Those differences are material and are retained in
the reports. RSS medians at the same point decreased 1.06% and 2.97%, illustrating
why RSS and GC wall time cannot be inferred from retained JS heap alone.

To investigate the GC change, the unmodified original JavaScript source at
`4221f1f` was linked to the exact common-base checkout in the restored environment.
Its original 12 tests passed, followed by one fresh K=5000 worker:

```sh
# In the separate original-source checkout; these are its historical JS commands.
node scripts/crystal.js link /workspace/graphile-crystal-common-base common-base
NODE_ENV=production GRAPHILE_ENV=production pnpm test
BENCH_RUN=bridge-original-base-plans-2026-10-15 BENCH_REPEATS=1 BENCH_K=5000 node scripts/bench.js c
node scripts/crystal.js stock
```

That original-code observation retained 1497.43 MiB, used 1463.36 MiB above the
plan baseline, and recorded GC pauses of 1098.15, 1205.82 and 1727.62 ms, with
44.44 seconds of load time. It also verified 5001 plans, zero errors and capacity
5100. Its raw result and manifest were copied unchanged to
[the original-code bridge directory](../bridge-original-base-plans-2026-10-15/c-5000-r1.json),
with source SHA `4221f1f` preserved. This observation and the stock bridge show
that slower timing also occurs without the refactor. They do not identify the
cause or establish statistical timing equivalence. Host scheduling, CPU quota,
database/cache state and runtime variability remain confounders; no workload,
warmup, GC protocol, dependency pin or upstream implementation was adjusted to
improve results. The cgroup memory-event counters did not increase during the
matrices or bridge, and no OOM/kill occurred; see the before/after resource records.

A new full stock matrix was not necessary for the selected common-base/PR2
comparison: stock installation, all correctness tests, A=1/150, C=10 and D=1 smoke,
and the original-versus-refactored A=150 bridge cover the registry execution path.
This decision leaves stock's complete numeric matrix historical. The four stock
smoke workers, stock bridge pair and original common-base bridge are supplemental
observations, separate from the 84 new formal samples and the 126 old samples.
The stock smoke adds one snapshot analysis beyond the 12 formal new analyses.
No PR3 duplicate matrix or future plan-memory branch was measured.

## Final review

All implementation, CLI adapters and tests remain TypeScript, with no `any` escape,
type-check suppression or JavaScript configuration exception. The dependency and
import review found no Constructive package, application logic, fixture/schema
content or real data. Original synthetic fixture SQL remains byte-identical.
Raw heap snapshots remain ignored/local; only their JSON analyses are included.
All 238 historical result/evidence files, including 126 samples and 18 analyses,
remain byte-identical to the original delivered HEAD. Both local checkouts were
restored to stock dependencies after their runs.

GitHub reported zero configured Actions workflows. Local validation passed;
there is no hosted CI pass to claim. The delivery check records the Draft PR,
remote branch SHA and any attached checks separately.
