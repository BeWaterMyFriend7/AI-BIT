package com.opencode.plugin

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage

@State(
    name = "OpencodePluginSettings",
    storages = [Storage("opencodePluginSettings.xml")]
)
class OpencodeSettings : PersistentStateComponent<OpencodeSettings.State> {

    data class State(
        var opencodePath: String = "opencode",
        var defaultModel: String = "",
        var systemPrompts: MutableList<SystemPrompt> = mutableListOf(
            SystemPrompt("单测", "为如下代码写单测"),
            SystemPrompt("优化", "优化如下代码")
        )
    )

    data class SystemPrompt(
        var name: String = "",
        var prompt: String = ""
    )

    private var state = State()

    override fun getState(): State = state

    override fun loadState(state: State) {
        this.state = state
    }

    fun getOpencodePath(): String = state.opencodePath
    fun getDefaultModel(): String = state.defaultModel
    fun getSystemPrompts(): List<SystemPrompt> = state.systemPrompts

    companion object {
        fun getInstance(): OpencodeSettings =
            ApplicationManager.getApplication().getService(OpencodeSettings::class.java)
    }
}
