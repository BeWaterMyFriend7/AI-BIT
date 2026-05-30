# vscode-oc

在 VS Code 中集成 OpenCode CLI 的插件。

## 功能

- 右键菜单将选中文本/文件路径发送到 OpenCode 终端
- 提示词预设（单测、优化）一键发送
- 会话历史锚点导航面板

## 安装

1. 确保已安装 opencode CLI：`npm install -g opencode-ai`
2. 克隆项目，VS Code 中打开 `vscode-oc` 目录
3. `npm install && npm run compile`
4. F5 启动扩展开发主机

## 开发

```bash
npm install
npm run watch    # 开发时自动编译
```

## 配置

`Ctrl+,` → 搜索 "OpenCode" 打开设置页面。
