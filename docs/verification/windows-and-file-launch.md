# Windows 绿色版与本地 Web 验证

当前产物目录固定为 dist/web、dist/windows、dist/core，不含版本号。Windows 仅交付绿色版，不生成安装器。

## 入口与构建

- dist/web/index.html：直接双击；保留同目录所有文件，也可部署到静态服务器。
- dist/windows/BlockClearPlay.exe：Windows x64 绿色版，无需安装。保留整个 windows 目录，不能单独复制 EXE。
- dist/core：编译后的规则库，没有独立游戏界面。

软件版本来自 package.json，保留在 Windows EXE 属性、windows/version.json 和 Web manifest.json。构建先在忽略的缓存目录生成程序，成功后整体替换 dist/windows，删除旧 EXE 和旧资源。个人进度在 AppData，构建不清理存档。路径在递归清理和移动前验证，拒绝目录重定向；仅清理已知生成目录。此前版本号目录及安装包一并移除。

```powershell
pnpm verify
pnpm build:windows
pnpm smoke:windows
```

## 验证

- Core 42 项测试、100% 行/分支/函数覆盖率及固定回放一致性验证。
- 打包后的真实 EXE 使用隐藏窗口，分别测试 echo:// 和 file:// 入口：渲染、无 Node API 暴露、UI 清四行得 2834 分、暂停与存档刷新恢复、无 renderer error。
- 在旧输出放置临时 obsolete-build.exe 标记后重建，验证旧文件被清除、目录只有新版程序、没有安装包或版本号目录。
- EXE 保留产品版本，SHA256SUMS.txt 校验当前 windows/BlockClearPlay.exe。
- windows-smoke.json、web-file-smoke.json 为实际自检报告；windows-preview.png 为真实程序截图。

## 实现与限制

Web 生产构建使用 IIFE 普通脚本支持本地文件启动。Electron 45.0.0、electron-builder 26.18.0 只构建 dir 目标；不自动发布、不隐式使用个人签名证书。构建缓存位于 node_modules/.cache，不进入公开源码仓库。

当前为未签名 Windows x64 开发测试版，未完成干净系统、杀毒软件或浏览器/设备兼容矩阵验证。file:// 自检使用 Electron Chromium，不能代表全部浏览器已实测。尚未提供微信、Android/iOS 或在线服务。

Electron 和 Chromium 的许可文件随运行目录保留。GitHub 仅保存源码、文档及测试资料，不提交运行时和生成包。
