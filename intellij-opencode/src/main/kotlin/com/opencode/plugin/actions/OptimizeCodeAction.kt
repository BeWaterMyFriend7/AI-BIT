package com.opencode.plugin.actions

import com.opencode.plugin.OpencodeSettings

class OptimizeCodeAction : BaseOpencodeAction("") {
    override fun buildPrompt(selectedText: String?, files: List<java.io.File>): String {
        val prompts = OpencodeSettings.getInstance().getSystemPrompts()
        val optimize = prompts.find { it.name == "优化" }
        return optimize?.prompt ?: "优化如下代码"
    }
}
