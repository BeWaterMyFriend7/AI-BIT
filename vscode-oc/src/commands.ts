import * as vscode from 'vscode';
import { OpenCodeTerminal } from './terminal';
import { SessionViewProvider } from './sessionView';

export function registerCommands(
    context: vscode.ExtensionContext,
    terminal: OpenCodeTerminal,
    sessionProvider: SessionViewProvider
): void {

    const sendSelectedText = vscode.commands.registerCommand('opencode.sendSelectedText', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }
        const selection = editor.selection;
        if (selection.isEmpty) { return; }
        const text = editor.document.getText(selection);
        terminal.sendText(text);
        vscode.window.setStatusBarMessage(`已发送选中内容 (${text.length} 字符)`, 3000);
        sessionProvider.appendAnchor(text, '');
    });

    const sendFilePath = vscode.commands.registerCommand('opencode.sendFilePath', (_uri?: vscode.Uri, uris?: vscode.Uri[]) => {
        const paths = uris && uris.length > 0
            ? uris.map(u => u.fsPath)
            : _uri ? [_uri.fsPath] : [];
        if (paths.length === 0) { return; }
        const content = paths.join('\n');
        terminal.sendText(content);
        vscode.window.setStatusBarMessage(`已发送 ${paths.length} 个文件路径`, 3000);
        sessionProvider.appendAnchor(content, '');
    });

    const sendPreset = (presetLabel: string, uris?: vscode.Uri[]) => {
        const presets: Array<{ label: string; prompt: string }> =
            vscode.workspace.getConfiguration('opencode').get('promptPresets', []);
        const preset = presets.find(p => p.label === presetLabel);
        if (!preset) { return; }

        const editor = vscode.window.activeTextEditor;
        let text: string;
        if (editor && !editor.selection.isEmpty) {
            text = editor.document.getText(editor.selection);
        } else if (uris && uris.length > 0) {
            text = uris.map(u => u.fsPath).join('\n');
        } else {
            return;
        }

        const content = preset.prompt + text;
        terminal.sendTextAutoEnter(content);
        vscode.window.setStatusBarMessage(`已发送：${presetLabel}`, 3000);
        sessionProvider.appendAnchor(content, '');
    };

    const sendPresetUnitTest = vscode.commands.registerCommand('opencode.sendPresetUnitTest', (uri?: vscode.Uri, uris?: vscode.Uri[]) => {
        sendPreset('单测', uris);
    });

    const sendPresetOptimize = vscode.commands.registerCommand('opencode.sendPresetOptimize', (uri?: vscode.Uri, uris?: vscode.Uri[]) => {
        sendPreset('优化', uris);
    });

    context.subscriptions.push(sendSelectedText, sendFilePath, sendPresetUnitTest, sendPresetOptimize);
}
