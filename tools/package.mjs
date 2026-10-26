import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {version}=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url),'utf8'));
const output=path.join(root,'dist','web');
// The build already writes directly to this directory. Only add its file manifest.
const actualParent=await fs.realpath(path.dirname(output));
if(path.relative(path.join(root,'dist'),actualParent)!==''||path.basename(output)!=='web')throw new Error('Unsafe output path');
const actual=await fs.realpath(output);
if(path.relative(output,actual)!=='')throw new Error('Output must not be redirected');
const files=[];
async function walk(directory){
  for(const entry of await fs.readdir(directory,{withFileTypes:true})){
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())await walk(file);
    else if(entry.name!=='manifest.json'){
      const bytes=await fs.readFile(file);
      files.push({path:path.relative(output,file).replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
    }
  }
}
await walk(output);files.sort((a,b)=>a.path.localeCompare(b.path));
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({version,ruleset:'echo-v1',status:'local-development-preview',files},null,2));
console.log(JSON.stringify({output,files:files.length,bytes:files.reduce((sum,file)=>sum+file.bytes,0)},null,2));
await import('./write-dist-guide.mjs');
