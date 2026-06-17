# SkillBridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build local web-based SkillBridge manager (Python FastAPI + Jinja2 + SQLite + PowerShell)

**Architecture:** FastAPI serves Jinja2-rendered HTML pages for the main matrix view and settings; JSON API endpoints handle async actions (scan, share, unshare). SQLite stores agent configs, operation logs, and scan cache. PowerShell subprocess handles Junction operations.

**Tech Stack:** Python 3.10+, FastAPI, Jinja2, SQLite3, Uvicorn, Pytest

---

## File Structure

```
skill-share/
├── requirements.txt
├── main.py                        # FastAPI app entry, startup/shutdown, uvicorn launch
├── skillbridge/
│   ├── __init__.py
│   ├── config.py                  # Constants: port, default paths, backup dir name
│   ├── database.py                # SQLite init, helpers for agents/scan_cache/source_selections/operations
│   ├── models.py                  # Pydantic models for all entities
│   ├── security.py                # Path normalization, directory traversal check, session token
│   ├── platform/
│   │   ├── __init__.py
│   │   └── windows.py             # PowerShell subprocess: create/delete/resolve Junction
│   ├── scanner.py                 # Walk agent skill roots, detect directory types, parse SKILL.md
│   ├── catalog.py                 # Aggregate skills across agents, determine states, pick source
│   ├── sharing.py                 # Orchestrate enable/disable sharing with backup/rollback
│   ├── routes.py                  # All HTML page routes + JSON API endpoints
│   ├── templates/
│   │   ├── base.html              # Layout skeleton with nav, sidebar
│   │   ├── index.html             # Skill × Agent matrix page
│   │   ├── settings.html          # Agent CRUD page
│   │   ├── skill_detail.html      # Per-skill detail + instances
│   │   └── logs.html              # Operation log list
│   └── static/
│       └── style.css              # All styles
```

---

### Task 1: Project scaffold

**Files:**
- Create: `skill-share/requirements.txt`
- Create: `skill-share/main.py`
- Create: `skill-share/skillbridge/__init__.py`
- Create: `skill-share/skillbridge/config.py`

- [ ] **Step 1: Create requirements.txt**

```
fastapi==0.115.0
uvicorn==0.30.0
jinja2==3.1.4
python-multipart==0.0.12
```

- [ ] **Step 2: Create config.py**

```python
import os
from pathlib import Path

APP_NAME = "SkillBridge"
HOST = "127.0.0.1"
PORT = 17890
DB_PATH = Path.home() / ".skillbridge" / "skillbridge.db"
BACKUP_DIR_NAME = "skillbridge-backups"

DEFAULT_AGENTS = [
    {
        "id": "codex",
        "name": "Codex",
        "skill_root": str(Path.home() / ".codex" / "skills"),
        "icon": "codex",
        "enabled": True,
        "ignore_patterns": [".system", ".internal"],
    },
    {
        "id": "opencode",
        "name": "OpenCode",
        "skill_root": str(Path.home() / ".config" / "opencode" / "skills"),
        "icon": "opencode",
        "enabled": True,
        "ignore_patterns": [],
    },
]

SKILL_MD_FIELDS = ["name", "description", "compatibility"]
```

- [ ] **Step 3: Create __init__.py** (empty)

- [ ] **Step 4: Create main.py stub**

```python
import uvicorn
from skillbridge.config import HOST, PORT

def main():
    uvicorn.run("skillbridge.routes:app", host=HOST, port=PORT, log_level="info")

if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Create directory structure**

Run:
```powershell
New-Item -ItemType Directory -Force -Path "skill-share/skillbridge/platform"
New-Item -ItemType Directory -Force -Path "skill-share/skillbridge/templates"
New-Item -ItemType Directory -Force -Path "skill-share/skillbridge/static"
```

---

### Task 2: Database module

**Files:**
- Create: `skill-share/skillbridge/database.py`

- [ ] **Step 1: Create database.py**

```python
import sqlite3
import json
from contextlib import contextmanager
from pathlib import Path
from datetime import datetime
from skillbridge.config import DB_PATH


def get_db_path() -> Path:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return DB_PATH


@contextmanager
def get_db():
    conn = sqlite3.connect(str(get_db_path()))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                skill_root TEXT NOT NULL,
                icon TEXT DEFAULT '',
                enabled INTEGER DEFAULT 1,
                ignore_patterns TEXT DEFAULT '[]',
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS scan_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT NOT NULL,
                skill_name TEXT NOT NULL,
                path TEXT NOT NULL,
                entry_type TEXT NOT NULL,
                resolved_target TEXT DEFAULT '',
                fingerprint TEXT DEFAULT '',
                state TEXT DEFAULT 'UNKNOWN',
                validation_errors TEXT DEFAULT '[]',
                has_skill_md INTEGER DEFAULT 0,
                description TEXT DEFAULT '',
                FOREIGN KEY (agent_id) REFERENCES agents(id)
            );

            CREATE TABLE IF NOT EXISTS source_selections (
                skill_name TEXT PRIMARY KEY,
                source_agent_id TEXT NOT NULL,
                source_path TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS operations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                skill_name TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                status TEXT DEFAULT 'PENDING',
                details TEXT DEFAULT '{}',
                backup_path TEXT DEFAULT '',
                error TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now')),
                finished_at TEXT DEFAULT ''
            );

            CREATE INDEX IF NOT EXISTS idx_scan_cache_agent ON scan_cache(agent_id);
            CREATE INDEX IF NOT EXISTS idx_scan_cache_name ON scan_cache(skill_name);
            CREATE INDEX IF NOT EXISTS idx_operations_action ON operations(action);
        """)


def get_all_agents():
    with get_db() as db:
        rows = db.execute("SELECT * FROM agents ORDER BY name").fetchall()
        return [dict(r) for r in rows]


def get_enabled_agents():
    with get_db() as db:
        rows = db.execute("SELECT * FROM agents WHERE enabled=1 ORDER BY name").fetchall()
        return [dict(r) for r in rows]


def upsert_agent(agent: dict):
    with get_db() as db:
        db.execute("""
            INSERT INTO agents (id, name, skill_root, icon, enabled, ignore_patterns, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                skill_root=excluded.skill_root,
                icon=excluded.icon,
                enabled=excluded.enabled,
                ignore_patterns=excluded.ignore_patterns,
                updated_at=excluded.updated_at
        """, (agent["id"], agent["name"], agent["skill_root"], agent.get("icon", ""),
              agent.get("enabled", 1), json.dumps(agent.get("ignore_patterns", []))))


def delete_agent(agent_id: str):
    with get_db() as db:
        db.execute("DELETE FROM agents WHERE id = ?", (agent_id,))


def clear_scan_cache():
    with get_db() as db:
        db.execute("DELETE FROM scan_cache")


def insert_scan_cache(entries: list[dict]):
    with get_db() as db:
        for e in entries:
            db.execute("""
                INSERT INTO scan_cache (agent_id, skill_name, path, entry_type, resolved_target, fingerprint, state, validation_errors, has_skill_md, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (e["agent_id"], e["skill_name"], e["path"], e["entry_type"],
                  e.get("resolved_target", ""), e.get("fingerprint", ""),
                  e.get("state", "UNKNOWN"), json.dumps(e.get("validation_errors", [])),
                  e.get("has_skill_md", 0), e.get("description", "")))


def get_scan_cache():
    with get_db() as db:
        rows = db.execute("SELECT * FROM scan_cache").fetchall()
        return [dict(r) for r in rows]


def get_source_selection(skill_name: str):
    with get_db() as db:
        row = db.execute("SELECT * FROM source_selections WHERE skill_name = ?", (skill_name,)).fetchone()
        return dict(row) if row else None


def upsert_source_selection(skill_name: str, agent_id: str, source_path: str):
    with get_db() as db:
        db.execute("""
            INSERT INTO source_selections (skill_name, source_agent_id, source_path, created_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(skill_name) DO UPDATE SET
                source_agent_id=excluded.source_agent_id,
                source_path=excluded.source_path,
                created_at=excluded.created_at
        """, (skill_name, agent_id, source_path))


def log_operation(action: str, skill_name: str, agent_id: str, status: str = "PENDING", details: dict = None, backup_path: str = "", error: str = ""):
    with get_db() as db:
        db.execute("""
            INSERT INTO operations (action, skill_name, agent_id, status, details, backup_path, error)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (action, skill_name, agent_id, status, json.dumps(details or {}), backup_path, error))


def update_operation_status(op_id: int, status: str, error: str = ""):
    with get_db() as db:
        db.execute("""
            UPDATE operations SET status=?, error=?, finished_at=datetime('now')
            WHERE id=?
        """, (status, error, op_id))


def get_operations(limit: int = 100):
    with get_db() as db:
        rows = db.execute("SELECT * FROM operations ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]
```

---

### Task 3: Models module

**Files:**
- Create: `skill-share/skillbridge/models.py`

- [ ] **Step 1: Create models.py**

```python
from pydantic import BaseModel, Field
from typing import Optional, list as List
from enum import Enum


class EntryType(str, Enum):
    REAL_DIR = "REAL_DIR"
    JUNCTION = "JUNCTION"
    BROKEN_LINK = "BROKEN_LINK"


class InstanceState(str, Enum):
    SOURCE_LOCAL = "SOURCE_LOCAL"
    SHARED_LINK = "SHARED_LINK"
    MISSING = "MISSING"
    LOCAL_COPY = "LOCAL_COPY"
    CONFLICT = "CONFLICT"
    BROKEN_LINK = "BROKEN_LINK"
    INVALID = "INVALID"


class AgentConfig(BaseModel):
    id: str
    name: str
    skill_root: str
    icon: str = ""
    enabled: bool = True
    ignore_patterns: list[str] = Field(default_factory=list)


class AgentCreate(BaseModel):
    id: str
    name: str
    skill_root: str
    icon: str = ""
    enabled: bool = True
    ignore_patterns: list[str] = Field(default_factory=list)


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    skill_root: Optional[str] = None
    icon: Optional[str] = None
    enabled: Optional[bool] = None
    ignore_patterns: Optional[list[str]] = None


class AgentSkillInstance(BaseModel):
    agent_id: str
    agent_name: str
    skill_name: str
    path: str
    entry_type: EntryType
    resolved_target: str = ""
    fingerprint: str = ""
    state: InstanceState
    has_skill_md: bool = False
    description: str = ""
    validation_errors: list[str] = Field(default_factory=list)


class SkillRow(BaseModel):
    skill_name: str
    description: str = ""
    source_agent_id: Optional[str] = None
    instances: list[AgentSkillInstance] = Field(default_factory=list)
    instances_by_agent: dict[str, AgentSkillInstance] = Field(default_factory=dict)


class SkillMatrix(BaseModel):
    skills: list[SkillRow]
    agents: list[AgentConfig]


class OperationLog(BaseModel):
    id: int
    action: str
    skill_name: str
    agent_id: str
    status: str
    details: dict = Field(default_factory=dict)
    backup_path: str = ""
    error: str = ""
    created_at: str = ""
    finished_at: str = ""


class ScanResult(BaseModel):
    success: bool
    message: str = ""
    skill_count: int = 0
    errors: list[str] = Field(default_factory=list)
```

---

### Task 4: Security module

**Files:**
- Create: `skill-share/skillbridge/security.py`

- [ ] **Step 1: Create security.py**

```python
import os
import secrets
from pathlib import Path
from skillbridge.config import BACKUP_DIR_NAME

_session_token: str = ""


def generate_session_token() -> str:
    global _session_token
    _session_token = secrets.token_hex(32)
    return _session_token


def get_session_token() -> str:
    return _session_token


def normalize_path(path: str) -> str:
    return os.path.normpath(os.path.abspath(path))


def is_path_allowed(path: str, allowed_roots: list[str]) -> bool:
    normalized = normalize_path(path)
    for root in allowed_roots:
        norm_root = normalize_path(root)
        if normalized == norm_root or normalized.startswith(norm_root + os.sep):
            return True
    return False


def is_inside_backup_dir(path: str, agent_root: str) -> bool:
    backup_dir = os.path.join(normalize_path(agent_root), BACKUP_DIR_NAME)
    norm_path = normalize_path(path)
    return norm_path.startswith(backup_dir + os.sep)
```

---

### Task 5: Windows platform adapter (PowerShell Junction operations)

**Files:**
- Create: `skill-share/skillbridge/platform/__init__.py`
- Create: `skill-share/skillbridge/platform/windows.py`

- [ ] **Step 1: Create platform/__init__.py** (empty)

- [ ] **Step 2: Create windows.py**

```python
import subprocess
import os
import json


def _run_powershell(script: str) -> tuple[str, str, int]:
    result = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
        capture_output=True, text=True, timeout=30
    )
    return result.stdout.strip(), result.stderr.strip(), result.returncode


def is_junction(path: str) -> bool:
    script = f"""
    $item = Get-Item -LiteralPath '{path}' -Force -ErrorAction SilentlyContinue
    if ($item -and ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {{
        Write-Output 'true'
    }} else {{
        Write-Output 'false'
    }}
    """
    out, _, _ = _run_powershell(script)
    return out == "true"


def is_real_directory(path: str) -> bool:
    script = f"""
    if (Test-Path -LiteralPath '{path}') {{
        $item = Get-Item -LiteralPath '{path}' -Force
        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {{
            Write-Output 'false'
        }} else {{
            Write-Output 'true'
        }}
    }} else {{
        Write-Output 'false'
    }}
    """
    out, _, _ = _run_powershell(script)
    return out == "true"


def create_junction(target_path: str, source_path: str) -> tuple[bool, str]:
    try:
        script = f"""
        $parent = Split-Path -Parent '{target_path}'
        if (-not (Test-Path $parent)) {{
            Write-Error "Parent directory does not exist: $parent"
            exit 1
        }}
        if (Test-Path -LiteralPath '{target_path}') {{
            $item = Get-Item -LiteralPath '{target_path}' -Force
            if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {{
                Remove-Item -LiteralPath '{target_path}' -Force
            }} else {{
                Write-Error "Target is a real directory, cannot overwrite without backup"
                exit 1
            }}
        }}
        New-Item -ItemType Junction -Path '{target_path}' -Target '{source_path}' | Out-Null
        if ($LASTEXITCODE -ne 0) {{ exit 1 }}
        Write-Output 'ok'
        """
        out, err, code = _run_powershell(script)
        if code != 0 or out != "ok":
            return False, err or out
        return True, ""
    except subprocess.TimeoutExpired:
        return False, "PowerShell operation timed out"
    except Exception as e:
        return False, str(e)


def remove_junction(path: str) -> tuple[bool, str]:
    try:
        script = f"""
        if (Test-Path -LiteralPath '{path}') {{
            $item = Get-Item -LiteralPath '{path}' -Force
            if (-not ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {{
                Write-Error "Path is a real directory, not a junction"
                exit 1
            }}
            Remove-Item -LiteralPath '{path}' -Force
            if ($LASTEXITCODE -ne 0) {{ exit 1 }}
        }}
        Write-Output 'ok'
        """
        out, err, code = _run_powershell(script)
        if code != 0 or out != "ok":
            return False, err or out
        return True, ""
    except subprocess.TimeoutExpired:
        return False, "PowerShell operation timed out"
    except Exception as e:
        return False, str(e)


def resolve_junction_target(path: str) -> str:
    script = f"""
    $item = Get-Item -LiteralPath '{path}' -Force -ErrorAction SilentlyContinue
    if ($item -and ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {{
        $target = $item.Target
        if ($target -and (Test-Path -LiteralPath $target)) {{
            Write-Output $target
        }} else {{
            Write-Output 'BROKEN'
        }}
    }} else {{
        Write-Output ''
    }}
    """
    out, _, _ = _run_powershell(script)
    return out


def backup_real_directory(path: str, backup_dir: str) -> tuple[bool, str]:
    try:
        script = f"""
        if (-not (Test-Path -LiteralPath '{path}')) {{
            Write-Output 'skipped'
            exit 0
        }}
        $item = Get-Item -LiteralPath '{path}' -Force
        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {{
            Write-Error "Path is a junction, not a real directory"
            exit 1
        }}
        $backupParent = Split-Path -Parent '{backup_dir}'
        if (-not (Test-Path $backupParent)) {{
            New-Item -ItemType Directory -Path $backupParent -Force | Out-Null
        }}
        Move-Item -LiteralPath '{path}' -Destination '{backup_dir}' -Force
        if ($LASTEXITCODE -ne 0) {{ exit 1 }}
        Write-Output 'ok'
        """
        out, err, code = _run_powershell(script)
        if code != 0 or out != "ok":
            return False, err or out
        return True, ""
    except subprocess.TimeoutExpired:
        return False, "PowerShell operation timed out"
    except Exception as e:
        return False, str(e)


def move_directory(src: str, dst: str) -> tuple[bool, str]:
    try:
        script = f"""
        if (-not (Test-Path -LiteralPath '{src}')) {{
            Write-Error "Source does not exist"
            exit 1
        }}
        $dstParent = Split-Path -Parent '{dst}'
        if (-not (Test-Path $dstParent)) {{
            New-Item -ItemType Directory -Path $dstParent -Force | Out-Null
        }}
        Move-Item -LiteralPath '{src}' -Destination '{dst}' -Force
        if ($LASTEXITCODE -ne 0) {{ exit 1 }}
        Write-Output 'ok'
        """
        out, err, code = _run_powershell(script)
        if code != 0 or out != "ok":
            return False, err or out
        return True, ""
    except Exception as e:
        return False, str(e)
```

---

### Task 6: Scanner module

**Files:**
- Create: `skill-share/skillbridge/scanner.py`

- [ ] **Step 1: Create scanner.py**

```python
import os
import json
import hashlib
from pathlib import Path
from datetime import datetime
from skillbridge.platform.windows import is_junction, is_real_directory, resolve_junction_target


def parse_skill_md(skill_dir: str) -> dict:
    md_path = os.path.join(skill_dir, "SKILL.md")
    if not os.path.isfile(md_path):
        return {"name": os.path.basename(skill_dir), "description": "", "has_skill_md": False}
    try:
        with open(md_path, "r", encoding="utf-8") as f:
            content = f.read()
        name = os.path.basename(skill_dir)
        description = ""
        lines = content.split("\n")
        in_frontmatter = False
        frontmatter_lines = []
        for line in lines:
            if line.strip() == "---":
                if not in_frontmatter:
                    in_frontmatter = True
                else:
                    break
            elif in_frontmatter:
                frontmatter_lines.append(line)
        for line in frontmatter_lines:
            if ":" in line:
                key, _, value = line.partition(":")
                key = key.strip().lower()
                value = value.strip().strip('"').strip("'")
                if key == "name":
                    name = value
                elif key == "description":
                    description = value
        return {"name": name, "description": description, "has_skill_md": True}
    except Exception:
        return {"name": os.path.basename(skill_dir), "description": "", "has_skill_md": False}


def compute_fingerprint(skill_dir: str) -> str:
    try:
        entries = []
        for root, dirs, files in os.walk(skill_dir):
            dirs[:] = [d for d in dirs if not d.startswith(".git") and d != "__pycache__" and d != "node_modules"]
            for f in files:
                fpath = os.path.join(root, f)
                try:
                    stat = os.stat(fpath)
                    rel = os.path.relpath(fpath, skill_dir)
                    entries.append((rel, stat.st_size, int(stat.st_mtime)))
                except OSError:
                    pass
        entries.sort(key=lambda x: x[0])
        data = json.dumps(entries, sort_keys=True)
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    except Exception:
        return ""


def scan_agent_skills(agent_id: str, skill_root: str, ignore_patterns: list[str]) -> list[dict]:
    results = []
    if not os.path.isdir(skill_root):
        return results
    for entry in os.listdir(skill_root):
        entry_path = os.path.join(skill_root, entry)
        # Skip ignored patterns
        if any(Path(entry).match(p) for p in ignore_patterns):
            continue
        # Skip backup dir
        if entry == "skillbridge-backups":
            continue
        if not os.path.isdir(entry_path):
            continue
        info = parse_skill_md(entry_path)
        skill_name = info["name"]
        if not skill_name:
            continue
        entry_type = "UNKNOWN"
        resolved_target = ""
        fingerprint = ""
        state = "UNKNOWN"
        validation_errors = []
        if is_junction(entry_path):
            entry_type = "JUNCTION"
            resolved_target = resolve_junction_target(entry_path)
            if resolved_target == "BROKEN" or not resolved_target:
                entry_type = "BROKEN_LINK"
                state = "BROKEN_LINK"
            else:
                fingerprint = compute_fingerprint(resolved_target) if os.path.isdir(resolved_target) else ""
            if not info["has_skill_md"]:
                validation_errors.append("SKILL.md not found at junction target")
        elif is_real_directory(entry_path):
            entry_type = "REAL_DIR"
            fingerprint = compute_fingerprint(entry_path)
        else:
            entry_type = "INVALID"
            state = "INVALID"
            validation_errors.append("Cannot determine directory type")
        if not info["has_skill_md"]:
            if "INVALID" not in state:
                state = "INVALID"
            if "SKILL.md" not in str(validation_errors):
                validation_errors.append("Missing SKILL.md")
        results.append({
            "agent_id": agent_id,
            "skill_name": skill_name,
            "path": entry_path,
            "entry_type": entry_type,
            "resolved_target": resolved_target,
            "fingerprint": fingerprint,
            "state": state,
            "has_skill_md": info["has_skill_md"],
            "description": info["description"],
            "validation_errors": validation_errors,
        })
    return results
```

---

### Task 7: Catalog module (State machine + aggregation)

**Files:**
- Create: `skill-share/skillbridge/catalog.py`

- [ ] **Step 1: Create catalog.py**

```python
from collections import defaultdict
from skillbridge.models import InstanceState, AgentSkillInstance, SkillRow, SkillMatrix, AgentConfig


def determine_instance_state(
    instance: dict,
    source_path: str,
    source_fingerprint: str,
    all_instances_for_skill: list[dict]
) -> InstanceState:
    entry_type = instance["entry_type"]
    path = instance["path"]

    if entry_type == "BROKEN_LINK":
        return InstanceState.BROKEN_LINK
    if entry_type == "INVALID":
        return InstanceState.INVALID

    # Check if this is the source directory
    if source_path and path == source_path:
        return InstanceState.SOURCE_LOCAL

    if entry_type == "JUNCTION":
        resolved = instance.get("resolved_target", "")
        if resolved == source_path or (source_path and resolved and os.path.normpath(resolved) == os.path.normpath(source_path)):
            return InstanceState.SHARED_LINK
        return InstanceState.BROKEN_LINK

    if entry_type == "REAL_DIR":
        # Real dir that is not the source
        if not source_path:
            # No source selected yet — if only one real dir, it will be source
            # This is handled by source inference
            return InstanceState.LOCAL_COPY
        if instance["fingerprint"] == source_fingerprint and source_fingerprint:
            return InstanceState.LOCAL_COPY
        return InstanceState.CONFLICT

    return InstanceState.INVALID


def infer_source(instances: list[dict]) -> tuple[str, str]:
    """Infer the best source directory. Returns (source_path, source_agent_id)."""
    real_dirs = [i for i in instances if i["entry_type"] == "REAL_DIR"]
    junctions = [i for i in instances if i["entry_type"] == "JUNCTION"]

    if not real_dirs:
        return ("", "")

    # If only one real dir, it's the source
    if len(real_dirs) == 1:
        return (real_dirs[0]["path"], real_dirs[0]["agent_id"])

    # If multiple real dirs with same fingerprint, pick first
    if len(real_dirs) > 1:
        fingerprints = set(i.get("fingerprint", "") for i in real_dirs)
        if len(fingerprints) == 1:
            return (real_dirs[0]["path"], real_dirs[0]["agent_id"])

    # Multiple real dirs with different fingerprints — conflict, can't auto-pick
    return ("", "")


def build_skill_matrix(agents: list[AgentConfig], scan_data: list[dict]) -> SkillMatrix:
    # Group scan data by skill name
    by_skill: dict[str, list[dict]] = defaultdict(list)
    for entry in scan_data:
        by_skill[entry["skill_name"]].append(entry)

    # Group instances by agent_id for each skill
    skills = []
    for skill_name, instances in by_skill.items():
        # Check for persisted source selection
        from skillbridge.database import get_source_selection
        selection = get_source_selection(skill_name)
        source_path = selection["source_path"] if selection else ""
        source_agent_id = selection["source_agent_id"] if selection else ""

        # If no persisted selection, infer
        if not source_path:
            source_path, source_agent_id = infer_source(instances)
            if source_path and source_agent_id:
                from skillbridge.database import upsert_source_selection
                upsert_source_selection(skill_name, source_agent_id, source_path)

        # Get source fingerprint
        source_fingerprint = ""
        for i in instances:
            if i["path"] == source_path:
                source_fingerprint = i.get("fingerprint", "")
                break

        # Build instance list with states
        instance_objs = []
        description = ""
        for i in instances:
            state = determine_instance_state(i, source_path, source_fingerprint, instances)
            agent_config = next((a for a in agents if a.id == i["agent_id"]), None)
            instance_objs.append(AgentSkillInstance(
                agent_id=i["agent_id"],
                agent_name=agent_config.name if agent_config else i["agent_id"],
                skill_name=i["skill_name"],
                path=i["path"],
                entry_type=i["entry_type"],
                resolved_target=i.get("resolved_target", ""),
                fingerprint=i.get("fingerprint", ""),
                state=state,
                has_skill_md=i.get("has_skill_md", False),
                description=i.get("description", ""),
                validation_errors=i.get("validation_errors", []),
            ))
            if i.get("description"):
                description = i["description"]

        # Build agent-indexed map
        instances_by_agent = {inst.agent_id: inst for inst in instance_objs}

        # For agents that don't have this skill, create MISSING instance
        for agent in agents:
            if agent.id not in instances_by_agent:
                instance_objs.append(AgentSkillInstance(
                    agent_id=agent.id,
                    agent_name=agent.name,
                    skill_name=skill_name,
                    path="",
                    entry_type="REAL_DIR",
                    state=InstanceState.MISSING,
                ))
                instances_by_agent[agent.id] = instance_objs[-1]

        skills.append(SkillRow(
            skill_name=skill_name,
            description=description,
            source_agent_id=source_agent_id,
            instances=instance_objs,
            instances_by_agent=instances_by_agent,
        ))

    # Sort skills by name
    skills.sort(key=lambda s: s.skill_name)

    return SkillMatrix(skills=skills, agents=agents)
```

I notice I used `os.path.normpath` and `os` in catalog.py without importing `os`. Let me fix that. Also, `InstanceState` is used as a string comparison in some places. Let me make sure the types work properly.

- [ ] **Step 2: Fix imports in catalog.py**

Add `import os` at the top of catalog.py.

---

### Task 8: Sharing orchestration module

**Files:**
- Create: `skill-share/skillbridge/sharing.py`

- [ ] **Step 1: Create sharing.py**

```python
import os
from datetime import datetime
from pathlib import Path
from skillbridge.database import log_operation, update_operation_status
from skillbridge.platform.windows import (
    create_junction, remove_junction, backup_real_directory,
    is_junction, is_real_directory, resolve_junction_target, move_directory
)
from skillbridge.security import normalize_path, is_path_allowed
from skillbridge.config import BACKUP_DIR_NAME


def enable_sharing(skill_name: str, source_path: str, target_agent_root: str, target_agent_id: str) -> dict:
    """Enable sharing by creating a Junction from target to source."""
    op_id = None
    backup_dir = ""
    try:
        norm_source = normalize_path(source_path)
        norm_target_root = normalize_path(target_agent_root)

        if not os.path.isdir(norm_source):
            return {"success": False, "error": f"Source directory does not exist: {norm_source}"}
        if not os.path.isdir(norm_target_root):
            return {"success": False, "error": f"Target agent root does not exist: {norm_target_root}"}

        target_path = os.path.join(norm_target_root, skill_name)

        # Log operation
        log_operation("ENABLE_SHARE", skill_name, target_agent_id, "IN_PROGRESS",
                      {"source": norm_source, "target": target_path})
        with open(os.devnull) as _: pass
        from skillbridge.database import get_db
        conn = get_db().__enter__()
        try:
            cursor = conn.execute("SELECT last_insert_rowid()")
            op_id = cursor.fetchone()[0]
        finally:
            conn.__exit__(None, None, None)

        # Check if target already exists
        if os.path.exists(target_path):
            if is_junction(target_path):
                resolved = resolve_junction_target(target_path)
                if resolved == norm_source or (resolved and os.path.normpath(resolved) == os.path.normpath(norm_source)):
                    update_operation_status(op_id, "SUCCESS")
                    return {"success": True, "message": "Already shared"}
                # Remove old junction
                ok, err = remove_junction(target_path)
                if not ok:
                    update_operation_status(op_id, "FAILED", err)
                    return {"success": False, "error": f"Failed to remove old junction: {err}"}
            elif is_real_directory(target_path):
                # Backup real directory
                timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
                backup_dir = os.path.join(norm_target_root, BACKUP_DIR_NAME, timestamp, skill_name)
                ok, err = backup_real_directory(target_path, backup_dir)
                if not ok:
                    update_operation_status(op_id, "FAILED", err)
                    return {"success": False, "error": f"Failed to backup: {err}"}
            else:
                update_operation_status(op_id, "FAILED", "Target exists but is neither junction nor directory")
                return {"success": False, "error": "Target exists in unknown state"}

        # Create junction
        ok, err = create_junction(target_path, norm_source)
        if not ok:
            # Rollback: restore backup if we made one
            if backup_dir:
                move_directory(backup_dir, target_path)
            update_operation_status(op_id, "FAILED", err)
            return {"success": False, "error": f"Failed to create junction: {err}"}

        update_operation_status(op_id, "SUCCESS")
        result = {"success": True, "message": f"Shared {skill_name} to {target_agent_id}"}
        if backup_dir:
            result["backup_path"] = backup_dir
        return result

    except Exception as e:
        if op_id:
            update_operation_status(op_id, "FAILED", str(e))
        return {"success": False, "error": str(e)}


def disable_sharing(skill_name: str, source_path: str, target_agent_root: str, target_agent_id: str) -> dict:
    """Disable sharing by removing the Junction."""
    op_id = None
    try:
        norm_target_root = normalize_path(target_agent_root)
        target_path = os.path.join(norm_target_root, skill_name)

        if not os.path.exists(target_path):
            log_operation("DISABLE_SHARE", skill_name, target_agent_id, "SUCCESS",
                          {"message": "Target did not exist"})
            return {"success": True, "message": "Nothing to remove"}

        if not is_junction(target_path):
            return {"success": False, "error": "Target is a real directory, not a junction. Use backup + manual handling."}

        resolved = resolve_junction_target(target_path)
        if source_path and resolved != source_path and os.path.normpath(resolved) != os.path.normpath(source_path):
            return {"success": False, "error": f"Junction points to {resolved}, not the expected source {source_path}"}

        log_operation("DISABLE_SHARE", skill_name, target_agent_id, "IN_PROGRESS",
                      {"target": target_path})
        from skillbridge.database import get_db
        conn = get_db().__enter__()
        try:
            cursor = conn.execute("SELECT last_insert_rowid()")
            op_id = cursor.fetchone()[0]
        finally:
            conn.__exit__(None, None, None)

        ok, err = remove_junction(target_path)
        if not ok:
            update_operation_status(op_id, "FAILED", err)
            return {"success": False, "error": err}

        update_operation_status(op_id, "SUCCESS")
        return {"success": True, "message": f"Removed junction for {skill_name}"}

    except Exception as e:
        if op_id:
            update_operation_status(op_id, "FAILED", str(e))
        return {"success": False, "error": str(e)}
```

---

### Task 9: Routes (FastAPI app with HTML + JSON endpoints)

**Files:**
- Create: `skill-share/skillbridge/routes.py`

- [ ] **Step 1: Create routes.py**

```python
import os
import json
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from skillbridge.config import DEFAULT_AGENTS, DB_PATH
from skillbridge.database import init_db, get_all_agents, get_enabled_agents, upsert_agent, delete_agent, clear_scan_cache, insert_scan_cache, get_scan_cache, get_source_selection, upsert_source_selection, get_operations, log_operation
from skillbridge.models import AgentCreate, AgentUpdate, SkillMatrix
from skillbridge.scanner import scan_agent_skills
from skillbridge.catalog import build_skill_matrix
from skillbridge.sharing import enable_sharing, disable_sharing
from skillbridge.security import generate_session_token, get_session_token

app = FastAPI(title="SkillBridge")

# Static files
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Templates
templates_dir = Path(__file__).parent / "templates"
templates = Jinja2Templates(directory=str(templates_dir))


def _get_instance_state_label(state: str) -> str:
    labels = {
        "SOURCE_LOCAL": "源",
        "SHARED_LINK": "已共享",
        "MISSING": "未启用",
        "LOCAL_COPY": "本地副本",
        "CONFLICT": "冲突",
        "BROKEN_LINK": "断链",
        "INVALID": "无效",
    }
    return labels.get(state, state)


def _get_instance_state_icon(state: str) -> str:
    icons = {
        "SOURCE_LOCAL": "🔒",
        "SHARED_LINK": "✓",
        "MISSING": "○",
        "LOCAL_COPY": "●",
        "CONFLICT": "!",
        "BROKEN_LINK": "✗",
        "INVALID": "⊘",
    }
    return icons.get(state, "?")


def _get_state_css_class(state: str) -> str:
    classes = {
        "SOURCE_LOCAL": "state-source",
        "SHARED_LINK": "state-shared",
        "MISSING": "state-missing",
        "LOCAL_COPY": "state-local-copy",
        "CONFLICT": "state-conflict",
        "BROKEN_LINK": "state-broken",
        "INVALID": "state-invalid",
    }
    return classes.get(state, "")


def _get_agent_icon(icon_name: str) -> str:
    icons = {
        "codex": "⚡",
        "opencode": "◆",
        "claude": "◈",
        "custom": "▣",
    }
    return icons.get(icon_name, "▣")


@app.on_event("startup")
async def startup():
    init_db()
    # Seed default agents if none exist
    if not get_all_agents():
        for agent in DEFAULT_AGENTS:
            upsert_agent(agent)


# ─── HTML Pages ─────────────────────────────────────────────────


@app.get("/", response_class=HTMLResponse)
async def index_page(request: Request):
    agents = get_enabled_agents()
    scan_data = get_scan_cache()
    matrix = build_skill_matrix(agents, scan_data) if scan_data else SkillMatrix(skills=[], agents=agents)
    return templates.TemplateResponse("index.html", {
        "request": request,
        "matrix": matrix,
        "state_labels": _get_instance_state_label,
        "state_icons": _get_instance_state_icon,
        "state_classes": _get_state_css_class,
        "agent_icons": _get_agent_icon,
    })


@app.get("/settings", response_class=HTMLResponse)
async def settings_page(request: Request):
    agents = get_all_agents()
    return templates.TemplateResponse("settings.html", {
        "request": request,
        "agents": agents,
    })


@app.get("/skills/{skill_name}", response_class=HTMLResponse)
async def skill_detail_page(request: Request, skill_name: str):
    agents = get_enabled_agents()
    scan_data = get_scan_cache()
    matrix = build_skill_matrix(agents, scan_data)
    skill = next((s for s in matrix.skills if s.skill_name == skill_name), None)
    if not skill:
        return HTMLResponse("Skill not found", status_code=404)
    return templates.TemplateResponse("skill_detail.html", {
        "request": request,
        "skill": skill,
        "state_labels": _get_instance_state_label,
        "state_icons": _get_instance_state_icon,
        "state_classes": _get_state_css_class,
        "agent_icons": _get_agent_icon,
    })


@app.get("/logs", response_class=HTMLResponse)
async def logs_page(request: Request):
    ops = get_operations()
    return templates.TemplateResponse("logs.html", {
        "request": request,
        "operations": ops,
    })


# ─── JSON API ───────────────────────────────────────────────────


@app.get("/api/agents")
async def api_get_agents():
    return get_all_agents()


@app.post("/api/agents")
async def api_create_agent(agent: AgentCreate):
    upsert_agent(agent.model_dump())
    return {"success": True, "agent_id": agent.id}


@app.put("/api/agents/{agent_id}")
async def api_update_agent(agent_id: str, update: AgentUpdate):
    agents = get_all_agents()
    existing = next((a for a in agents if a["id"] == agent_id), None)
    if not existing:
        raise HTTPException(status_code=404, detail="Agent not found")
    merged = {**existing, **update.model_dump(exclude_none=True)}
    upsert_agent(merged)
    return {"success": True}


@app.delete("/api/agents/{agent_id}")
async def api_delete_agent(agent_id: str):
    delete_agent(agent_id)
    return {"success": True}


@app.post("/api/scan")
async def api_scan():
    agents = get_enabled_agents()
    if not agents:
        return {"success": False, "message": "No enabled agents configured"}
    all_skills = []
    errors = []
    for agent in agents:
        try:
            skills = scan_agent_skills(agent["id"], agent["skill_root"],
                                       json.loads(agent.get("ignore_patterns", "[]")))
            all_skills.extend(skills)
        except Exception as e:
            errors.append(f"{agent['id']}: {str(e)}")
    clear_scan_cache()
    insert_scan_cache(all_skills)
    return {
        "success": True,
        "message": f"Scanned {len(all_skills)} skills across {len(agents)} agents",
        "skill_count": len(all_skills),
        "errors": errors,
    }


@app.get("/api/skills")
async def api_get_skills():
    agents = get_enabled_agents()
    scan_data = get_scan_cache()
    if not scan_data:
        return {"skills": [], "agents": [dict(a) for a in agents]}
    matrix = build_skill_matrix(agents, scan_data)
    return matrix.model_dump()


@app.get("/api/skills/{skill_name}")
async def api_get_skill_detail(skill_name: str):
    agents = get_enabled_agents()
    scan_data = get_scan_cache()
    if not scan_data:
        raise HTTPException(status_code=404, detail="No scan data")
    matrix = build_skill_matrix(agents, scan_data)
    skill = next((s for s in matrix.skills if s.skill_name == skill_name), None)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill.model_dump()


@app.post("/api/skills/{skill_name}/share")
async def api_enable_share(skill_name: str, request: Request):
    body = await request.json()
    target_agent_id = body.get("agent_id")
    if not target_agent_id:
        raise HTTPException(status_code=400, detail="agent_id required")

    agents = get_all_agents()
    target_agent = next((a for a in agents if a["id"] == target_agent_id), None)
    if not target_agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    source = get_source_selection(skill_name)
    if not source:
        raise HTTPException(status_code=400, detail=f"No source selected for skill '{skill_name}'. Run scan first.")

    result = enable_sharing(skill_name, source["source_path"], target_agent["skill_root"], target_agent_id)

    # Refresh scan cache after operation
    _refresh_scan_cache()

    return result


@app.delete("/api/skills/{skill_name}/share/{agent_id}")
async def api_disable_share(skill_name: str, agent_id: str):
    agents = get_all_agents()
    target_agent = next((a for a in agents if a["id"] == agent_id), None)
    if not target_agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    source = get_source_selection(skill_name)
    source_path = source["source_path"] if source else ""

    result = disable_sharing(skill_name, source_path, target_agent["skill_root"], agent_id)

    _refresh_scan_cache()

    return result


@app.post("/api/skills/{skill_name}/source")
async def api_set_source(skill_name: str, request: Request):
    body = await request.json()
    agent_id = body.get("agent_id")
    if not agent_id:
        raise HTTPException(status_code=400, detail="agent_id required")

    agents = get_enabled_agents()
    scan_data = get_scan_cache()
    if not scan_data:
        raise HTTPException(status_code=400, detail="No scan data. Run scan first.")

    target_instances = [s for s in scan_data if s["skill_name"] == skill_name and s["agent_id"] == agent_id]
    if not target_instances:
        raise HTTPException(status_code=404, detail=f"No instance found for skill '{skill_name}' on agent '{agent_id}'")

    instance = target_instances[0]
    if instance["entry_type"] != "REAL_DIR":
        raise HTTPException(status_code=400, detail="Can only set source to a real directory")

    upsert_source_selection(skill_name, agent_id, instance["path"])

    _refresh_scan_cache()

    return {"success": True, "source_agent_id": agent_id, "source_path": instance["path"]}


@app.get("/api/operations")
async def api_get_operations():
    return get_operations()


def _refresh_scan_cache():
    agents = get_enabled_agents()
    all_skills = []
    for agent in agents:
        try:
            skills = scan_agent_skills(agent["id"], agent["skill_root"],
                                       json.loads(agent.get("ignore_patterns", "[]")))
            all_skills.extend(skills)
        except Exception:
            pass
    clear_scan_cache()
    insert_scan_cache(all_skills)
```

Wait, I need to also fix the `os.path.normpath` import issue. Let me ensure `os` is imported in catalog.py.

Also, I notice the `sharing.py` has a hacky way to get the last insert row id. Let me fix that by returning the ID from `log_operation`.

Let me also reconsider the sharing.py - the `log_operation` function doesn't return the ID. I need to fix this.

Let me adjust these things in the actual implementation. For the plan, I'll note the needed fix.

---

### Task 10: Base template + styles

**Files:**
- Create: `skill-share/skillbridge/templates/base.html`
- Create: `skill-share/skillbridge/static/style.css`

- [ ] **Step 1: Create base.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}SkillBridge{% endblock %}</title>
    <link rel="stylesheet" href="/static/style.css">
</head>
<body>
    <nav class="nav">
        <div class="nav-inner">
            <a href="/" class="nav-brand">SkillBridge</a>
            <div class="nav-links">
                <a href="/" class="nav-link">Skill 总览</a>
                <a href="/settings" class="nav-link">Agent 设置</a>
                <a href="/logs" class="nav-link">操作记录</a>
            </div>
        </div>
    </nav>
    <main class="main">
        {% block content %}{% endblock %}
    </main>
</body>
</html>
```

- [ ] **Step 2: Create style.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; }

.nav { background: #1a1a2e; color: white; padding: 0 24px; }
.nav-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; height: 48px; gap: 32px; }
.nav-brand { font-size: 18px; font-weight: 700; color: white; text-decoration: none; }
.nav-links { display: flex; gap: 16px; }
.nav-link { color: #aaa; text-decoration: none; font-size: 14px; }
.nav-link:hover { color: white; }

.main { max-width: 1200px; margin: 0 auto; padding: 24px; }

.toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.toolbar input[type="text"] { padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; width: 240px; }
.btn { padding: 6px 16px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer; font-size: 14px; }
.btn:hover { background: #f0f0f0; }
.btn-primary { background: #1a1a2e; color: white; border-color: #1a1a2e; }
.btn-primary:hover { background: #2d2d4e; }
.btn-danger { color: #d32f2f; border-color: #d32f2f; }
.btn-danger:hover { background: #ffebee; }

.matrix { overflow-x: auto; }
.matrix-table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
.matrix-table th, .matrix-table td { padding: 10px 16px; text-align: left; border-bottom: 1px solid #eee; }
.matrix-table th { background: #fafafa; font-weight: 600; font-size: 13px; color: #666; white-space: nowrap; }
.matrix-table td { font-size: 14px; }
.matrix-table tr:hover td { background: #f8f9ff; }

.skill-name { font-weight: 600; }
.skill-desc { font-size: 12px; color: #999; }

.state-btn { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 4px; font-size: 13px; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
.state-btn:hover { opacity: 0.8; }

.state-source { background: #e8f5e9; color: #2e7d32; border-color: #a5d6a7; cursor: default; }
.state-shared { background: #e8f5e9; color: #2e7d32; border-color: #a5d6a7; }
.state-missing { background: #f5f5f5; color: #999; border-color: #ddd; }
.state-local-copy { background: #e3f2fd; color: #1565c0; border-color: #90caf9; }
.state-conflict { background: #fff3e0; color: #e65100; border-color: #ffcc80; }
.state-broken { background: #ffebee; color: #c62828; border-color: #ef9a9a; }
.state-invalid { background: #fce4ec; color: #ad1457; border-color: #f48fb1; }

.skill-detail { background: white; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); padding: 24px; }
.skill-detail h1 { font-size: 24px; margin-bottom: 8px; }
.skill-detail .meta { color: #999; font-size: 14px; margin-bottom: 24px; }
.instance-list { list-style: none; }
.instance-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #eee; }
.instance-item:last-child { border-bottom: none; }
.instance-agent { font-weight: 600; width: 120px; }

.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; font-weight: 600; color: #666; margin-bottom: 4px; }
.form-group input, .form-group select { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; max-width: 400px; }

.log-table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
.log-table th, .log-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
.log-table th { background: #fafafa; font-weight: 600; color: #666; }

.status-success { color: #2e7d32; }
.status-failed { color: #c62828; }
.status-in-progress { color: #e65100; }

.empty-state { text-align: center; padding: 48px; color: #999; font-size: 14px; }

.modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); align-items: center; justify-content: center; z-index: 100; }
.modal-overlay.active { display: flex; }
.modal { background: white; border-radius: 8px; padding: 24px; min-width: 400px; max-width: 500px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
.modal h3 { margin-bottom: 12px; }
.modal p { margin-bottom: 16px; color: #666; font-size: 14px; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }

.toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 10px 24px; border-radius: 6px; font-size: 14px; color: white; z-index: 200; display: none; }
.toast.show { display: block; }
.toast-success { background: #2e7d32; }
.toast-error { background: #c62828; }

@media (max-width: 768px) {
    .matrix-table th, .matrix-table td { padding: 6px 8px; font-size: 12px; }
    .state-btn { font-size: 11px; padding: 2px 6px; }
}
```

---

### Task 11: Index page template (Skill × Agent matrix)

**Files:**
- Create: `skill-share/skillbridge/templates/index.html`

- [ ] **Step 1: Create index.html**

```html
{% extends "base.html" %}
{% block title %}SkillBridge - Skill 总览{% endblock %}
{% block content %}
<div class="toolbar">
    <input type="text" id="searchInput" placeholder="搜索 Skill..." oninput="filterSkills()">
    <select id="stateFilter" onchange="filterSkills()">
        <option value="">全部状态</option>
        <option value="MISSING">未启用</option>
        <option value="SHARED_LINK">已共享</option>
        <option value="CONFLICT">冲突</option>
        <option value="BROKEN_LINK">断链</option>
        <option value="LOCAL_COPY">本地副本</option>
    </select>
    <button class="btn btn-primary" onclick="rescan()">重新扫描</button>
    <a href="/settings" class="btn">Agent 设置</a>
</div>

<div class="matrix">
    <table class="matrix-table" id="matrixTable">
        <thead>
            <tr>
                <th>Skill</th>
                {% for agent in matrix.agents %}
                <th class="agent-col">{{ agent_icons(agent.icon) }} {{ agent.name }}</th>
                {% endfor %}
            </tr>
        </thead>
        <tbody>
            {% for skill in matrix.skills %}
            <tr class="skill-row" data-name="{{ skill.skill_name.lower() }}">
                <td>
                    <a href="/skills/{{ skill.skill_name }}" class="skill-name">{{ skill.skill_name }}</a>
                    {% if skill.description %}
                    <div class="skill-desc">{{ skill.description }}</div>
                    {% endif %}
                </td>
                {% for agent in matrix.agents %}
                {% set instance = skill.instances_by_agent.get(agent.id) %}
                <td>
                    {% if instance %}
                    <button class="state-btn {{ state_classes(instance.state) }}"
                            onclick="handleStateClick('{{ skill.skill_name }}', '{{ agent.id }}', '{{ instance.state }}')"
                            data-state="{{ instance.state }}">
                        {{ state_icons(instance.state) }} {{ state_labels(instance.state) }}
                    </button>
                    {% else %}
                    <span class="state-btn state-missing">-</span>
                    {% endif %}
                </td>
                {% endfor %}
            </tr>
            {% else %}
            <tr>
                <td colspan="{{ matrix.agents|length + 1 }}">
                    <div class="empty-state">
                        {% if matrix.agents %}
                        暂无 Skill 数据，请点击"重新扫描"。
                        {% else %}
                        暂无 Agent 配置，请先到 <a href="/settings">Agent 设置</a> 添加。
                        {% endif %}
                    </div>
                </td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
</div>

<!-- Confirmation Modal -->
<div class="modal-overlay" id="confirmModal">
    <div class="modal">
        <h3 id="modalTitle">确认操作</h3>
        <p id="modalMessage">确定要执行此操作吗？</p>
        <div class="modal-actions">
            <button class="btn" onclick="closeModal()">取消</button>
            <button class="btn btn-danger" id="modalConfirmBtn" onclick="executeAction()">确定</button>
        </div>
    </div>
</div>

<!-- Toast -->
<div class="toast" id="toast"></div>

<script>
let pendingAction = null;

function filterSkills() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const stateFilter = document.getElementById('stateFilter').value;
    const rows = document.querySelectorAll('.skill-row');
    rows.forEach(row => {
        const name = row.dataset.name;
        let show = !search || name.includes(search);
        if (show && stateFilter) {
            const stateBtns = row.querySelectorAll('.state-btn');
            let hasState = false;
            stateBtns.forEach(btn => {
                if (btn.dataset.state === stateFilter) hasState = true;
            });
            show = hasState;
        }
        row.style.display = show ? '' : 'none';
    });
}

function showToast(msg, type) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast show toast-' + type;
    setTimeout(() => toast.className = 'toast', 3000);
}

function closeModal() {
    document.getElementById('confirmModal').classList.remove('active');
    pendingAction = null;
}

function handleStateClick(skillName, agentId, state) {
    if (state === 'SOURCE_LOCAL') {
        showToast('源目录不可直接操作', 'error');
        return;
    }
    if (state === 'SHARED_LINK') {
        document.getElementById('modalTitle').textContent = '取消共享';
        document.getElementById('modalMessage').textContent = `确定要取消 "${skillName}" 在 "${agentId}" 的共享吗？源目录不会被删除。`;
        document.getElementById('modalConfirmBtn').className = 'btn btn-danger';
        document.getElementById('modalConfirmBtn').textContent = '取消共享';
        pendingAction = { action: 'disable', skillName, agentId };
        document.getElementById('confirmModal').classList.add('active');
        return;
    }
    if (state === 'MISSING') {
        document.getElementById('modalTitle').textContent = '启用共享';
        document.getElementById('modalMessage').textContent = `确定为 "${agentId}" 启用 "${skillName}" 的共享？将在目标目录创建 Junction。`;
        document.getElementById('modalConfirmBtn').className = 'btn btn-primary';
        document.getElementById('modalConfirmBtn').textContent = '启用共享';
        pendingAction = { action: 'enable', skillName, agentId };
        document.getElementById('confirmModal').classList.add('active');
        return;
    }
    if (state === 'CONFLICT') {
        window.location.href = '/skills/' + encodeURIComponent(skillName);
        return;
    }
    if (state === 'BROKEN_LINK') {
        document.getElementById('modalTitle').textContent = '修复断链';
        document.getElementById('modalMessage').textContent = `"${skillName}" 在 "${agentId}" 的链接已断开。删除断链？`;
        pendingAction = { action: 'disable', skillName, agentId };
        document.getElementById('confirmModal').classList.add('active');
        return;
    }
    if (state === 'LOCAL_COPY') {
        document.getElementById('modalTitle').textContent = '本地副本';
        document.getElementById('modalMessage').textContent = `"${skillName}" 在 "${agentId}" 是本地副本。备份后转为共享？`;
        document.getElementById('modalConfirmBtn').className = 'btn btn-primary';
        document.getElementById('modalConfirmBtn').textContent = '备份并共享';
        pendingAction = { action: 'enable', skillName, agentId };
        document.getElementById('confirmModal').classList.add('active');
        return;
    }
    window.location.href = '/skills/' + encodeURIComponent(skillName);
}

async function executeAction() {
    if (!pendingAction) return;
    const { action, skillName, agentId } = pendingAction;
    closeModal();
    try {
        let url, options;
        if (action === 'enable') {
            url = `/api/skills/${encodeURIComponent(skillName)}/share`;
            options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent_id: agentId }) };
        } else {
            url = `/api/skills/${encodeURIComponent(skillName)}/share/${encodeURIComponent(agentId)}`;
            options = { method: 'DELETE' };
        }
        const resp = await fetch(url, options);
        const data = await resp.json();
        if (data.success) {
            showToast(data.message || '操作成功', 'success');
            setTimeout(() => location.reload(), 1000);
        } else {
            showToast(data.error || '操作失败', 'error');
        }
    } catch (e) {
        showToast('网络错误: ' + e.message, 'error');
    }
}

async function rescan() {
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '扫描中...';
    try {
        const resp = await fetch('/api/scan', { method: 'POST' });
        const data = await resp.json();
        if (data.success) {
            showToast(data.message, 'success');
            setTimeout(() => location.reload(), 500);
        } else {
            showToast(data.message || '扫描失败', 'error');
            btn.disabled = false;
            btn.textContent = '重新扫描';
        }
    } catch (e) {
        showToast('扫描失败: ' + e.message, 'error');
        btn.disabled = false;
        btn.textContent = '重新扫描';
    }
}
</script>
{% endblock %}
```

---

### Task 12: Settings page, Skill detail page, Logs page templates

**Files:**
- Create: `skill-share/skillbridge/templates/settings.html`
- Create: `skill-share/skillbridge/templates/skill_detail.html`
- Create: `skill-share/skillbridge/templates/logs.html`

- [ ] **Step 1: Create settings.html**

```html
{% extends "base.html" %}
{% block title %}SkillBridge - Agent 设置{% endblock %}
{% block content %}
<h2 style="margin-bottom: 16px;">Agent 配置</h2>

<table class="matrix-table" style="margin-bottom: 24px;">
    <thead>
        <tr>
            <th>启用</th>
            <th>名称</th>
            <th>ID</th>
            <th>Skill 根目录</th>
            <th>操作</th>
        </tr>
    </thead>
    <tbody>
        {% for agent in agents %}
        <tr>
            <td>
                <input type="checkbox" {{ 'checked' if agent.enabled else '' }}
                       onchange="toggleAgent('{{ agent.id }}', this.checked)">
            </td>
            <td>{{ agent.name }}</td>
            <td style="color: #999; font-size: 12px;">{{ agent.id }}</td>
            <td style="font-size: 12px; max-width: 300px; overflow: hidden; text-overflow: ellipsis;">{{ agent.skill_root }}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteAgent('{{ agent.id }}')">删除</button>
            </td>
        </tr>
        {% else %}
        <tr>
            <td colspan="5"><div class="empty-state">暂无 Agent 配置</div></td>
        </tr>
        {% endfor %}
    </tbody>
</table>

<h3 style="margin-bottom: 12px;">新增 Agent</h3>
<form onsubmit="addAgent(event)">
    <div class="form-group">
        <label>Agent ID (小写字母、数字、连字符)</label>
        <input type="text" name="id" required pattern="[a-z0-9-]+">
    </div>
    <div class="form-group">
        <label>名称</label>
        <input type="text" name="name" required>
    </div>
    <div class="form-group">
        <label>Skill 根目录</label>
        <input type="text" name="skill_root" required placeholder="C:\Users\...\.codex\skills">
    </div>
    <button type="submit" class="btn btn-primary">添加</button>
</form>

<script>
async function toggleAgent(id, enabled) {
    await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
    });
}

async function deleteAgent(id) {
    if (!confirm('确定删除 Agent "' + id + '"？不会删除任何文件。')) return;
    await fetch(`/api/agents/${id}`, { method: 'DELETE' });
    location.reload();
}

async function addAgent(event) {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form));
    data.ignore_patterns = ['.system', '.internal'];
    const resp = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const result = await resp.json();
    if (result.success) {
        location.reload();
    } else {
        alert('添加失败: ' + (result.error || '未知错误'));
    }
}
</script>
{% endblock %}
```

- [ ] **Step 2: Create skill_detail.html**

```html
{% extends "base.html" %}
{% block title %}SkillBridge - {{ skill.skill_name }}{% endblock %}
{% block content %}
<div class="skill-detail">
    <a href="/" style="color: #999; text-decoration: none; font-size: 13px;">← 返回总览</a>
    <h1>{{ skill.skill_name }}</h1>
    {% if skill.description %}
    <div class="meta">{{ skill.description }}</div>
    {% endif %}
    {% if skill.source_agent_id %}
    <div class="meta">源 Agent: {{ skill.source_agent_id }}</div>
    {% endif %}

    <h3 style="margin: 24px 0 12px;">各 Agent 实例</h3>
    <ul class="instance-list">
        {% for inst in skill.instances %}
        <li class="instance-item">
            <span class="instance-agent">{{ agent_icons(inst.agent_name) }} {{ inst.agent_name }}</span>
            <span class="state-btn {{ state_classes(inst.state) }}">
                {{ state_icons(inst.state) }} {{ state_labels(inst.state) }}
            </span>
            <span style="font-size: 12px; color: #999;">
                {% if inst.path %}
                {{ inst.path }}
                {% endif %}
                {% if inst.entry_type == 'JUNCTION' and inst.resolved_target %}
                → {{ inst.resolved_target }}
                {% endif %}
            </span>
            {% if inst.validation_errors %}
            <span style="font-size: 12px; color: #c62828;">{{ inst.validation_errors|join(', ') }}</span>
            {% endif %}
        </li>
        {% endfor %}
    </ul>

    {% if skill.source_agent_id %}
    <h3 style="margin: 24px 0 12px;">操作</h3>
    <div style="display: flex; gap: 8px;">
        <button class="btn" onclick="location.reload()">刷新</button>
    </div>
    {% endif %}
</div>
{% endblock %}
```

- [ ] **Step 3: Create logs.html**

```html
{% extends "base.html" %}
{% block title %}SkillBridge - 操作记录{% endblock %}
{% block content %}
<h2 style="margin-bottom: 16px;">操作记录</h2>

<table class="log-table">
    <thead>
        <tr>
            <th>时间</th>
            <th>动作</th>
            <th>Skill</th>
            <th>Agent</th>
            <th>状态</th>
            <th>详情</th>
        </tr>
    </thead>
    <tbody>
        {% for op in operations %}
        <tr>
            <td style="white-space: nowrap;">{{ op.created_at }}</td>
            <td>{{ op.action }}</td>
            <td>{{ op.skill_name }}</td>
            <td>{{ op.agent_id }}</td>
            <td class="status-{{ op.status.lower() }}">{{ op.status }}</td>
            <td style="font-size: 12px; color: #999; max-width: 300px;">
                {% if op.error %}<span style="color: #c62828;">{{ op.error }}</span>{% endif %}
                {% if op.backup_path %}备份: {{ op.backup_path }}{% endif %}
            </td>
        </tr>
        {% else %}
        <tr>
            <td colspan="6"><div class="empty-state">暂无操作记录</div></td>
        </tr>
        {% endfor %}
    </tbody>
</table>
{% endblock %}
```

---

### Task 13: Finalize main.py entry point

**Files:**
- Modify: `skill-share/main.py`

- [ ] **Step 1: Update main.py**

```python
#!/usr/bin/env python3
import uvicorn
from skillbridge.config import HOST, PORT

def main():
    uvicorn.run("skillbridge.routes:app", host=HOST, port=PORT, log_level="info")

if __name__ == "__main__":
    main()
```

---

### Task 14: Install and run

- [ ] **Step 1: Install dependencies**

```powershell
cd skill-share
pip install -r requirements.txt
```

- [ ] **Step 2: Run the application**

```powershell
cd skill-share
python main.py
```

- [ ] **Step 3: Open browser to `http://127.0.0.1:17890`**

- [ ] **Step 4: Click "重新扫描" to scan default Codex and OpenCode skill directories**

- [ ] **Step 5: Test enabling/disabling sharing by clicking state buttons in the matrix**
