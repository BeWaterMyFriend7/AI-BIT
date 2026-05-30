# idea-oc

在 IntelliJ IDEA 中集成 OpenCode CLI 的插件。

## 功能

- 右键菜单将选中文本/文件路径发送到 OpenCode 终端
- 提示词预设（单测、优化）一键发送
- 会话历史锚点导航面板（WebView，解决终端滚轮问题）

## 安装

1. 确保已安装 opencode CLI：`npm install -g opencode-ai`
2. `./gradlew buildPlugin`
3. `Settings → Plugins → Install Plugin from Disk → 选择 build/distributions/idea-oc-0.1.0.zip`

## 开发

```bash
./gradlew runIde    # 启动带插件的 IDEA 沙箱实例
./gradlew build     # 编译
```

## 配置

`File → Settings → Tools → OpenCode` 打开设置页面。
