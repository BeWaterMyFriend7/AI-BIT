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
exports.OpenCodeTerminal = void 0;
const vscode = __importStar(require("vscode"));
const TERMINAL_NAME = 'OpenCode';
class OpenCodeTerminal {
    constructor() {
        this.terminal = null;
    }
    createOrShow(projectPath) {
        if (this.terminal) {
            this.terminal.show();
            return;
        }
        const exePath = vscode.workspace.getConfiguration('opencode').get('executablePath', 'opencode');
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
    sendText(text) {
        if (!this.terminal) {
            vscode.window.showWarningMessage('请先启动 OpenCode 终端');
            return;
        }
        this.terminal.show();
        this.terminal.sendText(text);
    }
    sendTextAutoEnter(text) {
        if (!this.terminal) {
            vscode.window.showWarningMessage('请先启动 OpenCode 终端');
            return;
        }
        this.terminal.show();
        this.terminal.sendText(text);
        this.terminal.sendText('\n');
    }
    exists() {
        return this.terminal !== null;
    }
    dispose() {
        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = null;
        }
    }
}
exports.OpenCodeTerminal = OpenCodeTerminal;
//# sourceMappingURL=terminal.js.map