# Graphile multitenant memory benchmark

A private, standalone, synthetic benchmark comparing published PostGraphile
**stock** with this repository's **local-scoped** PR2 adaptation. A fresh clone
installs registry dependencies and builds locally; no Crystal checkout is needed.
Stock uses the original Amber introspection plugin. Local scoped replaces only
that plugin, reusing the same published parser, catalogue types and package graph.

Read the single [comparison report](results/COMPARISON.md) for retained-memory
results, stock/scoped deltas, build timings and limitations. The
[reproduction note](results/REPRODUCTION.md) gives the exact focused workflow.
The current result tree contains only the A/B comparison and its
raw evidence. Earlier runs remain in
[Git history](https://github.com/Zetazzz/graphile-multitenant-memory-repro/tree/20cd35cb7561aa679718be85c79db001038231c3/results).

These measurements were collected at
[`b9aa76d`](https://github.com/Zetazzz/graphile-multitenant-memory-repro/tree/b9aa76d027d35e14e00a648cf219025df39f1c5d),
before the local source directories moved under `plugins/`. Recorded paths and
source/build hashes preserve that measured layout; the result files are unchanged.

## Install and run

Requires Node 24+, pnpm 11.19.0 and Docker Compose. PostgreSQL 17.7 is pinned in
`compose.yaml`, bound to loopback port 55432, with `max_locks_per_transaction=512`.
The database and example password are synthetic and dedicated to this benchmark.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm format:check
pnpm db:up
NODE_ENV=production GRAPHILE_ENV=production pnpm test
pnpm db:fixture 2
pnpm start
```

```sh
curl http://127.0.0.1:5678/graphql \
  -H 'Host: tenant_000.localhost' -H 'x-bench-user: 1' \
  -H 'Content-Type: application/json' \
  --data '{"query":"{ requestIdentity allTasks { nodes { title ownerId } } }"}'
```

`x-bench-user` supplies synthetic test identity, not authentication. The loopback
server applies tenant/user settings inside each transaction; RLS filters both
values. Hosts must match the tenant allowlist. The database guard permits only the
loopback `graphile_memory_bench` database as `bench_admin`; do not use a business
database. `BENCH_PG_PORT` changes the Compose host port/default connection string;
`BENCH_DATABASE_URL` permits the same guarded database on a local PostgreSQL
installation. `pnpm db:down` preserves its benchmark volume.

## Focused comparison

`bench:memory` runs only these seven points, three fresh workers per point:

| Scenario | Question | Points | Fixture |
| --- | --- | --- | --- |
| A | What does one unqueried target retain as unrelated schemas grow? | 1, 20, 60, 150 other tenants | N + 1 tenants |
| B | What do simultaneously retained tenant instances cost? | 1, 10, 50 retained instances | Fixed 60 tenants |

Two profiles produce **42 samples total**. B warms each retained instance with the
same correctness query. The runner preserves the discarded warmup instance,
5.5-second quiet periods, three forced GCs, separate client processes and awaited
release. It does not run rotation, operation-cache growth or heap snapshots for
this comparison. Their correctness cases remain in the test suite.

Use new run names when measuring again; raw workers and preflight receipts refuse
to overwrite existing evidence. Commit source changes before preflight. With a
built, clean source tree and the database running:

```sh
BENCH_PROFILE=stock pnpm preflight stock-next
BENCH_PROFILE=local-scoped pnpm preflight local-next
BENCH_PROFILE=stock BENCH_RUN=stock-next pnpm bench:memory
BENCH_PROFILE=local-scoped BENCH_RUN=local-next pnpm bench:memory
pnpm verify-results stock-next --matrix memory
pnpm verify-results local-next --matrix memory
pnpm report stock-next local-next results
```

Tests, fixture resets and benchmarks must run serially. Regenerate the checked-in
report without measuring again using `pnpm report stock local-scoped results`.
`compare:local` is an alias for the same comparison generator. Verification checks
exact point/repetition counts, independent PIDs, clean source, matching build and
dependency provenance, profile activation, released instances and invariant SDL.
Preflight records the correctness tests before measurement.

Memory tables distinguish retained heap from the increment above the measured
baseline. Build timing, forced-GC pauses, RSS and post-release deltas appear in the
same report's appendices. Three repetitions describe these runs; they do not
establish statistical equivalence, production latency or exclusive object ownership.

## Implementation

All maintained implementation, CLIs and tests are TypeScript, compiled with strict
NodeNext/ES2023 settings. Local source is typechecked; external declarations use
`skipLibCheck`. Runtime dependencies remain `postgraphile`, `pg` and `express`.
No CNC code, dependencies, production data or application logic is included.

- `src/runtime/`: Amber instances, Host routing, request leases, serialized LRU
  changes and NOTIFY invalidation. Active requests keep their instance alive until
  their leases finish; eviction awaits release.
- `src/fixture/`: guarded synthetic tenants, RLS and hidden cross-schema dependencies.
- `src/benchmark/` and `src/measurement/`: scenario selection, isolated workers,
  unchanged collection protocol, source/build provenance and optional diagnostics.
- `src/report/`: raw-result validation and the reproducible comparison.
- `plugins/graphile-build/graphile-build-pg/` and `plugins/utils/pg-introspection/`:
  attributed local PR2 sources. [UPSTREAM.md](UPSTREAM.md) records adaptations,
  licences and pinned refs.
- `test/`: lifecycle, concurrency, RLS, release, invalidation, cache, scoped query,
  service configuration, package identity and reporting checks. Tests use synthetic
  fixtures and do not require previous measurement files.

Run `pnpm build` after changing source. Commands use emitted `dist/` files; build
receipts hash source, tests, local candidate files, configuration and emitted code.
Workers reject stale builds. Stock does not load the local candidate; both profiles
share the same registry package identities. `BENCH_PROFILE` selects only `stock`
or `local-scoped` and is incompatible with an active external-checkout link.

After DDL, `NOTIFY bench_schema_changed, 'tenant_000'` invalidates the affected
exposed tenant. Hidden shared-type changes require notifying each affected tenant;
automatic dependency discovery is outside this reproduction.

## Optional checkout and diagnostic tools

The focused comparison above does not use an external checkout. `crystal:link`
and `crystal:stock` retain the optional stock/common-base/PR2 workflow. Build an
upstream Crystal checkout first, then link it with
`pnpm crystal:link /absolute/path/to/crystal common-base` (or `pr2`), test it, and
restore with `pnpm crystal:stock`. The switch changes only the local package
symlink and records the checkout SHA and resolved dependency paths. It does not
edit registry packages or the dependency lock.

PR3 shares PR2's scoped algorithm and is not separately benchmarked.

`bench:a`, `bench:b`, `bench:c`, `bench:d` and `bench:all` remain optional diagnostic
commands; `bench:b` also includes rotation, whereas `bench:memory` selects A and B
only. `report:run <run>` can report an explicitly requested diagnostic run.
`compare <common-base-run> <pr2-run> <output-directory>` verifies the pinned checkout
comparison using each run's own preflight receipt. None of these commands requires
old results to exist in the current tree.
