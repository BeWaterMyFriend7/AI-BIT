package com.opencode.idea

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.jcef.JBCefBrowser
import java.awt.BorderLayout
import javax.swing.JPanel

class SessionToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = JPanel(BorderLayout())
        val browser = JBCefBrowser()

        val html = javaClass.getResource("/webview/session.html")?.readText()
            ?: "<html><body>Error loading session view</body></html>"
        browser.loadHTML(html)

        panel.add(browser.component, BorderLayout.CENTER)
        toolWindow.component.add(panel)
    }
}
