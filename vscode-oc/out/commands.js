"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommands = registerCommands;
const vscode = __importStar(require("vscode"));
function registerCommands(context, terminal) {
    const sendSelectedText = vscode.commands.registerCommand('opencode.sendSelectedText', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const selection = editor.selection;
        if (selection.isEmpty) {
            return;
        }
        const text = editor.document.getText(selection);
        terminal.sendText(text);
    });
    const sendFilePath = vscode.commands.registerCommand('opencode.sendFilePath', (_uri, uris) => {
        const paths = uris && uris.length > 0
            ? uris.map(u => u.fsPath)
            : _uri ? [_uri.fsPath] : [];
        if (paths.length === 0) {
            return;
        }
        const content = paths.join('\n');
        terminal.sendText(content);
    });
    const sendPreset = (presetLabel) => {
        const presets = vscode.workspace.getConfiguration('opencode').get('promptPresets', []);
        const preset = presets.find(p => p.label === presetLabel);
        if (!preset) {
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const selection = editor.selection;
        if (selection.isEmpty) {
            return;
        }
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
//# sourceMappingURL=commands.js.map