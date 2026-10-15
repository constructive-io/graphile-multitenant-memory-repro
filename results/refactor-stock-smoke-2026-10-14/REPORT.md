# Stock Graphile memory measurements

Generated from 4 fresh-process raw measurements in this directory. Values are medians; MiB = 2^20 bytes.

Node v24.19.0; V8 13.6.233.17-node.51; PostgreSQL 17.7 (Debian 17.7-3.pgdg12+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 12.2.0-14+deb12u1) 12.2.0, 64-bit.

PostGraphile 5.1.5; Grafast 1.1.4; Grafserv 1.0.2; pg 8.23.1.

Source commits: `66b157deefa9ba682822f39e17b05387a1d3b94f`. Raw JSON also records sourceDirty, overall gitDirty (including generated results), and resolved package paths.

Profile: stock. Crystal SHA: not linked.

Every point has a discarded five-request warmup instance. Memory collection waits 5.5 seconds and forces GC three times. Peak RSS is the process lifetime high-water mark, including warmup. Clients execute in separate processes and exit before sampling.

## A: unrelated tenant schemas

| Other tenants N | Total tenants | Repeats | Heap MiB | Baseline MiB | Increment MiB | RSS MiB | Peak RSS MiB | Build ms | After release heap MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | 1 | 33.28 | 28.89 | 4.39 | 114.87 | 115.05 | 263.21 | 29.19 |
| 150 | 151 | 1 | 85.20 | 28.96 | 56.24 | 317.77 | 318.29 | 1973.34 | 27.24 |

Target SDL SHA-256 is invariant: `d01a0e83334d47a180bf6f0b4ead295db6e8dde7c449aa82a09770e09c66c5eb`. The measured target is built but unqueried; the discarded warmup validates the same catalog through real queries.

From N=1 to N=150, process heap with the target live changes by 51.92 MiB (0.35 MiB per added co-tenant). This measures the progressive-introspection problem area. Use the separate same-base comparison to attribute differences between candidate implementations.

## B: simultaneous live instances

| Instances M | Repeats | Heap MiB | Increment MiB | Increment per instance MiB | RSS MiB | Peak RSS MiB | Total build ms | After release heap MiB | After release minus baseline MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

The catalog stays at 60 tenants. Every instance is built by a real Host-routed request and runs one identical bounded correctness query. Increment per instance divides the process delta by M; it includes shared and per-instance runtime costs.

### Fixed-capacity rotation

## C: retained distinct cached operations

| New operations K | Repeats | Verified total plans | Heap MiB | Plan baseline MiB | Increment MiB | KiB per new operation | Forced-GC median ms | RSS MiB | Peak RSS MiB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 1 | 11 | 38.01 | 34.23 | 3.78 | 387.01 | 28.76 | 117.50 | 117.50 |

Each K adds exactly K successful, distinct OperationPlan objects on top of one warmup plan. Replay preserves counts. Both the operations cache and HTTP parsing cache have capacity K+100. The delta includes ASTs, parsing, plans, SQL strings/generated JavaScript and cache overhead. This is the plan-memory-overhaul problem area; it is not a pure plan-object retained-size measurement. GC numbers are explicit full-collection wall times, not automatic-GC percentiles.

## D: isolated build-only snapshots

### N=1 co-tenants (1 separate snapshots)

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
| Object | 15485 | 0.88 | 12.39 |
| system / Context | 13063 | 0.75 | 6.80 |
| Map | 140 | 0.00 | 4.85 |
| TenantLRU | 1 | 0.00 | 3.98 |
| GraphQLSchema | 1 | 0.00 | 3.97 |
| Array | 7655 | 0.23 | 2.22 |
| Module | 674 | 0.08 | 1.06 |
| Promise | 160 | 0.01 | 0.53 |
| GraphQLObjectType | 73 | 0.01 | 0.48 |
| Behavior | 1 | 0.00 | 0.38 |
| GraphQLInputObjectType | 83 | 0.01 | 0.24 |
| ArrayBuffer | 56 | 0.01 | 0.21 |

Catalog-row and build-object signatures are evidence of post-build survival where present; they do not prove every retained object can safely be removed. Constructor totals union only outermost same-constructor dominated subtrees. Different rows overlap and MUST NOT be summed. Analysis uses a declared strong-edge model, excludes weak/non-root shortcut edges, and does not reproduce all V8 ephemeron semantics. Snapshot hashes and full constructor summaries are in the analysis JSON. D after-release memory is snapshot-perturbed and is excluded from formal release comparisons.

## Coverage and comparison limits

- Registry stock and the common-base control use Amber only. PR2 is the sole measured scoped-introspection candidate. PR3 shares its algorithm but has a different integration path; no PR3 performance matrix was run. No installed implementation is patched by the harness. Checkout provenance distinguishes groups. No separate Benjie development branch was supplied or benchmarked.
- A/D cover catalog retention and build-state survival. B combines this with runtime instance costs and release behavior. C covers one bounded nested operation family; it does not characterize all mutation, subscription or polymorphic plan workloads.
- RLS and cross-schema correctness are tested independently and exercised by each discarded warmup. Lower memory obtained by dropping required dependencies would fail the intended comparison.
- Historical ~0.4 MB/co-tenant/instance and 103→27 MiB figures are sanity references only. This harness uses ten tables per tenant, three repeats, in-process disposable warmup and PostGraphile/Grafserv readiness timing. Cross-version results are not a causal optimization comparison; compare candidates against their exact common base.
- RSS allocator behavior is separate from retained JS heap. A high RSS after release does not establish a JS leak. A finite rotation plateau also cannot rule out slower growth.

## Raw files

- [a-1-r1.json](./a-1-r1.json)
- [a-150-r1.json](./a-150-r1.json)
- [c-10-r1.json](./c-10-r1.json)
- [d-1-r1.json](./d-1-r1.json)
