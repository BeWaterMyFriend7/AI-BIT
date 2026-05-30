import * as vscode from 'vscode';
import { OpenCodeTerminal } from './terminal';
import { registerCommands } from './commands';

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
    statusBarItem.tooltip = '点击启动 OpenCode 终端 | 启动后可在终端中与 AI 对话';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    registerCommands(context, terminal);
}

export function deactivate() {}
