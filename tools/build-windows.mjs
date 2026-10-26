import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(process.platform!=='win32')throw new Error('Build this Windows desktop target on Windows.');
const environment={...process.env,CSC_IDENTITY_AUTO_DISCOVERY:'false'};
// This development build must not consume a user's signing keys implicitly.
for(const key of ['CSC_LINK','CSC_KEY_PASSWORD','WIN_CSC_LINK','WIN_CSC_KEY_PASSWORD','CSC_NAME'])delete environment[key];
const child=spawn(process.execPath,[path.join(root,'node_modules/electron-builder/cli.js'),'--config','electron-builder.config.cjs','--win','nsis','--x64','--publish','never'],
  {cwd:root,env:environment,stdio:'inherit',windowsHide:true});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',async code=>{
  process.exitCode=code??1;
  if(code===0){try{await import('./finalize-windows.mjs');}catch(error){console.error(error.message);process.exitCode=1;}}
});
