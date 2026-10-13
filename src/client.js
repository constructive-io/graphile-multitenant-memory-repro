import { request } from 'node:http';
export function graphqlRequest(port, tenant, query, user = '1', variables = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const req = request({ hostname: '127.0.0.1', port, path: '/graphql', method: 'POST', agent: false,
      headers: { host: `${tenant}.localhost`, 'x-bench-user': user, 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
    }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(text) }); } catch (error) { reject(error); } });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end(body);
  });
}
export const smokeQuery = '{ requestIdentity allTasks { nodes { id title ownerId tenantKey priority score labels scores scoreWindow { start { value } end { value } } projectByProjectId { name accountByAccountId { name } } } } allInheritedRecords { nodes { id ownerId tenantKey label } } echoScore(value: 17) echoMood(value: calm) }';
export async function checkedRequest(port, tenant, query = smokeQuery, user = '1') {
  const result = await graphqlRequest(port, tenant, query, user);
  if (result.status !== 200 || result.body.errors) throw new Error(JSON.stringify(result));
  return result.body.data;
}
