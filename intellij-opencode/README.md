# Opencode IDE Assistant for IntelliJ IDEA

将 IntelliJ IDEA 与 [Opencode](https://opencode.ai) 深度融合，右键选中代码/文件一键发送到 Opencode 对话。

## 功能

- **右键菜单**: 选中代码 → 解释代码 / 写单测 / 优化代码 / 发送到 Opencode
- **上下文缓冲**: 多次选中的文本和文件累积后批量发送
- **终端集成**: 在 IDEA 内置终端中启动 Opencode TUI 对话
- **系统提示词**: 自定义 "单测"、"优化" 等快捷指令模板
- **Chat Viewer**: 锚点时间线浏览会话历史，hover 预览，点击跳转
- **状态栏**: 显示上下文缓冲数量
- **坑点检测**: 首次启动检测终端滚轮设置并提示调整

## 安装

1. 下载 `intellij-opencode-0.1.0.zip`
2. IntelliJ IDEA → `Settings → Plugins → ⚙ → Install Plugin from Disk`
3. 选择 `.zip` 文件
4. 重启 IDE

## 兼容性

- IntelliJ IDEA 2023.2+
- 社区版 (IC) 和旗舰版 (IU) 均支持
- 需要 Terminal 插件（IDE 自带）

## 前提

- [Opencode CLI](https://opencode.ai) 已安装
- 如需自定义路径：`Settings → Tools → Opencode`

## 配置

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| Opencode 路径 | `opencode` | opencode 可执行文件路径 |
| 默认模型 | (空) | 默认 AI 模型 |
| 系统提示词 | 单测、优化 | 每行格式: `名称:提示词` |

## 开发

```bash
# 需要 JDK 17+ 和 Gradle 8.7+
cd intellij-opencode
gradle build        # 构建插件
gradle runIde       # 启动沙盒 IDE 调试
```

## 许可

MIT
