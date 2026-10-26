import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.resolve(root,'../dist'),output=path.join(dist,'android');
const source=path.join(root,'apps/android/app/build/outputs/apk/debug/app-debug.apk');
const bytes=await fs.readFile(source);
if(bytes.length<1000||bytes.readUInt32LE(0)!==0x04034b50)throw new Error('Missing or invalid APK');
await fs.mkdir(dist,{recursive:true});
if(path.relative(dist,await fs.realpath(dist))!=='')throw new Error('Redirected dist directory');
try{if(path.relative(output,await fs.realpath(output))!=='')throw new Error('Redirected Android output');}
catch(error){if(error.code!=='ENOENT')throw error;}
// Only this fixed generated directory is replaced, after a successful APK build.
if(path.dirname(output)!==dist||path.basename(output)!=='android')throw new Error('Unsafe Android output');
await fs.rm(output,{recursive:true,force:true});await fs.mkdir(output);
const file='BlockClearPlay-debug.apk';
const {version}=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
await fs.writeFile(path.join(output,file),bytes);
await fs.writeFile(path.join(output,'SHA256SUMS.txt'),`${createHash('sha256').update(bytes).digest('hex')}  ${file}\n`);
await fs.writeFile(path.join(output,'version.json'),JSON.stringify({version,variant:'debug',commit:process.env.GITHUB_SHA??null},null,2));
await fs.writeFile(path.join(output,'README.txt'),'方块消消看 — Android Debug 测试版\n\n安装 BlockClearPlay-debug.apk，Android 8.0+，无需联网。\n这是调试签名的侧载测试版，不可作为商店发布包。\n云端每次构建的调试签名可能不同，若无法覆盖安装，需卸载旧测试版再装；卸载会删除其存档。\n版本见应用信息和 version.json；新构建替换 dist/android 内旧产物。\n');
await import('./write-dist-guide.mjs');
console.log(JSON.stringify({output,version,bytes:bytes.length},null,2));
