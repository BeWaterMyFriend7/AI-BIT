plugins {
    id("java")
    id("org.jetbrains.intellij") version "1.17.4"
    id("org.jetbrains.kotlin.jvm") version "1.9.23"
}

group = "com.opencode.plugin"
version = "0.1.0"

repositories {
    mavenCentral()
}

dependencies {
    implementation("com.google.code.gson:gson:2.10.1")
}

intellij {
    version.set("2024.1")
    type.set("IC")
    plugins.set(listOf("terminal"))
}

kotlin {
    jvmToolchain(17)
}

tasks {
    patchPluginXml {
        sinceBuild.set("232")
        untilBuild.set("")
    }
}
