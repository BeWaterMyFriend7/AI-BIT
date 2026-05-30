import * as vscode from 'vscode';
import { writeTempFile } from '../opencodeCli';
import { sendToTerminal } from '../terminal';
import { getPromptsFromConfig } from '../config';

export function registerQuickActions(ctx: vscode.ExtensionContext): void {
    // 解释代码 — 直接发送，用户按 Enter 确认
    ctx.subscriptions.push(
        vscode.commands.registerCommand('opencode.explainCode', () =>
            sendWithPrompt('请解释这段代码的功能和逻辑')),
        vscode.commands.registerCommand('opencode.writeTests', () => {
            const p = getPromptsFromConfig().find(p => p.name === '单测');
            sendWithPrompt(p?.prompt || '为如下代码写单测');
        }),
        vscode.commands.registerCommand('opencode.optimizeCode', () => {
            const p = getPromptsFromConfig().find(p => p.name === '优化');
            sendWithPrompt(p?.prompt || '优化如下代码');
        }),
        // 发送到 Opencode — 不弹窗，直接发送，用户自己 Enter
        vscode.commands.registerCommand('opencode.sendToChat', () => {
            const text = getSelection(); if (!text) return;
            const f = writeTempFile(text, 'selection');
            sendToTerminal(`(文件: ${f})`);
        })
    );
}

function sendWithPrompt(prompt: string): void {
    const text = getSelection(); if (!text) return;
    const f = writeTempFile(text, 'selection');
    sendToTerminal(`${prompt}\n(文件: ${f})`);
}

function getSelection(): string | undefined {
    const e = vscode.window.activeTextEditor;
    if (!e) { vscode.window.showWarningMessage('没有打开的文件'); return undefined; }
    const t = e.document.getText(e.selection);
    if (!t) { vscode.window.showWarningMessage('请先选中代码'); return undefined; }
    return t;
}
