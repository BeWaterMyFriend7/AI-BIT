import * as vscode from 'vscode';
import { OpenCodeTerminal } from './terminal';

export function registerCommands(
    context: vscode.ExtensionContext,
    terminal: OpenCodeTerminal
): void {

    const sendSelectedText = vscode.commands.registerCommand('opencode.sendSelectedText', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }
        const selection = editor.selection;
        if (selection.isEmpty) { return; }
        const text = editor.document.getText(selection);
        terminal.sendText(text);
    });

    const sendFilePath = vscode.commands.registerCommand('opencode.sendFilePath', (_uri?: vscode.Uri, uris?: vscode.Uri[]) => {
        const paths = uris && uris.length > 0
            ? uris.map(u => u.fsPath)
            : _uri ? [_uri.fsPath] : [];
        if (paths.length === 0) { return; }
        const content = paths.join('\n');
        terminal.sendText(content);
    });

    const sendPreset = (presetLabel: string) => {
        const presets: Array<{ label: string; prompt: string }> =
            vscode.workspace.getConfiguration('opencode').get('promptPresets', []);
        const preset = presets.find(p => p.label === presetLabel);
        if (!preset) { return; }

        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }
        const selection = editor.selection;
        if (selection.isEmpty) { return; }
        const text = editor.document.getText(selection);
        const content = `${preset.prompt}${text}`;
        terminal.sendTextAutoEnter(content);
    };

    const sendPresetUnitTest = vscode.commands.registerCommand('opencode.sendPresetUnitTest', () => {
        sendPreset('单测');
    });

    const sendPresetOptimize = vscode.commands.registerCommand('opencode.sendPresetOptimize', () => {
        sendPreset('优化');
    });

    context.subscriptions.push(sendSelectedText, sendFilePath, sendPresetUnitTest, sendPresetOptimize);
}
