import fs from 'node:fs/promises';
const metadata=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url),'utf8'));
await fs.writeFile(new URL('../../dist/core/package.json',import.meta.url),JSON.stringify({
  name:'@dropgrid/core',version:metadata.version,private:true,type:'module',
  exports:{'.':{types:'./index.d.ts',import:'./index.js'}},
},null,2)+'\n');
await fs.writeFile(new URL('../../dist/core/README.txt',import.meta.url),
  '这是开发用的编译规则库，没有界面，不能独立运行游戏。\r\n玩家请使用 ../web/index.html 或 Windows 桌面版 .exe。\r\n');
