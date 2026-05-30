import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exportOpencodeSession, getOpencodeSessions } from './opencodeCli';

export interface Message {
    sessionId: string;
    messageId: string;
    role: 'user' | 'assistant' | 'tool';
    timestamp: string;
    content: string;
    summary: string;
}

export interface Anchor {
    type: AnchorType;
    time: string;
    summary: string;
    messageId: string;
    sessionId: string;
    relatedFiles: string[];
}

export type AnchorType = 'user_request' | 'plan' | 'code_change' | 'error' | 'test_result' | 'summary';

export interface SessionData {
    sessionId: string;
    messages: Message[];
    anchors: Anchor[];
}

// ── Layer 1: Session collection ──

export async function collectSessions(): Promise<SessionData[]> {
    const sessions: SessionData[] = [];

    try {
        const sessionIds = await getOpencodeSessions();
        for (const id of sessionIds) {
            if (!id) continue;
            const data = await parseFromExport(id);
            if (data) {
                sessions.push(data);
            }
        }
    } catch {
        // Fall back to local file reading
        const localData = await parseFromLocalFiles();
        sessions.push(...localData);
    }

    return sessions;
}

async function parseFromExport(sessionId: string): Promise<SessionData | null> {
    const raw = await exportOpencodeSession(sessionId);
    if (!raw) return null;

    let messages: Message[] = [];

    // opencode export format: { info, messages: [{ info: {role, id, time}, parts: [{type, text}] }] }
    if (raw.messages) {
        messages = raw.messages.map((m: any, idx: number) => {
            const info = m.info || {};
            const content = extractContentFromParts(m.parts || []);
            return {
                sessionId,
                messageId: info.id || `msg_${idx}`,
                role: normalizeRole(info.role || 'unknown'),
                timestamp: epochToIso(info.time?.created) || new Date().toISOString(),
                content,
                summary: extractSummaryFromParts(m.parts || [])
            };
        });
    }

    const anchors = generateAnchors(messages, sessionId);
    return { sessionId, messages, anchors };
}

function extractContentFromParts(parts: any[]): string {
    return parts
        .filter((p: any) => p.type === 'text' && p.text)
        .map((p: any) => p.text)
        .join('\n');
}

function extractSummaryFromParts(parts: any[]): string {
    const textParts = parts.filter((p: any) => p.type === 'text' && p.text);
    const fullText = textParts.map((p: any) => p.text).join(' ');
    if (!fullText) {
        const reasoning = parts.find((p: any) => p.type === 'reasoning');
        return reasoning?.text?.substring(0, 80) || '';
    }
    return fullText.length > 80 ? fullText.substring(0, 80) + '...' : fullText;
}

function epochToIso(epochMs: number | undefined): string | null {
    if (!epochMs) return null;
    return new Date(epochMs).toISOString();
}

async function parseFromLocalFiles(): Promise<SessionData[]> {
    const results: SessionData[] = [];
    const baseDir = path.join(os.homedir(), '.local', 'share', 'opencode', 'sessions');

    if (!fs.existsSync(baseDir)) return results;

    const dirs = fs.readdirSync(baseDir);
    for (const dir of dirs) {
        const sessionDir = path.join(baseDir, dir);
        if (!fs.statSync(sessionDir).isDirectory()) continue;

        const messagesFile = path.join(sessionDir, 'messages.json');
        if (!fs.existsSync(messagesFile)) continue;

        try {
            const raw = JSON.parse(fs.readFileSync(messagesFile, 'utf-8'));
            const messagesArray = raw.messages || (Array.isArray(raw) ? raw : []);
            const sessionId = dir;
            const messages = messagesArray.map((m: any, idx: number) => {
                const info = m.info || {};
                const parts = m.parts || [];
                const content = extractContentFromParts(parts);
                return {
                    sessionId,
                    messageId: info.id || `msg_${idx}`,
                    role: normalizeRole(info.role || 'unknown'),
                    timestamp: epochToIso(info.time?.created) || new Date().toISOString(),
                    content,
                    summary: extractSummaryFromParts(parts)
                };
            });

            const anchors = generateAnchors(messages, sessionId);
            results.push({ sessionId, messages, anchors });
        } catch {
            // Ignore unparseable files
        }
    }

    return results;
}

// ── Layer 2: Anchor generation ──

const ANCHOR_RULES: Array<{ type: AnchorType; keywords: RegExp[]; minScore: number }> = [
    {
        type: 'user_request',
        keywords: [/^(请|帮我|你能|可以|Write|Can|could|帮我写|帮我优化|帮我改|生成|修复|分析|解释)/],
        minScore: 1
    },
    {
        type: 'plan',
        keywords: [/^#+\s/, /步骤\s*\d/, /Step\s*\d/, /^[1-9]\./, /计划/, /方案/, /I'll/, /Let me/],
        minScore: 2
    },
    {
        type: 'code_change',
        keywords: [/write|edit|create|modify|update|delete|new file|写入|修改|创建|新建|删除/i,
            /`[^`]+\.(ts|js|py|go|rs|java|kt|tsx|jsx)`/],
        minScore: 1
    },
    {
        type: 'error',
        keywords: [/error/i, /failed?/i, /exception/i, /错误/, /失败/, /异常/, /cannot/, /unable/,
            /Error\b/, /panic/, /stack trace/],
        minScore: 1
    },
    {
        type: 'test_result',
        keywords: [/test.*(pass|fail|result)/i, /测试.*(通过|失败|结果)/, /PASSED/, /FAILED/,
            /coverage/, /覆盖率/, /\d+ passing/, /\d+ failing/],
        minScore: 1
    },
    {
        type: 'summary',
        keywords: [/总结|汇总|Conclusion|Summary|总的来说|综上所述|Here's what I did/,
            /完成了/, /任务完成/],
        minScore: 1
    }
];

function generateAnchors(messages: Message[], sessionId: string): Anchor[] {
    const anchors: Anchor[] = [];

    for (const msg of messages) {
        const content = msg.content || '';
        const scoreMap = new Map<AnchorType, number>();

        for (const rule of ANCHOR_RULES) {
            for (const pattern of rule.keywords) {
                if (pattern.test(content)) {
                    scoreMap.set(rule.type, (scoreMap.get(rule.type) || 0) + 1);
                }
            }
        }

        for (const rule of ANCHOR_RULES) {
            const score = scoreMap.get(rule.type) || 0;
            if (score >= rule.minScore) {
                anchors.push({
                    type: rule.type,
                    time: msg.timestamp,
                    summary: msg.summary || extractSummaryFromContent(content, rule.type),
                    messageId: msg.messageId,
                    sessionId,
                    relatedFiles: extractRelatedFiles(content)
                });
                break; // One anchor per message
            }
        }
    }

    return anchors;
}

// ── Helpers ──

function normalizeRole(role: string): Message['role'] {
    if (role === 'user' || role === 'human') return 'user';
    if (role === 'assistant' || role === 'ai' || role === 'model') return 'assistant';
    if (role === 'tool' || role === 'function' || role === 'system') return 'tool';
    return 'user';
}

function extractSummaryFromContent(content: string, type: string): string {
    if (!content || typeof content !== 'string') return '';

    const firstLine = content.split('\n').find(l => l.trim().length > 10)?.trim() || '';
    const truncated = firstLine.length > 80 ? firstLine.substring(0, 80) + '...' : firstLine;

    switch (type) {
        case 'user_request': return truncated || '新需求';
        case 'plan': return truncated || 'AI 执行计划';
        case 'code_change': return truncated || '文件修改';
        case 'error': return truncated || '错误信息';
        case 'test_result': return truncated || '测试结果';
        case 'summary': return truncated || '会话总结';
        default: return truncated || '会话消息';
    }
}

function extractRelatedFiles(content: string): string[] {
    if (!content || typeof content !== 'string') return [];

    const files: string[] = [];
    const patterns = [
        /\b([\w\/\-_.]+\.(ts|js|py|go|rs|java|kt|tsx|jsx|vue|css|html|json|yaml|yml|md))\b/gi,
        /`([^`]+\.(ts|js|py|go|rs|java|kt|tsx|jsx))`/gi
    ];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            if (!files.includes(match[1])) {
                files.push(match[1]);
            }
        }
    }

    return files.slice(0, 5);
}

// Export for Chat Viewer consumption
export { generateAnchors };
