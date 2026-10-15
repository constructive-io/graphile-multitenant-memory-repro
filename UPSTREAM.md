# Local scoped-introspection source

The local candidate adapts the MIT-licensed Graphile Crystal PR2 implementation
from https://github.com/constructive-io/crystal at
`434a1f6deddda7786fa2497ad30ca01d598135a1` (common base
`3ecd1d7920de38dc5ae6ee61763e8223b3b53908`). It is a local adaptation, not a
measurement of that entire checkout. The package licences are retained verbatim
in `graphile-build/graphile-build-pg/LICENSE.md` and
`utils/pg-introspection/LICENSE.md`, including the PostgreSQL documentation notices.

The mirrored paths contain the upstream introspection plugin, its watch SQL and
version context, the complete scoped algorithm, and the query-builder portion of
`introspection.ts`. `index.ts` re-exports the published catalogue types and parser
through PostGraphile's forwarding export. This avoids duplicating the registry
parser, ACL code, smart comments, reserved words and type identity.

Local adaptations: module specifiers target emitted `.js` files and PostGraphile
forwarding exports; existing global helper/hook declarations use the published
types; catch values are narrowed for strict TypeScript. The plugin is named
`LocalPgIntrospectionPlugin` and provides the original ordering capability, while
the preset disables the published `PgIntrospectionPlugin`. PR2's private
`_lookups.typeById` check uses the public `getType({ id })` lookup instead. SQL,
scope construction and dependency traversal are unchanged. Formatting follows
this repository. Stock loads only its published Amber plugin.


Upstream tests adapted into `test/scoped-introspection.test.ts`,
`test/scoped-service.test.ts` and `test/scoped-integration.test.ts` retain the query,
service, closure and capability cases. Jest assertions become Node assertions;
integration setup uses the isolated guarded benchmark database and cleans its
own schemas, extension and access method. The upstream SQL fixture is preserved
byte-for-byte under the mirrored package's `__tests__/fixtures/` path. The public
lookup adaptation is also used by the synthetic validator test double.

The published plugin at graphile-build-pg 5.1.5 and pg-introspection 1.0.1 runtime
files match the common-base implementation after TypeScript transpilation and
normalization of whitespace/module suffixes/source-map comments. The candidate
therefore changes the scoped-query path on the same published package graph;
shared parser and type identities are checked directly. The local plugin retains
the upstream 5.1.4 version context and has its own distinct name; it is not labelled
as a newly published Graphile release. No dependency version override is needed.
