# 资产与依赖台账（开发版）

日期：2026-10-26。这里只记录实际使用，不代表最终商用或商标审查已完成。

| 项目 | 来源/源文件 | 状态 |
|---|---|---|
| 游戏名《方块消消看》/DropGrid Echo | 按用户提供的候选名称修改 | 未做商标、商店和域名检索 |
| 标志、块体、网格、主题 | apps/web/src/style.css、renderer.ts | 项目内程序化绘制，无外部图像 |
| 三组循环旋律 | apps/web/src/audio.ts，三套手写 MIDI 音高序列 | 程序合成，无采样；待实际设备试听与音频质量评审 |
| 旋转/落地/消行/Spin/全清/结束音效 | 同上 | 程序合成，无外部录音 |
| 字体 | CSS 系统字体栈 | 未打包或再分发字体文件；各设备显示可能不同 |
| 图标 | CSS、文字、系统 Unicode 字形；桌面 icon.ico 由 tools/build-icon.mjs 生成 | 无外部图标库；跨系统字形一致性待复核 |
| TypeScript | pnpm-lock.yaml，Apache-2.0 | 仅开发工具，需保留适用通知 |
| Vite 及打包依赖 | pnpm-lock.yaml | 开发工具；Web 改为 IIFE 普通脚本构建，仍随包保留 Vite MIT 通知 |
| @types/node | pnpm-lock.yaml，MIT | 仅开发类型，不进入游戏运行包 |
| Electron 45.0.0 | 官方 npm 包与官方运行时，MIT 及 Chromium/Node 第三方通知 | Windows 宿主；LICENSE.electron.txt 和 LICENSES.chromium.html 随运行目录保留 |
| electron-builder 26.18.0 | 官方 npm 包，开发依赖清单 | NSIS 打包工具，不作为游戏 JS 依赖；相关许可文件已纳入清单 |

Core 运行时零第三方依赖。Web 生产代码没有外部 CDN、字体、音频请求；当前没有广告、支付、身份或分析 SDK。浏览器 localStorage 只存设置、本地进度、输入回放和本地记录，没有网络传输这些数据。

`apps/web/public/THIRD-PARTY-NOTICES.txt` 随 Web 构建一起分发。完整开发依赖许可文件保存在当前目录 licenses/，元数据见 dependency-licenses.json；目前记录了 283 个已安装包，不等于把这些开发依赖全部打进游戏。Electron 运行时的第三方许可另随 Windows 包分发。

后续每加入 SDK、字体、音频录制、图像或平台插件，都要补充来源 URL、精确版本、许可证、署名要求、用途与修改记录。正式发行还需按目标市场完成品牌及整体表达审查、隐私说明、平台资质与出版运营条件。
