import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { spawn, exec } from 'child_process';

export interface OpencodeConfig {
    opencodePath: string;
    defaultModel: string;
    systemPrompts: Array<{ name: string; prompt: string }>;
}

export function getConfig(): OpencodeConfig {
    const c = vscode.workspace.getConfiguration('opencode');
    return {
        opencodePath: c.get<string>('opencodePath', 'opencode'),
        defaultModel: c.get<string>('defaultModel', ''),
        systemPrompts: c.get<Array<{ name: string; prompt: string }>>('systemPrompts', [])
    };
}

function getTempDir(): string {
    const dir = path.join(os.tmpdir(), 'vscode-opencode');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

export function writeTempFile(content: string, prefix: string): string {
    const ts = Date.now();
    const filepath = path.join(getTempDir(), `${prefix}-${ts}.txt`);
    fs.writeFileSync(filepath, content, 'utf-8');
    return filepath;
}

export function runOpencodeRun(
    prompt: string,
    files: string[],
    cwd: string,
    terminal?: vscode.Terminal
): vscode.Terminal {
    const t = terminal ?? vscode.window.createTerminal({
        name: 'Opencode Run',
        cwd: cwd
    });
    t.show();

    const fileArgs = files.map(f => `-f "${f}"`).join(' ');
    const escapedPrompt = prompt.replace(/"/g, '\\"');
    t.sendText(`opencode run ${fileArgs} "${escapedPrompt}"`);
    return t;
}

export function runOpencodeRunWithStdin(
    prompt: string,
    stdinContent: string,
    cwd: string,
    terminal?: vscode.Terminal
): vscode.Terminal {
    const tmpFile = writeTempFile(stdinContent, 'stdin');
    return runOpencodeRun(prompt, [tmpFile], cwd, terminal);
}

export async function getOpencodeSessions(): Promise<string[]> {
    const config = getConfig();
    return new Promise((resolve) => {
        exec(`"${config.opencodePath}" session list`, (err, stdout) => {
            if (err) {
                resolve([]);
                return;
            }
            // Skip header (line 1) and separator (line 2), extract first column
            const sessionIds = stdout.split('\n')
                .slice(2)
                .map(l => l.trim())
                .filter(l => l.length > 0)
                .map(l => l.split(/\s+/)[0])
                .filter(id => id && id.startsWith('ses_'));
            resolve(sessionIds);
        });
    });
}

export async function exportOpencodeSession(sessionId: string): Promise<any | null> {
    const config = getConfig();
    return new Promise((resolve) => {
        exec(`"${config.opencodePath}" export ${sessionId}`, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
            if (err) {
                resolve(null);
                return;
            }
            try {
                // Strip the "Exporting session: xxx" status line from stdout
                const jsonStart = stdout.indexOf('{');
                if (jsonStart === -1) {
                    resolve(null);
                    return;
                }
                const jsonStr = stdout.substring(jsonStart);
                resolve(JSON.parse(jsonStr));
            } catch {
                resolve(null);
            }
        });
    });
}

export function checkOpencodeInstalled(): Promise<boolean> {
    const config = getConfig();
    return new Promise((resolve) => {
        exec(`"${config.opencodePath}" --version`, (err) => {
            resolve(!err);
        });
    });
}

export function opencodeCommand(): string {
    return getConfig().opencodePath;
}
