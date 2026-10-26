import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const workspace=path.resolve(root,'..');
const {version}=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
const dist=path.join(workspace,'dist'),output=path.join(dist,'windows');
const staging=path.join(root,'node_modules/.cache/windows-build/staging/win-unpacked');
// Validate absolute locations and redirects before any recursive removal or move.
async function checked(target){
  const relative=path.relative(workspace,target);
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Unsafe generated path: '+target);
  let ancestor=target;
  for(;;){
    try{if(path.relative(ancestor,await fs.realpath(ancestor))!=='')throw new Error('Redirected generated path: '+ancestor);}
    catch(error){if(error.code!=='ENOENT')throw error;}
    if(ancestor===workspace)break;
    ancestor=path.dirname(ancestor);
  }
}
await checked(staging);await checked(output);
const bytes=await fs.readFile(path.join(staging,'BlockClearPlay.exe'));
if(bytes.length<1_000_000||bytes.toString('ascii',0,2)!=='MZ')throw new Error('Incomplete Windows executable');
await fs.mkdir(dist,{recursive:true});
// Replace only after a fresh build succeeds. Saves live in AppData, outside this directory.
await fs.rm(output,{recursive:true,force:true});
await fs.rename(staging,output);
await fs.writeFile(path.join(output,'version.json'),JSON.stringify({version,platform:'win32-x64',format:'portable-directory'},null,2));
await fs.writeFile(path.join(output,'README.txt'),
  `方块消消看 v${version} — Windows 64 位绿色版\r\n\r\n双击 BlockClearPlay.exe 即可运行，无需安装。\r\n请保留本目录全部文件，不能只拷贝 EXE。\r\n无需预先安装 Node.js、pnpm 或浏览器。\r\n后续构建自动替换本目录，旧 EXE 和资源不会保留。\r\n游戏存档位于用户 AppData，不随构建目录清理。\r\n当前为未签名的开发测试版。\r\n`);
await fs.writeFile(path.join(dist,'SHA256SUMS.txt'),`${createHash('sha256').update(bytes).digest('hex')}  windows/BlockClearPlay.exe\n`);
// Migrate previously generated versioned output; never remove arbitrary dist contents.
for(const entry of await fs.readdir(dist,{withFileTypes:true})){
  if(entry.isDirectory()&&/^(web|windows)-v\d+\.\d+\.\d+$/.test(entry.name)){
    const legacy=path.join(dist,entry.name);await checked(legacy);await fs.rm(legacy,{recursive:true,force:true});
  }
}
await import('./write-dist-guide.mjs');
console.log(JSON.stringify({executable:path.join(output,'BlockClearPlay.exe'),version,format:'portable-directory',bytes:bytes.length,signed:false},null,2));
