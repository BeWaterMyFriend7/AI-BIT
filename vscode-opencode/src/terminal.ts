import * as vscode from 'vscode';
import { opencodeCommand } from './opencodeCli';

const sessions: vscode.Terminal[] = [];
let currentIdx = -1;

/** 创建新终端并设为当前 */
export function startOpencodeTUI(): vscode.Terminal {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath ?? process.cwd();
    const n = sessions.length + 1;
    const name = sessions.length === 0 ? 'Opencode' : `Opencode #${n}`;
    const t = vscode.window.createTerminal({ name, cwd, env: { ...process.env as Record<string, string> } });
    t.show();
    t.sendText(opencodeCommand());
    sessions.push(t);
    currentIdx = sessions.length - 1;
    return t;
}

/** 新开会话：新建终端，不关旧的 */
export function newSession(): vscode.Terminal { return startOpencodeTUI(); }

/** 获取当前会话终端，没有则创建一个 */
export function getOrCreateTerminal(): vscode.Terminal {
    if (currentIdx >= 0 && sessions[currentIdx]) return sessions[currentIdx];
    return startOpencodeTUI();
}

/** 发送文本到当前终端 */
export function sendToTerminal(text: string): void {
    const t = getOrCreateTerminal();
    t.show();
    t.sendText(text);
}

/** 切换会话 */
export function switchSession(index: number): vscode.Terminal | null {
    if (index >= 0 && index < sessions.length) { currentIdx = index; sessions[currentIdx].show(); return sessions[currentIdx]; }
    return null;
}

/** 关闭指定会话 */
export function stopSession(index: number): void {
    if (index < 0 || index >= sessions.length) return;
    sessions[index].dispose(); // onDidCloseTerminal handles cleanup
}

/** 关闭当前会话 */
export function stopCurrent(): void { stopSession(currentIdx); }

export function getCurrentTerminal(): vscode.Terminal | null {
    return (currentIdx >= 0 && sessions[currentIdx]) ? sessions[currentIdx] : null;
}
export function sessionCount(): number { return sessions.length; }
export function currentIndex(): number { return currentIdx; }
export function listSessions(): Array<{ label: string; idx: number }> {
    return sessions.map((t, i) => ({ label: t.name + (i === currentIdx ? ' ★' : ''), idx: i }));
}

// ── 生命周期 ──
let _onChange: () => void = () => {};
export function onSessionsChanged(fn: () => void): void { _onChange = fn; }

export function initTerminalTracking(): void {
    vscode.window.onDidCloseTerminal(t => {
        const i = sessions.indexOf(t);
        if (i < 0) return;
        sessions.splice(i, 1);
        if (i === currentIdx) { currentIdx = sessions.length > 0 ? sessions.length - 1 : -1; }
        else if (i < currentIdx) { currentIdx--; }
        _onChange();
    });
}
