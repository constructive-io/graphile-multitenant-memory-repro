# Stock Graphile memory measurements

Generated from 42 fresh-process raw measurements in this directory. Values are medians; MiB = 2^20 bytes.

Node v24.19.0; V8 13.6.233.17-node.51; PostgreSQL 17.7 (Debian 17.7-3.pgdg12+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 12.2.0-14+deb12u1) 12.2.0, 64-bit.

PostGraphile 5.1.5; Grafast 1.1.4; Grafserv 1.0.2; pg 8.23.1.

Source commits: `f11869bd11d8715c6129e791bdddf8607ee89a43`. Raw JSON also records sourceDirty, overall gitDirty (including generated results), and resolved package paths.

Profile: stock. Crystal SHA: not linked.

Every point has a discarded five-request warmup instance. Memory collection waits 5.5 seconds and forces GC three times. Peak RSS is the process lifetime high-water mark, including warmup. Clients execute in separate processes and exit before sampling.

## A: unrelated tenant schemas

| Other tenants N | Total tenants | Repeats | Heap MiB | Baseline MiB | Increment MiB | RSS MiB | Peak RSS MiB | Build ms | After release heap MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | 3 | 33.33 | 28.93 | 4.40 | 115.98 | 116.13 | 117.00 | 29.24 |
| 20 | 21 | 3 | 39.78 | 28.96 | 10.82 | 171.95 | 173.01 | 207.13 | 29.25 |
| 60 | 61 | 3 | 54.45 | 29.00 | 25.45 | 230.40 | 230.40 | 329.03 | 29.26 |
| 150 | 151 | 3 | 87.30 | 29.01 | 58.28 | 332.68 | 332.85 | 698.50 | 29.32 |

Target SDL SHA-256 is invariant: `d01a0e83334d47a180bf6f0b4ead295db6e8dde7c449aa82a09770e09c66c5eb`. The measured target is built but unqueried; the discarded warmup validates the same catalog through real queries.

From N=1 to N=150, process heap with the target live changes by 53.97 MiB (0.36 MiB per added co-tenant). This measures the progressive-introspection problem area. Use the separate same-base comparison to attribute differences between candidate implementations.

## B: simultaneous live instances

| Instances M | Repeats | Heap MiB | Increment MiB | Increment per instance MiB | RSS MiB | Peak RSS MiB | Total build ms | After release heap MiB | After release minus baseline MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 3 | 54.61 | 25.61 | 25.61 | 231.46 | 231.46 | 548.67 | 29.40 | 0.40 |
| 10 | 3 | 280.69 | 251.68 | 25.17 | 557.48 | 557.48 | 4379.26 | 31.23 | 2.23 |
| 50 | 3 | 1273.01 | 1244.01 | 24.88 | 1844.77 | 1844.79 | 18673.19 | 29.91 | 0.91 |

The catalog stays at 60 tenants. Every instance is built by a real Host-routed request and runs one identical bounded correctness query. Increment per instance divides the process delta by M; it includes shared and per-instance runtime costs.

### Fixed-capacity rotation

| Completed tenant builds | Live instances | Repeats | Heap MiB | Increment MiB | Released instances |
| --- | --- | --- | --- | --- | --- |
| 60 | 10 | 3 | 281.18 | 252.18 | 50 |
| 120 | 10 | 3 | 281.76 | 252.76 | 110 |
| 180 | 10 | 3 | 282.12 | 253.12 | 170 |
| 240 | 10 | 3 | 282.39 | 253.39 | 230 |
| 300 | 10 | 3 | 282.66 | 253.66 | 290 |

Over the final three complete passes, median heap spans 282.12–282.66 MiB; last minus third pass is 0.54 MiB over 120 additional builds. This finite experiment measures settling/drift; it is not proof of indefinite boundedness.

## C: retained distinct cached operations

| New operations K | Repeats | Verified total plans | Heap MiB | Plan baseline MiB | Increment MiB | KiB per new operation | Forced-GC median ms | RSS MiB | Peak RSS MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 3 | 11 | 38.06 | 34.28 | 3.78 | 387.51 | 21.63 | 119.67 | 119.67 |
| 100 | 3 | 101 | 65.61 | 34.27 | 31.33 | 320.87 | 23.59 | 173.57 | 173.57 |
| 1000 | 3 | 1001 | 330.19 | 34.28 | 295.92 | 303.02 | 188.58 | 551.67 | 551.67 |
| 5000 | 3 | 5001 | 1497.01 | 34.28 | 1462.74 | 299.57 | 865.56 | 1876.83 | 1877.62 |

Each K adds exactly K successful, distinct OperationPlan objects on top of one warmup plan. Replay preserves counts. Both the operations cache and HTTP parsing cache have capacity K+100. The delta includes ASTs, parsing, plans, SQL strings/generated JavaScript and cache overhead. This is the plan-memory-overhaul problem area; it is not a pure plan-object retained-size measurement. GC numbers are explicit full-collection wall times, not automatic-GC percentiles.

## D: isolated build-only snapshots

### N=1 co-tenants (3 separate snapshots)

| Heuristic signature | Count | Shallow MiB | Union retained MiB |
| --- | --- | --- | --- |
| Type row | 529 | 0.15 | 1.14 |
| Build object signature | 1 | 0.00 | 0.40 |
| Attribute row | 144 | 0.03 | 0.22 |
| Class row | 57 | 0.02 | 0.18 |
| Constraint row | 40 | 0.01 | 0.09 |
| Introspection container signature | 1 | 0.00 | 0.08 |
| Procedure row | 15 | 0.00 | 0.04 |
| Namespace row | 6 | 0.00 | 0.01 |

| Constructor | Count | Shallow MiB | Union retained MiB |
| --- | --- | --- | --- |
| Object | 15492 | 0.88 | 12.37 |
| system / Context | 13064 | 0.75 | 6.80 |
| Map | 140 | 0.00 | 4.85 |
| TenantLRU | 1 | 0.00 | 3.99 |
| GraphQLSchema | 1 | 0.00 | 3.97 |
| Array | 7662 | 0.24 | 2.22 |
| Module | 675 | 0.08 | 1.03 |
| Promise | 162 | 0.01 | 0.54 |
| GraphQLObjectType | 73 | 0.01 | 0.48 |
| Behavior | 1 | 0.00 | 0.38 |
| GraphQLInputObjectType | 83 | 0.01 | 0.24 |
| ArrayBuffer | 56 | 0.01 | 0.21 |

### N=150 co-tenants (3 separate snapshots)

| Heuristic signature | Count | Shallow MiB | Union retained MiB |
| --- | --- | --- | --- |
| Attribute row | 10425 | 2.31 | 15.90 |
| Class row | 4080 | 1.18 | 12.52 |
| Type row | 4105 | 1.13 | 8.79 |
| Constraint row | 2871 | 0.66 | 6.01 |
| Introspection container signature | 1 | 0.00 | 3.26 |
| Procedure row | 760 | 0.20 | 1.53 |
| Build object signature | 1 | 0.00 | 0.40 |
| Namespace row | 155 | 0.01 | 0.20 |

| Constructor | Count | Shallow MiB | Union retained MiB |
| --- | --- | --- | --- |
| Object | 77026 | 8.03 | 65.90 |
| Map | 140 | 0.00 | 58.35 |
| TenantLRU | 1 | 0.00 | 57.47 |
| GraphQLSchema | 1 | 0.00 | 57.45 |
| system / Context | 239692 | 12.48 | 30.74 |
| Array | 41482 | 1.27 | 7.32 |
| Module | 675 | 0.08 | 1.04 |
| GraphQLObjectType | 73 | 0.01 | 0.48 |
| Behavior | 1 | 0.00 | 0.38 |
| GraphQLInputObjectType | 83 | 0.01 | 0.24 |
| ArrayBuffer | 56 | 0.01 | 0.21 |
| Promise | 4185 | 0.19 | 0.20 |

Catalog-row and build-object signatures are evidence of post-build survival where present; they do not prove every retained object can safely be removed. Constructor totals union only outermost same-constructor dominated subtrees. Different rows overlap and MUST NOT be summed. Analysis uses a declared strong-edge model, excludes weak/non-root shortcut edges, and does not reproduce all V8 ephemeron semantics. Snapshot hashes and full constructor summaries are in the analysis JSON. D after-release memory is snapshot-perturbed and is excluded from formal release comparisons.

## Coverage and comparison limits

- Registry stock and the common-base control use Amber only. The local-scoped profile adapts PR2 to the published dependency graph; historical PR2 results refer to the recorded external checkout. No installed implementation is patched by the harness. Checkout provenance distinguishes groups. No separate Benjie development branch was supplied or benchmarked.
- A/D cover catalog retention and build-state survival. B combines this with runtime instance costs and release behavior. C covers one bounded nested operation family; it does not characterize all mutation, subscription or polymorphic plan workloads.
- RLS and cross-schema correctness are tested independently and exercised by each discarded warmup. Lower memory obtained by dropping required dependencies would fail the intended comparison.
- Historical ~0.4 MB/co-tenant/instance and 103→27 MiB figures are sanity references only. This harness uses ten tables per tenant, three repeats, in-process disposable warmup and PostGraphile/Grafserv readiness timing. Cross-version results are not a causal optimization comparison; compare candidates against their exact common base.
- RSS allocator behavior is separate from retained JS heap. A high RSS after release does not establish a JS leak. A finite rotation plateau also cannot rule out slower growth.

## Raw files

- [a-1-r1.json](./a-1-r1.json)
- [a-1-r2.json](./a-1-r2.json)
- [a-1-r3.json](./a-1-r3.json)
- [a-150-r1.json](./a-150-r1.json)
- [a-150-r2.json](./a-150-r2.json)
- [a-150-r3.json](./a-150-r3.json)
- [a-20-r1.json](./a-20-r1.json)
- [a-20-r2.json](./a-20-r2.json)
- [a-20-r3.json](./a-20-r3.json)
- [a-60-r1.json](./a-60-r1.json)
- [a-60-r2.json](./a-60-r2.json)
- [a-60-r3.json](./a-60-r3.json)
- [b-1-r1.json](./b-1-r1.json)
- [b-1-r2.json](./b-1-r2.json)
- [b-1-r3.json](./b-1-r3.json)
- [b-10-r1.json](./b-10-r1.json)
- [b-10-r2.json](./b-10-r2.json)
- [b-10-r3.json](./b-10-r3.json)
- [b-50-r1.json](./b-50-r1.json)
- [b-50-r2.json](./b-50-r2.json)
- [b-50-r3.json](./b-50-r3.json)
- [c-10-r1.json](./c-10-r1.json)
- [c-10-r2.json](./c-10-r2.json)
- [c-10-r3.json](./c-10-r3.json)
- [c-100-r1.json](./c-100-r1.json)
- [c-100-r2.json](./c-100-r2.json)
- [c-100-r3.json](./c-100-r3.json)
- [c-1000-r1.json](./c-1000-r1.json)
- [c-1000-r2.json](./c-1000-r2.json)
- [c-1000-r3.json](./c-1000-r3.json)
- [c-5000-r1.json](./c-5000-r1.json)
- [c-5000-r2.json](./c-5000-r2.json)
- [c-5000-r3.json](./c-5000-r3.json)
- [d-1-r1.json](./d-1-r1.json)
- [d-1-r2.json](./d-1-r2.json)
- [d-1-r3.json](./d-1-r3.json)
- [d-150-r1.json](./d-150-r1.json)
- [d-150-r2.json](./d-150-r2.json)
- [d-150-r3.json](./d-150-r3.json)
- [rotation-10-r1.json](./rotation-10-r1.json)
- [rotation-10-r2.json](./rotation-10-r2.json)
- [rotation-10-r3.json](./rotation-10-r3.json)
