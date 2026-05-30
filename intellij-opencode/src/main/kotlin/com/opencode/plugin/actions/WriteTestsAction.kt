package com.opencode.plugin.actions

import com.opencode.plugin.OpencodeSettings

class WriteTestsAction : BaseOpencodeAction("") {
    override fun buildPrompt(selectedText: String?, files: List<java.io.File>): String {
        val prompts = OpencodeSettings.getInstance().getSystemPrompts()
        val unitTest = prompts.find { it.name == "单测" }
        return unitTest?.prompt ?: "为如下代码写单测"
    }
}
