# Crystal checkout memory measurements

Generated from 42 fresh-process raw measurements in this directory. Values are medians; MiB = 2^20 bytes.

Node v24.19.0; V8 13.6.233.17-node.51; PostgreSQL 17.7 (Debian 17.7-3.pgdg12+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 12.2.0-14+deb12u1) 12.2.0, 64-bit.

PostGraphile 5.1.5; Grafast 1.1.3; Grafserv 1.0.2; pg 8.23.1.

Source commits: `62a71b2f41f708dcabd7e8bc8da5ab9442bd99ba`. Raw JSON also records sourceDirty, overall gitDirty (including generated results), and resolved package paths.

Profile: pr2. Crystal SHA: 434a1f6deddda7786fa2497ad30ca01d598135a1.

Every point has a discarded five-request warmup instance. Memory collection waits 5.5 seconds and forces GC three times. Peak RSS is the process lifetime high-water mark, including warmup. Clients execute in separate processes and exit before sampling.

## A: unrelated tenant schemas

| Other tenants N | Total tenants | Repeats | Heap MiB | Baseline MiB | Increment MiB | RSS MiB | Peak RSS MiB | Build ms | After release heap MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | 3 | 32.59 | 28.68 | 3.91 | 116.78 | 116.96 | 476.72 | 28.98 |
| 20 | 21 | 3 | 32.58 | 28.67 | 3.91 | 130.19 | 130.19 | 455.63 | 28.97 |
| 60 | 61 | 3 | 32.74 | 28.67 | 4.07 | 129.61 | 129.77 | 469.79 | 28.98 |
| 150 | 151 | 3 | 32.59 | 28.68 | 3.91 | 129.71 | 129.71 | 485.53 | 28.98 |

Target SDL SHA-256 is invariant: `d01a0e83334d47a180bf6f0b4ead295db6e8dde7c449aa82a09770e09c66c5eb`. The measured target is built but unqueried; the discarded warmup validates the same catalog through real queries.

From N=1 to N=150, process heap with the target live changes by -0.00 MiB (-0.00 MiB per added co-tenant). This measures the progressive-introspection problem area. Use the separate same-base comparison to attribute differences between candidate implementations.

## B: simultaneous live instances

| Instances M | Repeats | Heap MiB | Increment MiB | Increment per instance MiB | RSS MiB | Peak RSS MiB | Total build ms | After release heap MiB | After release minus baseline MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 3 | 33.15 | 4.48 | 4.48 | 131.91 | 131.91 | 466.86 | 29.13 | 0.46 |
| 10 | 3 | 69.82 | 41.14 | 4.11 | 250.39 | 250.39 | 4156.07 | 30.96 | 2.29 |
| 50 | 3 | 221.26 | 192.59 | 3.85 | 410.54 | 411.08 | 19319.54 | 29.52 | 0.85 |

The catalog stays at 60 tenants. Every instance is built by a real Host-routed request and runs one identical bounded correctness query. Increment per instance divides the process delta by M; it includes shared and per-instance runtime costs.

### Fixed-capacity rotation

| Completed tenant builds | Live instances | Repeats | Heap MiB | Increment MiB | Released instances |
| --- | --- | --- | --- | --- | --- |
| 60 | 10 | 3 | 70.40 | 41.73 | 50 |
| 120 | 10 | 3 | 71.03 | 42.36 | 110 |
| 180 | 10 | 3 | 71.47 | 42.80 | 170 |
| 240 | 10 | 3 | 71.72 | 43.05 | 230 |
| 300 | 10 | 3 | 72.05 | 43.37 | 290 |

Over the final three complete passes, median heap spans 71.47–72.05 MiB; last minus third pass is 0.57 MiB over 120 additional builds. This finite experiment measures settling/drift; it is not proof of indefinite boundedness.

## C: retained distinct cached operations

| New operations K | Repeats | Verified total plans | Heap MiB | Plan baseline MiB | Increment MiB | KiB per new operation | Forced-GC median ms | RSS MiB | Peak RSS MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 3 | 11 | 37.35 | 33.54 | 3.81 | 390.04 | 15.21 | 134.65 | 134.65 |
| 100 | 3 | 101 | 64.91 | 33.54 | 31.36 | 321.09 | 25.27 | 172.91 | 172.91 |
| 1000 | 3 | 1001 | 329.15 | 33.54 | 295.60 | 302.70 | 123.12 | 558.99 | 559.20 |
| 5000 | 3 | 5001 | 1493.81 | 33.53 | 1460.27 | 299.06 | 625.88 | 1836.13 | 1836.70 |

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
| Object | 15088 | 0.83 | 11.61 |
| system / Context | 11523 | 0.67 | 4.72 |
| Map | 140 | 0.00 | 4.24 |
| TenantLRU | 1 | 0.00 | 3.51 |
| GraphQLSchema | 1 | 0.00 | 3.49 |
| Array | 7459 | 0.23 | 1.93 |
| Module | 714 | 0.09 | 0.92 |
| GraphQLObjectType | 73 | 0.01 | 0.47 |
| Promise | 121 | 0.01 | 0.44 |
| Behavior | 1 | 0.00 | 0.38 |
| GraphQLInputObjectType | 83 | 0.01 | 0.24 |
| ArrayBuffer | 58 | 0.01 | 0.21 |

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
| Object | 15087 | 0.83 | 11.61 |
| system / Context | 11523 | 0.67 | 4.74 |
| Map | 140 | 0.00 | 4.24 |
| TenantLRU | 1 | 0.00 | 3.51 |
| GraphQLSchema | 1 | 0.00 | 3.49 |
| Array | 7459 | 0.23 | 1.93 |
| Module | 714 | 0.09 | 0.92 |
| GraphQLObjectType | 73 | 0.01 | 0.47 |
| Promise | 121 | 0.01 | 0.44 |
| Behavior | 1 | 0.00 | 0.38 |
| GraphQLInputObjectType | 83 | 0.01 | 0.24 |
| ArrayBuffer | 58 | 0.01 | 0.21 |

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
