package com.opencode.idea.settings

import com.intellij.openapi.options.Configurable
import com.intellij.ui.ToolbarDecorator
import com.intellij.ui.table.JBTable
import javax.swing.JComponent
import javax.swing.JPanel
import javax.swing.JTextField
import javax.swing.table.DefaultTableModel
import java.awt.BorderLayout
import java.awt.GridBagConstraints
import java.awt.GridBagLayout

class OpenCodeSettingsConfigurable : Configurable {
    private var panel: JPanel? = null
    private var executablePathField: JTextField? = null
    private var portField: JTextField? = null
    private var presetTable: JBTable? = null
    private var tableModel: DefaultTableModel? = null

    override fun getDisplayName(): String = "OpenCode"

    override fun createComponent(): JComponent {
        val settings = OpenCodeSettings.getInstance()

        panel = JPanel(GridBagLayout())
        val gbc = GridBagConstraints()
        gbc.fill = GridBagConstraints.HORIZONTAL
        gbc.gridx = 0
        gbc.weightx = 1.0

        // Section 1: Basic settings
        val basicPanel = JPanel(GridBagLayout())
        basicPanel.border = javax.swing.border.TitledBorder("基本设置")

        executablePathField = JTextField(settings.executablePath, 30)

        val bg1 = GridBagConstraints()
        bg1.gridx = 0; bg1.gridy = 0; bg1.anchor = GridBagConstraints.WEST
        basicPanel.add(javax.swing.JLabel("opencode 路径:"), bg1)
        bg1.gridx = 1; bg1.weightx = 1.0; bg1.fill = GridBagConstraints.HORIZONTAL
        basicPanel.add(executablePathField, bg1)

        portField = JTextField(settings.port.toString(), 10)
        bg1.gridx = 0; bg1.gridy = 1; bg1.weightx = 0.0; bg1.fill = GridBagConstraints.NONE
        basicPanel.add(javax.swing.JLabel("端口号:"), bg1)
        bg1.gridx = 1; bg1.weightx = 1.0; bg1.fill = GridBagConstraints.HORIZONTAL
        basicPanel.add(portField, bg1)

        gbc.gridy = 0
        panel!!.add(basicPanel, gbc)

        // Section 2: Prompt presets
        val presetPanel = JPanel(BorderLayout())
        presetPanel.border = javax.swing.border.TitledBorder("提示词预设")

        tableModel = object : DefaultTableModel(arrayOf("名称", "提示词内容"), 0) {
            override fun isCellEditable(row: Int, column: Int): Boolean = true
        }
        for (preset in settings.promptPresets) {
            tableModel!!.addRow(arrayOf(preset.label, preset.prompt))
        }

        presetTable = JBTable(tableModel)
        val decorator = ToolbarDecorator.createDecorator(presetTable)
            .setAddAction { tableModel!!.addRow(arrayOf("", "")) }
        presetPanel.add(decorator.createPanel(), BorderLayout.CENTER)

        gbc.gridy = 1; gbc.fill = GridBagConstraints.BOTH; gbc.weighty = 1.0
        panel!!.add(presetPanel, gbc)

        return panel!!
    }

    override fun isModified(): Boolean {
        val settings = OpenCodeSettings.getInstance()
        if (executablePathField!!.text != settings.executablePath) return true
        if (portField!!.text != settings.port.toString()) return true
        if (tableModel!!.rowCount != settings.promptPresets.size) return true
        for (i in 0 until tableModel!!.rowCount) {
            if (tableModel!!.getValueAt(i, 0) != settings.promptPresets.getOrNull(i)?.label) return true
            if (tableModel!!.getValueAt(i, 1) != settings.promptPresets.getOrNull(i)?.prompt) return true
        }
        return false
    }

    override fun apply() {
        val settings = OpenCodeSettings.getInstance()
        settings.executablePath = executablePathField!!.text
        settings.port = portField!!.text.toIntOrNull() ?: 0

        settings.promptPresets.clear()
        for (i in 0 until tableModel!!.rowCount) {
            val label = tableModel!!.getValueAt(i, 0) as? String ?: ""
            val prompt = tableModel!!.getValueAt(i, 1) as? String ?: ""
            if (label.isNotEmpty() || prompt.isNotEmpty()) {
                settings.promptPresets.add(PromptPreset(label, prompt))
            }
        }
    }

    override fun reset() {
        val settings = OpenCodeSettings.getInstance()
        executablePathField!!.text = settings.executablePath
        portField!!.text = settings.port.toString()

        tableModel!!.rowCount = 0
        for (preset in settings.promptPresets) {
            tableModel!!.addRow(arrayOf(preset.label, preset.prompt))
        }
    }
}
