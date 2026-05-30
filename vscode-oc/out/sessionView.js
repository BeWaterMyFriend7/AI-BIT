"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionViewProvider = void 0;
const vscode = __importStar(require("vscode"));
class SessionViewProvider {
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
        this._anchors = [];
        this.maxAnchors = 200;
    }
    resolveWebviewView(webviewView) {
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
                webviewView.webview.postMessage({
                    type: 'highlightAnchor',
                    index: msg.index
                });
            }
        });
    }
    appendAnchor(input, output) {
        const now = new Date();
        const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const summary = input.substring(0, 60).replace(/\n/g, ' ');
        this._anchors.push({ time, summary, input, output });
        if (this._anchors.length > this.maxAnchors) {
            this._anchors.shift();
        }
        this.sendAnchors();
    }
    sendAnchors() {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateAnchors',
                anchors: this._anchors
            });
        }
    }
    getHtml(webview) {
        const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'session.css'));
        const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'session.js'));
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
exports.SessionViewProvider = SessionViewProvider;
SessionViewProvider.viewType = 'opencode.sessionView';
//# sourceMappingURL=sessionView.js.map