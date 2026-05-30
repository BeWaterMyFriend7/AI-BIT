# Opencode IDE 插件设计方案

## Context

开发 IntelliJ IDEA 和 VS Code 插件，将 IDE 与 Opencode CLI 深度融合。核心目标：右键选中内容/文件后一键发送到 Opencode，管理启停、会话和系统提示词。

## Opencode CLI 关键接口

- `opencode run -f <file> "prompt"` — 非交互式单次执行，支持 stdin 管道
- `opencode` — 交互式 TUI，在终端中运行
- `opencode -c` / `opencode -s <session-id>` — 继续会话
- `opencode session list` — 列出所有会话
- `opencode export <sessionId>` — **导出完整 JSON**（messages + metadata，锚点数据源）
- `opencode serve --port N` — HTTP 服务模式（Phase 2 扩展预留）
- 系统提示词：通过 `opencode.json` 的 `instructions` 字段引用 .md 文件

## 总体架构

```
IDE 右键/快捷键
  ├─ 快速模式: opencode run -f <tmpfile> "prompt"      → 终端输出
  └─ 对话模式: opencode (TUI)                            → 终端交互
       │
       └─ opencode session list / export <id> → JSON
              │
              ├─ 会话采集层 → 结构化 Message[]
              ├─ 锚点生成层 → Anchor[] (自动标注)
              ├─ 预览层     → hover tooltip
              └─ 跳转层     → Chat Viewer (独立面板)
```

**两个面板，分工明确：**
- **Opencode Terminal**: 负责实时交互（当前对话）
- **Chat Viewer**: 负责历史浏览、锚点跳转、搜索、预览（只读，从 export JSON 渲染）

---

## 锚点体系（4 层架构）

### Layer 1: 会话采集

数据源优先级：
1. `opencode export <sessionId>` → JSON （最可靠）
2. 本地 session 文件: `~/.local/share/opencode/sessions/` 
3. 终端输出解析 （兜底）

统一消息结构：
```json
{
  "sessionId": "xxx",
  "messageId": "msg_001",
  "role": "user|assistant|tool",
  "timestamp": "2026-05-30T10:00:00",
  "content": "...",
  "summary": "修复 Kafka 消费逻辑",
  "anchors": ["需求", "报错", "测试", "文件修改"]
}
```

### Layer 2: 锚点生成

从消息流中自动识别关键节点，生成锚点：

| 类型 | 说明 | 识别规则 |
|------|------|----------|
| `user_request` | 用户提出新需求 | role=user 且内容包含问句/指令 |
| `plan` | AI 给出计划 | role=assistant 且包含步骤/列表 |
| `code_change` | 修改文件 | role=tool 且涉及 write/edit |
| `error` | 出现错误 | content 包含 error/fail/失败 |
| `test_result` | 测试结果 | tool call 涉及 test/测试 |
| `summary` | 阶段总结 | role=assistant 且长度>阈值 + 总结性语言 |

锚点存储为独立索引，指向原始 messageId。

### Layer 3: 预览

鼠标 hover 锚点时显示：

```
时间: 10:32
类型: 测试失败
摘要: 单测启动失败，原因是端口 8080 被占用
相关文件: xxx_test.go
```

数据由锚点生成层提取，不依赖终端。

### Layer 4: 跳转

点击锚点 → Chat Viewer 定位到对应消息，展示完整的 user/assistant/tool 上下文。终端不受影响。Chat Viewer 是结构化数据渲染，天然支持搜索、过滤、展开/折叠。

---

## 坑点 2 解决：IDEA 终端滚轮问题

**问题**: IntelliJ 终端中鼠标滚轮被劫持为 "命令历史翻页" 而非内容滚动。

**解决方案（双层）**:

1. **插件检测 + 提示**: 首次启动时检测 IntelliJ Terminal 设置，若 `use scroll to navigate through command history` 开启，弹出通知引导用户关闭（Settings → Tools → Terminal → 取消勾选）。VS Code 也有类似选项，同样处理。

2. **Chat Viewer 承担历史浏览**: 即使终端设置未改，用户不在终端里回看历史。终端只做当前交互，所有历史浏览、锚点跳转都在 Chat Viewer 完成。终端滚轮问题不再影响体验。

---

## VS Code 插件

### 目录: `vscode-opencode/`

### 技术栈
- TypeScript, VS Code Extension API
- `child_process.spawn` 调用 opencode CLI
- `vscode.window.createTerminal` 管理终端
- WebviewViewProvider 实现 Chat Viewer 侧栏

### 核心模块

**1. 右键菜单**
- `editor/context`: 选中文本 → "发送到 Opencode" / "解释代码" / "写单测" / "优化代码"
- `explorer/context`: 右键文件 → "发送文件到 Opencode" / "添加文件到上下文"
- 支持多选文件和连续文本选择
- when 条件: `editorHasSelection`, `explorerResourceIsFile`

**2. 上下文缓冲 (Context Buffer)**
- 维护 ContextItem[]，累积用户多次选中的文本/文件
- 命令: "查看上下文" / "清空上下文" / "发送到 Opencode"
- 状态栏显示当前上下文数量

**3. Opencode 生命周期**
- 状态栏图标：显示 running/stopped，
- 点击启动：创建专用终端 `opencode`（TUI 模式）
- `opencode run` one-shot 在独立临时终端执行
- 命令面板：Opencode: 启动 / 停止

**4. 系统提示词配置**
```json
"opencode.systemPrompts": [
  { "name": "单测", "prompt": "为如下代码写单测" },
  { "name": "优化", "prompt": "优化如下代码" }
]
"opencode.defaultModel": "",
"opencode.opencodePath": ""
```

**5. Chat Viewer（锚点面板）**
- WebviewViewProvider 侧栏
- 输入: opencode export JSON → 结构化渲染
- 锚点时间线 + hover 预览 + 点击跳转到对应消息
- 搜索过滤
- 定时刷新（检测活跃 session 变化）

**6. 快速命令流程**
```
选中代码 → 右键 "写单测"
  → 选中文本 → 临时文件
  → 终端: opencode run -f <tmpfile> "为如下代码写单测"
  → 流式输出到终端
```

### 文件结构
```
vscode-opencode/
  package.json
  tsconfig.json
  src/
    extension.ts              # activate/deactivate
    contextBuffer.ts          # 上下文缓冲
    opencodeCli.ts            # spawn/exec 封装 + session export
    terminal.ts               # 终端管理
    sessionReader.ts          # session JSON 解析 + 锚点生成
    chatViewer.ts             # Chat Viewer webview provider
    commands/
      sendToChat.ts           # 发送到对话
      quickActions.ts         # 解释/单测/优化
      contextManage.ts        # 上下文管理
    config.ts                 # 配置读取
    statusBar.ts              # 状态栏
```

---

## IntelliJ IDEA 插件

### 目录: `intellij-opencode/`

### 技术栈
- Kotlin, IntelliJ Platform Plugin SDK
- `ProcessBuilder` 调用 opencode CLI
- `TerminalView` 管理终端（依赖 `org.jetbrains.plugins.terminal`）
- `ToolWindowFactory` + JComponent 实现 Chat Viewer 面板

### 核心模块

**1. 右键菜单 (Actions)**
- `EditorPopupMenu` + `ProjectViewPopupMenu` 注册 Action Group "Opencode"
- 子菜单: 发送到 Opencode / 解释代码 / 写单测 / 优化代码 / 添加文件到上下文
- 多选文件时一次性发送所有文件路径
- `update()` 控制可见性

**2. 上下文缓冲**
- `OpencodeContextService` — ProjectService
- ToolWindow 面板展示上下文列表
- 状态栏 widget 显示数量，点击展开 popup

**3. Opencode 生命周期**
- 状态栏 widget: running/stopped 状态
- 点击启动: `TerminalView.createLocalShellWidget()` + `executeCommand("opencode")`
- `opencode run` 在独立终端标签页执行

**4. 系统提示词配置**
- `OpencodeSettings` — PersistentStateComponent
- `OpencodeSettingsConfigurable` — Settings > Tools > Opencode
- 默认: "单测: 为如下代码写单测", "优化: 优化如下代码"

**5. Chat Viewer（锚点面板）**
- ToolWindow "Opencode Sessions"
- JList/JTree 展示锚点时间线
- hover tooltip 显示预览
- 点击跳转到对应消息（结构化渲染，非终端）
- 搜索框 + 类型过滤

**6. 坑点检测**
- 启动时检测 `TerminalOptionsProvider` 的滚轮设置
- 若命令历史翻页开启 → notification 提示关闭

### 文件结构
```
intellij-opencode/
  build.gradle.kts
  gradle.properties
  src/main/resources/META-INF/
    plugin.xml
  src/main/kotlin/com/opencode/plugin/
    OpencodeSettings.kt
    OpencodeSettingsConfigurable.kt
    OpencodeContextService.kt
    OpencodeCliRunner.kt           # CLI 调用 + session export 解析
    OpencodeSessionParser.kt       # JSON → Message[] + 锚点生成
    OpencodeStatusBarWidget.kt
    OpencodeStatusBarWidgetFactory.kt
    OpencodeToolWindowFactory.kt   # 上下文面板
    OpencodeChatViewerFactory.kt   # Chat Viewer ToolWindow
    OpencodeStartupActivity.kt     # 首次启动检测 (坑点提示)
    actions/
      BaseOpencodeAction.kt
      SendToOpencodeAction.kt
      ExplainCodeAction.kt
      WriteTestAction.kt
      OptimizeCodeAction.kt
      AddFileToContextAction.kt
```

---

## 数据流总结

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│  IDE 右键     │────▶│  Opencode CLI   │────▶│  Terminal    │
│  选中文本/文件 │     │  run / TUI      │     │  实时交互     │
└──────────────┘     └────────┬────────┘     └──────────────┘
                              │
                     opencode export
                              │
                     ┌────────▼────────┐
                     │  Session JSON   │
                     │  (messages[])   │
                     └────────┬────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
     ┌────────▼──┐   ┌───────▼───────┐   ┌───▼──────────┐
     │ 锚点生成   │   │ 消息格式化    │   │ 全文搜索索引  │
     │ (6种类型)  │   │ (role/render)│   │              │
     └────────┬──┘   └───────┬───────┘   └──────┬───────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
                     ┌────────▼────────┐
                     │  Chat Viewer    │
                     │  锚点时间线     │
                     │  hover 预览     │
                     │  点击跳转       │
                     │  搜索过滤       │
                     └─────────────────┘
```

---

## 实现顺序

### Phase 1: VS Code 基础（1-2 天）
1. 项目脚手架 + package.json
2. 右键菜单 + 快速命令（选中文本 → opencode run）
3. 终端管理（启动/停止 opencode TUI）
4. 系统提示词配置

### Phase 2: VS Code 进阶（1-2 天）
5. 上下文缓冲（多次选择累积）
6. session export 解析 + 锚点生成引擎
7. Chat Viewer webview（锚点时间线 + 预览 + 跳转）
8. 状态栏集成

### Phase 3: IntelliJ 基础（2-3 天）
9. Gradle 项目初始化 + plugin.xml
10. 右键菜单 Actions
11. 终端管理 + 坑点检测提示
12. 配置页面

### Phase 4: IntelliJ 进阶（2-3 天）
13. 上下文缓冲服务 + ToolWindow
14. session export 解析 + 锚点生成引擎
15. Chat Viewer ToolWindow
16. 状态栏 widget

### Phase 5: 联调验证（1 天）
17. 两端功能对齐测试 + 内网环境验证

---

## 验证方法

### VS Code
```bash
cd vscode-opencode && npm install
# F5 → Extension Development Host
# 测试: 右键选中代码 → "写单测" → 终端有 opencode run 执行
# 测试: 启动 opencode TUI → Chat Viewer 显示锚点
```

### IntelliJ
```bash
cd intellij-opencode && ./gradlew runIde
# 沙盒 IDE 中: 右键 → Opencode 子菜单 → 选择操作
# 测试: Chat Viewer ToolWindow 展示会话锚点
```

### 通用检查点
- [ ] opencode 未安装时有友好提示
- [ ] 右键菜单在正确的上下文出现/隐藏
- [ ] 多选文件和连续选择文本正确累积
- [ ] opencode 终端正常启动/停止
- [ ] 系统提示词正确传递到 opencode
- [ ] IDEA 终端滚轮设置检测 + 提示
- [ ] `opencode export` JSON 正确解析
- [ ] 锚点自动标注准确（6 种类型）
- [ ] Chat Viewer hover 预览 + 点击跳转正常
- [ ] Chat Viewer 搜索过滤功能正常
