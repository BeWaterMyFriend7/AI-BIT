import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('OpenCode plugin activated');
}

export function deactivate() {}
