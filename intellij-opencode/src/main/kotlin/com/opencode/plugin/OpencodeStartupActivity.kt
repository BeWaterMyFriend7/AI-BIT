package com.opencode.plugin

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.StartupActivity

class OpencodeStartupActivity : StartupActivity {

    override fun runActivity(project: Project) {
        // Check opencode installed
        ApplicationManager.getApplication().executeOnPooledThread {
            val installed = OpencodeCliRunner.isOpencodeInstalled()
            ApplicationManager.getApplication().invokeLater {
                if (!installed) {
                    notify("Opencode 未安装",
                        "请在 Settings → Tools → Opencode 中配置 opencode 路径",
                        NotificationType.WARNING, project)
                }
            }
        }

        // Check terminal scroll setting (pitfall #2)
        checkTerminalScrollSetting(project)
    }

    private fun checkTerminalScrollSetting(project: Project) {
        try {
            val propertiesComponent = com.intellij.ide.util.PropertiesComponent.getInstance()
            val useHistory = propertiesComponent.getBoolean(
                "terminal.use.scroll.to.navigate.command.history", true
            )
            if (useHistory) {
                notify("终端滚轮提示",
                    "当前终端配置为滚轮翻动命令历史。\n建议 Settings → Tools → Terminal 中取消勾选对应选项。",
                    NotificationType.INFORMATION, project)
            }
        } catch (_: Exception) { }
    }

    private fun notify(title: String, content: String, type: NotificationType, project: Project) {
        NotificationGroupManager.getInstance()
            .getNotificationGroup("Opencode Notifications")
            ?.createNotification(title, content, type)
            ?.notify(project)
    }
}
