# 本地 HTML 启动修复与 Windows 开发版

本次针对用户反馈的三个问题：双击 index.html 无法启动、dist/core 用途不清、没有 Windows 可执行文件。

## 已完成

1. Web 生产构建改为独立 IIFE 普通脚本，输出 index.html + game.js + game.css，支持 file:// 本地文件入口及 HTTP/HTTPS 部署。开发服务器入口仍保留 Vite 模块开发体验。[Vite IIFE 构建选项](https://vite.dev/config/build-options.html)。
2. 增加 Electron Windows x64 宿主，复用同一个 Web 包和 Core。正常桌面启动使用本地 echo:// 来源，不需要 Node.js、pnpm、单独安装浏览器或启动 HTTP 服务器。
3. 用 electron-builder 26.18.0、Electron 45.0.0 生成 NSIS 安装包与 win-unpacked 免安装目录；构建明确禁止自动发布，且不隐式使用个人签名凭据。
4. 增加原创图标生成源码、dist 总说明、Web/Windows/Core 各目录说明。移除旧的重复 Web ZIP；SHA256SUMS.txt 改为当前安装器的校验值。
5. 构建诊断与未使用的自动更新元数据移入 node_modules/.cache，dist/windows-v0.1.0 只保留运行所需目录、安装程序与使用说明。

## 双击入口

| 产物 | 用途 |
|---|---|
| dist/web-v0.1.0/index.html | Web 游戏，保留同目录全部文件即可本地打开 |
| dist/windows-v0.1.0/BlockClearPlay-Setup-0.1.0.exe | Windows x64 安装包，约 122MB |
| dist/windows-v0.1.0/win-unpacked/BlockClearPlay.exe | 免安装游戏入口，必须保留整个 win-unpacked 目录 |
| dist/core | 开发用 JS 规则库及类型声明，没有界面，不能单独游玩 |

旧 ZIP 只是 Web 文件夹的压缩副本，用于传输/部署，不是 Windows 程序；本轮移除了这一重复产物。

## 实际验证

- `pnpm verify`：42 项测试全部通过，Core 行/分支/函数覆盖均 100%，Core/Web 构建及固定回放 7f3279ab 一致性验证通过。
- `node --check`：桌面主进程和打包配置语法通过。
- 打包后的真实 BlockClearPlay.exe 在隐藏窗口自检，使用正常 echo:// 入口：渲染完成、renderer 无 Node API、通过真实 UI 清 4 行得 2834 分、硬降后暂停不丢输入、本地存档刷新恢复、无 renderer error。
- 同一个打包程序再使用 file:// 直接打开本轮 Web index.html，以上五项再次全部通过。结果见 windows-smoke.json、web-file-smoke.json。
- windows-preview.png 来自最终打包 exe 的实际页面捕获，非网页设计稿。
- 生成了真实 PE 格式的安装器，并校验 SHA-256；安装器没有执行安装。未进行 Start Menu/桌面快捷方式、安装升级/卸载、干净虚拟机或杀毒软件矩阵测试。
- file:// 自检使用 Electron 的 Chromium 渲染器。普通 Chrome/Edge/Safari 和各浏览器本地存储策略仍需兼容矩阵验证，不把该测试夸大为全部浏览器均已实测。

## 可复现命令

在 repo 中执行：

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm build:windows
pnpm smoke:windows
```

Windows 首次构建需下载官方 Electron 二进制与 NSIS 等工具；后续可复用缓存。electron-winstaller 属于未使用的 Squirrel 打包路线，其安装脚本在 pnpm-workspace.yaml 显式禁用，不影响本项目 NSIS 输出。

自检用 windowsHide 和隐藏 BrowserWindow，资料放在 node_modules/.cache，不污染用户正式存档。正常运行的个人进度由 Electron 的用户数据目录管理。

## 限制

当前是**未签名的 Windows x64 开发测试版**，不是商用上架认证。未验证安装流程；未提供 Windows 32 位/ARM 原生包、微信、Android/iOS 包或在线服务。本地 Web 文件存档由浏览器策略决定，受限时仍可开始单局游戏；桌面版使用稳定的独立来源。

Electron 自身 LICENSE.electron.txt 和 LICENSES.chromium.html 随 Windows 运行目录保留；开发依赖清单与许可证文件已更新。公开代码仓库与构建包分离，安装器和运行时不提交到 Git。
