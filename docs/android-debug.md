# Android Debug APK 与 GitHub Actions

使用现有 TypeScript Core 和 Web 生产资源，Java Activity + Android System WebView 提供离线 Android 宿主。Android 8.0+，需要支持现代 JavaScript 的系统 WebView。没有联网权限、账号、广告或支付 SDK。

## 云端构建与下载

主分支相关源码更新时，`.github/workflows/android-debug.yml` 自动构建。也可在 GitHub → Actions → Android Debug APK → Run workflow 手动触发。成功后在该次运行的 Artifacts 下载 `android-debug`，解压得到 `BlockClearPlay-debug.apk`、版本与 SHA-256 文件。Actions 下载通常需要登录 GitHub，产物保留 14 天。

调试签名允许侧载测试，不用于商店上架。每次全新云端环境可能使用不同 Debug 密钥，覆盖安装可能失败；届时卸载旧测试版再安装会删除其存档。正式发布时应使用稳定、保密的发布签名，另行构建 Release/AAB。

CI 使用 JDK 17、Gradle 8.11.1、AGP 8.9.2、Android SDK 35，执行 Core/Web 验证、assembleDebug、lintDebug、apksigner 验签和资源检查，然后上传产物。测试签名由 Android 工具自动生成，无需提供发布密钥。

## 本地构建

本地需自行安装同版本 JDK、Gradle 和 Android SDK，设置 ANDROID_HOME；本机当前未安装这些 Android 构建依赖，因此使用 GitHub Actions 编译。

```powershell
pnpm install --frozen-lockfile
pnpm build:android
```

产物固定为 `../dist/android/BlockClearPlay-debug.apk`。成功构建后清理此目录的旧 APK，版本写入应用信息与 version.json，文件夹和 APK 名称不带版本号。生成的 SDK 缓存、Gradle 缓存、local.properties 与 APK 不进入源码仓库。

## 平台适配与验证范围

- HTTPS 本地资源来源 `https://appassets.androidplatform.net`，使用 AndroidX WebViewAssetLoader，不依赖 file:// 放开访问。禁止任意网页导航，不暴露通用 JavaScript 原生接口。
- DOM 存储保留进度；切后台派发失焦暂停；旋转保留 WebView；系统栏及刘海区域留出安全边距。
- 回放导入使用系统文档选择器；导出通过仅允许本地可信来源的 WebMessageListener 调用系统保存对话框。旧系统 WebView 若不支持该接口，需要升级 WebView 才能导出。
- 原创四格图标复用桌面视觉，没有第三方美术。

CI 的编译、lint、资源检查和签名验证不等同于真机测试。仍需验证 Android 低中高端设备的触控、横竖屏、音频、切后台存档及回放文件读写。微信小游戏和 iOS 不由此流程生成。

## 依赖与来源

- AndroidX WebKit 1.12.1 及其 AndroidX 传递依赖：Google Maven，Apache-2.0；[官方组件与版本](https://developer.android.com/jetpack/androidx/releases/webkit)、[AndroidX 源码许可](https://android.googlesource.com/platform/frameworks/support/+/androidx-main/LICENSE.txt)。
- AGP/Android 构建工具仅用于开发构建；运行时使用设备自带 Android System WebView。
- [Android 官方命令行构建说明](https://developer.android.com/build/building-cmdline)、[AGP 8.9 工具链兼容表](https://developer.android.com/build/releases/agp-8-9-0-release-notes)、[GitHub 构建产物说明](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts)。
