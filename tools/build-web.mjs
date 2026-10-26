import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {version}=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
const dist=path.resolve(root,'../dist');
const output=path.join(dist,`web-v${version}`);
await fs.mkdir(dist,{recursive:true});
if(path.relative(dist,await fs.realpath(dist))!=='')throw new Error('Output root must not be redirected');
try{if(path.relative(output,await fs.realpath(output))!=='')throw new Error('Output directory must not be redirected');}
catch(error){if(error.code!=='ENOENT')throw error;}

// A classic IIFE script runs both over HTTPS and directly from file://.
// The development entry remains a normal Vite module.
await build({configFile:false,root:path.join(root,'apps/web'),base:'./',build:{
  outDir:output,emptyOutDir:true,target:'es2022',cssCodeSplit:false,
  lib:{entry:path.join(root,'apps/web/src/main.ts'),name:'BlockClearPlay',formats:['iife'],fileName:()=> 'game.js',cssFileName:'game'},
}});
const original=await fs.readFile(path.join(root,'apps/web/index.html'),'utf8');
const entry='<script type="module" src="/src/main.ts"></script>';
if(!original.includes(entry))throw new Error('Unrecognized Web entry');
const html=original.replace('</head>','  <link rel="stylesheet" href="./game.css" />\n  </head>')
  .replace(entry,'<script defer src="./game.js"></script>');
await fs.writeFile(path.join(output,'index.html'),html);
await fs.writeFile(path.join(output,'README.txt'),
  '方块消消看 / Block Clear Play\r\n\r\n双击 index.html 即可在浏览器中游玩。\r\n请保留此目录的全部文件，不要单独移动 index.html。\r\n也可以将本目录放到 HTTP/HTTPS 静态服务器部署。\r\n浏览器可能限制本地文件的存档；Windows 桌面版提供稳定的独立存档。\r\n');
await import('./package.mjs');
