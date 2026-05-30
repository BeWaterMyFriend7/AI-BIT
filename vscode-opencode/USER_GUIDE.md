# Opencode IDE Assistant 用户手册（VS Code）

## 快速开始

安装插件后，确保 `opencode` 命令可在终端执行：

```bash
opencode --version
# 应输出版本号
```

## 1. 右键快速命令

### 选中代码操作

1. 在编辑器中选中一段代码
2. 右键 → 出现 **Opencode** 子菜单：
   - **解释代码**: 向 Opencode 发送 "请解释这段代码的功能和逻辑"
   - **写单测**: 使用配置的 "单测" 提示词发送
   - **优化代码**: 使用配置的 "优化" 提示词发送
   - **发送到 Opencode**: 弹出输入框，可自定义问题
   - **添加到上下文**: 暂存当前选中文本，等待批量发送

### 文件操作

1. 在文件资源管理器中右键文件
2. 选择 **添加文件到 Opencode 上下文**

## 2. 上下文缓冲

当需要发送多段代码或多个文件时，使用上下文缓冲：

1. 逐个选中代码 / 右键文件 → **添加到上下文**
2. 状态栏右下角显示 `Opencode [N]` 表示已缓冲 N 项
3. 点击状态栏 → 打开上下文面板查看已缓冲内容
4. 在上下文面板中点击 **发送到 Opencode** 批量发送
5. 或通过命令面板 (`Ctrl+Shift+P`) 执行：
   - `Opencode: 查看上下文`
   - `Opencode: 清空上下文`
   - `Opencode: 发送上下文到 Opencode`

## 3. Opencode 对话模式

- 点击状态栏 **Opencode** 图标，或执行 `Opencode: 启动对话`
- VS Code 终端中将启动 Opencode TUI 交互界面
- 在此终端中正常与 Opencode 进行多轮对话
- 执行 `Opencode: 停止对话` 关闭终端

## 4. Chat Viewer — 会话历史浏览

Chat Viewer 面板位于侧边栏（点击 `Opencode Sessions` 图标）：

- **锚点时间线**: 自动标注每条对话的关键节点（需求 / 计划 / 代码修改 / 错误 / 测试 / 总结）
- **过滤**: 按类型过滤（需求、计划、代码、错误、测试、总结）
- **搜索**: 搜索会话和锚点内容
- **预览**: 鼠标悬停锚点显示时间、类型、摘要、相关文件
- **跳转**: 点击锚点查看该轮完整对话内容
- **刷新**: 每 30 秒自动刷新，或点击刷新按钮

## 5. 配置系统提示词

`File → Preferences → Settings → Extensions → Opencode`

系统提示词格式（`name: prompt`）：
```
单测: 为如下代码写单测
优化: 优化如下代码
审查: Review the following code for bugs
```

提示词修改后右键菜单的 "写单测"、"优化代码" 会立即生效。

## 6. 快捷键

| 操作 | 快捷键（默认） |
|------|---------------|
| 启动 Opencode | `Ctrl+Shift+P` → `Opencode: 启动对话` |
| 查看上下文 | `Ctrl+Shift+P` → `Opencode: 查看上下文` |
| 清空上下文 | `Ctrl+Shift+P` → `Opencode: 清空上下文` |

> 可在 `File → Preferences → Keyboard Shortcuts` 中为任意 Opencode 命令绑定自定义快捷键。

## 注意事项

- 快速命令（解释/单测/优化）使用 `opencode run` 模式，在独立终端执行，不影响正在进行的 TUI 对话
- 文本内容超过 500KB 时建议使用文件右键 "添加文件到上下文" 而非选中文本方式
- 内网环境下插件本身无需联网，仅 opencode CLI 需要访问其模型接口
