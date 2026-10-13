import assert from 'node:assert/strict';
import { checkedRequest } from '../src/client.js';
import { planQuery } from '../src/cache-probe.js';
const [portString,tenant,kind,countString]=process.argv.slice(2);
const port=Number(portString), count=Number(countString);
for(let i=0;i<count;i++) {
  const data=await checkedRequest(port,tenant,kind==='plans'?planQuery(i):undefined);
  if(kind==='plans') assert.equal(data[`task${i}`].nodes.length,1);
  else assert.equal(data.requestIdentity,`bench_reader:${tenant}:1`);
}
