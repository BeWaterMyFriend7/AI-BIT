# opencode IDE 插件设计说明

日期: 2026-05-30

## 概述

在 VS Code 和 IntelliJ IDEA 中开发插件，将 OpenCode CLI 深度集成到 IDE 中，减少用户复制粘贴操作。用户通过右键菜单直接将选中文本/文件发送到 OpenCode 终端，支持提示词预设一键发送，提供会话历史锚点导航。

## 目录结构

```
AI-BIT/
├── vscode-oc/                  # VS Code 插件 (TypeScript，纯 VS Code Extension API)
│   ├── README.md               # 项目说明
│   ├── USER_GUIDE.md           # 用户操作手册
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── extension.ts        # 入口：激活/停用，注册命令
│   │   ├── terminal.ts         # 终端管理：创建/切换/销毁 opencode 终端
│   │   ├── promptPresets.ts    # 提示词预设管理（读取 settings.json）
│   │   ├── sessionView.ts      # WebView 面板：会话历史 + 锚点导航
│   │   └── commands.ts         # 右键菜单命令注册
│   └── media/
│       ├── session.css
│       └── session.js
│
├── idea-oc/                    # IDEA 插件 (Kotlin，IntelliJ Platform SDK)
│   ├── README.md               # 项目说明
│   ├── USER_GUIDE.md           # 用户操作手册
│   ├── build.gradle.kts
│   ├── gradle.properties
│   ├── src/main/
│   │   ├── resources/META-INF/plugin.xml
│   │   └── kotlin/
│   │       ├── OpenCodePlugin.kt          # 插件入口
│   │       ├── OpenCodeTerminalRunner.kt  # 终端管理
│   │       ├── ContextCollector.kt        # 上下文收集（选中文本/文件路径）
│   │       ├── PromptPresetAction.kt      # 提示词预设
│   │       ├── SessionToolWindow.kt       # 会话 WebView 面板
│   │       └── settings/
│   │           └── OpenCodeSettings.kt    # IDE Settings 配置项
│   └── ...
```

两个插件各自独立，共享相同的交互模型和 UI 风格，但代码完全独立（不同语言、不同 SDK）。

## 用户交互流程

所有操作通过鼠标点击完成，无需命令面板。

### 入口一览

| 操作 | VS Code | IDEA |
|------|---------|------|
| 启动/切换 OpenCode | 底部状态栏 🐙 图标（左键） | 底部工具栏 🐙 按钮（左键） |
| 停止 OpenCode | 底部状态栏 🐙 图标（右键） | 底部工具栏 🐙 按钮（右键） |
| 会话历史面板 | 底部状态栏 📋 图标（左键） | 底部工具栏 📋 按钮（左键） |
| 发送内容 | 编辑器/文件右键菜单 | 编辑器/文件右键菜单 |

两个独立图标：🐙 = OpenCode 启停，📋 = 会话历史。

### 流程一：普通发送（填入终端，不自动回车）

1. 编辑器中选择代码 或 文件浏览器中选择文件
2. 右键 → 子菜单：
   - "发送选中内容" → 内容填入终端输入行，等待用户编辑后手动回车
   - "发送文件路径" → 文件路径填入终端输入行，等待用户编辑后手动回车
   - ─────────────
   - "单测：写单测" → 预设提示词 + 内容，自动回车发送
   - "优化：优化代码" → 预设提示词 + 内容，自动回车发送

### 流程二：提示词预设（填入终端，自动回车发送）

1. 选中代码 → 右键 → "单测：写单测"
2. 终端出现："为如下代码写单测：\n[选中内容]" 并自动回车
3. 无需用户二次确认

### 流程三：多次追加

1. 选中代码A → 右键 → "发送选中内容" → 终端输入行出现A
2. 选中文件B → 右键 → "发送文件路径" → 终端输入行追加B
3. 用户检查后，手动 Enter 统一发送

### 流程四：会话历史导航

1. 点击底部 📋 图标 → 打开侧边/底部 WebView 面板
2. 锚点时间线列表（每次输入为一个锚点）
3. 鼠标悬停锚点 → 浮动预览输入和输出内容
4. 点击锚点 → 面板内高亮展开对应内容

## 架构

### 三大模块（两个插件均实现）

1. **终端管理** — 创建/切换/销毁 opencode 终端，注入输入
2. **上下文收集** — 右键收集文本/文件路径，填入终端输入行
3. **会话面板** — WebView 展示结构化会话历史，带锚点导航

### VS Code 实现

- 技术：TypeScript + VS Code Extension API，零外部依赖
- 终端：`vscode.window.createTerminal()`，项目根目录为 cwd
- 发送文本：`terminal.sendText(text)` — 填入输入行，不自动回车
- 自动发送：`terminal.sendText(text + "\n")` — 追加换行模拟回车
- 会话面板：`vscode.window.createWebviewPanel()`
- 配置：`vscode.workspace.getConfiguration('opencode')` 读取 settings.json
- 右键菜单：通过 `package.json` 的 `contributes.menus` 注册

### IDEA 实现

- 技术：Kotlin + IntelliJ Platform SDK，Gradle 构建
- 终端：通过 `TerminalToolWindowManager` 创建/管理终端标签页
- 发送文本：写入终端的 TTY/控制台输入流
- 会话面板：`ToolWindow` + JCEF `JBCefBrowser` 实现 WebView
- 配置：`AppSettingsState` / `PropertiesComponent` 管理 IDE 级别配置
- 右键菜单：在 `plugin.xml` 中注册 `<action>`，挂载到 `EditorPopupMenu` 和 `ProjectViewPopupMenu`

### IDEA 终端滚轮问题解决方案

IDEA 终端中鼠标滚轮被拦截用于翻命令历史。解决方案：

- **WebView 面板承担全部历史浏览** — 显示完整输入/输出对话内容，原生支持鼠标滚动
- **终端只做"当前对话窗口"** — 仅展示最新一问一答，无需在终端中浏览历史
- **锚点点击行为** — 在 WebView 面板内高亮展开内容，不操作终端
- **面板自动跟随** — 默认展示最新内容，终端有新输出时自动滚动到底部

| 对比 | VS Code | IDEA |
|------|---------|------|
| 主要浏览方式 | 终端可滚动 | WebView 面板 |
| 锚点点击 | 终端内定位 | 面板内高亮展开 |
| 悬停预览 | 面板浮动卡 | 面板浮动卡 |

### 会话内容采集

通过轮询终端缓冲区获取内容（每 2 秒一次）：
- VS Code：通过 `vscode.window.onDidWriteTerminalData` 事件监听终端输出
- IDEA：从 `TerminalExecutionConsole` 读取内容

输入/输出边界识别：输入文本以回车结束（终端回显），输出为下一个输入行之前的所有内容。

## 配置

提供可视化的设置页面，利用 IDE 原生设置界面。

**VS Code**：
- 设置入口：`Ctrl+,` → 搜索 "OpenCode"
- 通过 `package.json` 的 `contributes.configuration` 声明配置项
- VS Code 自动生成设置 UI（输入框、下拉、数组编辑器等）
- 配置项：
  - `opencode.executablePath`：opencode 可执行文件路径，默认 `"opencode"`
  - `opencode.port`：端口号，默认 0（随机）
  - `opencode.promptPresets`：提示词预设数组，每条含 `label` 和 `prompt`

**IDEA**：
- 设置入口：`File → Settings → Tools → OpenCode`
- 通过 `Configurable` 接口实现自定义设置面板
- 使用 Swing 表单组件（JTextField、JTable 等）
- 支持新建/编辑/删除提示词预设
- 配置项与 VS Code 一致

**默认提示词预设**（首次安装时写入，可编辑/删除）：
- "单测" → "为如下代码写单测：\n"
- "优化" → "优化如下代码：\n"

## 边界情况与约束

1. 端口占用：opencode 默认端口 0（随机），不固定1端口，避免冲突
2. 无网络：插件仅使用本地 opencode CLI，零网络请求，适配内网环境
3. 版本兼容：VS Code >= 1.75，IDEA >= 2023.1
4. 多会话：仅一个 opencode 终端实例，状态栏图标切换焦点
5. 特殊字符：发送前转义 `\n`、`\r`、`$` 等终端特殊字符

## 文档要求

每个插件目录下均需包含：
- `README.md` — 项目说明、安装方式、开发指南
- `USER_GUIDE.md` — 用户操作手册，含截图和完整操作步骤

## 验收标准

1. 右键菜单项在两个编辑器中均正确显示
2. 选中文本/文件路径正确填入终端输入行，不自动回车
3. 提示词预设自动回车发送
4. 会话面板正确展示锚点时间线、悬停预览、点击导航
5. IDEA 终端滚轮问题通过 WebView 面板方案解决
6. 可视化设置页面正常可用（VS Code Settings UI / IDEA Settings → Tools → OpenCode）
7. 配置修改即时生效，无需重新加载
