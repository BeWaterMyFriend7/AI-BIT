package com.opencode.idea

import com.intellij.openapi.actionSystem.*
import com.intellij.openapi.editor.Editor
import com.opencode.idea.settings.OpenCodeSettings

class PromptPresetAction {

    class UnitTestAction : AnAction() {
        override fun actionPerformed(e: AnActionEvent) {
            sendPreset(e, "单测")
        }

        override fun update(e: AnActionEvent) {
            val editor = e.getData(CommonDataKeys.EDITOR)
            e.presentation.isEnabled = editor != null && editor.selectionModel.hasSelection()
        }
    }

    class OptimizeAction : AnAction() {
        override fun actionPerformed(e: AnActionEvent) {
            sendPreset(e, "优化")
        }

        override fun update(e: AnActionEvent) {
            val editor = e.getData(CommonDataKeys.EDITOR)
            e.presentation.isEnabled = editor != null && editor.selectionModel.hasSelection()
        }
    }

    companion object {
        private fun sendPreset(e: AnActionEvent, presetLabel: String) {
            val project = e.project ?: return
            val editor: Editor = e.getData(CommonDataKeys.EDITOR) ?: return
            val selectionModel = editor.selectionModel
            if (!selectionModel.hasSelection()) return

            val text = selectionModel.selectedText ?: return
            val settings = OpenCodeSettings.getInstance()
            val preset = settings.promptPresets.find { it.label == presetLabel } ?: return

            val content = preset.prompt + text
            val runner = OpenCodeTerminalRunner.getInstance(project)
            runner.sendText(content + "\n") // auto-enter
        }
    }
}
