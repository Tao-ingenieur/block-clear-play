import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const packaged=process.argv.includes('--packaged');
const executable=packaged?path.resolve(root,`../dist/windows/BlockClearPlay.exe`):
  path.join(root,'node_modules/electron/dist/electron.exe');
const reports=path.join(root,'node_modules/.cache/dropgrid-smoke',packaged?'packaged':'development');
await fs.mkdir(reports,{recursive:true});
for(const file of [false,true]){
  const report=path.join(reports,file?'file.json':'desktop.json');
  const args=[...(packaged?[]:[root]),'--smoke-test',`--smoke-report=${report}`,...(file?['--file-entry']:[])];
  const environment={...process.env};delete environment.ELECTRON_RUN_AS_NODE;
  let diagnostics='';
  const code=await new Promise((resolve,reject)=>{
    const child=spawn(executable,args,{cwd:root,env:environment,stdio:['ignore','ignore','pipe'],windowsHide:true});
    child.stderr.on('data',data=>{diagnostics=(diagnostics+data.toString()).slice(-4000);});
    child.on('error',reject);child.on('exit',code=>resolve(code));
  });
  let result;
  try{result=JSON.parse(await fs.readFile(report,'utf8'));}
  catch{throw new Error(`Desktop process exited ${code} without a report. ${diagnostics}`);}
  console.log(JSON.stringify(result,null,2));
  if(code!==0||!result.pass)process.exit(1);
}
