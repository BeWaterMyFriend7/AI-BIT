import * as vscode from 'vscode';
import { sessionCount } from './terminal';

let _item: vscode.StatusBarItem;

export function createStatusBar(ctx: vscode.ExtensionContext): void {
    _item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    _item.command = 'opencode.showMenu';
    refreshStatusBar();
    _item.show();
    ctx.subscriptions.push(_item);
}

export function refreshStatusBar(): void {
    const n = sessionCount();
    _item.text = n > 0 ? `$(hubot) Opencode (${n})` : '$(hubot) Opencode: 启动';
    _item.tooltip = n > 0 ? `活跃会话: ${n}\n点击打开菜单` : '点击启动 Opencode';
    _item.backgroundColor = n > 0
        ? new vscode.ThemeColor('statusBarItem.prominentBackground')
        : undefined;
}
