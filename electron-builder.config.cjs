const path=require('node:path');
module.exports={
  appId:'io.dropgrid.blockclearplay',productName:'方块消消看',executableName:'BlockClearPlay',
  directories:{output:path.resolve(__dirname,'node_modules/.cache/windows-build/staging'),buildResources:'apps/desktop/assets'},
  files:['apps/desktop/main.cjs','package.json'],
  extraResources:[{from:path.resolve(__dirname,'../dist/web'),to:'web'}],
  electronDist:'node_modules/electron/dist',asar:true,npmRebuild:false,forceCodeSigning:false,
  win:{target:[{target:'dir',arch:['x64']}],icon:'apps/desktop/assets/icon.ico',requestedExecutionLevel:'asInvoker'},
};
