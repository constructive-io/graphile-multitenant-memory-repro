# Standalone local scoped validation

This record concerns the standalone implementation at source commit
`f11869bd11d8715c6129e791bdddf8607ee89a43`, based on
`fbcb21cdd054deb5f7fdcfb68c22cb200bd20e9c`. It is separate from all historical
checkout measurements. Final benchmark workers use this committed source; later
documentation and result commits do not change its build inputs.

## Standalone loading and compatibility

The root build includes the sibling `graphile-build/graphile-build-pg/` and
`utils/pg-introspection/` source directories. A selected local preset disables the
published `PgIntrospectionPlugin` and installs the repository's
`LocalPgIntrospectionPlugin`, retaining the original ordering capability. Stock
keeps Amber unchanged and does not import the local implementation.

All dependencies remain the existing registry pins; the lockfile is unchanged.
PostGraphile 5.1.5 forwards imports into one graphile-build-pg 5.1.5,
pg-introspection 1.0.1, Grafast 1.1.4, graphile-build 5.1.1, @dataplan/pg 1.1.2,
GraphQL 16.14.2 and graphile-config 1.1.1 graph. No installed package is patched,
aliased or replaced globally. The local index reuses the published parser and
catalogue types. Exact runtime object identities and TypeScript symbol identities
were verified; see [upstream audit](upstream-audit.json).

The scoped SQL builder and traversal match pinned PR2. The private type lookup
uses the equivalent published `getType({ id })` API. Other adaptations are module
paths, one distinct plugin name with `provides`, strict catch narrowing and
formatting. Both package licences and the upstream integration SQL fixture are
byte-identical. [UPSTREAM.md](../../UPSTREAM.md) records sources and attribution.

## Independent installation and correctness

A fresh independent clone of `f11869b` installed with
`pnpm install --frozen-lockfile`, using a writable temporary pnpm cache. It did not
link any Crystal checkout or reuse the working tree's node_modules. The cache
contains registry tarballs, not a prepared Crystal source build. Its worktree
remained clean after validation; see the `clean-*.txt` logs. Earlier
`independent-*` logs record an additional patch-based review clone and are retained
as supplementary evidence.

The independent clone passed strict typechecking, build, formatting, and all
**44 tests under stock and 44 under local-scoped, with zero skipped**. The main
working tree passed the same 44-test preflights for both profiles. Tests cover
lifecycle and release, RLS, NOTIFY, aborted requests, actual operation cache counts,
SQL fixture hashes, scoped query/service validation, hidden dependencies,
extensions, partitioned indexes, missing schemas, type identity and stock isolation.

Both builds have identical content receipts in [build.json](build.json):

- Source: `3d9310e3953a70e2e8503baa5905970fe10fa0e0841e855e1488c2e1dbb487b8`.
- Emitted: `0ebce362822e9df7e0620f87b0b8a08776449b4e4e05b2075773250ee8a14e3b`.

[Stock activation](clean-activation-stock.json) records zero local module
loads. [Local activation](clean-activation-local.json) records the plugin and
scoped query loading from that clone's own `dist/` paths. All six shared runtime
identity assertions pass and both schemas hash to
`d01a0e83334d47a180bf6f0b4ead295db6e8dde7c449aa82a09770e09c66c5eb`.

## Retained checkout profiles

The current harness also passed **43/43 tests for common-base and 43/43 for PR2**,
with zero skipped tests, against clean checkouts at
`3ecd1d7920de38dc5ae6ee61763e8223b3b53908` and
`434a1f6deddda7786fa2497ad30ca01d598135a1` respectively.
[Common-base activation](legacy-common-base-activation.json) and
[PR2 activation](legacy-pr2-activation.json) confirm the expected profile, no local
implementation loads, six shared package identities, and SDL matching each
historical run. [Validation](legacy-validation.json) records unchanged checkout
SHAs, clean worktrees and successful registry restoration after each profile.

These optional historical checkouts were built only after the independent registry
clone had passed its standalone checks and both full matrices had finished. Their
upstream backend builds initially encountered missing `tamedevil` declarations;
repeating the unchanged incremental build after prerequisite emission passed. Both
initial failures and successful retry logs are retained. No upstream source,
configuration or dependency lock was edited. The restored current stock clone
passed another 44 tests, and the old TypeScript stock clone passed its original
16 tests before the timing controls.

## Provenance and acceptance

Both final preflights passed all 44 tests with `sourceDirty=false`,
`sourceUnchanged=true`, and `provenanceUnchanged=true`. The source and emitted
hashes above stay fixed across workers. Untracked result output can make the
broader `gitDirty` field true without changing the measured source.
`compose.yaml`, local sources, licences, fixture and upstream record are included
in the content digest. Default preflight and matrix verification reject
uncommitted source.

An earlier review-only stock matrix was intentionally interrupted after 22
completed workers when commit/publication authorization arrived, so that the final
matrices could run against committed source. Its failed manifest and raw samples
remain unchanged in `standalone-stock-review-2026-10-15`; the matching local review
directory contains only its preflight. Neither partial group enters the final
comparison. The optional `--review` path retains explicit dirty-source labels and
fixed content checks; it cannot pass the default clean acceptance gate.

## Historical preservation

All **382 previously tracked result/provenance files** remain byte-for-byte
unchanged, including the original **126 samples / 18 analyses** and the prior
TypeScript refactor's **84 samples / 12 analyses**. Per-file SHA-256 evidence is in
[history-preservation.json](history-preservation.json).

The final historical report check ran 13 commands, verified all 210 formal samples
and 30 analyses, reproduced all numeric tables and refactor delta JSON, and checked
219 generated links. [Verification](historical-report-verification.json) records
these checks. The report writer now creates fresh comparison destinations before
writing and resolves raw-file links relative to relocated reports.

Historical PR3 references remain intentionally in old reports, build/validation
records, comparison-provenance files and old verification JSON. These describe
past work and were not rewritten. Maintained runtime/profile/preset/CLI/comparison
support is removed; the README retains one explanatory sentence. Negative tests
verify the removed profile is rejected. The final [rejection check](profile-rejection-final.json)
also verifies parser, saved-state, CLI and environment selection rejection without
changing the package link or creating a checkout state file.
The [final preservation check](final-history-check.json) lists the 23 historical
files with residual PR3 references and confirms zero changed historical files.

## Fresh measurements

Both full matrices passed: **84 fresh workers and 12 separate snapshot analyses**,
with three repetitions per point, the original fixtures, 5.5-second quiet periods,
three forced GCs, separate load processes and separate snapshot analysis processes.
The [controlled comparison](../standalone-comparison-2026-10-15/COMPARISON.md) and
[verification receipt](../standalone-comparison-2026-10-15/comparison-verification.json)
confirm identical source/build/dependencies, correct profile activation, distinct
worker PIDs, clean source and matching SDL. The ordinary stock and local reports
link every raw sample; diagnostic analyses are stored alongside those samples.

| Measurement | Earlier registry stock | New stock | Earlier TS PR2 | New local scoped |
| --- | ---: | ---: | ---: | ---: |
| A150 retained heap, MiB | 87.02 | 87.30 | 32.80 | 33.03 |
| B50 retained heap, MiB | 1,272.78 | 1,273.01 | 221.89 | 221.83 |
| B50 increment per instance, MiB | 24.8816 | 24.8803 | 3.8608 | 3.8543 |
| Rotation final heap, MiB | 282.37 | 282.66 | 72.22 | 72.55 |
| C5000 increment per operation, KiB | 299.7047 | 299.5688 | 299.8230 | 299.2094 |

Values are three-worker medians. Stock A150 incremental heap differs from its
earlier baseline by -0.011%, B50 per-instance increment by -0.005%, and C5000
per-operation increment by -0.045%. Local A150 increment differs from earlier
PR2 by +0.104%, B50 per-instance increment by -0.170%, and C5000 per-operation
increment by -0.205%. Total heap also includes the measured process baseline.
The local candidate reproduces the earlier scoped memory behavior; it does not
reduce the roughly 300 KiB retained per cached operation in this workload.

The [historical comparison](BASELINE-COMPARISON.md) and
[exact deltas](BASELINE-COMPARISON.json) include all points, worker ranges,
baseline-subtracted memory, RSS, release, timings, forced GC and snapshot evidence.
Historical registry stock matches the recorded current dependency versions and
environment. Previous TypeScript stock smoke/bridge observations are singletons,
reported separately. Earlier full PR2 instead used Grafast 1.1.3,
graphile-build-pg 5.1.4 and GraphQL 16.13.2, versus 1.1.4, 5.1.5 and 16.14.2 here;
that historical comparison does not isolate an adaptation effect.

Timings varied materially: versus historical registry stock, new stock B50 build
and C5000 load medians increased 45.1% and 46.8%. Versus earlier TS PR2, local B50
build and C5000 load medians increased 25.1% and 36.3%. Earlier review and final
stock B10 workers have byte-identical source/emitted hashes and dependencies, yet
their medians differ (2,631.88 versus 4,379.26 ms), demonstrating variation without
a code change.

The completed [interleaved timing controls](../standalone-timing-bridge-2026-10-15/README.md)
add **21 supplemental workers**, using clean old/current stock clones and a
rotating current-local C5000 series. Current-stock B10/B50 build medians remain
11.4%/23.2% higher than old TypeScript stock, with all three paired ratios above
one at both points. Current-stock C5000 load median is 4.5% lower than old stock.
Current-local C5000 has a 16.7% lower median than current stock in these controls,
but its paired ratios are 1.0741, 1.1509 and 0.4511; stock load times range from
25.24 to 52.96 seconds. Those observations do not establish a stable profile speed
advantage or timing equivalence. The full-matrix slow observations remain intact.

The source-path audit found the same stock Amber configuration and matching
hashes for the 11 checked dependency entry files, with no added schema or SQL
workload. It did not establish the cause of the
build-time gaps. The controls added no memory-limit or OOM events, although CPU
throttling was recorded. Their retained-memory medians remain close: B50 increment
is 24.8814 versus 24.8798 MiB per instance for old/current stock, and C5000 is
299.7058/299.4150/299.8412 KiB per operation for old/current/local. Memory continuity
is supported; timing differences remain an explicit limitation.
