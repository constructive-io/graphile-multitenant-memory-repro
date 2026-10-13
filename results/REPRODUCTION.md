# Reproduction evidence

## Source and environment

Implementation source was pushed with ordinary fast-forward commits, preserving the
original skeleton and history. A second clone was created directly from
`https://github.com/Zetazzz/graphile-multitenant-memory-repro.git`, at implementation
SHA `eaa6a4545be4ac7fca2e88c3deb2e5af4f49e36d`, then fast-forwarded to the
worker-environment-isolation commit
`6f5d4304ab962c48f255a1664a79082c6d3775ed`, then the PostgreSQL lock-capacity
commit `be0c142bdd1f6cb9257169c4607e02e0f7708b30` before final acceptance runs. Its tracked working tree was clean,
and `pnpm install --frozen-lockfile` succeeded without changing the lockfile.
Formal acceptance measurements execute from this clean remote clone. Workers
receive only PATH, production mode settings and explicit synthetic database
overrides, avoiding inherited host credentials in heap snapshots.

The selected environment is Linux in the CNC cloud environment; no Mac was used.
Only independent benchmark clones, the official Graphile release checkout and the
subsequently user-selected Crystal comparison checkouts were used. The real Docker PostgreSQL container was started with `docker compose up -d
--wait`; the fallback local PostgreSQL path was not needed. The image ID and
manifest digest are saved in this directory. Every raw sample records the server's
PostgreSQL version, Node/V8, architecture, CPU, memory and resolved dependency paths.

All commands requiring a benchmark, test or fixture reset were run sequentially.
No concurrent benchmark scenario was run. The full acceptance matrix begins after
all dependency installations, official Crystal builds and preflight tests finish.

The complete stock acceptance matrix subsequently finished all 42 fresh workers:
A N=1/20/60/150, B M=1/10/50, three capacity-10 rotations of 300 builds each,
C K=10/100/1000/5000, and D N=1/150. Every point has three repetitions, and all six
D snapshots were analyzed in separate processes. `stock-2026-10-13/verification.json`
checks exact point coverage, uniform source/dependencies/settings, clean runtime
source, balanced build/release counts, real plan counts, and invariant SDL.
There were no cgroup OOM or OOM-kill events. Raw heap snapshots remain local in the
clean clone; committed analysis JSON contains their hashes and complete summaries.
Postprocessing/report improvements do not change the recorded benchmark source SHA.

## Correctness tests

The following each passed all 12 tests (including nested integration subtests):

- Registry stock: `validation-stock.txt`.
- Clean remote clone with frozen lockfile: `validation-clean-clone.txt`.
- Linked official release checkout: `validation-crystal.txt`.

Tests cover RLS and transaction-local settings, both users and multiple hosts,
indexed nested relations, hidden enum FK/domain/range/function types/inheritance,
lazy coalesced builds, failed build recovery, draining leases, awaited release,
NOTIFY with changed SDL, running SQL after client abort, real plan counts and cache
reuse. The independent dominator implementation is checked against deletion-based
reachability on 80 generated graphs, plus explicit sharing/cycle/union examples.

## Verified Crystal source switch

The official `graphile/crystal` tag `postgraphile@5.1.5` resolves to
`046893b6366ccc150ba490ac8981796d55985594`. The source tree remained unmodified.
The upstream Yarn 4.12.0 workspace was installed with `--immutable --mode=skip-build`
and built with its own workspace scripts for ruru-components and ruru, `tsc -b`,
and the upstream topological `build-package` scripts. Optional sqlite native build
scripts were skipped; sqlite is not used by this benchmark. Environment-supported
HTTP(S) proxy configuration was required for Yarn downloads. No dependency source
or implementation was patched.

`pnpm crystal:link /workspace/graphile-crystal-reference` verified all critical
Graphile packages and GraphQL resolved inside that checkout. The actual paths and
versions are in `crystal-link-verification.json`. Tests passed, followed by one
A N=1 smoke point and one C K=10 smoke point, saved under
`crystal-release-switch/`. These are switch-validation samples, not a second full
performance comparison. Its report explicitly has one repetition.

The release checkout's Grafast is 1.1.3, graphile-build-pg is 5.1.4 and GraphQL is
16.13.2, whereas the pinned registry dependency graph resolves Grafast 1.1.4,
graphile-build-pg 5.1.5 and GraphQL 16.14.2. Thus even the release-tag checkout should
not be assumed identical to today's registry resolution.

`pnpm crystal:stock` restored the original pnpm symlink, with resolved provenance in
`crystal-stock-restoration.json`. The separate clean clone used only registry stock
for formal measurements. A specific Benjie development/fix branch has not been
provided and was not run.
