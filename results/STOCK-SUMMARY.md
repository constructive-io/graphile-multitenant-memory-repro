# Published stock findings

The complete stock matrix passed: 42 fresh Node processes, three repetitions per
point, and six separately analyzed build-only snapshots. It ran from a clean remote
clone at `be0c142bdd1f6cb9257169c4607e02e0f7708b30`, using pinned registry
PostGraphile 5.1.5 with Amber only. Docker PostgreSQL 17.7 was actually used.
[Detailed tables and raw JSON](./stock-2026-10-13/REPORT.md) and
[machine-checked matrix evidence](./stock-2026-10-13/verification.json) are retained.

| Problem area | Observed magnitude | Interpretation |
| --- | --- | --- |
| Unrelated catalog retention | With one target live, N=1 to N=150 **other** tenants raises post-GC process heap from 33.03 to 87.02 MiB; build readiness rises from 128.31 to 608.54 ms | About 0.362 MiB, or 0.380 decimal MB, per added co-tenant per instance; relevant to progressive/scoped introspection |
| Many live instances | A fixed 60-tenant catalog and 50 live instances retain 1,272.78 MiB total heap, an increment of 1,244.08 MiB or 24.88 MiB per instance | Per-instance retention compounds; includes catalog and runtime costs |
| Lifecycle release | Those 50 instances return to 29.51 MiB after awaited release and GC, 0.81 MiB above the discarded-warmup baseline | No substantial retained JS-instance leak is demonstrated by this release test; RSS is a separate allocator measure |
| Fixed-capacity rotation | Capacity 10, 300 tenant builds: median heap 280.88 to 282.37 MiB across five passes; final three passes differ by 0.58 MiB | Small finite drift after settling, not proof of indefinite boundedness |
| Cached operations | K=5,000 adds 1,463.40 MiB, or 299.70 KiB per added operation; 5,001 actual plans are verified, including the warm plan | Relevant to plan-memory-overhaul motivation; includes AST, parsing, execution plans, generated code and cache overhead |
| Forced GC | At K=5,000, explicit full-GC wall time has a 643.18 ms median | A controlled collection cost, not an automatic-GC or request-latency percentile |

All A and D points have the same target SDL SHA-256. Correctness tests and discarded
warmup requests exercise RLS, Host/user isolation, and required cross-schema
dependencies. Functionality was not removed to reduce memory.

Build-only snapshots show catalog objects still reachable after schema construction.
At N=150, the property signatures identify 10,425 attribute rows, 4,080 class rows,
4,105 type rows, 760 procedure rows, one introspection container and one build-object
signature. The build signature has about 0.40 MiB union retained size. This is
evidence of survival, not proof that every retained object is unnecessary at runtime.
Constructor and signature retained-size rows overlap and must not be summed.

The historical roughly 0.4 MB per co-tenant per instance is directionally consistent
with this fixture; no workload was tuned to reproduce that number. The historical
103-to-27 MiB comparison is not reproduced by the stock-only matrix. Separate
same-base Crystal candidate groups are required to test an optimization's effect.

Coverage remains bounded: one ten-table synthetic schema family, finite HTTP
operations, one nested plan family and 300-build rotations. Mutation, subscription
and polymorphic plan families are not characterized. Neither a high post-release
RSS nor these finite runs establishes a JS leak or proves that none can occur.
