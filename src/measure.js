import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { realpathSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
export const QUIET_MS = 5500;
export async function collectMemory() {
  if (!global.gc) throw new Error('Use --expose-gc');
  await delay(QUIET_MS);
  const gcPausesMs=[];
  for(let i=0;i<3;i++) {
    const start=performance.now();
    global.gc();
    gcPausesMs.push(performance.now()-start);
    await new Promise(resolve=>setImmediate(resolve));
  }
  return { ...process.memoryUsage(), peakRssBytes: process.resourceUsage().maxRSS * 1024, gcPausesMs };
}
export function dependencies() {
  const root=createRequire(import.meta.url);
  const pgl=createRequire(root.resolve('postgraphile'));
  const result={};
  for(const name of ['postgraphile','grafast','grafserv','graphile-build','graphile-build-pg','@dataplan/pg','pg-introspection','graphql','pg','express']) {
    const req=['express','pg','postgraphile'].includes(name)?root:pgl;
    // Some packages export only their entry point. Search upward for their manifest.
    let resolved=realpathSync(req.resolve(name));
    let dir=resolved.slice(0,resolved.lastIndexOf('/'));
    while(true) {
      try { const p=JSON.parse(readFileSync(`${dir}/package.json`)); if(p.name===name) {result[name]={version:p.version,path:realpathSync(dir)};break;} } catch {}
      const parent=dir.slice(0,dir.lastIndexOf('/'));if(parent===dir||!parent)throw new Error(`No manifest for ${name}`);dir=parent;
    }
  }
  return result;
}
export async function environment(pool) {
  let crystal=null;
  try { crystal=JSON.parse(readFileSync('.crystal-state.json','utf8')); } catch {}
  return { recordedAt:new Date().toISOString(),node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch,
    cpus:os.cpus().length,cpuModel:os.cpus()[0]?.model,totalMemory:os.totalmem(),nodeOptions:process.env.NODE_OPTIONS??'',
    nodeEnv:process.env.NODE_ENV,graphileEnv:process.env.GRAPHILE_ENV,quietMs:QUIET_MS,gcPasses:3,
    postgres:(await pool.query('SELECT version() AS version')).rows[0].version,
    postgresSettings:(await pool.query("SELECT name, setting, unit FROM pg_settings WHERE name IN ('max_locks_per_transaction','shared_buffers','max_connections') ORDER BY name")).rows,
    gitSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    gitDirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim().length>0,
    sourceDirty:execFileSync('git',['status','--porcelain','--','src','scripts','test','package.json','pnpm-lock.yaml','compose.yaml'],{encoding:'utf8'}).trim().length>0,dependencies:dependencies(),crystal };
}
