const {app, BrowserWindow, Menu, net, protocol}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const {pathToFileURL}=require('node:url');

const smoke=process.argv.includes('--smoke-test');
const fileSmoke=process.argv.includes('--file-entry');
const reportArgument=process.argv.find(arg=>arg.startsWith('--smoke-report='));
const reportPath=reportArgument?.slice('--smoke-report='.length);
if(smoke&&reportPath)app.setPath('userData',path.join(path.dirname(reportPath),fileSmoke?'file-profile':'desktop-profile'));
app.setName('方块消消看');
protocol.registerSchemesAsPrivileged([{scheme:'echo',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
let window;
let watchdog;
const errors=[];
const checks=[];
const webRoot=app.isPackaged?path.join(process.resourcesPath,'web'):path.resolve(__dirname,'../../../dist/web-v0.1.0');
const entry='echo://game/index.html';
const csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

async function finishSmoke(pass,error){
  clearTimeout(watchdog);
  const report={pass,packaged:app.isPackaged,fileEntry:fileSmoke,electron:process.versions.electron,checks,errors,error:error?String(error):null};
  if(reportPath){await fs.mkdir(path.dirname(reportPath),{recursive:true});await fs.writeFile(reportPath,JSON.stringify(report,null,2));}
  app.exit(pass?0:1);
}
async function waitFor(condition,timeout=8000){
  const start=Date.now();
  while(Date.now()-start<timeout){if(await window.webContents.executeJavaScript(condition))return;await new Promise(resolve=>setTimeout(resolve,50));}
  throw new Error(`Timed out: ${condition}`);
}
async function runSmoke(){
  await waitFor("Boolean(document.querySelector('#overlay-action'))");
  checks.push('window and renderer loaded');
  const isolated=await window.webContents.executeJavaScript("typeof window.require==='undefined' && typeof window.process==='undefined'");
  if(!isolated)throw new Error('Renderer exposes Node');checks.push('sandboxed renderer has no Node access');
  // Exercise the actual shipped UI, not a separate demonstration game.
  await window.webContents.executeJavaScript("document.querySelector('[data-mode=puzzle]').click();document.querySelector('#overlay-action').click()");
  const key=async(code)=>window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent('keydown',{code:${JSON.stringify(code)},bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{code:${JSON.stringify(code)},bubbles:true}))`);
  await key('ArrowUp');for(let i=0;i<5;i++)await key('ArrowLeft');await key('Space');
  await waitFor("document.querySelector('#lines').textContent==='004'");
  const score=await window.webContents.executeJavaScript("document.querySelector('#score').textContent.replace(/[^0-9]/g,'')");
  if(score!=='2834')throw new Error(`Unexpected score ${score}`);
  checks.push('puzzle UI cleared four lines and scored 2834');
  if(reportPath){const image=await window.webContents.capturePage();await fs.writeFile(reportPath.replace(/\.json$/,'.png'),image.toPNG());}
  await window.webContents.executeJavaScript("document.querySelector('[data-mode=marathon]').click();document.querySelector('#overlay-action').click()");
  await key('Space');await key('Escape');
  await waitFor("document.querySelector('#overlay-action') && document.querySelector('#score').textContent!=='0'");
  checks.push('hard drop and pause keep pending inputs');
  const session=await window.webContents.executeJavaScript("localStorage.getItem('echo.session')");
  if(!session)throw new Error('Missing save');
  await window.webContents.reload();
  await waitFor("Boolean(document.querySelector('#continue-saved'))");
  checks.push('local save survives reload');
  if(errors.length)throw new Error('Renderer error(s) captured');
  await finishSmoke(true);
}

app.whenReady().then(async()=>{
  await protocol.handle('echo',async request=>{
    try{
      const url=new URL(request.url);
      if(url.host!=='game'||request.method!=='GET')return new Response('Not found',{status:404});
      const file=path.resolve(webRoot,'.'+decodeURIComponent(url.pathname));
      const relative=path.relative(webRoot,file);
      if(relative.startsWith('..')||path.isAbsolute(relative)||relative.includes('\0'))return new Response('Forbidden',{status:403});
      const response=await net.fetch(pathToFileURL(file).href);
      const headers=new Headers(response.headers);headers.set('Content-Security-Policy',csp);
      return new Response(response.body,{status:response.status,headers});
    }catch{return new Response('Not found',{status:404});}
  });
  Menu.setApplicationMenu(null);
  window=new BrowserWindow({width:1180,height:900,minWidth:680,minHeight:600,title:'方块消消看',
    backgroundColor:'#11191c',show:!smoke,autoHideMenuBar:true,
    webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:!smoke}});
  window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('echo://game/')&&!(smoke&&fileSmoke&&url.startsWith('file:')))event.preventDefault();});
  window.webContents.on('render-process-gone',(_event,details)=>{if(smoke)void finishSmoke(false,`Renderer exited: ${details.reason}`);});
  if(smoke){
    watchdog=setTimeout(()=>void finishSmoke(false,'Smoke test deadline exceeded'),35000);
    window.webContents.on('console-message',(_event,details)=>{if(details.level==='error')errors.push(details.message);});
    window.webContents.once('did-finish-load',()=>void runSmoke().catch(error=>finishSmoke(false,error.message)));
  }
  if(smoke&&fileSmoke)await window.loadFile(path.join(webRoot,'index.html'));else await window.loadURL(entry);
  if(!smoke)window.on('ready-to-show',()=>window.show());
}).catch(error=>{if(smoke)void finishSmoke(false,error.message);else app.quit();});
app.on('window-all-closed',()=>app.quit());
