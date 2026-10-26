import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const destination=path.join(root,'docs/compliance');
const inventory=[];
await fs.mkdir(path.join(destination,'licenses'),{recursive:true});
async function collect(directory){
  for(const entry of await fs.readdir(directory,{withFileTypes:true})){
    if(!entry.isDirectory()||entry.isSymbolicLink())continue;
    const location=path.join(directory,entry.name);
    if(entry.name.startsWith('@')){await collect(location);continue;}
    let pkg;
    try{pkg=JSON.parse(await fs.readFile(path.join(location,'package.json'),'utf8'));}catch{continue;}
    const key=`${pkg.name}@${pkg.version}`;
    if(inventory.some(item=>item.package===key))continue;
    const notices=[];
    for(const file of await fs.readdir(location)){
      if(!/^(licen[sc]e|notice|copying)(\.|$)/i.test(file))continue;
      const target=key.replaceAll('/','__')+'-'+file;
      await fs.copyFile(path.join(location,file),path.join(destination,'licenses',target));
      notices.push(`licenses/${target}`);
    }
    inventory.push({package:key,license:pkg.license??null,repository:typeof pkg.repository==='string'?pkg.repository:pkg.repository?.url??null,
      usage:'development-only',notices});
  }
}
for(const entry of await fs.readdir(path.join(root,'node_modules/.pnpm'),{withFileTypes:true})){
  if(!entry.isDirectory()||entry.name==='node_modules')continue;
  await collect(path.join(root,'node_modules/.pnpm',entry.name,'node_modules'));
}
inventory.sort((a,b)=>a.package.localeCompare(b.package));
await fs.writeFile(path.join(destination,'dependency-licenses.json'),JSON.stringify({scope:'installed development dependencies on Windows x64; platform optional packages are recorded by lockfile',packages:inventory},null,2));
console.log(`Recorded ${inventory.length} installed packages and their bundled license/notice files.`);
