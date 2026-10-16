# Stock versus Scoped: memory comparison

## Conclusion

Scoped uses less incremental heap at 7 of 7 measured points. At 150 other schemas, incremental heap is 58.28 MiB for Stock and 3.92 MiB for Scoped (-93.28% versus Stock). At 50 retained tenant instances, it is 1244.02 MiB and 195.26 MiB respectively (-84.30%). These results describe the synthetic workloads below.

The -93.28% change at 150 other schemas applies only to incremental heap. Total heap changes by -62.16% and RSS by -64.96% at that point. Scoped has higher median build time at 6 of 7 points. Three repetitions per point are a limited sample, not confidence intervals or production performance guarantees.

Read [the scenarios](#scenarios) and [memory definitions](#memory-definitions) to interpret the tables; use the [reproduction guide](./REPRODUCTION.md) to run or regenerate the comparison; follow [verified run identity](#verified-run-identity) and [raw measurements](#raw-measurements) to audit it.

Both profiles passed clean-source verification and their correctness preflights.

42 independent workers: 21 per profile, with three repetitions at each of seven points. Selection: `memory` (A: 1, 20, 60, 150 other schemas; B: 1, 10, 50 tenant instances).

Only A/B retention and release are measured. This selection does not measure cached-operation growth, rotation, or heap-snapshot ownership.

Stock (`BENCH_PROFILE=stock`) uses published PostGraphile Amber. Scoped (`BENCH_PROFILE=local-scoped`) replaces only its introspection plugin with the local PR2 adaptation, using `catalogTypes=all` and no capability extensions. Both groups use the same installed dependency graph, source commit, compiled build, recorded environment, warmup and GC settings. These reader names map to the unchanged `stock` and `local-scoped` commands, directories and raw profile values.

## Scenarios

### A: Unrelated schema growth

- Fixed: one built, unqueried target tenant instance, with the same target schema and an invariant SDL hash.
- Varies: **Other schemas**, the number of unrelated tenant schemas (N = 1, 20, 60, 150); the fixture contains N + 1 tenants.
- Purpose: measure how much one target retains as the surrounding database catalogue grows, without target query-plan warmup.

![Scenario A: one retained target instance as unrelated schemas grow in one PostgreSQL database](../docs/diagrams/other-schemas.svg)

*A — Other schemas.* The database contains `tenant_000`, N unrelated tenant schemas and the shared `bench_types` schema. Only one built, unqueried Graphile instance is retained as N varies.

### B: Retained tenant instances

- Fixed: a 60-tenant catalogue and the same single correctness query for each retained instance.
- Varies: **Tenant instances**, the number retained simultaneously (M = 1, 10, 50), each built through a real Host-routed request.
- Purpose: measure aggregate process memory as more tenant instances stay live; the per-instance average includes shared runtime costs.

![Scenario B: more warmed tenant instances retained against the same 60-tenant PostgreSQL database](../docs/diagrams/tenant-instances.svg)

*B — Tenant instances.* The database stays at 60 tenant schemas plus `bench_types`. Each of the M retained Graphile instances is warmed once with the same Host-routed correctness query.

The diagrams show catalogue metadata and retained instances, not data-row growth or concurrent request load. Stock gathers broad catalogue metadata; Scoped focuses on the target and required cross-schema dependencies. The measured `catalogTypes=all` setting also includes all `pg_catalog` types.

A/B remain the scenario identifiers (raw `scenario` values `a`/`b`, with N or M in `value`). The short labels above change only presentation; raw field names and measurements are unchanged.

## Memory definitions

- **Incremental heap**: `retained.heapUsed - baseline.heapUsed` for each worker (`heapDelta`), then the median of three workers. The baseline follows a discarded five-request warmup instance, awaited release, a 5.5-second quiet period and three forced GCs.
- **Total heap**: `retained.heapUsed`, the whole worker's used JavaScript heap while the measured instances are live, after the same quiet period and GC protocol. It includes the baseline runtime; it is not V8's allocated `heapTotal` field or the exclusive retained size of tenant objects.
- **RSS**: `retained.rss`, the worker process's resident memory, including JavaScript heap and native/allocator memory. It excludes the separate PostgreSQL and client processes. Peak RSS is the process lifetime high-water mark and includes discarded warmup.

MiB = 2^20 bytes. Each metric is aggregated independently. In particular, the median of worker increments need not equal the median total heap minus the median baseline. RSS and total heap percentages must not be read as incremental-heap percentages.

## Incremental heap

Δ is Scoped minus Stock; a negative value means lower memory. Percentages use Stock as the denominator.

| Point | Stock MiB | Scoped MiB | Δ MiB | Δ % |
| --- | ---: | ---: | ---: | ---: |
| Other schemas: 1 (A) | 4.41 | 3.91 | -0.50 | -11.28% |
| Other schemas: 20 (A) | 10.82 | 3.91 | -6.91 | -63.86% |
| Other schemas: 60 (A) | 25.45 | 3.95 | -21.49 | -84.46% |
| Other schemas: 150 (A) | 58.28 | 3.92 | -54.36 | -93.28% |
| Tenant instances: 1 (B) | 25.62 | 4.47 | -21.15 | -82.56% |
| Tenant instances: 10 (B) | 251.73 | 41.15 | -210.58 | -83.65% |
| Tenant instances: 50 (B) | 1244.02 | 195.26 | -1048.76 | -84.30% |

As Other schemas grows from 1 to 150 in A, Stock incremental heap moves from 4.41 to 58.28 MiB; Scoped moves from 3.91 to 3.92 MiB. B measures a different cost: keeping more queried tenant instances alive within one fixed catalogue. The two scenarios hold different variables fixed, so their rows are not interchangeable.

### Increment per tenant instance

| Tenant instances | Stock MiB/instance | Scoped MiB/instance | Δ MiB/instance | Δ % |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 25.62 | 4.47 | -21.15 | -82.56% |
| 10 | 25.17 | 4.11 | -21.06 | -83.65% |
| 50 | 24.88 | 3.91 | -20.98 | -84.30% |

Each B worker divides its incremental heap by its retained instance count before aggregation. This is an average process increment, including shared costs; it does not isolate the ownership or marginal cost of one additional instance.

### Total heap and process baseline

| Point | Stock total heap MiB | Scoped total heap MiB | Δ MiB | Δ % | Stock baseline MiB | Scoped baseline MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Other schemas: 1 (A) | 33.33 | 33.02 | -0.31 | -0.93% | 28.92 | 29.11 |
| Other schemas: 20 (A) | 39.78 | 33.02 | -6.76 | -16.99% | 28.97 | 29.11 |
| Other schemas: 60 (A) | 54.45 | 33.07 | -21.38 | -39.27% | 29.00 | 29.12 |
| Other schemas: 150 (A) | 87.29 | 33.03 | -54.26 | -62.16% | 29.01 | 29.12 |
| Tenant instances: 1 (B) | 54.62 | 33.58 | -21.04 | -38.52% | 29.00 | 29.11 |
| Tenant instances: 10 (B) | 280.73 | 70.27 | -210.46 | -74.97% | 29.00 | 29.12 |
| Tenant instances: 50 (B) | 1273.01 | 224.37 | -1048.64 | -82.37% | 29.00 | 29.11 |

At 150 other schemas, total heap is 87.29 MiB for Stock and 33.03 MiB for Scoped (-62.16%). Including the baseline changes the quantities being compared, so this percentage differs from the incremental-heap comparison.

## Appendix: build timing

Values are median [minimum, maximum] milliseconds across three independent workers. A measures target readiness; B sums instance build durations. Repetitions are not paired across profiles. Three samples describe observed variation and do not establish confidence intervals or broad latency guarantees.

| Point | Stock ms [min, max] | Scoped ms [min, max] | Δ ms | Δ % |
| --- | ---: | ---: | ---: | ---: |
| Other schemas: 1 (A) | 127.83 [127.46, 132.25] | 573.39 [546.40, 601.02] | 445.56 | 348.57% |
| Other schemas: 20 (A) | 212.48 [202.79, 212.88] | 584.21 [405.55, 629.63] | 371.73 | 174.95% |
| Other schemas: 60 (A) | 358.83 [321.68, 382.42] | 515.73 [487.80, 684.94] | 156.91 | 43.73% |
| Other schemas: 150 (A) | 826.00 [580.56, 909.42] | 586.14 [408.39, 1539.47] | -239.87 | -29.04% |
| Tenant instances: 1 (B) | 323.36 [288.65, 338.37] | 708.93 [653.56, 1050.56] | 385.57 | 119.24% |
| Tenant instances: 10 (B) | 3042.17 [2688.09, 3230.91] | 6405.80 [6378.09, 6625.36] | 3363.63 | 110.57% |
| Tenant instances: 50 (B) | 16915.42 [16180.53, 17345.68] | 37394.49 [31386.47, 38501.97] | 20479.07 | 121.07% |

Scoped has higher median build time at 6 of 7 measured points. Read this as the observed memory/build-time tradeoff for this implementation; the three unpaired repetitions cannot establish a general speed claim. B totals sum instance build durations, not concurrent request latency.

## Appendix: GC and release

Forced-GC values are median [minimum, maximum] of the three worker pause medians. Each worker waits 5.5 seconds and performs three explicit collections. These are controlled collection costs, not automatic-GC or request-latency percentiles.

| Point | Stock GC ms [min, max] | Scoped GC ms [min, max] | Δ ms | Δ % |
| --- | ---: | ---: | ---: | ---: |
| Other schemas: 1 (A) | 12.62 [12.54, 15.49] | 22.04 [13.97, 22.91] | 9.43 | 74.71% |
| Other schemas: 20 (A) | 17.13 [16.55, 19.07] | 18.14 [12.26, 29.45] | 1.01 | 5.90% |
| Other schemas: 60 (A) | 23.23 [22.74, 24.26] | 12.40 [12.39, 14.81] | -10.83 | -46.63% |
| Other schemas: 150 (A) | 41.17 [40.53, 44.66] | 24.36 [14.99, 31.96] | -16.81 | -40.84% |
| Tenant instances: 1 (B) | 24.08 [22.96, 30.12] | 20.15 [14.15, 69.20] | -3.93 | -16.32% |
| Tenant instances: 10 (B) | 165.05 [154.87, 165.44] | 74.94 [66.63, 79.87] | -90.11 | -54.60% |
| Tenant instances: 50 (B) | 841.09 [768.57, 896.43] | 181.47 [131.47, 336.93] | -659.62 | -78.42% |

Compare the pause ranges as well as their medians: these small samples describe explicit collection under the retained workload and do not predict user-visible pauses.

Release measurements follow awaited disposal and GC. Excess heap is calculated against the same worker’s baseline before aggregation; it can be signed, so it is shown without a percentage.

| Point | Stock after release MiB | Scoped after release MiB | Stock excess MiB | Scoped excess MiB | Δ excess MiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| Other schemas: 1 (A) | 29.24 | 29.41 | 0.31 | 0.30 | -0.02 |
| Other schemas: 20 (A) | 29.25 | 29.41 | 0.28 | 0.30 | 0.02 |
| Other schemas: 60 (A) | 29.26 | 29.46 | 0.26 | 0.34 | 0.08 |
| Other schemas: 150 (A) | 29.31 | 29.42 | 0.30 | 0.30 | 0.00 |
| Tenant instances: 1 (B) | 29.41 | 29.56 | 0.41 | 0.44 | 0.03 |
| Tenant instances: 10 (B) | 31.24 | 31.43 | 2.24 | 2.31 | 0.07 |
| Tenant instances: 50 (B) | 29.80 | 32.55 | 0.80 | 3.44 | 2.64 |

Post-release excess shows what remains above each worker's own warmup baseline after awaited disposal and collection. Near-baseline heap is useful lifecycle evidence, but a single release measurement cannot prove the absence of a slow leak.

## Appendix: resident memory

| Point | Stock RSS MiB | Scoped RSS MiB | Δ MiB | Δ % | Stock peak MiB | Scoped peak MiB | Stock released RSS MiB | Scoped released RSS MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Other schemas: 1 (A) | 115.34 | 115.51 | 0.17 | 0.15% | 115.34 | 115.64 | 114.78 | 115.09 |
| Other schemas: 20 (A) | 173.12 | 116.56 | -56.56 | -32.67% | 175.02 | 116.71 | 173.12 | 116.16 |
| Other schemas: 60 (A) | 231.56 | 115.86 | -115.70 | -49.97% | 231.71 | 115.86 | 231.36 | 115.39 |
| Other schemas: 150 (A) | 329.76 | 115.54 | -214.22 | -64.96% | 329.89 | 115.54 | 329.05 | 115.02 |
| Tenant instances: 1 (B) | 229.35 | 115.87 | -113.48 | -49.48% | 229.61 | 115.87 | 229.30 | 115.36 |
| Tenant instances: 10 (B) | 574.07 | 246.76 | -327.30 | -57.02% | 574.07 | 246.92 | 571.88 | 242.45 |
| Tenant instances: 50 (B) | 1839.36 | 424.90 | -1414.46 | -76.90% | 1839.54 | 425.06 | 1824.21 | 401.24 |

RSS includes allocator/native behaviour and peak RSS includes discarded warmup. A high released RSS alone does not demonstrate a retained JavaScript leak. These finite synthetic workloads do not establish indefinite bounds or characterize every schema family.

## Correctness coverage and limits

The recorded preflights ran the correctness suite before measurement. [HTTP integration tests](../test/integration.test.ts) check concurrent tenant/user RLS isolation, transaction-local settings, hidden cross-schema types and functions, range/array values, inheritance, hidden-root exclusion, plan-cache growth and replay, NOTIFY rebuilds after DDL, and release waiting for an aborted client's running SQL. [Lifecycle tests](../test/core.test.ts) cover coalescing, request leases, eviction and release ordering.

[Scoped integration tests](../test/scoped-integration.test.ts) compare SDL and inspect dependency closure, including transitive types, functions, relations, indexes, partitions and extension capabilities. That separate fixture uses `catalogTypes=dependency-closure` and `pg_trgm`; its direct Stock/Scoped execution equality check is only `{ __typename }`. It is broader configuration coverage, not the measured `catalogTypes=all` configuration or an exhaustive query-equivalence test. [Scoped query tests](../test/scoped-introspection.test.ts) and [service tests](../test/scoped-service.test.ts) check option handling and defensive service configuration.

These synthetic tests and the invariant A SDL are correctness gates for this reproduction, not proof of full production compatibility or isolation for every schema, extension, mutation or subscription. Worker warmup runs the bounded smoke query and checks errors and request identity; it does not repeat all integration assertions. Cached-operation growth, rotation and snapshot ownership remain outside these A/B measurements even where related behavior has test coverage. No separate PR3 or plan-memory overhaul is benchmarked.

## Verified run identity

The source and build hashes below identify the measured implementation. Regenerating this report from the same raw files does not replace them with the current documentation or report-generator revision.

Source commit: `b9aa76d027d35e14e00a648cf219025df39f1c5d`. Compiler: `5.9.3`.

Source SHA-256: `06d8935e170f0f33a47204aa797ba8a0daf16b48d25e83fd3128331330cec771`. Emitted SHA-256: `45b8fae086a9735fc232f51591e60a51098fff5604d5602cb3379a1665b89fc9`.

A target SDL SHA-256, identical across points and profiles: `d01a0e83334d47a180bf6f0b4ead295db6e8dde7c449aa82a09770e09c66c5eb`.

Node v24.19.0; V8 13.6.233.17-node.51; PostgreSQL 17.7 (Debian 17.7-3.pgdg12+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 12.2.0-14+deb12u1) 12.2.0, 64-bit.

| Dependency | Version in both profiles |
| --- | --- |
| postgraphile | 5.1.5 |
| grafast | 1.1.4 |
| grafserv | 1.0.2 |
| graphile-build | 5.1.1 |
| graphile-build-pg | 5.1.5 |
| @dataplan/pg | 1.1.2 |
| pg-introspection | 1.0.1 |
| graphql | 16.14.2 |
| pg | 8.23.1 |
| express | 4.22.3 |

- Stock (`stock`): [memory manifest](./stock/manifest-memory.json), [correctness preflight](./stock/preflight.json), [run verification](./stock/verification.json).
- Scoped (`local-scoped`): [memory manifest](./local-scoped/manifest-memory.json), [correctness preflight](./local-scoped/preflight.json), [run verification](./local-scoped/verification.json).

Exact medians, ranges and deltas: [metrics](./local-metrics.json). Input hashes and verification summary: [comparison receipt](./comparison-verification.json).

## Raw measurements

Every cell links the three independent worker records; all 42 observations are retained.

| Point | Stock repetitions | Scoped repetitions |
| --- | --- | --- |
| Other schemas: 1 (A) | [1](./stock/a-1-r1.json), [2](./stock/a-1-r2.json), [3](./stock/a-1-r3.json) | [1](./local-scoped/a-1-r1.json), [2](./local-scoped/a-1-r2.json), [3](./local-scoped/a-1-r3.json) |
| Other schemas: 20 (A) | [1](./stock/a-20-r1.json), [2](./stock/a-20-r2.json), [3](./stock/a-20-r3.json) | [1](./local-scoped/a-20-r1.json), [2](./local-scoped/a-20-r2.json), [3](./local-scoped/a-20-r3.json) |
| Other schemas: 60 (A) | [1](./stock/a-60-r1.json), [2](./stock/a-60-r2.json), [3](./stock/a-60-r3.json) | [1](./local-scoped/a-60-r1.json), [2](./local-scoped/a-60-r2.json), [3](./local-scoped/a-60-r3.json) |
| Other schemas: 150 (A) | [1](./stock/a-150-r1.json), [2](./stock/a-150-r2.json), [3](./stock/a-150-r3.json) | [1](./local-scoped/a-150-r1.json), [2](./local-scoped/a-150-r2.json), [3](./local-scoped/a-150-r3.json) |
| Tenant instances: 1 (B) | [1](./stock/b-1-r1.json), [2](./stock/b-1-r2.json), [3](./stock/b-1-r3.json) | [1](./local-scoped/b-1-r1.json), [2](./local-scoped/b-1-r2.json), [3](./local-scoped/b-1-r3.json) |
| Tenant instances: 10 (B) | [1](./stock/b-10-r1.json), [2](./stock/b-10-r2.json), [3](./stock/b-10-r3.json) | [1](./local-scoped/b-10-r1.json), [2](./local-scoped/b-10-r2.json), [3](./local-scoped/b-10-r3.json) |
| Tenant instances: 50 (B) | [1](./stock/b-50-r1.json), [2](./stock/b-50-r2.json), [3](./stock/b-50-r3.json) | [1](./local-scoped/b-50-r1.json), [2](./local-scoped/b-50-r2.json), [3](./local-scoped/b-50-r3.json) |
