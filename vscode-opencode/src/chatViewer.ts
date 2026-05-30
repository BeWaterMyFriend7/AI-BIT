import * as vscode from 'vscode';
import { exportOpencodeSession, getOpencodeSessions } from './opencodeCli';

export class ChatViewerProvider implements vscode.WebviewViewProvider {
    static readonly viewType = 'opencode.chatViewer';
    private _view?: vscode.WebviewView;
    private _loading = false;

    constructor(private readonly _extUri: vscode.Uri) {}

    resolveWebviewView(wv: vscode.WebviewView, _ctx: vscode.WebviewViewResolveContext, _t: vscode.CancellationToken) {
        this._view = wv;
        wv.webview.options = { enableScripts: true, localResourceRoots: [this._extUri] };
        wv.webview.html = getHtml();
        wv.webview.onDidReceiveMessage(m => this._handle(m));

        // Load latest session on show
        wv.onDidChangeVisibility(() => { if (wv.visible) this._loadLatest(); });
        this._loadLatest();
    }

    private async _loadLatest() {
        if (this._loading) return;
        this._loading = true;
        this._view?.webview.postMessage({ command: 'status', text: '加载中...' });

        try {
            const ids = await getOpencodeSessions();
            if (ids.length === 0) {
                this._view?.webview.postMessage({
                    command: 'empty',
                    text: '暂无 Opencode 会话\n点击状态栏 "Opencode: 启动" 开始'
                });
                this._loading = false;
                return;
            }
            // Only the latest session
            const sessionId = ids[ids.length - 1];
            const raw = await exportOpencodeSession(sessionId);
            if (!raw) {
                this._view?.webview.postMessage({ command: 'empty', text: '暂无会话数据' });
                this._loading = false;
                return;
            }

            const msgs = (raw.messages || []).map((m: any) => {
                const info = m.info || {};
                const parts = m.parts || [];
                const textParts = parts.filter((p: any) => p.type === 'text' && p.text).map((p: any) => p.text);
                return {
                    role: info.role || 'unknown',
                    time: info.time?.created ? new Date(info.time.created).toLocaleString('zh-CN') : '',
                    content: textParts.join('\n') || '(空)',
                    summary: textParts.join(' ').substring(0, 80)
                };
            }).filter((m: any) => m.content.length > 0);

            this._view?.webview.postMessage({
                command: 'show',
                sessionId: raw.info?.id || sessionId,
                sessionTitle: raw.info?.title || sessionId,
                messages: msgs
            });
        } catch {
            this._view?.webview.postMessage({ command: 'empty', text: '加载失败' });
        }
        this._loading = false;
    }

    private _handle(msg: any) {
        if (msg.command === 'refresh') this._loadLatest();
    }
}

function getHtml(): string {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-sideBar-background);padding:8px}
h3{font-size:12px;margin-bottom:6px;color:var(--vscode-sideBarTitle-foreground)}
.empty{text-align:center;padding:24px 8px;color:var(--vscode-descriptionForeground);font-size:12px;white-space:pre-line}
.msg{margin-bottom:8px;font-size:12px;line-height:1.5}
.msg .meta{font-size:10px;color:var(--vscode-descriptionForeground);margin-bottom:1px}
.msg .bubble{padding:6px 8px;border-radius:6px;max-width:100%;word-break:break-word;white-space:pre-wrap}
.msg.user .bubble{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.msg.assistant .bubble{background:var(--vscode-textBlockQuote-background);color:var(--vscode-textBlockQuote-foreground)}
.msg.tool .bubble{background:var(--vscode-editorWidget-background);font-size:11px;opacity:0.8}
.toolbar{display:flex;gap:4px;margin-bottom:8px}
.toolbar button{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:none;padding:4px 8px;border-radius:3px;cursor:pointer;font-size:11px}
.toolbar button:hover{background:var(--vscode-button-secondaryHoverBackground)}
</style></head><body>
<div class="toolbar"><button onclick="vscode.postMessage({command:'refresh'})">刷新</button></div>
<div id="content"><div class="empty">加载中...</div></div>
<script>
var vscode = acquireVsCodeApi();
window.addEventListener('message', function(event){
  var m=event.data,el=document.getElementById('content');
  if(m.command==='status'){el.innerHTML='<div class="empty">'+esc(m.text)+'</div>';}
  else if(m.command==='empty'){el.innerHTML='<div class="empty">'+esc(m.text)+'</div>';}
  else if(m.command==='show'){
    var h='<h3 title="'+esc(m.sessionTitle)+'">'+esc((m.sessionTitle||'').substring(0,40))+'</h3>';
    h+='<div style="font-size:10px;color:var(--vscode-descriptionForeground);margin-bottom:8px">'+esc(m.sessionId)+'</div>';
    m.messages.forEach(function(msg){
      h+='<div class="msg '+msg.role+'"><div class="meta">'+msg.role.toUpperCase()+' · '+esc(msg.time)+'</div><div class="bubble">'+esc(msg.content)+'</div></div>';
    });
    el.innerHTML=h;
  }
});
function esc(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
</script></body></html>`;
}
