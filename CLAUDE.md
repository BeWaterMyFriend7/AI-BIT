# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo overview

AI-BIT 是一个 monorepo，用来存放 AI 编写的小项目。每个项目是一个独立子目录，彼此无依赖关系。README.md 中维护项目列表和简介。

## 项目列表

### chrome-extension-remember-link（链接收藏管理器）

面向内网环境的 Chrome 浏览器插件，一键保存/导入所有窗口的标签页链接，支持去重，支持保存到文本文件或书签文件夹。

- **类型**: Chrome Extension (Manifest V3)
- **入口文件**: `manifest.json`
- **加载方式**: Chrome `chrome://extensions/` → 开发者模式 → 加载已解压的扩展程序
- **无需构建**: 纯 vanilla JS，直接加载目录即可运行

#### 架构

- `background.js` — Service Worker，处理所有 chrome.* API 调用（tabs, downloads, bookmarks）。popup 通过 `chrome.runtime.sendMessage` 发送 action 到 background，background 执行后返回结果
- `popup.html` — 插件弹窗 UI（含全部 CSS），380px 宽，单文件内联样式
- `popup.js` — 弹窗交互逻辑，管理 UI 状态（save/import panel 切换、文件选择、链接预览），通过 `sendMessage()` 封装调用 background

#### 通信协议

popup 与 background 之间通过 message passing 通信，所有消息格式：

```
{ action: '<actionName>', ...params } → background 处理后返回结果
```

支持的 action:
- `getAllTabs` — 获取所有窗口的 HTTP/HTTPS 标签页（去重）
- `saveToFile` — 将链接保存为 .txt 下载
- `saveToBookmark` — 将链接保存到指定书签文件夹（跳过已存在的 URL）
- `importFromBookmark` — 从书签文件夹读取链接并在新标签页打开
- `getSavedLinksCount` — 获取指定书签文件夹中的链接数量

#### 权限

- `tabs` — 读取标签页信息
- `downloads` — 下载 .txt 文件
- `storage` — 预留（当前未使用）
- `bookmarks` — 读写书签
- `host_permissions: <all_urls>` — 读取所有标签页 URL

#### 注意事项

- 项目内无构建工具、无测试、无 linter
- 书签默认使用 `tmp` 文件夹，通过 UI 可自定义
- `require.md` 是原始需求文档，非代码
- 新项目应在此 repo 根目录下创建独立子目录
