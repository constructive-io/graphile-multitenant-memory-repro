# Stock Graphile memory measurements

Generated from 42 fresh-process raw measurements in this directory. Values are medians; MiB = 2^20 bytes.

Node v24.19.0; V8 13.6.233.17-node.51; PostgreSQL 17.7 (Debian 17.7-3.pgdg12+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 12.2.0-14+deb12u1) 12.2.0, 64-bit.

PostGraphile 5.1.5; Grafast 1.1.4; Grafserv 1.0.2; pg 8.23.1.

Source commits: `be0c142bdd1f6cb9257169c4607e02e0f7708b30`. Raw JSON also records sourceDirty, overall gitDirty (including generated results), and resolved package paths.

Profile: stock. Crystal SHA: not linked.

Every point has a discarded five-request warmup instance. Memory collection waits 5.5 seconds and forces GC three times. Peak RSS is the process lifetime high-water mark, including warmup. Clients execute in separate processes and exit before sampling.

## A: unrelated tenant schemas

| Other tenants N | Total tenants | Repeats | Heap MiB | Baseline MiB | Increment MiB | RSS MiB | Peak RSS MiB | Build ms | After release heap MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | 3 | 33.03 | 28.64 | 4.39 | 116.86 | 116.86 | 128.31 | 28.94 |
| 20 | 21 | 3 | 39.49 | 28.68 | 10.81 | 174.02 | 174.15 | 200.54 | 28.96 |
| 60 | 61 | 3 | 54.16 | 28.72 | 25.44 | 229.96 | 230.09 | 313.42 | 28.97 |
| 150 | 151 | 3 | 87.02 | 28.73 | 58.29 | 326.82 | 327.00 | 608.54 | 29.03 |

Target SDL SHA-256 is invariant: `d01a0e83334d47a180bf6f0b4ead295db6e8dde7c449aa82a09770e09c66c5eb`. The measured target is built but unqueried; the discarded warmup validates the same catalog through real queries.

From N=1 to N=150, process heap with the target live changes by 53.99 MiB (0.36 MiB per added co-tenant). This measures the progressive-introspection problem area. Use the separate same-base comparison to attribute differences between candidate implementations.

## B: simultaneous live instances

| Instances M | Repeats | Heap MiB | Increment MiB | Increment per instance MiB | RSS MiB | Peak RSS MiB | Total build ms | After release heap MiB | After release minus baseline MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 3 | 54.33 | 25.61 | 25.61 | 259.81 | 259.81 | 321.52 | 29.12 | 0.40 |
| 10 | 3 | 280.42 | 251.69 | 25.17 | 576.21 | 576.36 | 2711.14 | 30.94 | 2.22 |
| 50 | 3 | 1272.78 | 1244.08 | 24.88 | 1850.54 | 1850.54 | 12870.14 | 29.51 | 0.81 |

The catalog stays at 60 tenants. Every instance is built by a real Host-routed request and runs one identical bounded correctness query. Increment per instance divides the process delta by M; it includes shared and per-instance runtime costs.

### Fixed-capacity rotation

| Completed tenant builds | Live instances | Repeats | Heap MiB | Increment MiB | Released instances |
| --- | --- | --- | --- | --- | --- |
| 60 | 10 | 3 | 280.88 | 252.16 | 50 |
| 120 | 10 | 3 | 281.43 | 252.72 | 110 |
| 180 | 10 | 3 | 281.79 | 253.07 | 170 |
| 240 | 10 | 3 | 282.04 | 253.32 | 230 |
| 300 | 10 | 3 | 282.37 | 253.65 | 290 |

Over the final three complete passes, median heap spans 281.79–282.37 MiB; last minus third pass is 0.58 MiB over 120 additional builds. This finite experiment measures settling/drift; it is not proof of indefinite boundedness.

## C: retained distinct cached operations

| New operations K | Repeats | Verified total plans | Heap MiB | Plan baseline MiB | Increment MiB | KiB per new operation | Forced-GC median ms | RSS MiB | Peak RSS MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 3 | 11 | 37.79 | 33.98 | 3.81 | 390.28 | 14.79 | 116.75 | 116.75 |
| 100 | 3 | 101 | 65.30 | 33.97 | 31.33 | 320.83 | 22.62 | 171.49 | 171.49 |
| 1000 | 3 | 1001 | 329.40 | 33.98 | 295.42 | 302.51 | 118.38 | 550.96 | 551.46 |
| 5000 | 3 | 5001 | 1497.38 | 33.98 | 1463.40 | 299.70 | 643.18 | 1892.40 | 1893.33 |

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
| Object | 15411 | 0.88 | 12.38 |
| system / Context | 13049 | 0.75 | 6.74 |
| Map | 140 | 0.00 | 4.82 |
| TenantLRU | 1 | 0.00 | 3.99 |
| GraphQLSchema | 1 | 0.00 | 3.97 |
| Array | 7611 | 0.23 | 2.20 |
| Module | 674 | 0.08 | 1.04 |
| Promise | 146 | 0.01 | 0.53 |
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
| Object | 76949 | 8.03 | 65.90 |
| Map | 140 | 0.00 | 58.32 |
| TenantLRU | 1 | 0.00 | 57.48 |
| GraphQLSchema | 1 | 0.00 | 57.46 |
| system / Context | 239678 | 12.48 | 30.69 |
| Array | 41434 | 1.27 | 7.30 |
| Module | 674 | 0.08 | 1.05 |
| GraphQLObjectType | 73 | 0.01 | 0.48 |
| Behavior | 1 | 0.00 | 0.38 |
| GraphQLInputObjectType | 83 | 0.01 | 0.24 |
| ArrayBuffer | 56 | 0.01 | 0.21 |
| Promise | 4169 | 0.19 | 0.19 |

Catalog-row and build-object signatures are evidence of post-build survival where present; they do not prove every retained object can safely be removed. Constructor totals union only outermost same-constructor dominated subtrees. Different rows overlap and MUST NOT be summed. Analysis uses a declared strong-edge model, excludes weak/non-root shortcut edges, and does not reproduce all V8 ephemeron semantics. Snapshot hashes and full constructor summaries are in the analysis JSON. D after-release memory is snapshot-perturbed and is excluded from formal release comparisons.

## Coverage and comparison limits

- Registry stock and the common-base control use Amber only. The explicit PR2/PR3 comparison profiles enable the candidate scoped configuration; PR3 additionally installs its own exported scoped preset. No installed implementation is patched by the harness. Checkout provenance distinguishes these groups. No separate Benjie development branch was supplied or benchmarked.
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
