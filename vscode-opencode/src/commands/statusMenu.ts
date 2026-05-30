import * as vscode from 'vscode';
import { startOpencodeTUI, newSession, getCurrentTerminal, sendToTerminal,
         sessionCount, listSessions, switchSession, stopCurrent,
         initTerminalTracking, onSessionsChanged } from '../terminal';
import { refreshStatusBar } from '../statusBar';

export function registerStatusMenu(context: vscode.ExtensionContext): void {
    initTerminalTracking();
    onSessionsChanged(refreshStatusBar);

    context.subscriptions.push(
        vscode.commands.registerCommand('opencode.showMenu', () => showMenu())
    );
}

async function showMenu(): Promise<void> {
    const sCount = sessionCount();
    const hasCurrent = !!getCurrentTerminal();
    const opts: vscode.QuickPickItem[] = [];

    if (hasCurrent) {
        opts.push({ label: '$(window) 打开当前会话', description: '切到 Opencode 终端' });
    }
    opts.push({ label: hasCurrent ? '$(add) 新开会话' : '$(play) 启动 Opencode 对话',
        description: sCount > 0 ? `新建终端（共 ${sCount} 个）` : '创建 Opencode 终端' });

    if (sCount > 1) {
        opts.push({ label: '$(list-tree) 切换会话', description: '选择活跃终端' });
    }
    if (hasCurrent) {
        opts.push(
            { label: '$(terminal) 手动输入命令', description: '直接往终端打字' },
            { label: '$(close) 关闭当前会话', description: '' }
        );
    }

    const pick = await vscode.window.showQuickPick(opts, { title: 'Opencode', placeHolder: '选择...' });
    if (!pick) return;

    if (pick.label.includes('启动') || pick.label.includes('新开会话')) { newSession(); }
    else if (pick.label.includes('打开当前') || pick.label.includes('启动')) { getCurrentTerminal()?.show(); }
    else if (pick.label.includes('切换会话')) {
        const list = listSessions();
        const items = list.map(s => ({ label: s.label.replace(' ★', '') }));
        const chosen = await vscode.window.showQuickPick(items, { title: '切换', placeHolder: '选择...' });
        if (chosen) { const idx = items.indexOf(chosen); if (idx >= 0) switchSession(idx); }
    } else if (pick.label.includes('手动输入')) {
        const text = await vscode.window.showInputBox({ prompt: '输入命令', placeHolder: 'opencode run ...' });
        if (text) sendToTerminal(text);
    } else if (pick.label.includes('关闭当前会话')) { stopCurrent(); }

    refreshStatusBar();
}
