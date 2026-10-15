import assert from 'node:assert/strict';
import { checkedRequest } from './client.js';
import { planQuery } from '../measurement/cache-probe.js';
import { object, array } from '../json.js';
import type { LoadKind } from './process.js';
export async function runLoad(
  port: number,
  tenant: string,
  kind: LoadKind,
  count: number,
): Promise<void> {
  for (let i = 0; i < count; i++) {
    const data = await checkedRequest(
      port,
      tenant,
      kind === 'plans' ? planQuery(i) : undefined,
    );
    if (kind === 'plans')
      assert.equal(array(object(data[`task${i}`]).nodes).length, 1);
    else assert.equal(data.requestIdentity, `bench_reader:${tenant}:1`);
  }
}
