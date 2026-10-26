import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {version}=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
const dist=path.resolve(root,'../dist'),output=path.join(dist,`windows-v${version}`);
if(path.relative(output,await fs.realpath(output))!=='')throw new Error('Redirected Windows output');
const installer=`BlockClearPlay-Setup-${version}.exe`;
const installerBytes=await fs.readFile(path.join(output,installer));
if(installerBytes.length<1_000_000||installerBytes.toString('ascii',0,2)!=='MZ')throw new Error('Incomplete Windows installer');
const cache=path.join(root,'node_modules/.cache/windows-build');
await fs.mkdir(cache,{recursive:true});
// These are builder diagnostics/update metadata; the game has no auto-updater.
for(const file of ['builder-debug.yml','latest.yml',`${installer}.blockmap`]){
  try{await fs.copyFile(path.join(output,file),path.join(cache,file));await fs.unlink(path.join(output,file));}
  catch(error){if(error.code!=='ENOENT')throw error;}
}
await fs.writeFile(path.join(output,'README.txt'),
  `方块消消看 — Windows 64 位开发版\r\n\r\n安装：双击 ${installer}\r\n免安装：双击 win-unpacked\\BlockClearPlay.exe\r\n\r\n免安装版必须保留整个 win-unpacked 目录，不能只拷贝 exe。\r\n无需预先安装 Node.js、pnpm 或浏览器。\r\n这是未签名的开发测试版，尚未完成安装/升级/卸载的完整验证。\r\n`);
await fs.writeFile(path.join(dist,'SHA256SUMS.txt'),
  `${createHash('sha256').update(installerBytes).digest('hex')}  windows-v${version}/${installer}\n`);
// Remove only our obsolete, reproducible Web archive; source files are untouched.
try{await fs.unlink(path.join(dist,`dropgrid-web-v${version}.zip`));}catch(error){if(error.code!=='ENOENT')throw error;}
await import('./write-dist-guide.mjs');
console.log(JSON.stringify({installer:path.join(output,installer),bytes:installerBytes.length,signed:false},null,2));
