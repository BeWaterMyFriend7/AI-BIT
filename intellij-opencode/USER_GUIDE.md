# Opencode IDE Assistant 用户手册（IntelliJ IDEA）

## 快速开始

安装插件并重启 IDE 后，确保 `opencode` 命令可在终端执行：

```bash
opencode --version
```

如需自定义路径：`File → Settings → Tools → Opencode → Opencode 路径`

## 1. 右键快速命令

### 选中代码操作

1. 在编辑器中选中一段代码
2. 右键 → 出现 **Opencode** 子菜单：
   - **解释代码**: 向 Opencode 发送 "请解释这段代码的功能和逻辑"
   - **写单测**: 使用配置的 "单测" 提示词
   - **优化代码**: 使用配置的 "优化" 提示词
   - **发送到 Opencode**: 弹出对话框，可自定义问题后发送
   - **添加到上下文**: 暂存当前选中文本

### 文件操作

1. 在 Project 视图中右键文件（支持多选）
2. 选择 **Opencode → 添加到上下文**

## 2. 上下文缓冲

当需要发送多段代码或多个文件时：

1. 逐个选中代码 / 右键文件 → **Opencode → 添加到上下文**
2. 状态栏右下角显示 `Opencode [N]`，点击打开上下文面板
3. 右侧 **Opencode Context** 工具窗口显示已缓冲内容
4. 点击 **清空** 清除所有缓冲
5. 点击 **发送到 Opencode**，输入问题后批量发送

## 3. Opencode 对话模式

插件不直接管理 Opencode 终端，你可以：

1. 打开 IDEA 内置终端 (`Alt+F12`)
2. 执行 `opencode` 启动交互式对话
3. 或通过快速命令在独立终端执行单次 `opencode run`

## 4. Chat Viewer — 会话历史浏览

**Opencode Sessions** 工具窗口（右侧边栏）：

- **锚点时间线**: 自动标注每条对话的关键节点
- **类型过滤**: 需求 / 计划 / 代码 / 错误 / 测试 / 总结
- **搜索**: 输入关键词过滤
- **预览**: 选中锚点后在下方面板查看完整消息内容
- **刷新**: 点击刷新按钮手动更新

## 5. 配置系统提示词

`File → Settings → Tools → Opencode`

格式（每行一个）：
```
单测: 为如下代码写单测
优化: 优化如下代码
审查: Review the following code for bugs
```

系统提示词的名称（冒号前）用于匹配右键菜单中的 "写单测"、"优化代码" 选项。

## 6. 终端滚轮设置（首次启动提示）

首次启动时，如果 IDEA 终端配置为 "滚轮翻动命令历史" 模式，插件会弹出提示。

建议操作：
1. `File → Settings → Tools → Terminal`
2. 取消勾选 **"Use scroll to navigate through command history"**
3. 或在 **Opencode Sessions** 面板中浏览对话历史（不受终端设置影响）

## 注意事项

- 快速命令使用 `opencode run` 模式，在独立终端执行
- 文本内容超过 500KB 时建议使用文件右键 "添加到上下文"
- 内网环境下插件本身无需联网，仅 opencode CLI 需要访问其模型接口
- 插件不更改系统 JAVA_HOME，使用 `org.gradle.java.home` 配置编译时 JDK
