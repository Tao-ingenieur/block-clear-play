# 资产与依赖台账（开发版）

日期：2026-10-26。这里只记录实际使用，不代表最终商用或商标审查已完成。

| 项目 | 来源/源文件 | 状态 |
|---|---|---|
| 游戏名《方块消消看》/DropGrid Echo | 按用户提供的候选名称修改 | 未做商标、商店和域名检索 |
| 标志、块体、网格、主题 | apps/web/src/style.css、renderer.ts | 项目内程序化绘制，无外部图像 |
| 三组循环旋律 | apps/web/src/audio.ts，三套手写 MIDI 音高序列 | 程序合成，无采样；待实际设备试听与音频质量评审 |
| 旋转/落地/消行/Spin/全清/结束音效 | 同上 | 程序合成，无外部录音 |
| 字体 | CSS 系统字体栈 | 未打包或再分发字体文件；各设备显示可能不同 |
| 图标 | CSS、文字与系统 Unicode 字形 | 无外部图标库；跨系统字形一致性待复核 |
| TypeScript | pnpm-lock.yaml，Apache-2.0 | 仅开发工具，需保留适用通知 |
| Vite 及打包依赖 | pnpm-lock.yaml | 开发工具；生成的 Web 包含其 modulepreload helper，随生产包附 MIT 通知 |
| @types/node | pnpm-lock.yaml，MIT | 仅开发类型，不进入游戏运行包 |

Core 运行时零第三方依赖。Web 生产代码没有外部 CDN、字体、音频请求；当前没有广告、支付、身份或分析 SDK。浏览器 localStorage 只存设置、本地进度、输入回放和本地记录，没有网络传输这些数据。

`apps/web/public/THIRD-PARTY-NOTICES.txt` 随 Web 构建一起分发。完整开发依赖许可文件保存在当前目录 licenses/，元数据见 dependency-licenses.json；该清单将 Vite 归为开发依赖，其生成 helper 的运行时许可另由上述文件覆盖。

后续每加入 SDK、字体、音频录制、图像或平台插件，都要补充来源 URL、精确版本、许可证、署名要求、用途与修改记录。正式发行还需按目标市场完成品牌及整体表达审查、隐私说明、平台资质与出版运营条件。
