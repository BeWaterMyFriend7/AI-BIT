import * as vscode from 'vscode';

const TERMINAL_NAME = 'OpenCode';

export class OpenCodeTerminal {
    private terminal: vscode.Terminal | null = null;
    private closeListener: vscode.Disposable | null = null;
    private lastSendTime: number = 0;
    private readonly DEBOUNCE_MS = 200;

    createOrShow(projectPath: string): void {
        if (this.terminal) {
            try { this.terminal.show(); } catch { this.terminal = null; }
            if (this.terminal) { return; }
        }
        this.terminal = vscode.window.createTerminal({
            name: TERMINAL_NAME,
            cwd: projectPath
        });
        this.terminal.show();

        if (this.closeListener) {
            this.closeListener.dispose();
        }
        this.closeListener = vscode.window.onDidCloseTerminal((t) => {
            if (t === this.terminal) {
                this.terminal = null;
            }
        });

        const exePath = vscode.workspace.getConfiguration('opencode').get<string>('executablePath', 'opencode');
        setTimeout(() => {
            if (this.terminal) {
                this.terminal.sendText(exePath, false);
                this.terminal.sendText('\n', false);
            }
        }, 500);
    }

    sendText(text: string): void {
        if (!this.terminal) {
            vscode.window.showWarningMessage('请先启动 OpenCode 终端');
            return;
        }
        const now = Date.now();
        if (now - this.lastSendTime < this.DEBOUNCE_MS) { return; }
        this.lastSendTime = now;

        this.terminal.show();
        this.terminal.sendText(text, false);
    }

    sendTextAutoEnter(text: string): void {
        if (!this.terminal) {
            vscode.window.showWarningMessage('请先启动 OpenCode 终端');
            return;
        }
        this.terminal.show();
        this.terminal.sendText(text, false);
        this.terminal.sendText('\n', false);
    }

    exists(): boolean {
        return this.terminal !== null;
    }

    dispose(): void {
        if (this.closeListener) {
            this.closeListener.dispose();
            this.closeListener = null;
        }
        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = null;
        }
    }
}
