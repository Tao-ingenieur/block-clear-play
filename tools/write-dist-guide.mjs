import fs from 'node:fs/promises';
await fs.mkdir(new URL('../../dist/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../../dist/README.txt',import.meta.url),
`方块消消看 — 构建产物说明\r\n\r\nweb/index.html\r\n  双击即可运行 Web 版，保留目录内全部文件。\r\n\r\nwindows/BlockClearPlay.exe\r\n  Windows 64 位绿色版，无需安装。必须保留整个 windows 目录。\r\n  不生成安装包，文件名和目录名不带版本号。版本见程序属性和 version.json。\r\n  新版构建成功后自动替换旧程序和资源；存档保存在 AppData。\r\n\r\nandroid/BlockClearPlay-debug.apk\r\n  Android 侧载测试版，由 GitHub Actions 生成，版本见 version.json。\r\n\r\ncore/\r\n  开发用的编译规则库（JS 与类型声明），没有游戏界面。\r\n\r\nrepo 保存源代码；dist 仅保存生成产物，不再保留重复 ZIP。\r\n当前为未签名开发测试版，尚未完成商用上架。\r\n`);
