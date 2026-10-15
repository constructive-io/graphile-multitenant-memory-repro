// Adapted from Crystal PR2; see UPSTREAM.md and the upstream package licences.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { postgraphile } from 'postgraphile';
import { PostGraphileAmberPreset } from 'postgraphile/presets/amber';
import { makePgService } from 'postgraphile/adaptors/pg';
import {
  execute,
  parse,
  printSchema,
  lexicographicSortSchema,
} from 'postgraphile/graphql';
import type { Introspection } from '../utils/pg-introspection/src/index.js';
import { PgIntrospectionPlugin } from '../graphile-build/graphile-build-pg/src/plugins/PgIntrospectionPlugin.js';
import { makePool } from '../src/runtime/config.js';
import { projectPath } from '../src/paths.js';

test('local scoped dependency closure preserves upstream schema and capabilities', async (t) => {
  const pool = makePool();
  async function cleanup() {
    await pool.query('DROP EXTENSION IF EXISTS pg_trgm CASCADE');
    await pool.query(
      'DROP SCHEMA IF EXISTS scope_root, scope_dependency, scope_unrelated, scope_extension, scope_capability_root, scope_partition_root CASCADE',
    );
    if (
      (
        await pool.query(
          "SELECT 1 FROM pg_am WHERE amname='scope_partition_btree'",
        )
      ).rowCount
    ) {
      await pool.query(
        'ALTER EXTENSION plpgsql DROP ACCESS METHOD scope_partition_btree',
      );
      await pool.query('DROP ACCESS METHOD scope_partition_btree CASCADE');
    }
  }
  async function build(scoped: boolean, schemaName = 'scope_root') {
    let captured: Introspection | undefined;
    const capture: GraphileConfig.Plugin = {
      name: 'LocalIntrospectionCapture',
      gather: {
        hooks: {
          pgIntrospection_introspection(_info, event) {
            captured = event.introspection;
          },
        },
      },
    };
    const pgl = postgraphile({
      extends: [PostGraphileAmberPreset],
      disablePlugins: [
        'PgEnumTablesPlugin',
        ...(scoped ? ['PgIntrospectionPlugin' as const] : []),
      ],
      plugins: [...(scoped ? [PgIntrospectionPlugin] : []), capture],
      ...(scoped
        ? {
            gather: {
              pgScopedIntrospection: {
                main: {
                  catalogTypes: 'dependency-closure' as const,
                  capabilityExtensions: ['pg_trgm'],
                },
              },
            },
          }
        : {}),
      pgServices: [
        makePgService({ pool, schemas: [schemaName], pubsub: false }),
      ],
    });
    try {
      const schema = await pgl.getSchema();
      assert(captured, 'Introspection hook must execute');
      const hash = createHash('sha256')
        .update(printSchema(lexicographicSortSchema(schema)))
        .digest('hex');
      return { schema, introspection: captured, hash };
    } finally {
      await pgl.release();
    }
  }
  try {
    await cleanup();
    await pool.query(
      readFileSync(
        projectPath(
          'graphile-build/graphile-build-pg/__tests__/fixtures/scoped-introspection.sql',
        ),
        'utf8',
      ),
    );
    const stock = await build(false),
      scoped = await build(true);
    await t.test('stock and local schemas and runtime match', async () => {
      assert.equal(scoped.hash, stock.hash);
      const document = parse('{ __typename }');
      const actual = await execute({ schema: scoped.schema, document });
      assert.deepEqual(
        actual,
        await execute({ schema: stock.schema, document }),
      );
      assert.equal(actual.errors, undefined);
      assert.equal(actual.data?.__typename, 'Query');
    });
    await t.test(
      'transitive tables, functions, ranges, arrays, inheritance and foreign keys survive',
      () => {
        const intro = scoped.introspection;
        const names = intro.namespaces.map((n) => n.nspname);
        for (const expected of [
          'scope_root',
          'scope_dependency',
          'scope_extension',
          'pg_catalog',
        ])
          assert(names.includes(expected));
        assert(!names.includes('scope_unrelated'));
        const table = intro.classes.find(
          (c) =>
            c.relname === 'closure_items' &&
            c.getNamespace()?.nspname === 'scope_root',
        );
        assert(table);
        const attrs = new Map(
          table.getAttributes().map((a) => [a.attname, a.getType()]),
        );
        for (const [attribute, type] of [
          ['status', 'item_status'],
          ['score', 'positive_integer'],
          ['payload', 'item_payload'],
          ['active_span', 'integer_span'],
        ])
          assert.equal(attrs.get(attribute)?.typname, type);
        assert.deepEqual(
          attrs
            .get('status')
            ?.getEnumValues()
            ?.map((e) => e.enumlabel),
          ['draft', 'active', 'archived'],
        );
        assert.equal(
          attrs.get('status')?.getArrayType()?.typname,
          '_item_status',
        );
        assert.deepEqual(
          attrs
            .get('payload')
            ?.getClass()
            ?.getAttributes()
            .map((a) => a.getType()?.typname),
          ['item_status', 'positive_integer'],
        );
        for (const [name, result, args] of [
          ['echo_dependency_status', 'item_status', ['item_status']],
          [
            'make_dependency_payload',
            'item_payload',
            ['item_status', 'positive_integer'],
          ],
        ] as const) {
          const proc = intro.procs.find(
            (p) =>
              p.proname === name && p.getNamespace()?.nspname === 'scope_root',
          );
          assert.equal(proc?.getReturnType()?.typname, result);
          assert.deepEqual(
            proc?.getArguments().map((a) => a.type.typname),
            args,
          );
        }
        const range = intro.ranges.find(
          (r) => r.getType()?.typname === 'integer_span',
        );
        assert.equal(range?.getSubType()?.typname, 'int4');
        assert.equal(
          intro.types.find((type) => type._id === range?.rngmultitypid)
            ?.typname,
          'integer_span_set',
        );
        const fk = table.getConstraints().find((c) => c.contype === 'f');
        assert.equal(fk?.getForeignClass()?.relname, 'dependency_owners');
        assert.equal(
          fk?.getForeignClass()?.getNamespace()?.nspname,
          'scope_dependency',
        );
        const inherited = intro.classes
          .find((c) => c.relname === 'inherited_items')
          ?.getInherited();
        assert.equal(inherited?.length, 1);
        assert.equal(
          intro.classes.find((c) => c._id === inherited?.[0]?.inhparent)
            ?.relname,
          'inherited_base',
        );
        assert(
          !intro.classes.some((c) => c.relname === 'reverse_inherited_item'),
        );
      },
    );
    await t.test(
      'indexes and owning extension survive while unrelated objects are excluded',
      () => {
        const intro = scoped.introspection;
        const names = intro.indexes.map((i) => i.getIndexClass()?.relname);
        for (const name of [
          'closure_items_status_idx',
          'closure_items_title_gin_trgm_idx',
          'closure_items_title_gist_trgm_idx',
        ])
          assert(names.includes(name));
        assert(intro.extensions.some((e) => e.extname === 'pg_trgm'));
        assert(
          !intro.types.some(
            (v) => v.getNamespace()?.nspname === 'scope_unrelated',
          ),
        );
        assert(
          !intro.procs.some(
            (v) => v.getNamespace()?.nspname === 'scope_unrelated',
          ),
        );
      },
    );
    await t.test(
      'explicit extension capabilities survive without an index dependency',
      async () => {
        const { introspection: intro } = await build(
          true,
          'scope_capability_root',
        );
        assert(intro.extensions.some((e) => e.extname === 'pg_trgm'));
        assert(
          !intro.indexes.some((i) =>
            i.getIndexClass()?.relname.includes('trgm'),
          ),
        );
      },
    );
    await t.test(
      'partitioned access method retains extension metadata',
      async () => {
        const { introspection: intro } = await build(
          true,
          'scope_partition_root',
        );
        assert.equal(
          intro.classes.find((c) => c.relname === 'partitioned_items_idx')
            ?.relkind,
          'I',
        );
        assert(!intro.classes.some((c) => c.relkind === 'i'));
        for (const name of ['plpgsql', 'pg_trgm'])
          assert(intro.extensions.some((e) => e.extname === name));
      },
    );
    await t.test('missing root schema fails closed', async () => {
      await assert.rejects(
        build(true, 'scope_missing_root'),
        /validation failed.*did not find required schema/,
      );
    });
  } finally {
    await cleanup();
    await pool.end();
  }
});
