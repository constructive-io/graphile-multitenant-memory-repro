# Scoped-introspection findings

The selected PR2 implementation substantially reduces retained catalog memory in
this synthetic multitenant workload, with a build-time tradeoff. It does not
materially reduce the cost of keeping thousands of distinct operation plans.
The [generated comparison](COMPARISON.md) links all raw samples and detailed tables.

The causal comparison is the unmodified common base at
`3ecd1d7920de38dc5ae6ee61763e8223b3b53908` versus unmodified PR2 at
`434a1f6deddda7786fa2497ad30ca01d598135a1`. Both use the same dependency versions,
upstream lockfile, harness commit, database settings, fixtures, query family and
collection protocol. Each group completed 42 fresh processes, three per point,
including six separately collected and analyzed snapshots. The published stock
baseline completed its own 42-process matrix; its newer transitive dependencies
make it a separate baseline, not the control for attributing PR2's effect.

## Catalog and instance memory: A and B

At 150 unrelated tenant schemas, whole-process post-GC heap with one target live
falls from **87.01 to 32.59 MiB**, a **62.55%** reduction. PR2 stays within
32.58–32.74 MiB across N=1/20/60/150. The target is additional to N, so N=150 means
151 total tenant schemas. Target SDL is identical in every accepted group and at
every scale. This addresses the catalog-memory motivation for progressive or
scoped introspection.

With the same fixed 60-tenant catalog and 50 simultaneously live instances,
baseline-subtracted heap falls from **1,243.94 to 192.59 MiB**, an **84.52%**
reduction, or **24.88 to 3.85 MiB per instance**. Total process heap is 1,272.67
versus 221.26 MiB. These percentages use different denominators from scenario A.
After all instances are evicted and released, process heap is about 29.5 MiB in
both groups. RSS can stay elevated because process memory allocation is distinct
from retained JavaScript objects.

Capacity-10 rotation across 60 tenants ends at **282.39 versus 72.05 MiB** after
300 builds. Both groups retain a small positive drift of about 0.57 MiB over the
last 120 builds. The cache releases old instances, but this finite experiment does
not establish a perfectly flat plateau or indefinite boundedness.

## Build-time tradeoff

At N=1, median target build time increases from **131.21 to 476.72 ms**. At N=150,
it decreases from **668.82 to 485.53 ms**. Building 50 instances against the fixed
60-tenant catalog takes **14.04 versus 19.32 seconds**, about 37.6% longer for PR2.
Thus lower memory does not imply uniformly faster builds. Build timing includes
PostGraphile and Grafserv readiness, excluding SDL printing and hashing.

## Cached operations: C

At K=5,000, incremental process heap is **1,461.89 versus 1,460.27 MiB**, or
**299.40 versus 299.06 KiB per additional cached operation**. This approximately
0.11% difference is not evidence of a meaningful plan-memory improvement. Median
explicit full-GC wall time is **631.06 versus 625.88 ms**; three repetitions do not
establish a statistically significant latency difference.

Every process verifies 5,001 real successful plans, including its one warmup plan,
and unchanged counts on replay. The memory delta includes ASTs, parsing, plans,
SQL strings/generated JavaScript and cache overhead; client responses are consumed
in another process. This measures a plan-memory problem area, but the candidate
does not implement a Grafast plan-memory overhaul. No separate Benjie development
branch or plan-memory fix was supplied or tested.

## Post-build survival: D

At N=150, matching reachable catalog objects fall from **10,425 to 75 attribute
rows**, **4,080 to 30 class rows**, and **4,105 to 505 type rows**. PR2's catalog
signature counts are the same at N=1 and N=150. Necessary hidden cross-schema enum
FK, domain, range, function argument/return type and inheritance behavior remains
covered by correctness tests. Scoped collection preserves this fixture's required
dependencies.

One heuristic build-object signature remains in each group at about **0.40 MiB**
union retained size. This is a negative result for eliminating that signature;
it does not prove that all its retained objects are avoidable. Constructor and
signature retained-size rows overlap and must never be summed. The analysis uses
the declared strong-edge dominator model and does not reproduce every V8 ephemeron
or native-memory semantic. Full analyses and snapshot hashes accompany the raw
worker JSON; the large raw snapshots remain local and can be regenerated.

## Scope and correctness

All three complete matrices passed automated coverage, provenance, real cache
count, lifecycle and SDL checks. Twelve correctness tests also passed on stock,
common base and PR2, covering RLS, request settings, hidden dependencies, concurrent
first builds, leases and aborted requests, awaited release, schema invalidation,
plan reuse and dominator analysis.

PR2 is the sole measured scoped representative. PR3 shares the scoped algorithm
but integrates it differently; it was built and correctness-tested before the user
narrowed scope. **There are no PR3 performance samples or inferred PR3 results.**
No Graphile implementation was patched by the harness. These finite measurements
cover synthetic tables and one bounded nested operation family, not all mutations,
subscriptions, polymorphic plans or production tenant workloads. All values above
are three-process medians, not confidence intervals.
