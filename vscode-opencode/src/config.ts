import * as vscode from 'vscode';
import { getConfig } from './opencodeCli';

export function getConfigModule() {
    return {
        getSystemPrompts(): Array<{ name: string; prompt: string }> {
            return getConfig().systemPrompts;
        },
        getDefaultModel(): string {
            return getConfig().defaultModel;
        }
    };
}

export function getPromptsFromConfig(): Array<{ name: string; prompt: string }> {
    const config = vscode.workspace.getConfiguration('opencode');
    return config.get<Array<{ name: string; prompt: string }>>('systemPrompts', []);
}
