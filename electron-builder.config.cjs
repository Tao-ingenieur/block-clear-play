const path=require('node:path');
const {version}=require('./package.json');
module.exports={
  appId:'io.dropgrid.blockclearplay',productName:'方块消消看',executableName:'BlockClearPlay',
  directories:{output:path.resolve(__dirname,`../dist/windows-v${version}`),buildResources:'apps/desktop/assets'},
  files:['apps/desktop/main.cjs','package.json'],
  extraResources:[{from:path.resolve(__dirname,`../dist/web-v${version}`),to:'web'}],
  electronDist:'node_modules/electron/dist',asar:true,npmRebuild:false,forceCodeSigning:false,
  win:{target:[{target:'nsis',arch:['x64']}],icon:'apps/desktop/assets/icon.ico',requestedExecutionLevel:'asInvoker'},
  nsis:{artifactName:'BlockClearPlay-Setup-${version}.${ext}',oneClick:false,perMachine:false,allowElevation:false,
    allowToChangeInstallationDirectory:true,createDesktopShortcut:true,shortcutName:'方块消消看',deleteAppDataOnUninstall:false},
};
