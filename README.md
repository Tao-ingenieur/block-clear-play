# 方块消消看 / DropGrid Echo

原创方块消除游戏的 TypeScript 工程。目前交付确定性 Core、可直接打开的 Web 单机版与 Windows 64 位开发版，尚未达到五平台商用发布状态。工作名尚未进行商标检索。

## 运行

需要 Node.js 24+、pnpm 11。首次安装需联网；使用 pnpm-lock.yaml 固定依赖。在源码仓库根目录（本项目的 repo/）执行：

```powershell
pnpm install --frozen-lockfile
pnpm dev:web
```

开发时打开终端输出的本地地址，默认 http://127.0.0.1:5173/ 。服务器默认只绑定本机，不对外发布。

玩家运行构建产物时不需要 pnpm：Web 版双击 `../dist/web/index.html`；Windows 绿色版双击 `../dist/windows/BlockClearPlay.exe`，必须保留 windows 整个目录，不能只复制 exe。目录和文件名不带版本号，软件版本见 EXE 属性和 version.json。新版构建成功后自动替换旧程序和资源，AppData 中的个人存档不受影响。

## 验证与构建

```powershell
pnpm verify          # Core+Web 类型检查，Core 100% 覆盖门槛，编译与固定回放比对
pnpm demo            # 无界面解开第一个残局，输出得分和恢复前后哈希
pnpm build           # Core + Web 构建输出到 ../dist/
pnpm build:core      # Core 编译库：../dist/core/
pnpm build:web       # Web 生产包：../dist/web/，含文件校验清单
pnpm preview:web     # 本地验证生产包，通常端口 4173
pnpm build:windows   # 在 Windows 上生成 x64 绿色版，自动替换旧产物
pnpm smoke:windows   # 隐藏运行打包后的 exe，验证玩法、暂停、存档与 file:// 入口
```

测试使用 Node 自带测试框架；`--test-isolation=none` 让测试在同一进程运行，避免受限 Windows 环境禁止测试子进程。测试各自创建状态，不依赖执行顺序。覆盖范围是 packages/core/src 的全部模块，没有 coverage ignore。

本地开发 QA 页面（不包含在生产构建入口中）：

- `/qa/determinism.html`：浏览器运行固定回放，期望 tick=500、score=36、hash=7f3279ab。
- `/qa/responsive.html`：390×844、360×640、844×390、1440×960 iframe 视口检查。它不替代真机测试。

## 当前功能

- Core：10×20 可见区/20 隐藏行、7-Bag、90° SRS 与独立 180° 无踢墙扩展、Hold、Ghost、固定 120Hz、DAS/ARR、锁延迟/重置上限、计分、Spin/Mini、Combo、B2B、全清。
- 六种单人模式；20 个原创入门残局及机器可执行解法。
- 纯逻辑双人结算、垃圾生成/抵消/注入、连接状态机、在线输入序号/时窗/频率门禁。这些尚未连接实际服务器。
- Web：键盘/触控/手势、暂停/失焦保护、主题/色弱符号/减少动态/字号、中英文、重映射、按规则配置隔离的本地记录、存档恢复、回放下载与播放。
- 音频：源码合成的三组原创循环旋律与事件音效，音乐/音效分离、静音。没有第三方采样和素材下载。

## 默认操作

| 按键 | 操作 |
|---|---|
| ← / → | 左右，Core 处理 DAS/ARR，忽略系统重复 keydown |
| ↓ | 软降 |
| Space | 硬降，立即锁定 |
| ↑ / Z | 顺时针 / 逆时针 |
| C | Hold |
| A | 180°，仅在设置启用后对下一局生效 |
| Esc | 暂停/继续 |

手机可用底部按键；棋盘轻点旋转、水平滑动移动、下滑硬降。关闭手势后仍可用按键。

## 核心接口

```typescript
import {createGame, step, serialize, restore, stateHash} from './packages/core/src/index.ts';
const game = createGame({seed: 17, mode: 'marathon'});
const events = step(game, [{tick: 1, sequence: 0, action: 'hard', pressed: true}]);
const recovered = restore(serialize(game));
// 同一个规则版本、初始配置与输入流得到相同状态；哈希只用于诊断。
console.assert(stateHash(game) === stateHash(recovered));
```

Core 有意使用可变 GameState，调用者每个 tick 只调用一次 step。渲染只读状态，不能写 board、score 或 tick。回放/存档必须带 schema 与 ruleset；不兼容版本明确拒绝。

## 目录

```text
dropGrid/
  repo/                    # GitHub 仓库根目录
    apps/                  # 各平台客户端源码
    packages/              # 规则核心源码
    tests/                 # 测试与回放夹具
    tools/                 # 构建与验证脚本
    docs/                  # 方案、规则、许可与验证文档
    package.json
    pnpm-lock.yaml
    node_modules/          # 仅本地依赖，.gitignore 排除
  dist/                    # 自动生成，不属于源码仓库
    core/                  # 编译后的 JS 库及类型声明
    web/                   # 双击 index.html 游玩，也可部署到静态服务器
    windows/               # Windows x64 绿色版，直接运行 BlockClearPlay.exe
    README.txt             # 各产物的用途和启动入口
    SHA256SUMS.txt          # 绿色版 EXE 校验值
```

上传 GitHub 时以 `repo/` 为仓库根目录，包含源码、测试、文档、配置和依赖锁文件。安装依赖使用 `pnpm install --frozen-lockfile`；不要上传 node_modules、本地缓存、环境密钥或外层 dist。构建输出统一在仓库外的 `../dist/`，不生成源码复制目录或源码压缩包。

`packages/core/src` 是纯规则；`apps/web/src` 是首个浏览器宿主，音频和 Canvas 已独立模块。未来微信与原生宿主通过统一适配接口复用 Core。

## 限制与下一步

未交付：微信真机包、APK/AAB、iOS 归档、在线服务、真实支付/广告、云存档、运营后台、正式发布合规。Windows 为未签名的开发测试版；目前验证了免安装 exe 的实际启动、消行、暂停和存档恢复，不能把这些测试当成完整商用认证。Web 仍需浏览器/设备矩阵、真实音频试听、性能/内存测量和视觉打磨；目前的 20 关为入门教学内容，难度设计需继续扩展。

Web 生产包使用普通 IIFE 脚本，可从本地文件直接启动，也可在 HTTP/HTTPS 静态服务器部署。file:// 下本地存储行为由浏览器决定，受限时仍可游玩；Windows 版使用独立、稳定的本地来源和用户存档目录。不含 PWA 缓存。音频遵循浏览器权限与平台行为，移动系统静音开关的具体一致性留待原生适配和真机验证。

线上 Web 发布需 HTTPS、自己的域名/服务器与平台资质。iOS 构建需 macOS/Xcode 和开发者账号；密钥、证书、个人信息不要提交到工程。最新状态见 [Windows 与本地文件启动验证](docs/verification/windows-and-file-launch.md)，Core 的初期验收见 [历史验证报告](docs/verification/phase-2-and-web.md)。
