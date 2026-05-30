import * as vscode from 'vscode';

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
        const cssUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'session.css')
        );
        const jsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'session.js')
        );

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
