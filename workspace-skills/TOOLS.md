# TOOLS.md - 技能部工具配置

## 身份

- **Agent ID：** `skills`
- **职能：** Skill 与 MCP 插件目录管理

---

## 关键路径

| 路径 | 说明 |
|------|------|
| `/home/rooot/.openclaw/workspace/skills/` | 共有 skill 源目录 |
| `/home/rooot/.openclaw/workspace-botN/skills/` | 各 bot 的 skill 目录（含 symlink）|
| `memory/shared-skills.md` | 共有 skill 目录（自动生成）|
| `memory/private-skills.md` | 私有 skill 目录（自动生成）|
| `memory/plugins.md` | MCP 插件配置清单（自动生成）|
| `memory/sync-status.md` | symlink 同步状态（自动生成）|

---

## 刷新目录

```bash
python3 ~/.openclaw/workspace-skills/scripts/update-inventory.py
```

---

## 常用查询命令

```bash
# 列出所有共有 skill
ls /home/rooot/.openclaw/workspace/skills/

# 检查 symlink 完整性（哪些 bot 缺少哪些 skill）
python3 -c "
import os
src = '/home/rooot/.openclaw/workspace/skills'
skills = [s for s in os.listdir(src) if os.path.isdir(os.path.join(src, s))]
for skill in sorted(skills):
    missing = [f'bot{i}' for i in range(1,11)
               if not os.path.exists(f'/home/rooot/.openclaw/workspace-bot{i}/skills/{skill}')]
    if missing: print(f'[缺失] {skill}: {missing}')
"

# 新增共有 skill 的 symlink（所有 bot）
SKILL=新skill名
for i in 1 2 3 4 5 6 7 8 9 10; do
  ln -s ../../workspace/skills/$SKILL /home/rooot/.openclaw/workspace-bot${i}/skills/$SKILL
done
```

---

## MCP 插件查询

```bash
# 查看某 bot 的 MCP 插件配置
cat /home/rooot/.openclaw/workspace-botN/config/mcporter.json
```
