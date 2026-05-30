package com.opencode.plugin.actions

import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.opencode.plugin.OpencodeTerminalService
import java.io.File

abstract class BaseOpencodeAction(
    private val promptTemplate: String
) : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.getRequiredData(CommonDataKeys.PROJECT)
        val editor = e.getData(CommonDataKeys.EDITOR)
        val selectedText = editor?.selectionModel?.selectedText

        if (selectedText.isNullOrBlank()) {
            return
        }

        val prompt = buildPrompt(selectedText, emptyList())

        ApplicationManager.getApplication().executeOnPooledThread {
            val tempFile = com.opencode.plugin.OpencodeCliRunner.writeTempFile(selectedText, "selection")
            ApplicationManager.getApplication().invokeLater {
                val svc = OpencodeTerminalService.getInstance(project)
                svc.getOrCreate()
                svc.sendText("$prompt\n(代码文件: ${tempFile.absolutePath})")
            }
        }
    }

    protected open fun buildPrompt(selectedText: String?, files: List<File>): String {
        return promptTemplate
    }

    override fun update(e: AnActionEvent) {
        val editor = e.getData(CommonDataKeys.EDITOR)
        val virtualFile = e.getData(CommonDataKeys.VIRTUAL_FILE)
        val hasSelection = editor?.selectionModel?.hasSelection() == true
        val hasFile = virtualFile != null
        e.presentation.isEnabledAndVisible = hasSelection || hasFile
    }

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT
}
