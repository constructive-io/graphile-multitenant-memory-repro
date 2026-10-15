import { request } from 'node:http';
import { object, array, string, number } from '../json.js';
export interface GraphqlResponse {
  status: number | undefined;
  body: Record<string, unknown>;
}
export function graphqlRequest(
  port: number,
  tenant: string,
  query: string,
  user = '1',
  variables: Record<string, unknown> = {},
): Promise<GraphqlResponse> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const req = request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/graphql',
        method: 'POST',
        agent: false,
        headers: {
          host: `${tenant}.localhost`,
          'x-bench-user': user,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          text += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: object(JSON.parse(text)) });
          } catch (error) {
            reject(error);
          }
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}
export const smokeQuery =
  '{ requestIdentity allTasks { nodes { id title ownerId tenantKey priority score labels scores scoreWindow { start { value } end { value } } projectByProjectId { name accountByAccountId { name } } } } allInheritedRecords { nodes { id ownerId tenantKey label } } echoScore(value: 17) echoMood(value: calm) }';
export async function checkedRequest(
  port: number,
  tenant: string,
  query = smokeQuery,
  user = '1',
): Promise<Record<string, unknown>> {
  const result = await graphqlRequest(port, tenant, query, user);
  if (result.status !== 200 || result.body.errors)
    throw new Error(JSON.stringify(result));
  return object(result.body.data);
}
// Decode only the fields used by correctness assertions, retaining unknown nested values for deepEqual.
export function smokeData(data: Record<string, unknown>) {
  return {
    requestIdentity: string(data.requestIdentity),
    allTasks: {
      nodes: array(object(data.allTasks).nodes).map((value) => {
        const row = object(value);
        return {
          ...row,
          ownerId: number(row.ownerId),
          tenantKey: string(row.tenantKey),
          priority: string(row.priority),
          scoreWindow: row.scoreWindow,
          scores: row.scores,
        };
      }),
    },
    allInheritedRecords: {
      nodes: array(object(data.allInheritedRecords).nodes).map(object),
    },
    echoScore: number(data.echoScore),
    echoMood: string(data.echoMood),
  };
}
