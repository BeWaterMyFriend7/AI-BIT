# Opencode IDE Assistant for VS Code

将 VS Code 与 [Opencode](https://opencode.ai) 深度融合，右键选中代码/文件一键发送到 Opencode 对话。

## 功能

- **右键菜单**: 选中代码 → 解释代码 / 写单测 / 优化代码 / 发送到 Opencode
- **上下文缓冲**: 多次选中的文本和文件累积后批量发送
- **终端集成**: 在 VS Code 内置终端中启动 Opencode TUI 对话
- **系统提示词**: 自定义 "单测"、"优化" 等快捷指令模板
- **Chat Viewer**: 锚点时间线浏览会话历史，hover 预览，点击跳转
- **状态栏**: 一键启动 Opencode，显示上下文缓冲数量

## 安装

1. 下载 `vscode-opencode-0.1.0.vsix`
2. VS Code → `Ctrl+Shift+X` → `...` → `Install from VSIX...`
3. 选择 `.vsix` 文件

## 前提

- [Opencode CLI](https://opencode.ai) 已安装并可在终端中执行 `opencode`
- 如需自定义路径：`Settings → Opencode → Opencode Path`

## 配置

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| `opencode.opencodePath` | `opencode` | opencode 可执行文件路径 |
| `opencode.defaultModel` | (空) | 默认 AI 模型 |
| `opencode.systemPrompts` | 单测、优化 | 自定义系统提示词模板 |

## 开发

```bash
cd vscode-opencode
npm install
# F5 启动 Extension Development Host 调试
```

## 许可

MIT
