# SkillBridge — 本地 Agent Skill 共享管理器

## 技术选型

| 层次 | 方案 |
|------|------|
| 后端 | Python FastAPI + Jinja2 模板 |
| 数据库 | SQLite (Python 内置 sqlite3，无需额外安装) |
| 前端 | 服务端渲染 (Jinja2) + 原生 CSS + fetch JSON API |
| 系统操作 | PowerShell 子进程 (os.subprocess) |
| 通信 | 仅本机 127.0.0.1:17890 |

## 架构

```
浏览器 → FastAPI 服务
  │
  ├── HTML 页面路由 (Jinja2 渲染)
  ├── JSON API 端点 (异步操作)
  ├── SQLite (Agent 配置 + 操作日志 + 扫描缓存)
  ├── 文件系统扫描引擎
  └── PowerShell 适配器 (Junction 创建/删除/识别)
```

## 页面设计

| 页面 | 路由 | 说明 |
|------|------|------|
| Skill 总览 | `GET /` | 主页面，Skill × Agent 状态矩阵，搜索筛选 |
| Agent 配置 | `GET /settings` | 新增/编辑/启用/停用 Agent |
| Skill 详情 | `GET /skills/{id}` | 查看 Skill 详细信息与各 Agent 实例状态 |
| 操作记录 | `GET /logs` | 操作审计日志列表 |
| 冲突处理 | 弹窗模态框 | 内嵌在总览页，不单独成页 |

### 主页面布局

```
┌──────────────────────────────────────────────────────────────┐
│ SkillBridge  [搜索...] [全部状态▼] [重新扫描] [⚙ 设置]      │
├──────────────────────────────────────────────────────────────┤
│ Skill Name           Codex    OpenCode   Claude Code         │
├──────────────────────────────────────────────────────────────┤
│ semantic-merge-rev   [源 🔒]  [共享 ✓]   [未启用 ○]         │
│ superpowers          [本地 ●] [冲突 !]   [共享 ✓]           │
│ experimental-skill   [未启用 ○][断链 ✗]  [未启用 ○]         │
└──────────────────────────────────────────────────────────────┘
```

### Agent 状态图标

| 状态 | 图标 | 点击行为 |
|------|------|----------|
| SOURCE_LOCAL | 绿色实心 + 锁 | 打开详情，不可直接关闭 |
| SHARED_LINK | 绿色勾选 | 弹出取消确认，确认后移除 Junction |
| MISSING | 灰色空心 | 创建 Junction，启用共享 |
| LOCAL_COPY | 蓝色实心 | 选择保留或备份后转共享 |
| CONFLICT | 橙色感叹号 | 进入冲突处理 |
| BROKEN_LINK | 红色叉号 | 重新指定源或删除断链 |
| INVALID | 灰红色禁用 | 查看错误详情 |

## API 设计

### HTML 页面路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | Skill 总览矩阵页 |
| GET | `/settings` | Agent 配置页 |
| GET | `/skills/{id}` | Skill 详情页 |
| GET | `/logs` | 操作记录页 |

### JSON API (异步操作)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agents` | 查询 Agent 列表 |
| POST | `/api/agents` | 新增 Agent |
| PUT | `/api/agents/{id}` | 编辑 Agent |
| DELETE | `/api/agents/{id}` | 删除 Agent |
| POST | `/api/scan` | 触发重新扫描 |
| GET | `/api/skills` | 获取 Skill 矩阵数据 |
| GET | `/api/skills/{id}` | 获取 Skill 详情 |
| POST | `/api/skills/{id}/share` | 为目标 Agent 启用共享 |
| DELETE | `/api/skills/{id}/share/{agentId}` | 取消共享 |
| POST | `/api/skills/{id}/source` | 选择/迁移源 |
| GET | `/api/operations` | 操作日志列表 |
| POST | `/api/operations/{id}/rollback` | 回滚操作 |

## 数据模型

### SQLite 表

| 表 | 关键字段 |
|---|---|
| `agents` | id, name, skill_root, icon, enabled, ignore_patterns, created_at, updated_at |
| `scan_cache` | id, agent_id, skill_name, path, entry_type, resolved_target, fingerprint, state, errors |
| `source_selections` | skill_name, source_agent_id, source_path, created_at |
| `operations` | id, action, skill_name, agent_id, status, backup_path, error, created_at |

### 实体关系

- `agents` 独立存储，用户配置驱动
- `scan_cache` 每次扫描后清空重建，文件系统是状态真实来源
- `source_selections` 记录每个 Skill 用户选择的源目录
- `operations` 只追加，不修改历史记录

## 项目结构

```
skill-share/
├── main.py                    # 程序入口，FastAPI 应用
├── requirements.txt           # 依赖
├── skillbridge/
│   ├── __init__.py
│   ├── config.py              # 配置常量
│   ├── database.py            # SQLite 初始化与操作
│   ├── models.py              # Pydantic 数据模型
│   ├── routes.py              # FastAPI 路由
│   ├── scanner.py             # 文件系统目录扫描
│   ├── catalog.py             # Skill 聚合与状态判定
│   ├── sharing.py             # 共享启用/停用编排
│   ├── platform/
│   │   ├── __init__.py
│   │   └── windows.py         # PowerShell Junction 适配器
│   ├── security.py            # 路径校验、会话令牌
│   ├── templates/             # Jinja2 页面模板
│   │   ├── base.html          # 布局骨架
│   │   ├── index.html         # 矩阵总览页
│   │   ├── settings.html      # Agent 配置页
│   │   ├── skill_detail.html  # Skill 详情页
│   │   └── logs.html          # 操作日志页
│   └── static/
│       └── style.css          # 样式
└── require.md
```

## 安全规则

- 服务只监听 `127.0.0.1`
- 所有路径参数需规范化校验，确认在已配置的 Agent 根目录或备份目录内
- 取消共享只删除已验证的 Junction，真实目录必须走备份流程
- PowerShell 参数通过安全参数传递，不拼接未转义用户输入
- 每个修改操作写审计日志

## 文件操作规则

### 启用共享
1. 校验源目录存在且有效
2. 目标路径不存在 → 直接创建 Junction
3. 目标已指向正确源 → 幂等成功
4. 目标是其他 Junction/断链 → 移除后重建
5. 目标是真实目录 → 备份后创建 Junction

### 取消共享
1. 确认目标为 ReparsePoint/Junction
2. 解析指向当前源
3. 只删除 Junction，不删源目录

### 备份规则
备份目录: `<agent-root>\skillbridge-backups\<yyyyMMdd-HHmmss>\<skill-name>\`
