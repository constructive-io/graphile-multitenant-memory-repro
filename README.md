# Graphile multitenant memory benchmark

A private, standalone, synthetic reproduction for planning issue #2228. The stock
baseline uses only PostGraphile's Amber preset. A separate controlled comparison
tests Crystal PR #2 against its common base. No Graphile
implementation is patched by this harness, and no application plugin, production
database, application code, or real tenant data is included. All harness code and
SQL in this repository were written independently for this benchmark.

Historical evidence (from the original JavaScript sources) comprises 126 formal fresh-process samples and 18 separate
snapshot analyses: stock, common base and PR2 each complete the full three-repeat
matrix. See the [stock findings](results/STOCK-SUMMARY.md),
[comparison findings](results/COMPARISON-SUMMARY.md),
[comparison tables](results/COMPARISON.md), and
[reproduction record](results/REPRODUCTION.md). Raw JSON is linked from each report.

The TypeScript refactor and fresh validation are documented in the
[refactor validation record](results/refactor-validation/VALIDATION.md). The new
common-base/PR2 comparison contains 84 formal samples and 12 snapshot analyses:
[current comparison](results/refactor-validation/COMPARISON.md) and
[historical versus refactored measurements](results/refactor-validation/REFACTOR-COMPARISON.md).
Historical figures above remain evidence of their original code.

## Quick start

Requires Node 24+, pnpm 11.19.0 and Docker Compose. The pinned PostgreSQL 17.7 image
sets `max_locks_per_transaction=512` for the 151-schema DDL transaction,
binds only `127.0.0.1:55432`, uses a named volume, and creates the dedicated
`graphile_memory_bench` database. The example password is deliberately synthetic.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
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

## Code map and TypeScript execution

All implementation, command entry points, and tests are TypeScript. No JavaScript
configuration exception is needed: configuration is JSON/YAML. TypeScript 5.9.3
uses strict checking, native ESM/NodeNext and ES2023 output, without a runtime
loader, bundler, source-map hook or downlevel async transformation. External package
declarations use `skipLibCheck`; all local source and tests are checked.

- `src/cli/`: executable adapters for the server, fixture, benchmark, worker, load,
  snapshot, provenance, preflight, reports and Crystal switching.
- `src/benchmark/scenarios.ts`: typed scenario registration, point validation,
  fixed fixture/cache sizes and the original A → B → rotation → C → D order.
- `src/benchmark/orchestrator.ts`: serial fixture setup, manifests and independent
  workers. `process.ts` resolves children relative to the compiled module, passes
  `--expose-gc`, and restricts inherited worker settings.
- `src/benchmark/worker.ts`, `stages.ts`, `results.ts`: disposable warmup, baseline,
  scenario stages, numeric result contracts, awaited release and result writing.
  `client.ts` and `load.ts` run requests in a separate client process.
- `src/measurement/`: unchanged quiet/GC protocol, runtime/source/build provenance,
  fail-closed operation-cache probing, isolated snapshot analysis and dominators.
- `src/report/`: validated historical/current JSON readers, aggregation, matrix
  verification and controlled comparisons. Reporting never runs in measured workers.
- `src/runtime/`: vanilla Amber instances, Host routing, typed request leases,
  serialized LRU mutations, NOTIFY invalidation and explicit Crystal profiles.
- `src/fixture/`: transactional reset, readable tenant definitions/policies/rows,
  and hidden cross-schema dependencies. Ten tables per tenant, two owners, indexed
  relations, enum/domain/array/range/function and inheritance fixtures are preserved.
- `test/`: compiled Node tests for lifecycle/concurrency, RLS and hidden dependencies,
  real operation counts, dominators, process configuration and original SQL hashes.

This organization takes only architectural inspiration from Constructive's
`packages/perf-harness` (typed definitions, CLI/runner/measurement/report boundaries).
No code, dependencies, fixtures, schema, application logic or data were copied from
that package. Runtime dependencies remain exactly `postgraphile`, `pg`, and `express`.

Run `pnpm build` after editing TypeScript. Every normal package command targets
`dist/src/cli/*.js`; tests target `dist/test/*.test.js`. Child paths are anchored to
that compiled tree, and the child working directory is the repository root.
Compilation finishes before any measured process starts. `dist/build.json` hashes
source, compiler configuration and emitted JavaScript; workers and preflight reject
stale/changed output and record the receipt. `dist/` is ignored, never benchmark input
from a previous checkout. Formatting: `pnpm format:check` (or `pnpm format`).

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
pnpm verify-results stock-full
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
arrays, build history, or prior instances. Fixture generation finishes and closes
its PostgreSQL pool before workers start. HTTP load children exit before collection;
the lightweight parent orchestrator remains outside the measured process.

`heapUsed` is live JS heap after forced GC. `rss` is current resident process memory;
`peakRssBytes` is the OS process high-water mark, including earlier warmup. RSS that
remains high after release is not by itself evidence of a JS leak. GC pauses are
wall times of each explicit full `global.gc()` call; they are not all automatic GC
pauses or production latency percentiles. Reports use medians, retaining all raw
samples. Forced-GC tables take each process's median of three calls, then the median
of the three process medians. Small negative release deltas and JIT/global-cache drift can occur.

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
version/provenance output is available with `pnpm provenance`.

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

### Controlled scoped-introspection comparison

The user selected [Crystal PR #2](https://github.com/constructive-io/crystal/pull/2)
as the sole representative of the scoped algorithm shared with
[PR #3](https://github.com/constructive-io/crystal/pull/3). Their fixed heads and
actual common merge-base are recorded under `results/comparison-provenance/`.
PR3 has a different integration path but no performance matrix is run for it.
Build the unmodified common-base and PR2 checkouts with their identical upstream
lockfile. The exact refs remain common-base
`3ecd1d7920de38dc5ae6ee61763e8223b3b53908` and PR2
`434a1f6deddda7786fa2497ad30ca01d598135a1`; do not substitute current branch heads.
Compile the harness against stock first with `pnpm typecheck && pnpm build`, then
run both groups serially:

```sh
pnpm crystal:link /absolute/path/to/common-base common-base
pnpm preflight my-common-base
BENCH_RUN=my-common-base pnpm bench:all
pnpm verify-results my-common-base
pnpm report my-common-base
pnpm crystal:stock

pnpm crystal:link /absolute/path/to/pr2 pr2
pnpm preflight my-pr2
BENCH_RUN=my-pr2 pnpm bench:all
pnpm verify-results my-pr2
pnpm report my-pr2
pnpm crystal:stock

pnpm compare my-common-base my-pr2 results/my-comparison
# Compare the completed new groups with the preserved historical groups:
pnpm compare:refactor crystal-common-base my-common-base crystal-pr2 my-pr2 results/my-comparison
```

Choose new run directory names when repeating measurements. Comparison reports use
an explicit output directory (or default to `results/<base>-vs-<candidate>/`) so new
runs do not overwrite the original `results/COMPARISON.md`. A single-run report can
be regenerated elsewhere with `pnpm report <run> <output.md>`; verification accepts
an optional output JSON path. Analyze a local snapshot with
`pnpm snapshot <input.heapsnapshot> <output.analysis.json>`.

 `pnpm preflight` runs the
correctness suite and saves a per-run receipt tied to the current clean source SHA;
it also records the tested clean Crystal SHA and resolved dependency versions.
The comparison checks this receipt and requires tests to precede measurements.
Historical receipts are retained for the
original accepted runs. Do not reuse their SHA labels for measurements of later code.

`common-base` adds no option or preset. `pr2` sets
`gather.pgScopedIntrospection.main=true`, with default `catalogTypes=all` and no
capability extensions. The optional `pr3` adapter adds the candidate's exported
`PgScopedIntrospectionPreset`; configuration alone would not activate PR3. That
adapter was prepared before the user removed duplicate performance work. It is not
used in the measured comparison. Runtime assertions verify the resolved preset and
save activation metadata. SQL, queries, warmup, GC, matrix and repetitions stay
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
tests the selected scoped-introspection representative. Necessary cross-schema dependencies
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
