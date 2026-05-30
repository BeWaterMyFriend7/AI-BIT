package com.opencode.plugin

import java.io.*

object OpencodeCliRunner {

    fun isOpencodeInstalled(): Boolean {
        return try {
            val proc = ProcessBuilder(opencodePath(), "--version")
                .redirectErrorStream(true)
                .start()
            proc.waitFor()
            proc.exitValue() == 0
        } catch (e: Exception) {
            false
        }
    }

    fun runOpencode(
        prompt: String,
        files: List<String> = emptyList(),
        stdinContent: String? = null,
        cwd: File = File(System.getProperty("user.dir"))
    ): Process {
        val args = mutableListOf<String>()
        args.add(opencodePath())
        args.add("run")
        files.forEach { args.addAll(listOf("-f", it)) }
        args.add(prompt)

        val pb = ProcessBuilder(args)
            .directory(cwd)
            .redirectErrorStream(true)

        val proc = pb.start()

        if (stdinContent != null) {
            proc.outputStream.bufferedWriter().use {
                it.write(stdinContent)
                it.flush()
            }
        }

        return proc
    }

    fun getSessions(): List<String> {
        val proc = ProcessBuilder(opencodePath(), "session", "list")
            .redirectErrorStream(true)
            .start()
        val output = proc.inputStream.bufferedReader().readText()
        proc.waitFor()
        // Skip header and separator lines, extract first column (session ID)
        return output.lines().drop(2)
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .mapNotNull { line -> line.split("\\s+".toRegex()).firstOrNull() }
    }

    fun exportSession(sessionId: String): String? {
        return try {
            val proc = ProcessBuilder(opencodePath(), "export", sessionId)
                .redirectErrorStream(true)
                .start()
            val output = proc.inputStream.bufferedReader().readText()
            proc.waitFor()
            if (proc.exitValue() != 0) return null
            // Strip "Exporting session: xxx" status line, extract JSON
            val jsonStart = output.indexOf('{')
            if (jsonStart == -1) null else output.substring(jsonStart)
        } catch (e: Exception) {
            null
        }
    }

    fun opencodePath(): String {
        return OpencodeSettings.getInstance().getOpencodePath()
    }

    fun writeTempFile(content: String, prefix: String): File {
        val tmpDir = File(System.getProperty("java.io.tmpdir"), "intellij-opencode")
        tmpDir.mkdirs()
        val file = File(tmpDir, "${prefix}-${System.currentTimeMillis()}.txt")
        file.writeText(content, Charsets.UTF_8)
        return file
    }
}
