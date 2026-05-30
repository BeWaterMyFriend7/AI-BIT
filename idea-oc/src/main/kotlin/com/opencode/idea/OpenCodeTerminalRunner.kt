package com.opencode.idea

import com.intellij.openapi.project.Project
import com.opencode.idea.settings.OpenCodeSettings
import org.jetbrains.plugins.terminal.AbstractTerminalRunner
import org.jetbrains.plugins.terminal.ShellTerminalWidget
import org.jetbrains.plugins.terminal.TerminalToolWindowManager
import java.io.OutputStream

class OpenCodeTerminalRunner(private val project: Project) {

    private var terminalWidget: ShellTerminalWidget? = null

    fun start(): ShellTerminalWidget? {
        val existing = findExisting()
        if (existing != null) {
            showTerminal()
            return existing
        }

        val settings = OpenCodeSettings.getInstance()
        val projectPath = project.basePath ?: System.getProperty("user.home") ?: "."

        val manager = TerminalToolWindowManager.getInstance(project)
        val tabName = "OpenCode"

        val shellCommand = listOf(settings.executablePath)
        val widget = manager.createLocalShellWidget(projectPath, tabName, false)
        terminalWidget = widget
        widget.executeCommand(settings.executablePath)

        showTerminal()
        return widget
    }

    fun sendText(text: String) {
        val widget = terminalWidget ?: findExisting() ?: return
        showTerminal()
        widget.executeCommand(text)
    }

    fun sendTextAutoEnter(text: String) {
        sendText(text)
    }

    fun exists(): Boolean {
        return findExisting() != null
    }

    fun dispose() {
        val widget = terminalWidget ?: return
        widget.close()
        terminalWidget = null
    }

    private fun findExisting(): ShellTerminalWidget? {
        if (terminalWidget != null) return terminalWidget
        val manager = TerminalToolWindowManager.getInstance(project)
        val consoles = manager.terminalsFor(project)
        for (console in consoles) {
            if (console is ShellTerminalWidget && console.toString().contains("OpenCode")) {
                terminalWidget = console
                return console
            }
        }
        return null
    }

    private fun showTerminal() {
        val manager = TerminalToolWindowManager.getInstance(project)
        manager.show(findExisting())
    }

    companion object {
        fun getInstance(project: Project): OpenCodeTerminalRunner {
            return project.getService(OpenCodeTerminalRunner::class.java)
        }
    }
}
