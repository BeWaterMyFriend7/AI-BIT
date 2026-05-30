import * as vscode from 'vscode';
import { checkOpencodeInstalled } from './opencodeCli';
import { startOpencodeTUI, newSession, stopCurrent } from './terminal';
import { createStatusBar, refreshStatusBar } from './statusBar';
import { registerQuickActions } from './commands/quickActions';
import { registerStatusMenu } from './commands/statusMenu';
import { ChatViewerProvider } from './chatViewer';

export async function activate(context: vscode.ExtensionContext) {
    if (!await checkOpencodeInstalled()) {
        vscode.window.showErrorMessage('Opencode 未安装或路径不对，请在 Settings → Opencode 设置路径');
    }

    createStatusBar(context);
    registerQuickActions(context);
    registerStatusMenu(context);

    // Legacy commands for keybindings
    context.subscriptions.push(
        vscode.commands.registerCommand('opencode.startTUI', () => { startOpencodeTUI(); refreshStatusBar(); }),
        vscode.commands.registerCommand('opencode.newSession', () => { newSession(); refreshStatusBar(); }),
        vscode.commands.registerCommand('opencode.stopTUI', () => { stopCurrent(); refreshStatusBar(); })
    );

    // Chat viewer (only this one sidebar view now)
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(
        ChatViewerProvider.viewType,
        new ChatViewerProvider(context.extensionUri),
        { webviewOptions: { retainContextWhenHidden: true } }
    ));

    vscode.window.onDidCloseTerminal(() => refreshStatusBar());
    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('opencode.systemPrompts'))
            vscode.window.showInformationMessage('Opencode 提示词已更新');
    });
}

export function deactivate() {}
