package com.opencode.plugin

import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import org.jetbrains.plugins.terminal.ShellTerminalWidget
import org.jetbrains.plugins.terminal.TerminalView

@Service(Service.Level.PROJECT)
class OpencodeTerminalService(private val project: Project) {

    private val sessions = mutableListOf<ShellTerminalWidget>()
    private var currentIdx = -1

    /** 创建新终端，启动 opencode，设为当前 */
    fun startTUI(): ShellTerminalWidget {
        val tv = TerminalView.getInstance(project)
        val basePath = project.basePath ?: System.getProperty("user.dir")
        val n = sessions.size + 1
        val name = if (sessions.isEmpty()) "Opencode" else "Opencode #$n"
        val w = tv.createLocalShellWidget(basePath, name)
        w.show()
        w.ttyConnector.write("${opencodePath()}\n")
        sessions.add(w)
        currentIdx = sessions.size - 1
        return w
    }

    /** 新开会话：新建终端，不关旧的 */
    fun newSession(): ShellTerminalWidget = startTUI()

    /** 获取当前终端，没有则创建 */
    fun getOrCreate(): ShellTerminalWidget {
        if (currentIdx >= 0 && sessions.getOrNull(currentIdx) != null) return sessions[currentIdx]
        return startTUI()
    }

    /** 发送文本到当前终端 TTY */
    fun sendText(text: String) {
        val w = getOrCreate()
        w.show()
        w.ttyConnector.write("$text\n")
    }

    /** 发送代码 + prompt */
    fun sendCodeWithPrompt(selectedText: String, prompt: String) {
        val f = OpencodeCliRunner.writeTempFile(selectedText, "selection")
        sendText("$prompt\n(代码文件: ${f.absolutePath})")
    }

    fun sessionCount(): Int = sessions.size
    fun currentIndex(): Int = currentIdx
    fun getCurrent(): ShellTerminalWidget? = sessions.getOrNull(currentIdx)

    fun listNames(): List<String> = sessions.mapIndexed { i, w ->
        val name = (w as? org.jetbrains.plugins.terminal.ShellTerminalWidget)?.let {
            it.toString().let { s -> if (s.length > 30) s.take(30) + "..." else s }
        } ?: "Terminal ${i + 1}"
        if (i == currentIdx) "$name ★" else name
    }

    /** 停止当前 */
    fun stopCurrent() { if (currentIdx >= 0) stopSession(currentIdx) }

    private fun stopSession(i: Int) {
        val w = sessions.getOrNull(i) ?: return
        w.close()
    }

    fun switchTo(i: Int): Boolean {
        if (i !in sessions.indices) return false
        currentIdx = i
        sessions[i].show()
        return true
    }

    /** 终端被外部关闭时回调 */
    fun onTerminalClosed(widget: ShellTerminalWidget) {
        val i = sessions.indexOf(widget)
        if (i < 0) return
        sessions.removeAt(i)
        if (i == currentIdx) currentIdx = if (sessions.isNotEmpty()) sessions.size - 1 else -1
        else if (i < currentIdx) currentIdx--
    }

    private fun opencodePath() = OpencodeSettings.getInstance().getOpencodePath()

    companion object {
        fun getInstance(project: Project): OpencodeTerminalService =
            project.getService(OpencodeTerminalService::class.java)
    }
}
