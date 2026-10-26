import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const workspace=root;
// Fixed, reproducible intermediate directories only. Keep dependencies, dist and saves.
const targets=[
  'node_modules/.cache','node_modules/.vite','node_modules/.vite-temp',
  'coverage','build','.gradle',
  'apps/android/.gradle','apps/android/build','apps/android/app/build',
  '.pnpm-store',
].map(relative=>path.join(workspace,relative));

async function validate(target){
  const relative=path.relative(workspace,target);
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Unsafe cleanup path: '+target);
  for(let current=target;;current=path.dirname(current)){
    try{
      if(path.relative(current,await fs.realpath(current))!=='')throw new Error('Redirected cleanup path: '+current);
    }catch(error){if(error.code!=='ENOENT')throw error;}
    if(current===workspace)break;
  }
}
async function size(target){
  try{
    const entry=await fs.lstat(target);
    if(entry.isSymbolicLink())return 0;
    if(!entry.isDirectory())return entry.size;
    let bytes=0;
    for(const name of await fs.readdir(target))bytes+=await size(path.join(target,name));
    return bytes;
  }catch(error){if(error.code==='ENOENT')return 0;throw error;}
}
// Preflight all absolute targets before deleting anything.
for(const target of targets)await validate(target);
let bytes=0;
const removed=[];
for(const target of targets){
  try{await fs.lstat(target);}catch(error){if(error.code==='ENOENT')continue;throw error;}
  bytes+=await size(target);
  await fs.rm(target,{recursive:true,force:true});
  removed.push(path.relative(workspace,target).replaceAll('\\','/'));
}
console.log(JSON.stringify({removed,bytes,megabytes:Number((bytes/1024/1024).toFixed(2))},null,2));
