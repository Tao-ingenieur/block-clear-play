import fs from 'node:fs/promises';
const {version}=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url),'utf8'));
await fs.mkdir(new URL('../../dist/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../../dist/README.txt',import.meta.url),
`方块消消看 — 构建产物说明\r\n\r\nweb-v${version}/index.html\r\n  Web 版入口：双击即可运行。保留同目录的 game.js、game.css 等文件。\r\n\r\nwindows-v${version}/\r\n  Windows 64 位桌面版。成功构建后包含安装包、免安装程序和所需资源。\r\n  BlockClearPlay-Setup-${version}.exe 是安装包，不需要另装 Node.js。\r\n  win-unpacked/BlockClearPlay.exe 是免安装入口，必须保留 win-unpacked 整个目录。\r\n\r\ncore/\r\n  开发用的编译规则库（JS 与类型声明），供各平台复用。没有界面，不能独立游玩。\r\n\r\nZIP 的含义\r\n  ZIP 只是文件夹的压缩副本，便于传输或部署，不会把 Web 游戏变成 Windows 程序。\r\n  为避免拿错，已不再保留重复的旧 Web ZIP。\r\n\r\n开发版尚未进行 Windows 代码签名，不代表已完成商用上架。\r\n`);
