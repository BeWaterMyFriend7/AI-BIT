package com.opencode.plugin.actions

import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.opencode.plugin.OpencodeCliRunner
import com.opencode.plugin.OpencodeTerminalService

class SendToChatAction : com.intellij.openapi.actionSystem.AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.getRequiredData(CommonDataKeys.PROJECT)
        val editor = e.getData(CommonDataKeys.EDITOR)
        val text = editor?.selectionModel?.selectedText ?: return
        val tmp = OpencodeCliRunner.writeTempFile(text, "selection")
        val svc = OpencodeTerminalService.getInstance(project)
        svc.getOrCreate()
        svc.sendText("(文件: ${tmp.absolutePath})")
    }

    override fun update(e: AnActionEvent) {
        val ed = e.getData(CommonDataKeys.EDITOR)
        e.presentation.isEnabledAndVisible = ed?.selectionModel?.hasSelection() == true
    }

    override fun getActionUpdateThread() = ActionUpdateThread.BGT
}
