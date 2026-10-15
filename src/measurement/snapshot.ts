import assert from 'node:assert/strict';
import { object, array, string, number } from '../json.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dominators, retainedByLabel } from './dominators.js';
export function analyzeSnapshot(input: string, output: string): void {
  const bytes = readFileSync(input);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const heap = parseHeap(JSON.parse(bytes.toString()));
  const { nodes, edges, strings } = heap;
  const meta = heap.snapshot.meta,
    nf = meta.node_fields,
    ef = meta.edge_fields;
  const width = nf.length,
    ew = ef.length,
    n = nodes.length / width;
  const ix = Object.fromEntries(nf.map((s, i) => [s, i])),
    ex = Object.fromEntries(ef.map((s, i) => [s, i]));
  const nodeTypes = meta.node_types[ix.type],
    edgeTypes = meta.edge_types[ex.type];
  assert(
    Array.isArray(nodeTypes) && Array.isArray(edgeTypes),
    'Missing snapshot type tables',
  );
  const offsets = new Uint32Array(n + 1),
    sizes = new Float64Array(n),
    labels = new Array<string | undefined>(n),
    signatures = new Array<string | undefined>(n);
  const rawStarts = new Uint32Array(n + 1);
  let raw = 0,
    kept = 0;
  const keep = (edge: number, node: number) =>
    edgeTypes[edges[edge + ex.type]] !== 'weak' &&
    (edgeTypes[edges[edge + ex.type]] !== 'shortcut' || node === 0);
  for (let i = 0; i < n; i++) {
    const base = i * width;
    rawStarts[i] = raw;
    sizes[i] = nodes[base + ix.self_size];
    const type = nodeTypes[nodes[base + ix.type]],
      name = strings[nodes[base + ix.name]];
    if (type === 'object') labels[i] = name;
    offsets[i] = kept;
    const props = new Set();
    const end = raw + nodes[base + ix.edge_count] * ew;
    for (let e = raw; e < end; e += ew) {
      if (keep(e, i)) kept++;
      if (edgeTypes[edges[e + ex.type]] === 'property')
        props.add(strings[edges[e + ex.name_or_index]]);
    }
    if (type === 'object') {
      const shape = [
        ['nspname', 'Namespace row'],
        ['relname', 'Class row'],
        ['typname', 'Type row'],
        ['proname', 'Procedure row'],
        ['attname', 'Attribute row'],
        ['conname', 'Constraint row'],
      ].find(([key]) => props.has(key) && props.has('_id'));
      if (props.has('attname') && props.has('getClass'))
        signatures[i] = 'Attribute row';
      else if (shape) signatures[i] = shape[1];
      else if (
        props.has('input') &&
        props.has('versions') &&
        props.has('status') &&
        props.has('getTypeByName')
      )
        signatures[i] = 'Build object signature';
      else if (
        props.has('namespaces') &&
        props.has('classes') &&
        props.has('types')
      )
        signatures[i] = 'Introspection container signature';
    }
    raw = end;
  }
  rawStarts[n] = raw;
  offsets[n] = kept;
  const targets = new Uint32Array(kept);
  let cursor = 0;
  for (let i = 0; i < n; i++)
    for (let e = rawStarts[i]; e < rawStarts[i + 1]; e += ew)
      if (keep(e, i)) targets[cursor++] = edges[e + ex.to_node] / width;
  const { idom, retained, reachable } = dominators(offsets, targets, sizes);
  const result = {
    source: input.split('/').at(-1),
    sha256,
    nodeCount: n,
    reachable,
    strongEdges: kept,
    strongGraphShallowBytes: retained[0],
    method:
      'Dominators of root-reachable V8 snapshot graph; weak edges and non-root shortcut edges excluded. External/native allocation and ephemeron-specific V8 semantics are not modeled. Constructor union sums only outermost same-constructor dominator subtrees, eliminating within-row double counting. Different rows overlap and MUST NOT be summed. Property signatures are heuristics, not proof of build-only ownership.',
    constructors: retainedByLabel(idom, retained, sizes, labels),
    signatures: retainedByLabel(idom, retained, sizes, signatures),
  };
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(
    JSON.stringify({
      snapshot: result.source,
      nodes: n,
      reachable,
      signatures: result.signatures,
    }),
  );
}

function parseHeap(value: unknown) {
  const heap = object(value),
    meta = object(object(heap.snapshot).meta);
  const types = (value: unknown) =>
    array(value).map((item) =>
      typeof item === 'string' ? item : array(item).map(string),
    );
  return {
    nodes: array(heap.nodes).map(number),
    edges: array(heap.edges).map(number),
    strings: array(heap.strings).map(string),
    snapshot: {
      meta: {
        node_fields: array(meta.node_fields).map(string),
        edge_fields: array(meta.edge_fields).map(string),
        node_types: types(meta.node_types),
        edge_types: types(meta.edge_types),
      },
    },
  };
}
