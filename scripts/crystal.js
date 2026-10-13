import { lstatSync, readlinkSync, readFileSync, writeFileSync, unlinkSync, symlinkSync, existsSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
const mode=process.argv[2],stateFile='.crystal-state.json',link=resolve('node_modules/postgraphile');
const git=(cwd,args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8'}).trim();
if(mode==='link') {
  if(existsSync(stateFile))throw new Error('Already linked; restore stock before switching');
  const checkout=realpathSync(resolve(process.argv[3]??''));
  const target=join(checkout,'postgraphile/postgraphile');
  if(JSON.parse(readFileSync(join(target,'package.json'))).name!=='postgraphile')throw new Error('Not a Crystal checkout');
  if(!existsSync(join(target,'dist/index.js')))throw new Error('Build Crystal first; dist/index.js is missing');
  if(!lstatSync(link).isSymbolicLink())throw new Error('Expected pnpm symlink; refusing to replace a directory');
  const state={checkout,sha:git(checkout,['rev-parse','HEAD']),dirty:git(checkout,['status','--porcelain']).length>0,originalLink:readlinkSync(link),linkedAt:new Date().toISOString()};
  writeFileSync(stateFile,JSON.stringify(state,null,2)+'\n');
  unlinkSync(link);symlinkSync(target,link,'dir');
  try {
    const deps=JSON.parse(execFileSync(process.execPath,['scripts/provenance.js'],{encoding:'utf8'}));
    for(const name of ['postgraphile','grafast','grafserv','graphile-build','graphile-build-pg','@dataplan/pg','pg-introspection','graphql']) {
      if(!deps[name].path.startsWith(checkout+'/'))throw new Error(`${name} did not resolve from the checkout`);
    }
    console.log(JSON.stringify({state,dependencies:deps},null,2));
  } catch(error) {unlinkSync(link);symlinkSync(state.originalLink,link,'dir');unlinkSync(stateFile);throw error;}
} else if(mode==='stock') {
  if(!existsSync(stateFile))throw new Error('No linked checkout to restore');
  const state=JSON.parse(readFileSync(stateFile));
  if(!lstatSync(link).isSymbolicLink()||realpathSync(link)!==join(state.checkout,'postgraphile/postgraphile'))throw new Error('Link changed unexpectedly');
  unlinkSync(link);symlinkSync(state.originalLink,link,'dir');unlinkSync(stateFile);
  console.log(execFileSync(process.execPath,['scripts/provenance.js'],{encoding:'utf8'}));
} else throw new Error('Use crystal:link /absolute/path/to/crystal or crystal:stock');
