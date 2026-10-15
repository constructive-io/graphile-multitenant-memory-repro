# Local scoped-introspection memory measurements

Generated from 42 fresh-process raw measurements in this directory. Values are medians; MiB = 2^20 bytes.

Node v24.19.0; V8 13.6.233.17-node.51; PostgreSQL 17.7 (Debian 17.7-3.pgdg12+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 12.2.0-14+deb12u1) 12.2.0, 64-bit.

PostGraphile 5.1.5; Grafast 1.1.4; Grafserv 1.0.2; pg 8.23.1.

Source commits: `f11869bd11d8715c6129e791bdddf8607ee89a43`. Raw JSON also records sourceDirty, overall gitDirty (including generated results), and resolved package paths.

Profile: local-scoped. Crystal SHA: not linked.

Every point has a discarded five-request warmup instance. Memory collection waits 5.5 seconds and forces GC three times. Peak RSS is the process lifetime high-water mark, including warmup. Clients execute in separate processes and exit before sampling.

## A: unrelated tenant schemas

| Other tenants N | Total tenants | Repeats | Heap MiB | Baseline MiB | Increment MiB | RSS MiB | Peak RSS MiB | Build ms | After release heap MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | 3 | 33.02 | 29.06 | 3.96 | 115.79 | 115.95 | 704.16 | 29.40 |
| 20 | 21 | 3 | 33.02 | 29.11 | 3.91 | 115.46 | 115.59 | 774.45 | 29.41 |
| 60 | 61 | 3 | 33.04 | 29.11 | 3.92 | 115.76 | 115.76 | 683.34 | 29.42 |
| 150 | 151 | 3 | 33.03 | 29.12 | 3.95 | 115.26 | 115.42 | 639.78 | 29.41 |

Target SDL SHA-256 is invariant: `d01a0e83334d47a180bf6f0b4ead295db6e8dde7c449aa82a09770e09c66c5eb`. The measured target is built but unqueried; the discarded warmup validates the same catalog through real queries.

From N=1 to N=150, process heap with the target live changes by 0.01 MiB (0.00 MiB per added co-tenant). This measures the progressive-introspection problem area. Use the separate same-base comparison to attribute differences between candidate implementations.

## B: simultaneous live instances

| Instances M | Repeats | Heap MiB | Increment MiB | Increment per instance MiB | RSS MiB | Peak RSS MiB | Total build ms | After release heap MiB | After release minus baseline MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 3 | 33.59 | 4.47 | 4.47 | 114.57 | 115.37 | 610.14 | 29.57 | 0.45 |
| 10 | 3 | 70.28 | 41.16 | 4.12 | 247.48 | 247.73 | 5377.71 | 31.41 | 2.30 |
| 50 | 3 | 221.83 | 192.71 | 3.85 | 410.06 | 410.09 | 25479.07 | 30.04 | 0.92 |

The catalog stays at 60 tenants. Every instance is built by a real Host-routed request and runs one identical bounded correctness query. Increment per instance divides the process delta by M; it includes shared and per-instance runtime costs.

### Fixed-capacity rotation

| Completed tenant builds | Live instances | Repeats | Heap MiB | Increment MiB | Released instances |
| --- | --- | --- | --- | --- | --- |
| 60 | 10 | 3 | 70.91 | 41.79 | 50 |
| 120 | 10 | 3 | 71.51 | 42.39 | 110 |
| 180 | 10 | 3 | 71.95 | 42.83 | 170 |
| 240 | 10 | 3 | 72.25 | 43.13 | 230 |
| 300 | 10 | 3 | 72.55 | 43.43 | 290 |

Over the final three complete passes, median heap spans 71.95–72.55 MiB; last minus third pass is 0.60 MiB over 120 additional builds. This finite experiment measures settling/drift; it is not proof of indefinite boundedness.

## C: retained distinct cached operations

| New operations K | Repeats | Verified total plans | Heap MiB | Plan baseline MiB | Increment MiB | KiB per new operation | Forced-GC median ms | RSS MiB | Peak RSS MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 3 | 11 | 37.76 | 33.97 | 3.79 | 387.71 | 13.30 | 116.84 | 117.50 |
| 100 | 3 | 101 | 65.32 | 33.98 | 31.34 | 320.90 | 23.27 | 170.03 | 170.16 |
| 1000 | 3 | 1001 | 329.43 | 33.97 | 295.46 | 302.55 | 141.58 | 556.81 | 556.81 |
| 5000 | 3 | 5001 | 1494.96 | 33.97 | 1460.98 | 299.21 | 859.40 | 1769.80 | 1770.09 |

Each K adds exactly K successful, distinct OperationPlan objects on top of one warmup plan. Replay preserves counts. Both the operations cache and HTTP parsing cache have capacity K+100. The delta includes ASTs, parsing, plans, SQL strings/generated JavaScript and cache overhead. This is the plan-memory-overhaul problem area; it is not a pure plan-object retained-size measurement. GC numbers are explicit full-collection wall times, not automatic-GC percentiles.

## D: isolated build-only snapshots

### N=1 co-tenants (3 separate snapshots)

| Heuristic signature | Count | Shallow MiB | Union retained MiB |
| --- | --- | --- | --- |
| Type row | 505 | 0.14 | 1.09 |
| Build object signature | 1 | 0.00 | 0.40 |
| Attribute row | 75 | 0.02 | 0.12 |
| Class row | 30 | 0.01 | 0.10 |
| Introspection container signature | 1 | 0.00 | 0.05 |
| Constraint row | 21 | 0.00 | 0.05 |
| Procedure row | 5 | 0.00 | 0.02 |
| Namespace row | 3 | 0.00 | 0.00 |

| Constructor | Count | Shallow MiB | Union retained MiB |
| --- | --- | --- | --- |
| Object | 15105 | 0.83 | 11.82 |
| system / Context | 11502 | 0.67 | 6.64 |
| Map | 140 | 0.00 | 4.38 |
| TenantLRU | 1 | 0.00 | 3.51 |
| GraphQLSchema | 1 | 0.00 | 3.49 |
| Array | 7462 | 0.23 | 2.10 |
| Module | 679 | 0.08 | 1.07 |
| GraphQLObjectType | 73 | 0.01 | 0.48 |
| Promise | 146 | 0.01 | 0.45 |
| Behavior | 1 | 0.00 | 0.38 |
| GraphQLInputObjectType | 83 | 0.01 | 0.24 |
| ArrayBuffer | 56 | 0.01 | 0.21 |

### N=150 co-tenants (3 separate snapshots)

| Heuristic signature | Count | Shallow MiB | Union retained MiB |
| --- | --- | --- | --- |
| Type row | 505 | 0.14 | 1.09 |
| Build object signature | 1 | 0.00 | 0.40 |
| Attribute row | 75 | 0.02 | 0.12 |
| Class row | 30 | 0.01 | 0.10 |
| Introspection container signature | 1 | 0.00 | 0.05 |
| Constraint row | 21 | 0.00 | 0.05 |
| Procedure row | 5 | 0.00 | 0.02 |
| Namespace row | 3 | 0.00 | 0.00 |

| Constructor | Count | Shallow MiB | Union retained MiB |
| --- | --- | --- | --- |
| Object | 15104 | 0.83 | 11.85 |
| system / Context | 11502 | 0.67 | 6.65 |
| Map | 140 | 0.00 | 4.38 |
| TenantLRU | 1 | 0.00 | 3.51 |
| GraphQLSchema | 1 | 0.00 | 3.49 |
| Array | 7462 | 0.23 | 2.10 |
| Module | 679 | 0.08 | 1.07 |
| GraphQLObjectType | 73 | 0.01 | 0.48 |
| Promise | 146 | 0.01 | 0.45 |
| Behavior | 1 | 0.00 | 0.38 |
| GraphQLInputObjectType | 83 | 0.01 | 0.24 |
| ArrayBuffer | 56 | 0.01 | 0.21 |

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
