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
