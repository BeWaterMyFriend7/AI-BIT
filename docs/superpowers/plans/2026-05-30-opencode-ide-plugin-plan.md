# opencode IDE Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build VS Code and IDEA plugins that integrate OpenCode CLI into IDE, enabling right-click send of selected text/files to terminal, prompt presets with auto-send, and session history with anchor navigation.

**Architecture:** Terminal-driven: opencode runs in IDE built-in terminal, plugin injects text via terminal API. WebView side panel provides session history with anchor navigation. Both plugins share identical interaction model but are independently implemented (TypeScript for VS Code, Kotlin for IDEA).

**Tech Stack:** VS Code Extension API (TypeScript, zero deps) | IntelliJ Platform SDK (Kotlin, Gradle, JCEF WebView)

**Spec:** `docs/superpowers/specs/2026-05-30-opencode-ide-plugin-design.md`

---

## Part A: VS Code Plugin (vscode-oc)

### File Map

| File | Responsibility |
|------|---------------|
| `vscode-oc/package.json` | Extension manifest: activation, commands, menus, configuration, keybindings |
| `vscode-oc/tsconfig.json` | TypeScript compile config |
| `vscode-oc/src/extension.ts` | Entry: activate/deactivate, register all commands and status bar |
| `vscode-oc/src/terminal.ts` | OpenCode terminal lifecycle: create, send, dispose |
| `vscode-oc/src/commands.ts` | Right-click command handlers for sending text/paths/presets |
| `vscode-oc/src/promptPresets.ts` | Read preset list from VS Code settings |
| `vscode-oc/src/sessionView.ts` | WebView panel provider: session history with anchors |
| `vscode-oc/media/session.html` | WebView HTML shell |
| `vscode-oc/media/session.css` | WebView styles (minimal, match VS Code theme) |
| `vscode-oc/media/session.js` | WebView JS: anchor rendering, hover preview, click navigation, polling |
| `vscode-oc/README.md` | Project description, install, dev guide |
| `vscode-oc/USER_GUIDE.md` | User manual with screenshots and operation steps |

---

### Task A1: Scaffold Extension

**Files:**
- Create: `vscode-oc/package.json`
- Create: `vscode-oc/tsconfig.json`
- Create: `vscode-oc/src/extension.ts`

- [ ] **Step 1: Create package.json**

In `vscode-oc/package.json`:
```json
{
  "name": "vscode-oc",
  "displayName": "OpenCode",
  "description": "Integrate OpenCode CLI into VS Code",
  "version": "0.1.0",
  "publisher": "local",
  "engines": { "vscode": "^1.75.0" },
  "categories": ["Other"],
  "activationEvents": ["onStartupFinished"],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      { "command": "opencode.sendSelectedText", "title": "发送选中内容" },
      { "command": "opencode.sendFilePath", "title": "发送文件路径" },
      { "command": "opencode.sendPresetUnitTest", "title": "单测：写单测" },
      { "command": "opencode.sendPresetOptimize", "title": "优化：优化代码" },
      { "command": "opencode.start", "title": "启动 OpenCode" },
      { "command": "opencode.stop", "title": "停止 OpenCode" },
      { "command": "opencode.showSession", "title": "打开会话历史" }
    ],
    "menus": {
      "editor/context": [
        { "command": "opencode.sendSelectedText", "when": "editorHasSelection", "group": "opencode@1" },
        { "command": "opencode.sendPresetUnitTest", "when": "editorHasSelection", "group": "opencode@3" },
        { "command": "opencode.sendPresetOptimize", "when": "editorHasSelection", "group": "opencode@4" }
      ],
      "explorer/context": [
        { "command": "opencode.sendFilePath", "group": "opencode@1" },
        { "command": "opencode.sendPresetUnitTest", "group": "opencode@3" },
        { "command": "opencode.sendPresetOptimize", "group": "opencode@4" }
      ]
    },
    "configuration": {
      "title": "OpenCode",
      "properties": {
        "opencode.executablePath": {
          "type": "string",
          "default": "opencode",
          "description": "opencode 可执行文件路径"
        },
        "opencode.port": {
          "type": "number",
          "default": 0,
          "description": "端口号，0 为随机"
        },
        "opencode.promptPresets": {
          "type": "array",
          "default": [
            { "label": "单测", "prompt": "为如下代码写单测：\n" },
            { "label": "优化", "prompt": "优化如下代码：\n" }
          ],
          "description": "提示词预设列表",
          "items": {
            "type": "object",
            "properties": {
              "label": { "type": "string" },
              "prompt": { "type": "string" }
            }
          }
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "tsc -p ./",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./"
  },
  "devDependencies": {
    "@types/vscode": "^1.75.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

In `vscode-oc/tsconfig.json`:
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create minimal extension.ts entry**

In `vscode-oc/src/extension.ts`:
```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('OpenCode plugin activated');
}

export function deactivate() {}
```

- [ ] **Step 4: Install dependencies and compile**

```bash
cd vscode-oc; npm install; npx tsc -p ./
```

- [ ] **Step 5: Verify extension loads**

Press F5 in VS Code (or run Extension Development Host). Check: "OpenCode plugin activated" appears.

- [ ] **Step 6: Commit**

```bash
git add vscode-oc/package.json vscode-oc/tsconfig.json vscode-oc/src/extension.ts vscode-oc/out/
git commit -m "feat(vscode-oc): scaffold extension with manifest and entry point"
```

---

### Task A2: Terminal Management

**Files:**
- Create: `vscode-oc/src/terminal.ts`
- Modify: `vscode-oc/src/extension.ts`

- [ ] **Step 1: Create terminal.ts**

In `vscode-oc/src/terminal.ts`:
```typescript
import * as vscode from 'vscode';

const TERMINAL_NAME = 'OpenCode';

export class OpenCodeTerminal {
    private terminal: vscode.Terminal | null = null;

    createOrShow(projectPath: string): void {
        if (this.terminal) {
            this.terminal.show();
            return;
        }
        const exePath = vscode.workspace.getConfiguration('opencode').get<string>('executablePath', 'opencode');
        this.terminal = vscode.window.createTerminal({
            name: TERMINAL_NAME,
            cwd: projectPath,
            shellPath: exePath
        });
        this.terminal.show();

        vscode.window.onDidCloseTerminal((t) => {
            if (t === this.terminal) {
                this.terminal = null;
            }
        });
    }

    sendText(text: string): void {
        if (!this.terminal) {
            vscode.window.showWarningMessage('请先启动 OpenCode 终端');
            return;
        }
        this.terminal.show();
        this.terminal.sendText(text);
    }

    sendTextAutoEnter(text: string): void {
        if (!this.terminal) {
            vscode.window.showWarningMessage('请先启动 OpenCode 终端');
            return;
        }
        this.terminal.show();
        this.terminal.sendText(text);
        this.terminal.sendText('\n');
    }

    exists(): boolean {
        return this.terminal !== null;
    }

    dispose(): void {
        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = null;
        }
    }
}
```

- [ ] **Step 2: Wire into extension.ts**

Modify `vscode-oc/src/extension.ts`:
```typescript
import * as vscode from 'vscode';
import { OpenCodeTerminal } from './terminal';

export function activate(context: vscode.ExtensionContext) {
    const terminal = new OpenCodeTerminal();

    const startCmd = vscode.commands.registerCommand('opencode.start', () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showWarningMessage('请先打开一个工作区');
            return;
        }
        terminal.createOrShow(workspaceFolders[0].uri.fsPath);
    });

    const stopCmd = vscode.commands.registerCommand('opencode.stop', () => {
        terminal.dispose();
    });

    context.subscriptions.push(startCmd, stopCmd);

    // Status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'opencode.start';
    statusBarItem.text = '$(terminal) OpenCode';
    statusBarItem.tooltip = '点击启动 OpenCode 终端';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
}

export function deactivate() {}
```

- [ ] **Step 3: Compile and verify**

```bash
cd vscode-oc; npx tsc -p ./
```

Press F5, click status bar icon, verify terminal opens with opencode running.

- [ ] **Step 4: Commit**

```bash
git add vscode-oc/src/terminal.ts vscode-oc/src/extension.ts vscode-oc/out/
git commit -m "feat(vscode-oc): terminal management with status bar icon"
```

---

### Task A3: Right-Click Command Handlers

**Files:**
- Create: `vscode-oc/src/commands.ts`
- Modify: `vscode-oc/src/extension.ts`

- [ ] **Step 1: Create commands.ts**

In `vscode-oc/src/commands.ts`:
```typescript
import * as vscode from 'vscode';
import { OpenCodeTerminal } from './terminal';

export function registerCommands(
    context: vscode.ExtensionContext,
    terminal: OpenCodeTerminal
): void {

    const sendSelectedText = vscode.commands.registerCommand('opencode.sendSelectedText', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }
        const selection = editor.selection;
        if (selection.isEmpty) { return; }
        const text = editor.document.getText(selection);
        const filePath = editor.document.uri.fsPath;
        const content = `${text}`;
        terminal.sendText(content);
    });

    const sendFilePath = vscode.commands.registerCommand('opencode.sendFilePath', (_uri?: vscode.Uri, uris?: vscode.Uri[]) => {
        const paths = uris && uris.length > 0
            ? uris.map(u => u.fsPath)
            : _uri ? [_uri.fsPath] : [];
        if (paths.length === 0) { return; }
        const content = paths.join('\n');
        terminal.sendText(content);
    });

    const sendPreset = (presetLabel: string) => {
        const presets: Array<{ label: string; prompt: string }> =
            vscode.workspace.getConfiguration('opencode').get('promptPresets', []);
        const preset = presets.find(p => p.label === presetLabel);
        if (!preset) { return; }

        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }
        const selection = editor.selection;
        if (selection.isEmpty) { return; }
        const text = editor.document.getText(selection);
        const content = `${preset.prompt}${text}`;
        terminal.sendTextAutoEnter(content);
    };

    const sendPresetUnitTest = vscode.commands.registerCommand('opencode.sendPresetUnitTest', () => {
        sendPreset('单测');
    });

    const sendPresetOptimize = vscode.commands.registerCommand('opencode.sendPresetOptimize', () => {
        sendPreset('优化');
    });

    context.subscriptions.push(sendSelectedText, sendFilePath, sendPresetUnitTest, sendPresetOptimize);
}
```

- [ ] **Step 2: Wire commands into extension.ts**

Modify `vscode-oc/src/extension.ts` activate function — add after status bar code:
```typescript
import { registerCommands } from './commands';

// Inside activate(), after terminal creation:
    registerCommands(context, terminal);
```

- [ ] **Step 3: Compile and verify**

```bash
cd vscode-oc; npx tsc -p ./
```

Press F5, open a file, select text, right-click → "发送选中内容" → verify text appears in terminal without auto-enter.
Select text, right-click → "单测：写单测" → verify auto-sends.

- [ ] **Step 4: Commit**

```bash
git add vscode-oc/src/commands.ts vscode-oc/src/extension.ts vscode-oc/out/
git commit -m "feat(vscode-oc): right-click command handlers for send and presets"
```

---

### Task A4: Session History WebView Panel

**Files:**
- Create: `vscode-oc/src/sessionView.ts`
- Create: `vscode-oc/media/session.html`
- Create: `vscode-oc/media/session.css`
- Create: `vscode-oc/media/session.js`
- Modify: `vscode-oc/src/extension.ts`

- [ ] **Step 1: Create session.html**

In `vscode-oc/media/session.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="session.css">
</head>
<body>
  <div id="header">
    <span id="title">会话历史</span>
    <button id="refreshBtn">刷新</button>
  </div>
  <div id="anchorList"></div>
  <div id="preview" class="hidden"></div>
  <script src="session.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create session.css**

In `vscode-oc/media/session.css`:
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--vscode-editor-font-size, 13px);
  color: var(--vscode-editor-foreground);
  background: var(--vscode-editor-background);
  padding: 8px;
}
#header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--vscode-widget-border);
}
#title { font-weight: bold; font-size: 14px; }
#refreshBtn {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  padding: 2px 8px;
  cursor: pointer;
  border-radius: 2px;
}
#anchorList { display: flex; flex-direction: column; gap: 4px; }
.anchor-item {
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 4px;
  border: 1px solid transparent;
}
.anchor-item:hover {
  background: var(--vscode-list-hoverBackground);
  border-color: var(--vscode-widget-border);
}
.anchor-item.active {
  background: var(--vscode-list-activeSelectionBackground);
  color: var(--vscode-list-activeSelectionForeground);
}
.anchor-time {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}
.anchor-summary {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}
#preview {
  position: fixed;
  max-width: 400px;
  max-height: 300px;
  overflow-y: auto;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-widget-border);
  border-radius: 4px;
  padding: 8px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  z-index: 100;
}
#preview .section-label {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  text-transform: uppercase;
  margin-bottom: 2px;
}
#preview .divider {
  border: none;
  border-top: 1px solid var(--vscode-widget-border);
  margin: 6px 0;
}
.hidden { display: none; }
```

- [ ] **Step 3: Create session.js**

In `vscode-oc/media/session.js`:
```javascript
(function () {
    const vscode = acquireVsCodeApi();
    const anchorList = document.getElementById('anchorList');
    const preview = document.getElementById('preview');
    const refreshBtn = document.getElementById('refreshBtn');

    let anchors = [];

    function renderAnchors() {
        anchorList.innerHTML = '';
        anchors.forEach((a, i) => {
            const item = document.createElement('div');
            item.className = 'anchor-item';
            item.dataset.index = i;

            const time = document.createElement('div');
            time.className = 'anchor-time';
            time.textContent = a.time;

            const summary = document.createElement('div');
            summary.className = 'anchor-summary';
            summary.textContent = a.summary;

            item.appendChild(time);
            item.appendChild(summary);

            item.addEventListener('click', () => {
                document.querySelectorAll('.anchor-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                vscode.postMessage({ type: 'jumpTo', index: i });
            });

            item.addEventListener('mouseenter', (e) => {
                preview.innerHTML =
                    '<div class="section-label">输入</div>' + escapeHtml(a.input) +
                    '<hr class="divider">' +
                    '<div class="section-label">输出</div>' + escapeHtml(a.output);
                preview.classList.remove('hidden');
                positionPreview(e);
            });

            item.addEventListener('mouseleave', () => {
                preview.classList.add('hidden');
            });

            anchorList.appendChild(item);
        });
    }

    function positionPreview(e) {
        const rect = e.target.getBoundingClientRect();
        preview.style.left = Math.min(rect.right + 8, window.innerWidth - 410) + 'px';
        preview.style.top = Math.min(rect.top, window.innerHeight - 310) + 'px';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    refreshBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'refresh' });
    });

    window.addEventListener('message', (event) => {
        const msg = event.data;
        if (msg.type === 'updateAnchors') {
            anchors = msg.anchors;
            renderAnchors();
        }
    });
})();
```

- [ ] **Step 4: Create sessionView.ts**

In `vscode-oc/src/sessionView.ts`:
```typescript
import * as vscode from 'vscode';
import * as path from 'path';

interface Anchor {
    time: string;
    summary: string;
    input: string;
    output: string;
}

export class SessionViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'opencode.sessionView';
    private _view?: vscode.WebviewView;
    private _anchors: Anchor[] = [];

    constructor(private readonly extensionUri: vscode.Uri) {}

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.extensionUri, 'media')
            ]
        };

        webviewView.webview.html = this.getHtml(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((msg) => {
            if (msg.type === 'refresh') {
                this.sendAnchors();
            }
            if (msg.type === 'jumpTo') {
                // Highlight anchor in panel
                webviewView.webview.postMessage({
                    type: 'highlightAnchor',
                    index: msg.index
                });
            }
        });
    }

    appendAnchor(input: string, output: string): void {
        const now = new Date();
        const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const summary = input.substring(0, 60).replace(/\n/g, ' ');
        this._anchors.push({ time, summary, input, output });
        this.sendAnchors();
    }

    private sendAnchors(): void {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateAnchors',
                anchors: this._anchors
            });
        }
    }

    private getHtml(webview: vscode.Webview): string {
        const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'session.html');
        const cssUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'session.css')
        );
        const jsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'session.js')
        );

        const htmlBytes = vscode.workspace.fs.readFile(htmlPath);
        // Note: async handling simplified for plan — real impl uses async

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${cssUri}">
</head>
<body>
  <div id="header">
    <span id="title">会话历史</span>
    <button id="refreshBtn">刷新</button>
  </div>
  <div id="anchorList"></div>
  <div id="preview" class="hidden"></div>
  <script src="${jsUri}"></script>
</body>
</html>`;
    }
}
```

- [ ] **Step 5: Wire session view into extension.ts**

In `vscode-oc/src/extension.ts`, add after existing registrations:
```typescript
import { SessionViewProvider } from './sessionView';

// Inside activate():
    const sessionProvider = new SessionViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SessionViewProvider.viewType, sessionProvider)
    );

    const showSessionCmd = vscode.commands.registerCommand('opencode.showSession', () => {
        vscode.commands.executeCommand('workbench.view.extension.opencode-session');
    });
    context.subscriptions.push(showSessionCmd);

    // Session history status bar item
    const sessionStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    sessionStatusBarItem.command = 'opencode.showSession';
    sessionStatusBarItem.text = '$(history) 会话';
    sessionStatusBarItem.tooltip = '打开会话历史';
    sessionStatusBarItem.show();
    context.subscriptions.push(sessionStatusBarItem);
```

Add to `package.json` contributes.viewsContainers and views:
```json
"viewsContainers": {
  "panel": [
    {
      "id": "opencode-session",
      "title": "OpenCode 会话",
      "icon": "$(history)"
    }
  ]
},
"views": {
  "opencode-session": [
    {
      "type": "webview",
      "id": "opencode.sessionView",
      "name": "会话历史"
    }
  ]
}
```

- [ ] **Step 6: Compile and verify**

```bash
cd vscode-oc; npx tsc -p ./
```

Press F5, click 📋 status bar icon → verify session panel opens. Verify refresh button works.

- [ ] **Step 7: Commit**

```bash
git add vscode-oc/src/sessionView.ts vscode-oc/media/ vscode-oc/src/extension.ts vscode-oc/package.json vscode-oc/out/
git commit -m "feat(vscode-oc): session history webview panel"
```

---

### Task A5: README and User Guide

**Files:**
- Create: `vscode-oc/README.md`
- Create: `vscode-oc/USER_GUIDE.md`

- [ ] **Step 1: Create README.md**

In `vscode-oc/README.md`:
```markdown
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
```

- [ ] **Step 2: Create USER_GUIDE.md**

In `vscode-oc/USER_GUIDE.md`:
```markdown
# vscode-oc 用户操作手册

## 快速开始

### 1. 启动 OpenCode

点击底部状态栏 🐙 OpenCode 图标，自动在项目根目录启动 opencode 终端。

### 2. 发送选中内容到 OpenCode

在编辑器中选中代码 → 右键 → "发送选中内容" → 内容出现在终端，手动回车发送。

### 3. 发送文件路径

在文件浏览器中选中文件（可多选） → 右键 → "发送文件路径" → 路径出现在终端，手动回车发送。

### 4. 使用提示词预设

选中代码 → 右键 → "单测：写单测" 或 "优化：优化代码" → 自动拼接预设提示词并回车发送。

### 5. 查看会话历史

点击底部状态栏 📋 图标 → 打开会话历史面板：
- 每个输入为一个锚点，显示时间和摘要
- 鼠标悬停锚点 → 预览输入和输出内容
- 点击锚点 → 高亮定位

### 6. 停止 OpenCode

右键底部 🐙 图标 → 停止 OpenCode。

## 配置

`Ctrl+,` → 搜索 "OpenCode" → 可修改：
- 可执行文件路径
- 端口号
- 自定义提示词预设（新建/编辑/删除）
```

- [ ] **Step 3: Commit**

```bash
git add vscode-oc/README.md vscode-oc/USER_GUIDE.md
git commit -m "docs(vscode-oc): add README and user guide"
```

---

## Part B: IDEA Plugin (idea-oc)

### File Map

| File | Responsibility |
|------|---------------|
| `idea-oc/build.gradle.kts` | Gradle build: dependencies, plugin config |
| `idea-oc/settings.gradle.kts` | Gradle project name |
| `idea-oc/gradle.properties` | Gradle properties |
| `idea-oc/src/main/resources/META-INF/plugin.xml` | Plugin descriptor: actions, extensions, configurable |
| `idea-oc/src/main/kotlin/.../OpenCodePlugin.kt` | Plugin entry, component initialization |
| `idea-oc/src/main/kotlin/.../OpenCodeTerminalRunner.kt` | Terminal lifecycle: create, send text, dispose |
| `idea-oc/src/main/kotlin/.../ContextCollector.kt` | Collect selected text / file paths |
| `idea-oc/src/main/kotlin/.../PromptPresetAction.kt` | Preset action registration and handling |
| `idea-oc/src/main/kotlin/.../SessionToolWindow.kt` | ToolWindow factory: JCEF WebView session panel |
| `idea-oc/src/main/kotlin/.../settings/OpenCodeSettings.kt` | Persistent settings state |
| `idea-oc/src/main/kotlin/.../settings/OpenCodeSettingsConfigurable.kt` | Settings UI panel |
| `idea-oc/src/main/resources/webview/session.html` | WebView HTML for session panel |
| `idea-oc/src/main/resources/webview/session.css` | WebView styles |
| `idea-oc/src/main/resources/webview/session.js` | WebView JS |
| `idea-oc/README.md` | Project description |
| `idea-oc/USER_GUIDE.md` | User manual |

Base package: `com.opencode.idea`

---

### Task B1: Scaffold Gradle Project

**Files:**
- Create: `idea-oc/build.gradle.kts`
- Create: `idea-oc/settings.gradle.kts`
- Create: `idea-oc/gradle.properties`
- Create: `idea-oc/src/main/resources/META-INF/plugin.xml`

- [ ] **Step 1: Create build.gradle.kts**

In `idea-oc/build.gradle.kts`:
```kotlin
plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "1.9.22"
    id("org.jetbrains.intellij") version "1.17.2"
}

group = "com.opencode.idea"
version = "0.1.0"

repositories {
    mavenCentral()
}

intellij {
    version.set("2023.1")
    type.set("IC")
    plugins.set(listOf("terminal"))
}

tasks {
    withType<JavaCompile> {
        sourceCompatibility = "17"
        targetCompatibility = "17"
    }
    withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
        kotlinOptions.jvmTarget = "17"
    }
}
```

- [ ] **Step 2: Create settings.gradle.kts**

In `idea-oc/settings.gradle.kts`:
```kotlin
rootProject.name = "idea-oc"
```

- [ ] **Step 3: Create gradle.properties**

In `idea-oc/gradle.properties`:
```properties
org.gradle.jvmargs=-Xmx2048m
```

- [ ] **Step 4: Create plugin.xml**

In `idea-oc/src/main/resources/META-INF/plugin.xml`:
```xml
<idea-plugin>
    <id>com.opencode.idea</id>
    <name>OpenCode</name>
    <vendor>local</vendor>

    <depends>com.intellij.modules.platform</depends>
    <depends>org.jetbrains.plugins.terminal</depends>

    <extensions defaultExtensionNs="com.intellij">
        <toolWindow
            id="OpenCode Session"
            anchor="bottom"
            icon="AllIcons.Actions.Show"
            factoryClass="com.opencode.idea.SessionToolWindowFactory"/>

        <applicationService
            serviceImplementation="com.opencode.idea.settings.OpenCodeSettings"/>

        <applicationConfigurable
            parentId="tools"
            instance="com.opencode.idea.settings.OpenCodeSettingsConfigurable"
            id="com.opencode.idea.settings"
            displayName="OpenCode"/>
    </extensions>

    <actions>
        <group id="OpenCode.EditorPopup" text="OpenCode"
               popup="true" icon="AllIcons.Actions.Show">
            <add-to-group group-id="EditorPopupMenu" anchor="last"/>
            <action id="opencode.sendSelectedText"
                    class="com.opencode.idea.ContextCollector$SendSelectedTextAction"
                    text="发送选中内容"/>
            <action id="opencode.sendFilePath"
                    class="com.opencode.idea.ContextCollector$SendFilePathAction"
                    text="发送文件路径"/>
            <separator/>
            <action id="opencode.sendPresetUnitTest"
                    class="com.opencode.idea.PromptPresetAction$UnitTestAction"
                    text="单测：写单测"/>
            <action id="opencode.sendPresetOptimize"
                    class="com.opencode.idea.PromptPresetAction$OptimizeAction"
                    text="优化：优化代码"/>
        </group>

        <group id="OpenCode.ProjectViewPopup" text="OpenCode"
               popup="true" icon="AllIcons.Actions.Show">
            <add-to-group group-id="ProjectViewPopupMenu" anchor="last"/>
            <action id="opencode.sendFilePathFromProject"
                    class="com.opencode.idea.ContextCollector$SendFilePathAction"
                    text="发送文件路径"/>
            <reference ref="opencode.sendPresetUnitTest"/>
            <reference ref="opencode.sendPresetOptimize"/>
        </group>
    </actions>
</idea-plugin>
```

- [ ] **Step 5: Verify Gradle build**

```bash
cd idea-oc; ./gradlew build
```

- [ ] **Step 6: Commit**

```bash
git add idea-oc/build.gradle.kts idea-oc/settings.gradle.kts idea-oc/gradle.properties idea-oc/src/main/resources/META-INF/plugin.xml
git commit -m "feat(idea-oc): scaffold gradle project with plugin descriptor"
```

---

### Task B2: Settings and Configurable

**Files:**
- Create: `idea-oc/src/main/kotlin/com/opencode/idea/settings/OpenCodeSettings.kt`
- Create: `idea-oc/src/main/kotlin/com/opencode/idea/settings/OpenCodeSettingsConfigurable.kt`

- [ ] **Step 1: Create OpenCodeSettings.kt**

In `idea-oc/src/main/kotlin/com/opencode/idea/settings/OpenCodeSettings.kt`:
```kotlin
package com.opencode.idea.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.*
import com.intellij.util.xmlb.XmlSerializerUtil

data class PromptPreset(
    var label: String = "",
    var prompt: String = ""
)

@State(
    name = "OpenCodeSettings",
    storages = [Storage("opencode.xml")]
)
@Service(Service.Level.APP)
class OpenCodeSettings : PersistentStateComponent<OpenCodeSettings> {
    var executablePath: String = "opencode"
    var port: Int = 0
    var promptPresets: MutableList<PromptPreset> = mutableListOf(
        PromptPreset("单测", "为如下代码写单测：\n"),
        PromptPreset("优化", "优化如下代码：\n")
    )

    override fun getState(): OpenCodeSettings = this

    override fun loadState(state: OpenCodeSettings) {
        XmlSerializerUtil.copyBean(state, this)
    }

    companion object {
        fun getInstance(): OpenCodeSettings {
            return ApplicationManager.getApplication().getService(OpenCodeSettings::class.java)
        }
    }
}
```

- [ ] **Step 2: Create OpenCodeSettingsConfigurable.kt**

In `idea-oc/src/main/kotlin/com/opencode/idea/settings/OpenCodeSettingsConfigurable.kt`:
```kotlin
package com.opencode.idea.settings

import com.intellij.openapi.options.Configurable
import com.intellij.ui.ToolbarDecorator
import com.intellij.ui.table.JBTable
import javax.swing.JComponent
import javax.swing.JPanel
import javax.swing.JTextField
import javax.swing.table.DefaultTableModel
import java.awt.BorderLayout
import java.awt.GridBagConstraints
import java.awt.GridBagLayout

class OpenCodeSettingsConfigurable : Configurable {
    private var panel: JPanel? = null
    private var executablePathField: JTextField? = null
    private var portField: JTextField? = null
    private var presetTable: JBTable? = null
    private var tableModel: DefaultTableModel? = null

    override fun getDisplayName(): String = "OpenCode"

    override fun createComponent(): JComponent {
        val settings = OpenCodeSettings.getInstance()

        panel = JPanel(GridBagLayout())
        val gbc = GridBagConstraints()
        gbc.fill = GridBagConstraints.HORIZONTAL
        gbc.gridx = 0
        gbc.weightx = 1.0

        // Section 1: Basic settings
        val basicPanel = JPanel(GridBagLayout())
        basicPanel.border = javax.swing.border.TitledBorder("基本设置")

        executablePathField = JTextField(settings.executablePath, 30)

        val bg1 = GridBagConstraints()
        bg1.gridx = 0; bg1.gridy = 0; bg1.anchor = GridBagConstraints.WEST
        basicPanel.add(javax.swing.JLabel("opencode 路径:"), bg1)
        bg1.gridx = 1; bg1.weightx = 1.0; bg1.fill = GridBagConstraints.HORIZONTAL
        basicPanel.add(executablePathField, bg1)

        portField = JTextField(settings.port.toString(), 10)
        bg1.gridx = 0; bg1.gridy = 1; bg1.weightx = 0.0; bg1.fill = GridBagConstraints.NONE
        basicPanel.add(javax.swing.JLabel("端口号:"), bg1)
        bg1.gridx = 1; bg1.weightx = 1.0; bg1.fill = GridBagConstraints.HORIZONTAL
        basicPanel.add(portField, bg1)

        gbc.gridy = 0
        panel!!.add(basicPanel, gbc)

        // Section 2: Prompt presets
        val presetPanel = JPanel(BorderLayout())
        presetPanel.border = javax.swing.border.TitledBorder("提示词预设")

        tableModel = object : DefaultTableModel(arrayOf("名称", "提示词内容"), 0) {
            override fun isCellEditable(row: Int, column: Int): Boolean = true
        }
        for (preset in settings.promptPresets) {
            tableModel!!.addRow(arrayOf(preset.label, preset.prompt))
        }

        presetTable = JBTable(tableModel)
        val decorator = ToolbarDecorator.createDecorator(presetTable)
            .setAddAction { tableModel!!.addRow(arrayOf("", "")) }
        presetPanel.add(decorator.createPanel(), BorderLayout.CENTER)

        gbc.gridy = 1; gbc.fill = GridBagConstraints.BOTH; gbc.weighty = 1.0
        panel!!.add(presetPanel, gbc)

        return panel!!
    }

    override fun isModified(): Boolean {
        val settings = OpenCodeSettings.getInstance()
        if (executablePathField!!.text != settings.executablePath) return true
        if (portField!!.text != settings.port.toString()) return true
        if (tableModel!!.rowCount != settings.promptPresets.size) return true
        for (i in 0 until tableModel!!.rowCount) {
            if (tableModel!!.getValueAt(i, 0) != settings.promptPresets.getOrNull(i)?.label) return true
            if (tableModel!!.getValueAt(i, 1) != settings.promptPresets.getOrNull(i)?.prompt) return true
        }
        return false
    }

    override fun apply() {
        val settings = OpenCodeSettings.getInstance()
        settings.executablePath = executablePathField!!.text
        settings.port = portField!!.text.toIntOrNull() ?: 0

        settings.promptPresets.clear()
        for (i in 0 until tableModel!!.rowCount) {
            val label = tableModel!!.getValueAt(i, 0) as? String ?: ""
            val prompt = tableModel!!.getValueAt(i, 1) as? String ?: ""
            if (label.isNotEmpty() || prompt.isNotEmpty()) {
                settings.promptPresets.add(PromptPreset(label, prompt))
            }
        }
    }

    override fun reset() {
        val settings = OpenCodeSettings.getInstance()
        executablePathField!!.text = settings.executablePath
        portField!!.text = settings.port.toString()

        tableModel!!.rowCount = 0
        for (preset in settings.promptPresets) {
            tableModel!!.addRow(arrayOf(preset.label, preset.prompt))
        }
    }
}
```

- [ ] **Step 3: Verify Gradle build**

```bash
cd idea-oc; ./gradlew build
```

- [ ] **Step 4: Commit**

```bash
git add idea-oc/src/main/kotlin/com/opencode/idea/settings/
git commit -m "feat(idea-oc): settings with configurable UI panel"
```

---

### Task B3: Terminal Management

**Files:**
- Create: `idea-oc/src/main/kotlin/com/opencode/idea/OpenCodeTerminalRunner.kt`
- Create: `idea-oc/src/main/kotlin/com/opencode/idea/OpenCodePlugin.kt`

- [ ] **Step 1: Create OpenCodeTerminalRunner.kt**

In `idea-oc/src/main/kotlin/com/opencode/idea/OpenCodeTerminalRunner.kt`:
```kotlin
package com.opencode.idea

import com.intellij.openapi.project.Project
import com.intellij.terminal.TerminalExecutionConsole
import org.jetbrains.plugins.terminal.AbstractTerminalRunner
import org.jetbrains.plugins.terminal.TerminalToolWindowManager
import java.io.OutputStream

class OpenCodeTerminalRunner(private val project: Project) {

    fun start(): TerminalExecutionConsole? {
        val exePath = settings.OpenCodeSettings.getInstance().executablePath
        val manager = TerminalToolWindowManager.getInstance(project)
        val tabName = "OpenCode"

        val existing = manager.findConsoleByTabName(tabName)
        if (existing != null) {
            manager.show(tabName)
            return existing
        }

        val console = manager.createLocalShellWidget(project, tabName, exePath, false)
        manager.show(tabName)
        return console
    }

    fun sendText(text: String) {
        val manager = TerminalToolWindowManager.getInstance(project)
        val console = manager.findConsoleByTabName("OpenCode") ?: return
        manager.show("OpenCode")

        val outputStream: OutputStream? = console.terminalStarter?.createTerminalStarter()?.let {
            // Write text to terminal input
            // IntelliJ terminal input is handled via TTY connector
            // Simplified: use terminal text insertion
            it.sendCommandToExecute(text)
            null // fall through to alternative
        }
    }

    fun stop() {
        val manager = TerminalToolWindowManager.getInstance(project)
        val console = manager.findConsoleByTabName("OpenCode") ?: return
        manager.closeConsole(console)
    }
}
```

- [ ] **Step 2: Create OpenCodePlugin.kt (entry point)**

In `idea-oc/src/main/kotlin/com/opencode/idea/OpenCodePlugin.kt`:
```kotlin
package com.opencode.idea

import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity

class OpenCodeStartupActivity : ProjectActivity {
    override suspend fun execute(project: Project) {
        // Plugin initialized when project opens
        // Terminal runner created on demand
    }
}
```

- [ ] **Step 3: Update plugin.xml**

Add to `plugin.xml` extensions:
```xml
<projectService serviceImplementation="com.opencode.idea.OpenCodeTerminalRunner"/>
```

Add to `plugin.xml`:
```xml
<projectActivity implementation="com.opencode.idea.OpenCodeStartupActivity"/>
```

Add actions for start/stop:
```xml
<action id="opencode.startTerminal"
        class="com.opencode.idea.OpenCodeTerminalRunner$StartAction"
        text="启动 OpenCode"
        icon="AllIcons.Actions.Execute"/>
<action id="opencode.stopTerminal"
        class="com.opencode.idea.OpenCodeTerminalRunner$StopAction"
        text="停止 OpenCode"/>
```

- [ ] **Step 4: Verify Gradle build**

```bash
cd idea-oc; ./gradlew build
```

- [ ] **Step 5: Commit**

```bash
git add idea-oc/src/main/kotlin/com/opencode/idea/OpenCodeTerminalRunner.kt idea-oc/src/main/kotlin/com/opencode/idea/OpenCodePlugin.kt idea-oc/src/main/resources/META-INF/plugin.xml
git commit -m "feat(idea-oc): terminal management with start/stop"
```

---

### Task B4: Context Collection and Preset Actions

**Files:**
- Create: `idea-oc/src/main/kotlin/com/opencode/idea/ContextCollector.kt`
- Create: `idea-oc/src/main/kotlin/com/opencode/idea/PromptPresetAction.kt`

- [ ] **Step 1: Create ContextCollector.kt**

In `idea-oc/src/main/kotlin/com/opencode/idea/ContextCollector.kt`:
```kotlin
package com.opencode.idea

import com.intellij.openapi.actionSystem.*
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile

class ContextCollector {

    class SendSelectedTextAction : AnAction() {
        override fun actionPerformed(e: AnActionEvent) {
            val project = e.project ?: return
            val editor: Editor = e.getData(CommonDataKeys.EDITOR) ?: return
            val selectionModel = editor.selectionModel
            if (!selectionModel.hasSelection()) return

            val text = selectionModel.selectedText ?: return
            val runner = OpenCodeTerminalRunner(project)
            runner.sendText(text)
        }

        override fun update(e: AnActionEvent) {
            val editor = e.getData(CommonDataKeys.EDITOR)
            e.presentation.isEnabled = editor != null && editor.selectionModel.hasSelection()
        }
    }

    class SendFilePathAction : AnAction() {
        override fun actionPerformed(e: AnActionEvent) {
            val project = e.project ?: return
            val files: Array<VirtualFile> = e.getData(CommonDataKeys.VIRTUAL_FILE_ARRAY) ?: return

            val paths = files.joinToString("\n") { it.path }
            val runner = OpenCodeTerminalRunner(project)
            runner.sendText(paths)
        }
    }
}
```

- [ ] **Step 2: Create PromptPresetAction.kt**

In `idea-oc/src/main/kotlin/com/opencode/idea/PromptPresetAction.kt`:
```kotlin
package com.opencode.idea

import com.intellij.openapi.actionSystem.*
import com.intellij.openapi.editor.Editor
import com.opencode.idea.settings.OpenCodeSettings

class PromptPresetAction {

    class UnitTestAction : AnAction() {
        override fun actionPerformed(e: AnActionEvent) {
            sendPreset(e, "单测")
        }

        override fun update(e: AnActionEvent) {
            val editor = e.getData(CommonDataKeys.EDITOR)
            e.presentation.isEnabled = editor != null && editor.selectionModel.hasSelection()
        }
    }

    class OptimizeAction : AnAction() {
        override fun actionPerformed(e: AnActionEvent) {
            sendPreset(e, "优化")
        }

        override fun update(e: AnActionEvent) {
            val editor = e.getData(CommonDataKeys.EDITOR)
            e.presentation.isEnabled = editor != null && editor.selectionModel.hasSelection()
        }
    }

    companion object {
        private fun sendPreset(e: AnActionEvent, presetLabel: String) {
            val project = e.project ?: return
            val editor: Editor = e.getData(CommonDataKeys.EDITOR) ?: return
            val selectionModel = editor.selectionModel
            if (!selectionModel.hasSelection()) return

            val text = selectionModel.selectedText ?: return
            val settings = OpenCodeSettings.getInstance()
            val preset = settings.promptPresets.find { it.label == presetLabel } ?: return

            val content = preset.prompt + text
            val runner = OpenCodeTerminalRunner(project)
            runner.sendText(content + "\n") // auto-enter
        }
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add idea-oc/src/main/kotlin/com/opencode/idea/ContextCollector.kt idea-oc/src/main/kotlin/com/opencode/idea/PromptPresetAction.kt
git commit -m "feat(idea-oc): context collection and preset actions"
```

---

### Task B5: Session ToolWindow (WebView)

**Files:**
- Create: `idea-oc/src/main/kotlin/com/opencode/idea/SessionToolWindowFactory.kt`
- Create: `idea-oc/src/main/resources/webview/session.html`
- Create: `idea-oc/src/main/resources/webview/session.css`
- Create: `idea-oc/src/main/resources/webview/session.js`

- [ ] **Step 1: Create SessionToolWindowFactory.kt**

In `idea-oc/src/main/kotlin/com/opencode/idea/SessionToolWindowFactory.kt`:
```kotlin
package com.opencode.idea

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.jcef.JBCefBrowser
import java.awt.BorderLayout
import javax.swing.JPanel

class SessionToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = JPanel(BorderLayout())
        val browser = JBCefBrowser()

        val html = javaClass.getResource("/webview/session.html")?.readText() ?: "<html><body>Error</body></html>"
        browser.loadHTML(html)

        panel.add(browser.component, BorderLayout.CENTER)
        toolWindow.component.add(panel)
    }
}
```

- [ ] **Step 2: Create session.html**

In `idea-oc/src/main/resources/webview/session.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  color: #333;
  background: #fff;
  padding: 8px;
}
#header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e0e0e0;
}
#title { font-weight: bold; font-size: 14px; }
#refreshBtn {
  background: #4a90d9;
  color: #fff;
  border: none;
  padding: 4px 12px;
  cursor: pointer;
  border-radius: 3px;
}
#anchorList { display: flex; flex-direction: column; gap: 4px; }
.anchor-item {
  padding: 8px 10px;
  cursor: pointer;
  border-radius: 4px;
  border: 1px solid transparent;
  transition: background 0.15s;
}
.anchor-item:hover { background: #f5f5f5; border-color: #e0e0e0; }
.anchor-item.active { background: #e8f0fe; border-color: #4a90d9; }
.anchor-time { font-size: 11px; color: #999; }
.anchor-summary {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}
#preview {
  position: fixed;
  max-width: 400px;
  max-height: 300px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 10px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 100;
}
.hidden { display: none; }
.section-label { font-size: 10px; color: #999; margin-bottom: 4px; }
.divider { border: none; border-top: 1px solid #e0e0e0; margin: 8px 0; }
</style>
</head>
<body>
  <div id="header">
    <span id="title">会话历史</span>
    <button id="refreshBtn">刷新</button>
  </div>
  <div id="anchorList"></div>
  <div id="preview" class="hidden"></div>
  <script>
    const anchorList = document.getElementById('anchorList');
    const preview = document.getElementById('preview');
    let anchors = [];

    function render() {
      anchorList.innerHTML = '';
      anchors.forEach((a, i) => {
        const item = document.createElement('div');
        item.className = 'anchor-item';
        item.dataset.index = i;
        item.innerHTML = '<div class="anchor-time">' + a.time + '</div>' +
          '<div class="anchor-summary">' + a.summary + '</div>';
        item.addEventListener('click', function() {
          document.querySelectorAll('.anchor-item').forEach(el => el.classList.remove('active'));
          item.classList.add('active');
        });
        item.addEventListener('mouseenter', function(e) {
          preview.innerHTML = '<div class="section-label">Input</div>' + escapeHtml(a.input) +
            '<hr class="divider"><div class="section-label">Output</div>' + escapeHtml(a.output);
          preview.classList.remove('hidden');
          var rect = e.target.getBoundingClientRect();
          preview.style.left = Math.min(rect.right + 8, window.innerWidth - 410) + 'px';
          preview.style.top = Math.min(rect.top, window.innerHeight - 310) + 'px';
        });
        item.addEventListener('mouseleave', function() { preview.classList.add('hidden'); });
        anchorList.appendChild(item);
      });
    }

    function escapeHtml(text) {
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    document.getElementById('refreshBtn').addEventListener('click', function() {
      // Trigger refresh via JBCefJSQuery or poll
    });

    // Demo data for initial render
    anchors = [
      { time: '14:30', summary: 'Write unit test for getUserById', input: 'Write unit test...', output: 'Sure, here is...' }
    ];
    render();
  </script>
</body>
</html>
```

- [ ] **Step 3: Compile and verify**

```bash
cd idea-oc; ./gradlew build
```

Launch IDEA with plugin, verify ToolWindow appears and shows demo anchor.

- [ ] **Step 4: Commit**

```bash
git add idea-oc/src/main/kotlin/com/opencode/idea/SessionToolWindowFactory.kt idea-oc/src/main/resources/webview/
git commit -m "feat(idea-oc): session history tool window with webview"
```

---

### Task B6: README and User Guide

**Files:**
- Create: `idea-oc/README.md`
- Create: `idea-oc/USER_GUIDE.md`

- [ ] **Step 1: Create README.md**

In `idea-oc/README.md`:
```markdown
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
```

- [ ] **Step 2: Create USER_GUIDE.md**

In `idea-oc/USER_GUIDE.md`:
```markdown
# idea-oc 用户操作手册

## 快速开始

### 1. 启动 OpenCode

点击底部工具栏 OpenCode 按钮，自动在项目根目录创建 opencode 终端标签页。

### 2. 发送选中内容到 OpenCode

在编辑器中选中代码 → 右键 → OpenCode → "发送选中内容" → 内容出现在终端输入行，手动回车发送。

### 3. 发送文件路径

在项目视图中选中文件（可多选） → 右键 → OpenCode → "发送文件路径" → 路径出现在终端，手动回车发送。

### 4. 使用提示词预设

选中代码 → 右键 → OpenCode → "单测：写单测" 或 "优化：优化代码" → 自动拼接预设提示词并回车发送。

### 5. 查看会话历史

点击底部 📋 图标 → 打开 OpenCode Session 面板：
- 每个输入为一个锚点，显示时间和摘要
- 鼠标悬停锚点 → 浮动预览输入和输出内容（解决 IDEA 终端滚轮问题）
- 点击锚点 → 高亮定位

### 6. 停止 OpenCode

关闭终端标签页即可。

## 配置

`File → Settings → Tools → OpenCode`：
- **基本设置**：可执行文件路径、端口号
- **提示词预设**：表格编辑，新建/编辑/删除自定义预设
```

- [ ] **Step 3: Commit**

```bash
git add idea-oc/README.md idea-oc/USER_GUIDE.md
git commit -m "docs(idea-oc): add README and user guide"
```

---

## Implementation Order

Recommended sequence:
1. **VS Code first** (A1→A2→A3→A4→A5): faster iteration, no Gradle overhead
2. **IDEA second** (B1→B2→B3→B4→B5→B6)

Total: ~12 tasks, each 5-15 min.

## Verification Checklist

After all tasks complete, verify:

- [ ] VS Code: status bar 🐙 icon creates OpenCode terminal
- [ ] VS Code: right-click "发送选中内容" fills terminal without auto-enter
- [ ] VS Code: right-click "发送文件路径" works with multi-select
- [ ] VS Code: right-click "单测：写单测" auto-sends with prompt prefix
- [ ] VS Code: 📋 icon opens session panel with anchors
- [ ] VS Code: hover preview and click navigation work in panel
- [ ] VS Code: settings UI (Ctrl+,) shows OpenCode config
- [ ] IDEA: toolbar button creates OpenCode terminal
- [ ] IDEA: right-click context menu items work
- [ ] IDEA: preset auto-send works
- [ ] IDEA: session panel opens with WebView, hover/click works
- [ ] IDEA: Settings → Tools → OpenCode opens config page
- [ ] IDEA: preset table editor works (add/edit/delete)

---

## Notes

- IDEA terminal sendText: The exact API for writing to IntelliJ terminal input varies by version. The plan uses a simplified approach; during implementation, adapt to `com.intellij.terminal.JBTerminalSystemSettingsProviderBase` or `org.jetbrains.plugins.terminal.ShellTerminalWidget` APIs based on the actual IntelliJ version.
- Session content capture (polling terminal output every 2s): implementation deferred to a refinement pass after core flow works. Initial version shows demo anchors; actual capture is added after verifying terminal API access.
- Port 0 (random) in opencode: the `--port` flag is passed but not critical for TUI mode.
