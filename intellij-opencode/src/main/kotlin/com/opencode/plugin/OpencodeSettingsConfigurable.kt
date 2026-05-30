package com.opencode.plugin

import com.intellij.openapi.options.Configurable
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.components.JBTextArea
import com.intellij.util.ui.FormBuilder
import javax.swing.*

class OpencodeSettingsConfigurable : Configurable {

    private var component: JPanel? = null
    private val opencodePathField = JTextField(40)
    private val modelField = JTextField(20)
    private val promptsArea = JBTextArea(10, 50).apply {
        lineWrap = true
        wrapStyleWord = true
    }

    override fun getDisplayName(): String = "Opencode"

    override fun createComponent(): JComponent {
        val panel = FormBuilder.createFormBuilder()
            .addLabeledComponent("Opencode 路径:", opencodePathField)
            .addLabeledComponent("默认模型:", modelField)
            .addLabeledComponent("系统提示词 (每行一个, 格式: 名称:提示词):", JBScrollPane(promptsArea))
            .addComponentFillVertically(JPanel(), 0)
            .panel

        component = panel
        return panel
    }

    override fun isModified(): Boolean {
        val settings = OpencodeSettings.getInstance()
        val appComponent = component ?: return false
        return opencodePathField.text != settings.getOpencodePath()
                || modelField.text != settings.getDefaultModel()
                || promptsArea.text != promptsToText(settings.getSystemPrompts())
    }

    override fun apply() {
        val settings = OpencodeSettings.getInstance()
        settings.state.opencodePath = opencodePathField.text
        settings.state.defaultModel = modelField.text
        settings.state.systemPrompts.clear()
        parsePrompts(promptsArea.text).forEach { (name, prompt) ->
            settings.state.systemPrompts.add(OpencodeSettings.SystemPrompt(name, prompt))
        }
    }

    override fun reset() {
        val settings = OpencodeSettings.getInstance()
        opencodePathField.text = settings.getOpencodePath()
        modelField.text = settings.getDefaultModel()
        promptsArea.text = promptsToText(settings.getSystemPrompts())
    }

    override fun disposeUIResources() {
        component = null
    }

    private fun promptsToText(prompts: List<OpencodeSettings.SystemPrompt>): String {
        return prompts.joinToString("\n") { "${it.name}: ${it.prompt}" }
    }

    private fun parsePrompts(text: String): List<Pair<String, String>> {
        return text.lines()
            .map { it.trim() }
            .filter { it.contains(":") }
            .map { line ->
                val idx = line.indexOf(':')
                Pair(line.substring(0, idx).trim(), line.substring(idx + 1).trim())
            }
    }
}
