# Stock versus local scoped introspection: memory

Both profiles passed clean-source verification and their correctness preflights.

42 independent workers: 21 per profile, with three repetitions at each of seven points. Selection: `memory` (A: 1, 20, 60, 150 other tenants; B: 1, 10, 50 live instances).

Only A/B retention and release are measured. This selection does not measure cached-operation growth, rotation, or heap-snapshot ownership.

Stock uses published PostGraphile Amber. Scoped replaces only its introspection plugin with the local implementation, using `catalogTypes=all` and no capability extensions. Both groups use the same installed dependency graph, source commit, compiled build, recorded environment, warmup and GC settings.

## Incremental retained heap

Each worker subtracts its discarded-warmup baseline from its retained heap before the three-worker median is taken. Δ is scoped minus stock; a negative value means lower memory. Percentages use stock as the denominator.

| Point | Stock MiB | Scoped MiB | Δ MiB | Δ % |
| --- | ---: | ---: | ---: | ---: |
| A N=1 | 4.41 | 3.91 | -0.50 | -11.28% |
| A N=20 | 10.82 | 3.91 | -6.91 | -63.86% |
| A N=60 | 25.45 | 3.95 | -21.49 | -84.46% |
| A N=150 | 58.28 | 3.92 | -54.36 | -93.28% |
| B M=1 | 25.62 | 4.47 | -21.15 | -82.56% |
| B M=10 | 251.73 | 41.15 | -210.58 | -83.65% |
| B M=50 | 1244.02 | 195.26 | -1048.76 | -84.30% |

A retains one built, unqueried target among N unrelated tenant schemas. B retains M queried instances in a fixed 60-tenant catalogue; its incremental heap includes shared runtime costs.

### Increment per live instance

| Instances | Stock MiB/instance | Scoped MiB/instance | Δ MiB/instance | Δ % |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 25.62 | 4.47 | -21.15 | -82.56% |
| 10 | 25.17 | 4.11 | -21.06 | -83.65% |
| 50 | 24.88 | 3.91 | -20.98 | -84.30% |

### Total retained heap and process baseline

| Point | Stock retained MiB | Scoped retained MiB | Δ MiB | Δ % | Stock baseline MiB | Scoped baseline MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A N=1 | 33.33 | 33.02 | -0.31 | -0.93% | 28.92 | 29.11 |
| A N=20 | 39.78 | 33.02 | -6.76 | -16.99% | 28.97 | 29.11 |
| A N=60 | 54.45 | 33.07 | -21.38 | -39.27% | 29.00 | 29.12 |
| A N=150 | 87.29 | 33.03 | -54.26 | -62.16% | 29.01 | 29.12 |
| B M=1 | 54.62 | 33.58 | -21.04 | -38.52% | 29.00 | 29.11 |
| B M=10 | 280.73 | 70.27 | -210.46 | -74.97% | 29.00 | 29.12 |
| B M=50 | 1273.01 | 224.37 | -1048.64 | -82.37% | 29.00 | 29.11 |

## Appendix: build timing

Values are median [minimum, maximum] milliseconds across three independent workers. A measures target readiness; B sums instance build durations. Repetitions are not paired across profiles. Three samples describe observed variation and do not establish confidence intervals or broad latency guarantees.

| Point | Stock ms [min, max] | Scoped ms [min, max] | Δ ms | Δ % |
| --- | ---: | ---: | ---: | ---: |
| A N=1 | 127.83 [127.46, 132.25] | 573.39 [546.40, 601.02] | 445.56 | 348.57% |
| A N=20 | 212.48 [202.79, 212.88] | 584.21 [405.55, 629.63] | 371.73 | 174.95% |
| A N=60 | 358.83 [321.68, 382.42] | 515.73 [487.80, 684.94] | 156.91 | 43.73% |
| A N=150 | 826.00 [580.56, 909.42] | 586.14 [408.39, 1539.47] | -239.87 | -29.04% |
| B M=1 | 323.36 [288.65, 338.37] | 708.93 [653.56, 1050.56] | 385.57 | 119.24% |
| B M=10 | 3042.17 [2688.09, 3230.91] | 6405.80 [6378.09, 6625.36] | 3363.63 | 110.57% |
| B M=50 | 16915.42 [16180.53, 17345.68] | 37394.49 [31386.47, 38501.97] | 20479.07 | 121.07% |

## Appendix: GC and release

Forced-GC values are median [minimum, maximum] of the three worker pause medians. Each worker waits 5.5 seconds and performs three explicit collections. These are controlled collection costs, not automatic-GC or request-latency percentiles.

| Point | Stock GC ms [min, max] | Scoped GC ms [min, max] | Δ ms | Δ % |
| --- | ---: | ---: | ---: | ---: |
| A N=1 | 12.62 [12.54, 15.49] | 22.04 [13.97, 22.91] | 9.43 | 74.71% |
| A N=20 | 17.13 [16.55, 19.07] | 18.14 [12.26, 29.45] | 1.01 | 5.90% |
| A N=60 | 23.23 [22.74, 24.26] | 12.40 [12.39, 14.81] | -10.83 | -46.63% |
| A N=150 | 41.17 [40.53, 44.66] | 24.36 [14.99, 31.96] | -16.81 | -40.84% |
| B M=1 | 24.08 [22.96, 30.12] | 20.15 [14.15, 69.20] | -3.93 | -16.32% |
| B M=10 | 165.05 [154.87, 165.44] | 74.94 [66.63, 79.87] | -90.11 | -54.60% |
| B M=50 | 841.09 [768.57, 896.43] | 181.47 [131.47, 336.93] | -659.62 | -78.42% |

Release measurements follow awaited disposal and GC. Excess heap is calculated against the same worker’s baseline before aggregation; it can be signed, so it is shown without a percentage.

| Point | Stock after release MiB | Scoped after release MiB | Stock excess MiB | Scoped excess MiB | Δ excess MiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| A N=1 | 29.24 | 29.41 | 0.31 | 0.30 | -0.02 |
| A N=20 | 29.25 | 29.41 | 0.28 | 0.30 | 0.02 |
| A N=60 | 29.26 | 29.46 | 0.26 | 0.34 | 0.08 |
| A N=150 | 29.31 | 29.42 | 0.30 | 0.30 | 0.00 |
| B M=1 | 29.41 | 29.56 | 0.41 | 0.44 | 0.03 |
| B M=10 | 31.24 | 31.43 | 2.24 | 2.31 | 0.07 |
| B M=50 | 29.80 | 32.55 | 0.80 | 3.44 | 2.64 |

## Appendix: resident memory

| Point | Stock RSS MiB | Scoped RSS MiB | Δ MiB | Δ % | Stock peak MiB | Scoped peak MiB | Stock released RSS MiB | Scoped released RSS MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A N=1 | 115.34 | 115.51 | 0.17 | 0.15% | 115.34 | 115.64 | 114.78 | 115.09 |
| A N=20 | 173.12 | 116.56 | -56.56 | -32.67% | 175.02 | 116.71 | 173.12 | 116.16 |
| A N=60 | 231.56 | 115.86 | -115.70 | -49.97% | 231.71 | 115.86 | 231.36 | 115.39 |
| A N=150 | 329.76 | 115.54 | -214.22 | -64.96% | 329.89 | 115.54 | 329.05 | 115.02 |
| B M=1 | 229.35 | 115.87 | -113.48 | -49.48% | 229.61 | 115.87 | 229.30 | 115.36 |
| B M=10 | 574.07 | 246.76 | -327.30 | -57.02% | 574.07 | 246.92 | 571.88 | 242.45 |
| B M=50 | 1839.36 | 424.90 | -1414.46 | -76.90% | 1839.54 | 425.06 | 1824.21 | 401.24 |

RSS includes allocator/native behaviour and peak RSS includes discarded warmup. A high released RSS alone does not demonstrate a retained JavaScript leak. These finite synthetic workloads do not establish indefinite bounds or characterize every schema family.

## Verified run identity

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

- stock: [memory manifest](./stock/manifest-memory.json), [correctness preflight](./stock/preflight.json), [run verification](./stock/verification.json).
- local-scoped: [memory manifest](./local-scoped/manifest-memory.json), [correctness preflight](./local-scoped/preflight.json), [run verification](./local-scoped/verification.json).

Exact medians, ranges and deltas: [metrics](./local-metrics.json). Input hashes and verification summary: [comparison receipt](./comparison-verification.json).

## Raw measurements

Every cell links the three independent worker records; all 42 observations are retained.

| Point | Stock repetitions | Scoped repetitions |
| --- | --- | --- |
| A N=1 | [1](./stock/a-1-r1.json), [2](./stock/a-1-r2.json), [3](./stock/a-1-r3.json) | [1](./local-scoped/a-1-r1.json), [2](./local-scoped/a-1-r2.json), [3](./local-scoped/a-1-r3.json) |
| A N=20 | [1](./stock/a-20-r1.json), [2](./stock/a-20-r2.json), [3](./stock/a-20-r3.json) | [1](./local-scoped/a-20-r1.json), [2](./local-scoped/a-20-r2.json), [3](./local-scoped/a-20-r3.json) |
| A N=60 | [1](./stock/a-60-r1.json), [2](./stock/a-60-r2.json), [3](./stock/a-60-r3.json) | [1](./local-scoped/a-60-r1.json), [2](./local-scoped/a-60-r2.json), [3](./local-scoped/a-60-r3.json) |
| A N=150 | [1](./stock/a-150-r1.json), [2](./stock/a-150-r2.json), [3](./stock/a-150-r3.json) | [1](./local-scoped/a-150-r1.json), [2](./local-scoped/a-150-r2.json), [3](./local-scoped/a-150-r3.json) |
| B M=1 | [1](./stock/b-1-r1.json), [2](./stock/b-1-r2.json), [3](./stock/b-1-r3.json) | [1](./local-scoped/b-1-r1.json), [2](./local-scoped/b-1-r2.json), [3](./local-scoped/b-1-r3.json) |
| B M=10 | [1](./stock/b-10-r1.json), [2](./stock/b-10-r2.json), [3](./stock/b-10-r3.json) | [1](./local-scoped/b-10-r1.json), [2](./local-scoped/b-10-r2.json), [3](./local-scoped/b-10-r3.json) |
| B M=50 | [1](./stock/b-50-r1.json), [2](./stock/b-50-r2.json), [3](./stock/b-50-r3.json) | [1](./local-scoped/b-50-r1.json), [2](./local-scoped/b-50-r2.json), [3](./local-scoped/b-50-r3.json) |
