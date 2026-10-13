# Crystal scoped-introspection comparison

Both groups use the same benchmark source, synthetic SQL, query family, GC protocol, dependency versions, PostgreSQL configuration and three fresh processes per point. Each group completes all 42 workers. The published registry baseline is reported separately because its transitive dependency versions differ.

Shared merge-base: `3ecd1d7920de38dc5ae6ee61763e8223b3b53908`. Identical upstream yarn.lock blob: `30ce8fb20d27a304158469c1cf4ccb98d8e2320d`.

PR2 is the sole scoped representative and enables direct integration with catalogTypes=all and no capability extensions. PR2 and PR3 contain the same scoped algorithm with different integration paths; at the user's direction, no PR3 performance matrix was run.

## Provenance

| Group | Crystal SHA | Detailed results |
| --- | --- | --- |
| common-base | `3ecd1d7920de38dc5ae6ee61763e8223b3b53908` | [Report](./crystal-common-base/REPORT.md) |
| pr2 | `434a1f6deddda7786fa2497ad30ca01d598135a1` | [Report](./crystal-pr2/REPORT.md) |

Benchmark source: `62a71b2f41f708dcabd7e8bc8da5ab9442bd99ba`. Identical SDL SHA-256: `d01a0e83334d47a180bf6f0b4ead295db6e8dde7c449aa82a09770e09c66c5eb`. All correctness suites passed before these measurements.

## A: one target with unrelated tenants

| Other tenants | Base heap MiB | PR2 heap MiB | PR2 heap reduction | Base / PR2 build ms |
| --- | --- | --- | --- | --- |
| 1 | 33.04 | 32.59 | 1.38% | 131.21 / 476.72 |
| 20 | 39.51 | 32.58 | 17.52% | 198.76 / 455.63 |
| 60 | 54.17 | 32.74 | 39.56% | 348.98 / 469.79 |
| 150 | 87.01 | 32.59 | 62.55% | 668.82 / 485.53 |

Percent reductions use total process post-GC heap with the target live. Detailed reports also expose baseline-subtracted increments, RSS, peak RSS and post-release heap.

## B: simultaneous instances

| Instances | Base increment MiB | PR2 increment MiB | Base / PR2 MiB per instance | Base / PR2 total build ms | Base / PR2 after-release heap MiB |
| --- | --- | --- | --- | --- | --- |
| 1 | 25.62 | 4.48 | 25.62 / 4.48 | 376.64 / 466.86 | 29.15 / 29.13 |
| 10 | 251.68 | 41.14 | 25.17 / 4.11 | 2694.16 / 4156.07 | 30.94 / 30.96 |
| 50 | 1243.94 | 192.59 | 24.88 / 3.85 | 14038.59 / 19319.54 | 29.48 / 29.52 |

### Capacity-10 rotation

| Completed builds | Base heap MiB | PR2 heap MiB |
| --- | --- | --- |
| 60 | 280.88 | 70.40 |
| 120 | 281.44 | 71.03 |
| 180 | 281.81 | 71.47 |
| 240 | 282.09 | 71.72 |
| 300 | 282.39 | 72.05 |

## C: distinct cached operations

| New operations K | Base / PR2 increment MiB | Base / PR2 KiB per operation | Base / PR2 forced-GC ms |
| --- | --- | --- | --- |
| 10 | 3.80 / 3.81 | 389.37 / 390.04 | 20.54 / 15.21 |
| 100 | 31.39 / 31.36 | 321.43 / 321.09 | 24.64 / 25.27 |
| 1000 | 295.42 / 295.60 | 302.51 / 302.70 | 126.30 / 123.12 |
| 5000 | 1461.89 / 1460.27 | 299.40 / 299.06 | 631.06 / 625.88 |

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
