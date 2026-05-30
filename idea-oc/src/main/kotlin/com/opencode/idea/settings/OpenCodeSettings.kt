package com.opencode.idea.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.*
import com.intellij.util.xmlb.XmlSerializerUtil

data class PromptPreset(
    var label: String = "",
    var prompt: String = ""
)

@State(
    name = "OpenCodeSettings",
    storages = [Storage("opencode.xml")]
)
@Service(Service.Level.APP)
class OpenCodeSettings : PersistentStateComponent<OpenCodeSettings> {
    var executablePath: String = "opencode"
    var port: Int = 0
    var promptPresets: MutableList<PromptPreset> = mutableListOf(
        PromptPreset("单测", "为如下代码写单测：\n"),
        PromptPreset("优化", "优化如下代码：\n")
    )

    override fun getState(): OpenCodeSettings = this

    override fun loadState(state: OpenCodeSettings) {
        XmlSerializerUtil.copyBean(state, this)
    }

    companion object {
        fun getInstance(): OpenCodeSettings {
            return ApplicationManager.getApplication().getService(OpenCodeSettings::class.java)
        }
    }
}
