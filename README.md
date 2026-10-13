# Graphile multitenant memory benchmark

A private, standalone, synthetic reproduction for planning issue #2228. The stock
baseline uses only PostGraphile's Amber preset. Explicit, separate comparison
profiles support Crystal PR #2 and PR #3 against their common base. No Graphile
implementation is patched by this harness, and no application plugin, production
database, application code, or real tenant data is included. All harness code and
SQL in this repository were written independently for this benchmark.

Completed stock evidence: [findings](results/STOCK-SUMMARY.md),
[full tables and raw results](results/stock-2026-10-13/REPORT.md), and
[reproduction record](results/REPRODUCTION.md).

## Quick start

Requires Node 24+, pnpm 11.19.0 and Docker Compose. The pinned PostgreSQL 17.7 image
sets `max_locks_per_transaction=512` for the 151-schema DDL transaction,
binds only `127.0.0.1:55432`, uses a named volume, and creates the dedicated
`graphile_memory_bench` database. The example password is deliberately synthetic.

```sh
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:fixture 2
NODE_ENV=production GRAPHILE_ENV=production pnpm test
pnpm start
```

```sh
curl http://127.0.0.1:5678/graphql \
  -H 'Host: tenant_000.localhost' -H 'x-bench-user: 1' \
  -H 'Content-Type: application/json' \
  --data '{"query":"{ requestIdentity allTasks { nodes { title ownerId } } }"}'
```

`x-bench-user` is a synthetic identity input, **not authentication**. This server is
for loopback benchmarks only. Hosts must match the configured tenant allowlist.
`role`, `jwt.claims.tenant`, and `jwt.claims.user_id` become transaction-local
PostgreSQL settings. RLS filters both tenant and owner, even with a shared pool.
The connection guard rejects non-loopback hosts, other database names and other
administrator names. Never point this harness at an existing business database.

`BENCH_PG_PORT` changes the Compose host port and default connection string.
`BENCH_DATABASE_URL` permits an independently created local PostgreSQL installation
with the same database and administrator names. Record that fallback explicitly.
`pnpm db:down` stops Docker and preserves its benchmark-only volume.

## Small code map

- `src/fixture.js`: ten tables per tenant, two synthetic owners, indexed relations,
  enum, domain, arrays and five functions. A hidden `bench_types` schema supplies an
  enum table FK, domain, custom range, function argument/return types and an
  inheritance parent. It is never exposed as a selected PostGraphile schema.
- `src/lru.js`, `src/server.js`, `src/instance.js`: Host routing, lazy builds,
  serialized cache mutations, request leases, awaited eviction/release, shared
  pool ownership and schema-change invalidation.
- `scripts/bench.js`, `scripts/worker.js`: serial orchestration and fresh isolated
  `--expose-gc` workers. `scripts/load.js` runs HTTP clients in another process.
- `src/cache-probe.js`: read-only actual operation/plan cache counters that fail
  closed if the pinned library's internal layout changes.
- `scripts/snapshot.js`, `src/dominators.js`: isolated heap snapshot analysis.

The cache queues first builds and mutations, but request execution runs concurrently.
It never releases an instance while a lease is active. A full cache waits for the
oldest entry's requests, awaits `pgl.release()`, then deletes all wrapper references.
A failed build can be retried. The shared pool is ended only at server shutdown.
The public, deprecated Grafserv `createHandler()` API is used because its returned
promise covers execution after a client disconnects; Express response `close`
alone does not. Websockets are disabled; this workload uses finite HTTP operations.

After DDL commits, notify the **affected exposed tenant**:

```sql
NOTIFY bench_schema_changed, 'tenant_000';
```

After the notification is received, the next request rebuilds that tenant. If a hidden shared type changes, notify every
affected tenant. Tests exercise NOTIFY, changed SDL, and request-safe invalidation.
Automatic DDL dependency discovery is outside this small server's scope.

## Scenarios

Each command defaults to three independent processes per point and saves every raw
JSON result before moving on. Use a unique `BENCH_RUN` to group a run.

```sh
BENCH_RUN=stock pnpm bench:a
BENCH_RUN=stock pnpm bench:b
BENCH_RUN=stock pnpm bench:c
BENCH_RUN=stock pnpm bench:d
pnpm report stock
# Or run everything serially:
BENCH_RUN=stock-full pnpm bench:all
# Verify the exact requested full matrix after bench:all:
node scripts/verify-results.js stock-full
```

| Scenario | Question | Default matrix |
| --- | --- | --- |
| A | Does one target instance retain more heap when unrelated schemas exist? | **Other** tenants N=1,20,60,150; total=N+1, target always tenant_000 |
| B | What is the cost of actually building many cached instances? | Fixed 60-tenant catalog; M=1,10,50 |
| B rotation | Does a capacity-10 cache settle while tenants rotate? | Fixed 60 tenants; five complete passes (300 builds), three fresh processes |
| C | What does retaining many genuinely different execution plans cost? | K=10,100,1000,5000 plus one warmup operation |
| D | What remains after a build without target queries? | Separate snapshot workers at N=1,150; three repeats |

A prints the canonical target SDL SHA-256 at every point and fails if any hash
changes with N. Its build timing includes PostGraphile and Grafserv readiness,
excluding SDL printing/hashing. B uses real Host-routed HTTP builds, measures total
and incremental heap per instance, then evicts all and waits for release. Its
rotation rows retain only numbers, never old instances. C changes response aliases
and operation ASTs, verifies K new successful `OperationPlan` objects and replays all
operations to confirm cache reuse. Results are bounded to two requested rows and
consumed in a separate client process.

`BENCH_A=1,20`, `BENCH_B=1,10`, `BENCH_K=10,100`, `BENCH_D=1` and
`BENCH_REPEATS=1` can make a clearly labeled smoke run. They do not satisfy the full
matrix. Do not run benchmarks or fixture-resetting tests concurrently.

## Measurement contract

Every worker first builds and queries one disposable instance five times, releases
it, waits 5.5 seconds, and forces GC three times separated by event-loop turns.
Each measured stage repeats that quiet period and GC protocol. Official
`@dataplan/pg` connection-service cleanup uses a five-second delayed timer in
production, so measuring immediately after release would include pending cleanup.
`NODE_ENV` and `GRAPHILE_ENV` are both production for all benchmark workers.

A and D measure a rebuilt target before any query. B warms each retained instance
with the same correctness query. C first measures one rebuilt, query-warmed instance,
then subtracts that baseline from the K-plan stage. Warmup and baseline are saved.
Measured workers inherit only PATH, the explicit benchmark database overrides and
production mode settings; host credentials and unrelated environment variables are
not inherited. The measured server process does not retain client responses, query arrays, schema
arrays, build history, or prior instances. The parent fixture generator and HTTP
load processes exit before memory collection.

`heapUsed` is live JS heap after forced GC. `rss` is current resident process memory;
`peakRssBytes` is the OS process high-water mark, including earlier warmup. RSS that
remains high after release is not by itself evidence of a JS leak. GC pauses are
wall times of each explicit full `global.gc()` call; they are not all automatic GC
pauses or production latency percentiles. Reports use medians, retaining all raw
samples. Small negative release deltas and JIT/global-cache drift can occur.

C sets the supported `schema.extensions.grafast.operationsCacheMaxLength` property
before execution and verifies the actual LRU capacity. Setting a similarly named
preset option is ineffective in these versions. Grafserv's separate parse/validate
cache also grows to K+100 so replay does not replace AST identities. Thus heap per
plan is **incremental process heap per cached operation**, including AST, parsing,
execution plan, SQL strings/generated JavaScript and cache overhead; it is not a pure `OperationPlan` shallow
size. The probe only reads library objects; it never patches or clears their caches.

D snapshots occur only in separate processes, after the ordinary memory sample.
Snapshot generation can change heap/RSS; D is diagnostic, not part of A's medians.
Analysis computes dominators of the snapshot's declared strong-edge graph. Weak
edges and non-root shortcut edges are excluded; special ephemeron semantics and
native/external allocations are not modeled. Constructor rows union the outermost
same-constructor dominated subtrees, avoiding duplicate counting within a row.
**Different constructor rows overlap and must not be summed.** PostgreSQL catalog
property signatures give separate heuristic evidence of retained introspection
objects. Retention alone does not prove that every object is build-only or avoidable.
Raw snapshots stay local (`*.heapsnapshot` is ignored); JSON analyses include their
SHA-256 and are committed. Regenerate them with `bench:d` when needed.

## Stock versus a local Crystal checkout

The lockfile pins official registry PostGraphile 5.1.5 and all transitives. Read-only
version/provenance output is available with `node scripts/provenance.js`.

Build an official [Crystal](https://github.com/graphile/crystal) checkout using its
own instructions (`yarn` and `yarn build`, or the relevant workspace build). Then:

```sh
pnpm crystal:link /absolute/path/to/crystal
NODE_ENV=production GRAPHILE_ENV=production pnpm test
BENCH_RUN=my-crystal-branch pnpm bench:all
pnpm report my-crystal-branch
pnpm crystal:stock
pnpm install --frozen-lockfile
```

The switch replaces only the local `node_modules/postgraphile` symlink; it does not
edit package.json, the lockfile, or Graphile sources. PostGraphile's forwarding
exports then follow the checkout's own dependency graph. The script fails unless
PostGraphile, Grafast, Grafserv, graphile-build, graphile-build-pg, @dataplan/pg,
pg-introspection and GraphQL all resolve inside that checkout. It records the
checkout SHA, dirty status and every resolved dependency path/version in results.
A linked checkout can use different transitive versions: compare that provenance.
The stock command restores the previous pnpm link. No specific Benjie development
branch has been supplied, so no result here claims to test his proposed fixes.

### Explicit Crystal PR alternatives

The user additionally selected [Crystal PR #2](https://github.com/constructive-io/crystal/pull/2)
and [Crystal PR #3](https://github.com/constructive-io/crystal/pull/3). Their fixed
heads and actual common merge-base are recorded under `results/comparison-provenance/`.
Build each unmodified checkout separately with its identical upstream lockfile.
Run the common base first, followed by each candidate, serially:

```sh
pnpm crystal:link /absolute/path/to/common-base common-base
NODE_ENV=production GRAPHILE_ENV=production pnpm test
BENCH_RUN=crystal-common-base pnpm bench:all
node scripts/verify-results.js crystal-common-base
pnpm report crystal-common-base
pnpm crystal:stock

pnpm crystal:link /absolute/path/to/pr2 pr2
NODE_ENV=production GRAPHILE_ENV=production pnpm test
BENCH_RUN=crystal-pr2 pnpm bench:all
node scripts/verify-results.js crystal-pr2
pnpm report crystal-pr2
pnpm crystal:stock

pnpm crystal:link /absolute/path/to/pr3 pr3
NODE_ENV=production GRAPHILE_ENV=production pnpm test
BENCH_RUN=crystal-pr3 pnpm bench:all
node scripts/verify-results.js crystal-pr3
pnpm report crystal-pr3
pnpm crystal:stock
node scripts/compare.js crystal-common-base crystal-pr2 crystal-pr3
```

`common-base` adds no option or preset. `pr2` sets
`gather.pgScopedIntrospection.main=true`. `pr3` sets the same option and adds the
candidate's exported `PgScopedIntrospectionPreset`; configuration alone does not
activate PR3. Both use the default `catalogTypes=all` and no capability extensions.
Runtime assertions verify the resolved preset and save activation metadata. The
candidates are never stacked. SQL, queries, warmup, GC, matrix and repetitions stay
identical, and the comparison verifier requires matching dependency versions and
SDL hashes. Their shared scoped algorithm does not change Grafast plan-memory design.

The common-base control is necessary: today's registry stock resolves different
transitive versions from these source checkouts. Do not treat registry-to-candidate
differences alone as the optimization's effect. The caller-owned `pg` pool stays
at the harness's pinned 8.23.1 in all groups.

## Interpretation and references

A and the introspection evidence in D address the motivation for progressive
introspection. B shows how per-instance catalog/runtime retention compounds and
whether lifecycle release limits it. C addresses the motivation for plan-memory
work. Stock results establish current behavior; the separate common-base comparison
tests the two explicitly selected scoped-introspection candidates. Necessary cross-schema dependencies
must keep working; lower memory obtained by dropping them is not a valid result.

Historical figures of roughly 0.4 MB per co-tenant per instance, or 103→27 MiB for
50 unrelated schemas, are only sanity references. Fixture sizes, versions,
measurement endpoints and memory definitions differ. This harness never tunes its
workload to hit those figures. See the generated report for actual findings and
coverage limits, including negative results.

Official sources used for API and measurement decisions:

- [PostGraphile library usage](https://postgraphile.org/postgraphile/5/usage-library)
- [Multiple GraphQL schemas](https://postgraphile.org/postgraphile/5/multiple-schemas)
- [Official Crystal source](https://github.com/graphile/crystal)
- [PostGraphile registry metadata](https://registry.npmjs.org/postgraphile)

MIT copyright holder: verified repository owner Zhi Zhen (Zetazzz). Repository
privacy is independent of its license; no publishing or collaborator changes are
part of this project.
