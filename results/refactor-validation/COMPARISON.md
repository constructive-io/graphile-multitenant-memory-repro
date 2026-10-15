# Crystal scoped-introspection comparison

Both groups use the same benchmark source, synthetic SQL, query family, GC protocol, dependency versions, PostgreSQL configuration and three fresh processes per point. Each group completes all 42 workers. The published registry baseline is reported separately because its transitive dependency versions differ.

Shared merge-base: `3ecd1d7920de38dc5ae6ee61763e8223b3b53908`. Identical upstream yarn.lock blob: `30ce8fb20d27a304158469c1cf4ccb98d8e2320d`.

PR2 is the sole scoped representative and enables direct integration with catalogTypes=all and no capability extensions. PR2 and PR3 contain the same scoped algorithm with different integration paths; at the user's direction, no PR3 performance matrix was run.

## Provenance

| Group | Crystal SHA | Detailed results |
| --- | --- | --- |
| common-base | `3ecd1d7920de38dc5ae6ee61763e8223b3b53908` | [Report](./../refactor-common-base-2026-10-14/REPORT.md) |
| pr2 | `434a1f6deddda7786fa2497ad30ca01d598135a1` | [Report](./../refactor-pr2-2026-10-14/REPORT.md) |

Benchmark source: `66b157deefa9ba682822f39e17b05387a1d3b94f`. Identical SDL SHA-256: `d01a0e83334d47a180bf6f0b4ead295db6e8dde7c449aa82a09770e09c66c5eb`. All correctness suites passed before these measurements.

## A: one target with unrelated tenants

| Other tenants | Base heap MiB | PR2 heap MiB | PR2 heap reduction | Base / PR2 build ms |
| --- | --- | --- | --- | --- |
| 1 | 33.24 | 32.77 | 1.42% | 140.24 / 503.43 |
| 20 | 39.69 | 32.77 | 17.45% | 215.28 / 467.82 |
| 60 | 54.37 | 32.77 | 39.72% | 364.04 / 468.64 |
| 150 | 87.20 | 32.80 | 62.39% | 741.88 / 420.78 |

Percent reductions use total process post-GC heap with the target live. Detailed reports also expose baseline-subtracted increments, RSS, peak RSS and post-release heap.

## B: simultaneous instances

| Instances | Base increment MiB | PR2 increment MiB | Base / PR2 MiB per instance | Base / PR2 total build ms | Base / PR2 after-release heap MiB |
| --- | --- | --- | --- | --- | --- |
| 1 | 25.62 | 4.48 | 25.62 / 4.48 | 343.19 / 471.04 | 29.33 / 29.31 |
| 10 | 251.69 | 41.13 | 25.17 / 4.11 | 3290.50 / 4342.15 | 31.14 / 31.28 |
| 50 | 1243.91 | 193.04 | 24.88 / 3.86 | 14771.12 / 20359.73 | 29.65 / 30.12 |

### Capacity-10 rotation

| Completed builds | Base heap MiB | PR2 heap MiB |
| --- | --- | --- |
| 60 | 281.04 | 70.52 |
| 120 | 281.62 | 71.20 |
| 180 | 281.97 | 71.63 |
| 240 | 282.26 | 71.91 |
| 300 | 282.55 | 72.22 |

## C: distinct cached operations

| New operations K | Base / PR2 increment MiB | Base / PR2 KiB per operation | Base / PR2 forced-GC ms |
| --- | --- | --- | --- |
| 10 | 3.77 / 3.76 | 385.95 / 385.48 | 30.91 / 18.25 |
| 100 | 31.36 / 31.31 | 321.15 / 320.65 | 34.59 / 28.98 |
| 1000 | 295.37 / 295.80 | 302.46 / 302.90 | 145.35 / 178.15 |
| 5000 | 1462.62 / 1463.98 | 299.55 / 299.82 | 797.13 / 886.09 |

C verifies K additional successful plans and replay reuse for every group. This candidate changes introspection, not Grafast plan-memory design. Any differences here are indirect; this does not test a plan-memory overhaul.

## D and interpretation limits

Each detailed report contains six separately collected snapshots, full constructor summaries and heuristic catalog/build-object retention signatures. Different retained-size rows overlap and must not be summed. Snapshot-perturbed release measurements are excluded from ordinary release comparisons.

A/B/D address scoped or progressive introspection motivation. Cross-schema dependencies, RLS, SDL and query behavior are correctness gates; dropping functionality is not counted as a memory improvement. RSS remaining high after release is not evidence of a JS leak. Rotation covers 300 builds and cannot establish indefinite boundedness. No separate Benjie development branch or plan-memory overhaul was tested.

### Build-only signatures at N=150

| Heuristic signature | Base / PR2 count | Base / PR2 union retained MiB |
| --- | --- | --- |
| Namespace row | 155 / 3 | 0.20 / 0.00 |
| Class row | 4080 / 30 | 12.52 / 0.10 |
| Type row | 4105 / 505 | 8.79 / 1.09 |
| Attribute row | 10425 / 75 | 15.90 / 0.12 |
| Constraint row | 2871 / 21 | 6.01 / 0.05 |
| Procedure row | 760 / 5 | 1.53 / 0.02 |
| Introspection container signature | 1 / 1 | 3.26 / 0.05 |
| Build object signature | 1 / 1 | 0.40 / 0.40 |

These are heuristic object signatures, not exclusive ownership categories. A zero count can reflect signature limitations; a positive count demonstrates matching reachable objects. The three-repetition medians describe these finite runs and are not confidence intervals.
