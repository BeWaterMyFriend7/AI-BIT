package com.opencode.plugin.ui

import com.intellij.openapi.actionSystem.*
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetFactory
import com.opencode.plugin.OpencodeTerminalService
import java.awt.event.MouseEvent

class OpencodeStatusBarWidgetFactory : StatusBarWidgetFactory {
    override fun getId() = "com.opencode.plugin.OpencodeStatusBarWidget"
    override fun getDisplayName() = "Opencode Status"
    override fun createWidget(project: Project): StatusBarWidget = OpencodeStatusBarWidget(project)
    override fun isAvailable(project: Project) = true
}

class OpencodeStatusBarWidget(private val project: Project) :
    StatusBarWidget, StatusBarWidget.TextPresentation {

    private var statusBar: StatusBar? = null

    override fun ID() = "com.opencode.plugin.OpencodeStatusBarWidget"
    override fun getPresentation(): StatusBarWidget.TextPresentation = this

    override fun getText(): String {
        val n = OpencodeTerminalService.getInstance(project).sessionCount()
        return if (n > 0) "Opencode ($n)" else "Opencode: 启动"
    }

    override fun getAlignment() = java.awt.Component.LEFT_ALIGNMENT

    override fun install(statusBar: StatusBar) { this.statusBar = statusBar }
    override fun dispose() { statusBar = null }

    override fun getClickConsumer(): com.intellij.util.Consumer<MouseEvent>? {
        return com.intellij.util.Consumer { event ->
            val svc = OpencodeTerminalService.getInstance(project)
            val group = DefaultActionGroup()

            if (svc.sessionCount() == 0) {
                group.add(makeAction("启动 Opencode 对话") { svc.startTUI() })
            } else {
                group.add(makeAction("打开当前会话") { svc.getCurrent()?.show() })
            }
            group.add(makeAction("新开会话") { svc.newSession() })
            if (svc.sessionCount() > 1)
                group.add(makeAction("切换会话") {
                    val names = svc.listNames()
                    val items = names.map { it.replace(" ★", "") }
                    val chosen = com.intellij.openapi.ui.Messages.showChooseDialog(
                        project, "选择会话", "切换", null, items.toTypedArray(), items.getOrNull(svc.currentIndex()))
                    if (chosen in items.indices) svc.switchTo(chosen)
                })
            if (svc.sessionCount() > 0)
                group.add(makeAction("关闭当前会话") { svc.stopCurrent() })

            val popup = JBPopupFactory.getInstance()
                .createActionGroupPopup("Opencode", group, DataContext.EMPTY_CONTEXT,
                    JBPopupFactory.ActionSelectionAid.SPEEDSEARCH, false)
            popup.showUnderneathOf(event.component)
        }
    }

    override fun getTooltipText(): String =
        "会话: ${OpencodeTerminalService.getInstance(project).sessionCount()}\n点击打开菜单"
}

private fun makeAction(text: String, action: () -> Unit): AnAction {
    return object : AnAction(text) {
        override fun actionPerformed(e: AnActionEvent) { action() }
    }
}
