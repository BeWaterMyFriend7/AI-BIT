import * as vscode from 'vscode';
import { OpenCodeTerminal } from './terminal';
import { registerCommands } from './commands';
import { SessionViewProvider } from './sessionView';

export function activate(context: vscode.ExtensionContext) {
    const terminal = new OpenCodeTerminal();

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'opencode.start';
    statusBarItem.text = '$(play) 启动 OpenCode';
    statusBarItem.tooltip = '点击启动 OpenCode 终端';
    statusBarItem.show();

    const startCmd = vscode.commands.registerCommand('opencode.start', () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showWarningMessage('请先打开一个工作区');
            return;
        }
        terminal.createOrShow(workspaceFolders[0].uri.fsPath);
        statusBarItem.text = '$(debug-stop) 停止 OpenCode';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        statusBarItem.tooltip = 'OpenCode 运行中 | 点击停止';
        statusBarItem.command = 'opencode.stop';
    });

    const stopCmd = vscode.commands.registerCommand('opencode.stop', () => {
        terminal.dispose();
        statusBarItem.text = '$(play) 启动 OpenCode';
        statusBarItem.backgroundColor = undefined;
        statusBarItem.tooltip = '点击启动 OpenCode 终端';
        statusBarItem.command = 'opencode.start';
    });

    context.subscriptions.push(startCmd, stopCmd, statusBarItem);

    vscode.window.onDidCloseTerminal((t) => {
        if (!terminal.exists()) {
            statusBarItem.text = '$(play) 启动 OpenCode';
            statusBarItem.backgroundColor = undefined;
            statusBarItem.tooltip = '点击启动 OpenCode 终端';
            statusBarItem.command = 'opencode.start';
        }
    });

    const sessionProvider = new SessionViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SessionViewProvider.viewType, sessionProvider)
    );

    registerCommands(context, terminal, sessionProvider);

    const showSessionCmd = vscode.commands.registerCommand('opencode.showSession', () => {
        vscode.commands.executeCommand('workbench.view.extension.opencode-session');
    });
    context.subscriptions.push(showSessionCmd);

    const sessionStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    sessionStatusBarItem.command = 'opencode.showSession';
    sessionStatusBarItem.text = '$(history) 会话';
    sessionStatusBarItem.tooltip = '打开会话历史';
    sessionStatusBarItem.show();
    context.subscriptions.push(sessionStatusBarItem);
}

export function deactivate() {}
