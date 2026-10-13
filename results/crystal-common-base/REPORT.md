# Crystal checkout memory measurements

Generated from 42 fresh-process raw measurements in this directory. Values are medians; MiB = 2^20 bytes.

Node v24.19.0; V8 13.6.233.17-node.51; PostgreSQL 17.7 (Debian 17.7-3.pgdg12+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 12.2.0-14+deb12u1) 12.2.0, 64-bit.

PostGraphile 5.1.5; Grafast 1.1.3; Grafserv 1.0.2; pg 8.23.1.

Source commits: `62a71b2f41f708dcabd7e8bc8da5ab9442bd99ba`. Raw JSON also records sourceDirty, overall gitDirty (including generated results), and resolved package paths.

Profile: common-base. Crystal SHA: 3ecd1d7920de38dc5ae6ee61763e8223b3b53908.

Every point has a discarded five-request warmup instance. Memory collection waits 5.5 seconds and forces GC three times. Peak RSS is the process lifetime high-water mark, including warmup. Clients execute in separate processes and exit before sampling.

## A: unrelated tenant schemas

| Other tenants N | Total tenants | Repeats | Heap MiB | Baseline MiB | Increment MiB | RSS MiB | Peak RSS MiB | Build ms | After release heap MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | 3 | 33.04 | 28.66 | 4.38 | 132.00 | 132.14 | 131.21 | 28.95 |
| 20 | 21 | 3 | 39.51 | 28.70 | 10.81 | 174.64 | 174.81 | 198.76 | 28.97 |
| 60 | 61 | 3 | 54.17 | 28.74 | 25.44 | 231.42 | 231.56 | 348.98 | 28.98 |
| 150 | 151 | 3 | 87.01 | 28.74 | 58.27 | 329.30 | 329.53 | 668.82 | 29.03 |

Target SDL SHA-256 is invariant: `d01a0e83334d47a180bf6f0b4ead295db6e8dde7c449aa82a09770e09c66c5eb`. The measured target is built but unqueried; the discarded warmup validates the same catalog through real queries.

From N=1 to N=150, process heap with the target live changes by 53.97 MiB (0.36 MiB per added co-tenant). This measures the progressive-introspection problem area. Use the separate same-base comparison to attribute differences between candidate implementations.

## B: simultaneous live instances

| Instances M | Repeats | Heap MiB | Increment MiB | Increment per instance MiB | RSS MiB | Peak RSS MiB | Total build ms | After release heap MiB | After release minus baseline MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 3 | 54.36 | 25.62 | 25.62 | 231.31 | 231.45 | 376.64 | 29.15 | 0.41 |
| 10 | 3 | 280.41 | 251.68 | 25.17 | 573.83 | 573.83 | 2694.16 | 30.94 | 2.20 |
| 50 | 3 | 1272.67 | 1243.94 | 24.88 | 1846.99 | 1846.99 | 14038.59 | 29.48 | 0.75 |

The catalog stays at 60 tenants. Every instance is built by a real Host-routed request and runs one identical bounded correctness query. Increment per instance divides the process delta by M; it includes shared and per-instance runtime costs.

### Fixed-capacity rotation

| Completed tenant builds | Live instances | Repeats | Heap MiB | Increment MiB | Released instances |
| --- | --- | --- | --- | --- | --- |
| 60 | 10 | 3 | 280.88 | 252.13 | 50 |
| 120 | 10 | 3 | 281.44 | 252.70 | 110 |
| 180 | 10 | 3 | 281.81 | 253.07 | 170 |
| 240 | 10 | 3 | 282.09 | 253.35 | 230 |
| 300 | 10 | 3 | 282.39 | 253.64 | 290 |

Over the final three complete passes, median heap spans 281.81–282.39 MiB; last minus third pass is 0.58 MiB over 120 additional builds. This finite experiment measures settling/drift; it is not proof of indefinite boundedness.

## C: retained distinct cached operations

| New operations K | Repeats | Verified total plans | Heap MiB | Plan baseline MiB | Increment MiB | KiB per new operation | Forced-GC median ms | RSS MiB | Peak RSS MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 3 | 11 | 37.80 | 34.00 | 3.80 | 389.37 | 20.54 | 120.15 | 120.15 |
| 100 | 3 | 101 | 65.40 | 34.01 | 31.39 | 321.43 | 24.64 | 176.48 | 176.48 |
| 1000 | 3 | 1001 | 329.42 | 34.00 | 295.42 | 302.51 | 126.30 | 545.73 | 545.96 |
| 5000 | 3 | 5001 | 1495.90 | 34.01 | 1461.89 | 299.40 | 631.06 | 1922.05 | 1923.04 |

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
| Object | 15507 | 0.88 | 12.06 |
| system / Context | 13100 | 0.76 | 4.90 |
| Map | 140 | 0.00 | 4.73 |
| TenantLRU | 1 | 0.00 | 3.99 |
| GraphQLSchema | 1 | 0.00 | 3.97 |
| Array | 7692 | 0.24 | 2.06 |
| Module | 713 | 0.09 | 0.93 |
| Promise | 148 | 0.01 | 0.53 |
| GraphQLObjectType | 73 | 0.01 | 0.48 |
| Behavior | 1 | 0.00 | 0.38 |
| GraphQLInputObjectType | 83 | 0.01 | 0.24 |
| ArrayBuffer | 58 | 0.01 | 0.21 |

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
| Object | 77043 | 8.03 | 65.58 |
| Map | 140 | 0.00 | 58.21 |
| TenantLRU | 1 | 0.00 | 57.47 |
| GraphQLSchema | 1 | 0.00 | 57.46 |
| system / Context | 239728 | 12.48 | 28.83 |
| Array | 41512 | 1.27 | 7.15 |
| Module | 713 | 0.09 | 0.93 |
| GraphQLObjectType | 73 | 0.01 | 0.48 |
| Behavior | 1 | 0.00 | 0.38 |
| GraphQLInputObjectType | 83 | 0.01 | 0.24 |
| ArrayBuffer | 58 | 0.01 | 0.21 |
| EventEmitter | 33 | 0.00 | 0.21 |

Catalog-row and build-object signatures are evidence of post-build survival where present; they do not prove every retained object can safely be removed. Constructor totals union only outermost same-constructor dominated subtrees. Different rows overlap and MUST NOT be summed. Analysis uses a declared strong-edge model, excludes weak/non-root shortcut edges, and does not reproduce all V8 ephemeron semantics. Snapshot hashes and full constructor summaries are in the analysis JSON. D after-release memory is snapshot-perturbed and is excluded from formal release comparisons.

## Coverage and comparison limits

- Registry stock and the common-base control use Amber only. PR2 is the sole measured scoped-introspection candidate. PR3 shares its algorithm but has a different integration path; no PR3 performance matrix was run. No installed implementation is patched by the harness. Checkout provenance distinguishes groups. No separate Benjie development branch was supplied or benchmarked.
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
