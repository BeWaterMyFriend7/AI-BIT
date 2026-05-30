package com.opencode.plugin.ui

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.opencode.plugin.OpencodeCliRunner
import java.awt.BorderLayout
import javax.swing.*
import javax.swing.border.EmptyBorder

class ChatViewerToolWindowFactory : ToolWindowFactory, DumbAware {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = ChatViewerPanel(project)
        val content = ContentFactory.getInstance().createContent(panel, "", false)
        toolWindow.contentManager.addContent(content)
    }
}

class ChatViewerPanel(private val project: Project) : JPanel(BorderLayout()) {

    private val contentArea = JEditorPane().apply { contentType = "text/html"; isEditable = false }
    private var loading = false

    init {
        val toolbar = JPanel()
        toolbar.add(JButton("刷新").apply { addActionListener { loadLatest() } })
        add(toolbar, BorderLayout.NORTH)
        add(JScrollPane(contentArea), BorderLayout.CENTER)
        loadLatest()
    }

    private fun loadLatest() {
        if (loading) return
        loading = true
        contentArea.text = "<html><body style='padding:16px;color:gray;text-align:center'>加载中...</body></html>"

        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                val ids = OpencodeCliRunner.getSessions()
                if (ids.isEmpty()) {
                    showEmpty("暂无 Opencode 会话\n点击状态栏 \"Opencode: 启动\" 开始")
                    ApplicationManager.getApplication().invokeLater { loading = false }
                    return@executeOnPooledThread
                }
                val sessionId = ids.last()
                val raw = OpencodeCliRunner.exportSession(sessionId) ?: run {
                    showEmpty("暂无会话数据"); ApplicationManager.getApplication().invokeLater { loading = false }; return@executeOnPooledThread
                }
                val gson = Gson()
                val mapType = object : TypeToken<Map<String, Any>>() {}.type
                val root: Map<String, Any> = gson.fromJson(raw, mapType)
                @Suppress("UNCHECKED_CAST")
                val msgs = root["messages"] as? List<Map<String, Any>> ?: emptyList()
                val title = (root["info"] as? Map<*, *>)?.get("title")?.toString() ?: sessionId

                ApplicationManager.getApplication().invokeLater {
                    val sb = StringBuilder()
                    sb.append("<html><body style='font-family:sans-serif;font-size:12px;padding:8px;color:#333'>")
                    sb.append("<h3 style='margin-bottom:2px'>${esc(title.take(30))}</h3>")
                    sb.append("<div style='font-size:10px;color:#999;margin-bottom:8px'>${esc(sessionId)}</div>")
                    msgs.forEach { m ->
                        val info = m["info"] as? Map<*, *> ?: return@forEach
                        val parts = m["parts"] as? List<Map<*, *>> ?: return@forEach
                        val role = info["role"]?.toString() ?: "unknown"
                        val timeStr = (info["time"] as? Map<*, *>)?.get("created")?.let {
                            try { java.text.SimpleDateFormat("HH:mm:ss").format(java.util.Date(it.toString().toLong())) } catch (_: Exception) { "" }
                        } ?: ""
                        val text = parts.filter { it["type"] == "text" }.mapNotNull { it["text"]?.toString() }.joinToString("\n")
                        val bg = when (role) { "user" -> "#e3f2fd" else -> "#f5f5f5" }
                        val align = when (role) { "user" -> "right" else -> "left" }
                        sb.append("<div style='margin-bottom:8px;text-align:$align'>")
                        sb.append("<div style='font-size:10px;color:#999'>${role.uppercase()} · $timeStr</div>")
                        sb.append("<div style='display:inline-block;max-width:90%;padding:6px 8px;border-radius:6px;background:$bg;text-align:left;white-space:pre-wrap;word-break:break-word'>${esc(text)}</div>")
                        sb.append("</div>")
                    }
                    sb.append("</body></html>")
                    contentArea.text = sb.toString()
                    contentArea.caretPosition = 0
                    loading = false
                }
            } catch (e: Exception) {
                showEmpty("加载失败: ${e.message}")
                ApplicationManager.getApplication().invokeLater { loading = false }
            }
        }
    }

    private fun showEmpty(text: String) {
        ApplicationManager.getApplication().invokeLater {
            contentArea.text = "<html><body style='padding:32px;color:gray;text-align:center;white-space:pre-line'>${esc(text)}</body></html>"
        }
    }

    private fun esc(s: String): String = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>")
}
