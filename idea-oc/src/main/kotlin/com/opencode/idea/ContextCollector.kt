package com.opencode.idea

import com.intellij.openapi.actionSystem.*
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile

class ContextCollector {

    class SendSelectedTextAction : AnAction() {
        override fun actionPerformed(e: AnActionEvent) {
            val project = e.project ?: return
            val editor: Editor = e.getData(CommonDataKeys.EDITOR) ?: return
            val selectionModel = editor.selectionModel
            if (!selectionModel.hasSelection()) return

            val text = selectionModel.selectedText ?: return
            val runner = OpenCodeTerminalRunner.getInstance(project)
            runner.sendText(text)
        }

        override fun update(e: AnActionEvent) {
            val editor = e.getData(CommonDataKeys.EDITOR)
            e.presentation.isEnabled = editor != null && editor.selectionModel.hasSelection()
        }
    }

    class SendFilePathAction : AnAction() {
        override fun actionPerformed(e: AnActionEvent) {
            val project = e.project ?: return
            val files: Array<VirtualFile> = e.getData(CommonDataKeys.VIRTUAL_FILE_ARRAY) ?: return

            val paths = files.joinToString("\n") { it.path }
            val runner = OpenCodeTerminalRunner.getInstance(project)
            runner.sendText(paths)
        }
    }
}
