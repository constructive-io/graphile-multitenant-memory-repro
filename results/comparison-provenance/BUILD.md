# Fixed Crystal comparison inputs

The user selected PR2 as the sole measured representative of these alternative
Crystal pull requests. PR3 was built and correctness-checked before the user removed
duplicate performance work; no PR3 performance sample was taken. Neither candidate
is applied to the published registry baseline or combined with the other.

| Profile | Ref used | Activation |
| --- | --- | --- |
| common-base | `3ecd1d7920de38dc5ae6ee61763e8223b3b53908` | Amber only |
| pr2 | `434a1f6deddda7786fa2497ad30ca01d598135a1` | Amber and `gather.pgScopedIntrospection.main=true` |
| pr3 | `4cfb141eaf8307a28996fd4c71f9a2e479d4d9b5` | Amber, `PgScopedIntrospectionPreset`, and the same gather option |

GitHub's compare API verifies the common base is the actual merge-base of both
heads, not merely a similarly named branch. The API responses are retained here.
All three refs have identical root package manifests, Yarn configuration and
`yarn.lock` blob `30ce8fb20d27a304158469c1cf4ccb98d8e2320d`.
The two scoped algorithm files have identical Git blob
`a380513f3981fe82a9523b7171cccac407a0cd61`; integration paths differ and are tested
by correctness checks. The performance comparison runs only PR2 and the common base.
Neither changes Grafast's plan-memory design.

Create three independent clones of `https://github.com/constructive-io/crystal.git`
and detach each at the exact SHA above. In each checkout, the upstream build steps
used here are:

```sh
node .yarn/releases/yarn-4.12.0.cjs install --immutable --mode=skip-build
node .yarn/releases/yarn-4.12.0.cjs workspace ruru-components build-package
node .yarn/releases/yarn-4.12.0.cjs workspace ruru build-package
node node_modules/typescript/bin/tsc -b
node .yarn/releases/yarn-4.12.0.cjs workspaces foreach \
  --parallel --topological-dev --all --exclude . \
  --exclude ruru --exclude ruru-components run build-package
git status --porcelain
git rev-parse HEAD
git rev-parse HEAD:yarn.lock
```

Optional native dependency lifecycle builds are skipped; the benchmark does not use
sqlite. The source workspace scripts and TypeScript projects are still built.
The environment uses a writable Yarn global directory, a shared download cache,
the npm registry, and the environment-provided proxy for downloads. These are
environment settings, not edits to the upstream manifests or sources. No checkout
is built while a performance matrix is running.

For measurements, the independent benchmark clone links the common-base and PR2 checkouts using
the matching explicit profile, runs its complete correctness suite, then runs the
same 42-worker matrix. All workers recheck the linked checkout's current HEAD and
tracked working-tree cleanliness against the recorded state. The common-base
control prevents the registry's newer Grafast/graphile-build-pg/GraphQL versions
from being mistaken for an optimization effect. The caller-owned pg 8.23.1 pool is
constant in all profiles.
