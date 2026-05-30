package com.opencode.plugin

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.File

object OpencodeSessionParser {

    data class Message(
        val sessionId: String,
        val messageId: String,
        val role: String, // user, assistant, tool
        val timestamp: String,
        val content: String,
        val summary: String
    )

    data class Anchor(
        val type: String,
        val time: String,
        val summary: String,
        val messageId: String,
        val sessionId: String,
        val relatedFiles: List<String>
    )

    data class SessionData(
        val sessionId: String,
        val messages: List<Message>,
        val anchors: List<Anchor>
    )

    private val anchorRules = listOf(
        AnchorRule("user_request", listOf(
            Regex("^(请|帮我|你能|可以|Write|Can|could|帮我写|帮我优化|帮我改|生成|修复|分析|解释)")
        ), 1),
        AnchorRule("plan", listOf(
            Regex("^#+\\s"), Regex("步骤\\s*\\d"), Regex("Step\\s*\\d"),
            Regex("^[1-9]\\."), Regex("计划|方案"), Regex("I'll|Let me")
        ), 2),
        AnchorRule("code_change", listOf(
            Regex("write|edit|create|modify|update|delete|new file|写入|修改|创建|新建|删除",
                RegexOption.IGNORE_CASE),
            Regex("`[^`]+\\.(ts|js|py|go|rs|java|kt|tsx|jsx)`")
        ), 1),
        AnchorRule("error", listOf(
            Regex("error", RegexOption.IGNORE_CASE),
            Regex("failed?", RegexOption.IGNORE_CASE),
            Regex("错误|失败|异常|cannot|unable"),
            Regex("panic|stack trace")
        ), 1),
        AnchorRule("test_result", listOf(
            Regex("test.*(pass|fail|result)", RegexOption.IGNORE_CASE),
            Regex("测试.*(通过|失败|结果)"),
            Regex("PASSED|FAILED"),
            Regex("coverage|覆盖率|\\d+ passing|\\d+ failing")
        ), 1),
        AnchorRule("summary", listOf(
            Regex("总结|汇总|Conclusion|Summary|总的来说|综上所述|Here's what I did|完成了|任务完成")
        ), 1)
    )

    fun collectSessions(): List<SessionData> {
        val sessions = mutableListOf<SessionData>()

        try {
            val sessionIds = OpencodeCliRunner.getSessions()
            for (id in sessionIds) {
                if (id.isBlank()) continue
                val data = parseFromExport(id)
                if (data != null) sessions.add(data)
            }
        } catch (_: Exception) {
            sessions.addAll(parseFromLocalFiles())
        }

        return sessions
    }

    private fun parseFromExport(sessionId: String): SessionData? {
        val raw = OpencodeCliRunner.exportSession(sessionId) ?: return null
        return try {
            val gson = Gson()
            val type = object : TypeToken<Map<String, Any>>() {}.type
            val root: Map<String, Any> = gson.fromJson(raw, type)

            @Suppress("UNCHECKED_CAST")
            val msgList = root["messages"] as? List<Map<String, Any>> ?: emptyList()

            val messages = msgList.mapIndexed { idx, m ->
                @Suppress("UNCHECKED_CAST")
                val info = m["info"] as? Map<String, Any> ?: emptyMap()
                @Suppress("UNCHECKED_CAST")
                val parts = m["parts"] as? List<Map<String, Any>> ?: emptyList()

                val content = extractTextFromParts(parts)
                Message(
                    sessionId = sessionId,
                    messageId = info["id"]?.toString() ?: "msg_$idx",
                    role = normalizeRole(info["role"]?.toString() ?: "unknown"),
                    timestamp = epochToIso(info["time"]?.let { t ->
                        @Suppress("UNCHECKED_CAST")
                        (t as? Map<String, Any>)?.get("created")?.toString()?.toDoubleOrNull()?.toLong()
                    }) ?: java.time.Instant.now().toString(),
                    content = content,
                    summary = extractSummaryFromParts(parts)
                )
            }

            val anchors = generateAnchors(messages, sessionId)
            SessionData(sessionId, messages, anchors)
        } catch (e: Exception) {
            null
        }
    }

    private fun parseFromLocalFiles(): List<SessionData> {
        val results = mutableListOf<SessionData>()
        val baseDir = File(System.getProperty("user.home"),
            ".local/share/opencode/sessions")
        if (!baseDir.exists()) return results

        for (dir in baseDir.listFiles() ?: emptyArray()) {
            if (!dir.isDirectory) continue
            val messagesFile = File(dir, "messages.json")
            if (!messagesFile.exists()) continue

            try {
                val sessionId = dir.name
                val raw = messagesFile.readText()
                val gson = Gson()
                val type = object : TypeToken<Map<String, Any>>() {}.type
                val root: Map<String, Any> = gson.fromJson(raw, type)

                @Suppress("UNCHECKED_CAST")
                val msgList = root["messages"] as? List<Map<String, Any>> ?: emptyList()

                val messages = msgList.mapIndexed { idx, m ->
                    @Suppress("UNCHECKED_CAST")
                    val info = m["info"] as? Map<String, Any> ?: emptyMap()
                    @Suppress("UNCHECKED_CAST")
                    val parts = m["parts"] as? List<Map<String, Any>> ?: emptyList()

                    val content = extractTextFromParts(parts)
                    Message(
                        sessionId = sessionId,
                        messageId = info["id"]?.toString() ?: "msg_$idx",
                        role = normalizeRole(info["role"]?.toString() ?: "unknown"),
                        timestamp = epochToIso(info["time"]?.let { t ->
                            @Suppress("UNCHECKED_CAST")
                            (t as? Map<String, Any>)?.get("created")?.toString()?.toDoubleOrNull()?.toLong()
                        }) ?: java.time.Instant.now().toString(),
                        content = content,
                        summary = extractSummaryFromParts(parts)
                    )
                }

                val anchors = generateAnchors(messages, sessionId)
                results.add(SessionData(sessionId, messages, anchors))
            } catch (_: Exception) {
                // skip
            }
        }
        return results
    }

    private fun extractTextFromParts(parts: List<Map<String, Any>>): String {
        return parts
            .filter { it["type"]?.toString() == "text" }
            .mapNotNull { it["text"]?.toString() }
            .joinToString("\n")
    }

    private fun extractSummaryFromParts(parts: List<Map<String, Any>>): String {
        val textParts = parts.filter { it["type"]?.toString() == "text" }
        val fullText = textParts.joinToString(" ") { it["text"]?.toString() ?: "" }
        if (fullText.isNotBlank()) {
            return if (fullText.length > 80) fullText.take(80) + "..." else fullText
        }
        // Fallback to reasoning
        val reasoning = parts.find { it["type"]?.toString() == "reasoning" }
        val rText = reasoning?.get("text")?.toString() ?: ""
        return if (rText.length > 80) rText.take(80) + "..." else rText
    }

    private fun epochToIso(epochMs: Long?): String? {
        if (epochMs == null) return null
        return java.time.Instant.ofEpochMilli(epochMs).toString()
    }

    private fun generateAnchors(messages: List<Message>, sessionId: String): List<Anchor> {
        val anchors = mutableListOf<Anchor>()

        for (msg in messages) {
            val content = msg.content
            val scores = mutableMapOf<String, Int>()

            for (rule in anchorRules) {
                for (pattern in rule.patterns) {
                    if (pattern.containsMatchIn(content)) {
                        scores[rule.type] = (scores[rule.type] ?: 0) + 1
                    }
                }
            }

            for (rule in anchorRules) {
                val score = scores[rule.type] ?: 0
                if (score >= rule.minScore) {
                    anchors.add(Anchor(
                        type = rule.type,
                        time = msg.timestamp,
                        summary = msg.summary.ifBlank {
                            extractSummary(content, rule.type)
                        },
                        messageId = msg.messageId,
                        sessionId = sessionId,
                        relatedFiles = extractRelatedFiles(content)
                    ))
                    break
                }
            }
        }

        return anchors
    }

    private fun normalizeRole(role: String): String = when {
        role == "user" || role == "human" -> "user"
        role == "assistant" || role == "ai" || role == "model" -> "assistant"
        role == "tool" || role == "function" || role == "system" -> "tool"
        else -> "user"
    }

    private fun extractSummary(content: String, type: String?): String {
        if (content.isBlank()) return ""
        val firstLine = content.lines().firstOrNull { it.trim().length > 10 }?.trim() ?: ""
        val truncated = if (firstLine.length > 80) firstLine.take(80) + "..." else firstLine
        return when (type) {
            "user_request" -> truncated.ifBlank { "新需求" }
            "plan" -> truncated.ifBlank { "AI 执行计划" }
            "code_change" -> truncated.ifBlank { "文件修改" }
            "error" -> truncated.ifBlank { "错误信息" }
            "test_result" -> truncated.ifBlank { "测试结果" }
            "summary" -> truncated.ifBlank { "会话总结" }
            else -> truncated.ifBlank { "会话消息" }
        }
    }

    private fun extractRelatedFiles(content: String): List<String> {
        if (content.isBlank()) return emptyList()
        val pattern = Regex("[\\w/\\-_.]+\\.(ts|js|py|go|rs|java|kt|tsx|jsx|vue|css|html|json|yaml|yml|md)")
        return pattern.findAll(content).map { it.value }.distinct().take(5).toList()
    }

    private data class AnchorRule(
        val type: String,
        val patterns: List<Regex>,
        val minScore: Int
    )
}
