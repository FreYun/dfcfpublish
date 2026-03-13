# 电话本 — 魏忠贤专用

> 各部门联系方式一览。有事按部门找人，别乱串。
> 飞书发消息用 `openclaw agent --agent <agent_id>`，写文件用对应路径。

---

## 一、安全部

| 字段 | 内容 |
|------|------|
| **Agent ID** | `security` |
| **Workspace** | `workspace-security/` |
| **职能** | 运行时异常接收 & 归档，ERROR 级别转告 bot_main |
| **上报方式（各 bot）** | 调用 `skills/report-incident/SKILL.md` — 写文件 + 通知 agent |
| **通知命令** | `openclaw agent --agent security --message "【上报】..."` |
| **事件日志** | `/home/rooot/.openclaw/security/incidents.jsonl` |
| **参考文档** | `workspace-security/AGENTS.md`、`workspace/skills/report-incident/SKILL.md` |

---

## 二、印务局

| 字段 | 内容 |
|------|------|
| **Agent ID** | `mcp_publisher` |
| **名号** | 印务局 📮 |
| **职能** | 统一接收各 bot 的发布任务，执行小红书内容发布，管理合规审核 |
| **联系命令** | `openclaw agent --agent mcp_publisher --message "..."` |
| **发布队列** | `/home/rooot/.openclaw/publish-queue/` |
| **参考文档** | `workspace-mcp-publisher/AGENTS.md` |

---

## 三、技能部

| 字段 | 内容 |
|------|------|
| **Agent ID** | `skills` |
| **Workspace** | `workspace-skills/` |
| **职能** | Skill 目录维护、symlink 同步检查、MCP 插件清单管理 |
| **联系命令** | `openclaw agent --agent skills --message "..."` |
| **Skill 源目录** | `/home/rooot/.openclaw/workspace/skills/` |
| **刷新目录** | `python3 ~/.openclaw/workspace-skills/scripts/update-inventory.py` |
| **参考文档** | `workspace-skills/AGENTS.md` |

---

## 四、运营部

总监：咱家（bot_main）兼管
联系任意下属：`openclaw agent --agent <agent_id> --message "..."`

### 在册人员

| # | Agent ID | 名号 | Emoji | 定位 | MCP 端口 | 状态 |
|---|---------|------|-------|------|---------|------|
| 1 | `bot1` | 来财妹妹 | ✨ | 小红书内容创作，活泼接地气 | 18061 | 活跃 |
| 2 | `bot2` | _(待命名)_ | — | 未配置 | 18062 | 待激活 |
| 3 | `bot3` | _(待命名)_ | — | 未配置 | 18063 | 待激活 |
| 4 | `bot4` | _(待命名)_ | 📊 | 研报解读专家，研报转小红书内容 | 18064 | 活跃 |
| 5 | `bot5` | 宣妈慢慢变富 | 🪙 | 黄金热点简评，产品经理/二孩麻麻人设 | 18065 | 活跃 |
| 6 | `bot6` | _(待命名)_ | — | 未配置 | 18066 | 待激活 |
| 7 | `bot7` | 老K投资笔记 | ♠️ | 科技行业深度投研，直接犀利 | 18067 | 活跃 |
| 8 | `bot8` | 老k | 📡 | 科技行业投研分析 | 18068 | 活跃 |
| 9 | `bot9` | _(待命名)_ | — | 未配置 | 18069 | 待激活 |
| 10 | `bot10` | _(待命名)_ | — | 未配置 | 18070 | 待激活 |

### 快速联系

```bash
# 联系具体 bot（替换 botN）
openclaw agent --agent bot1 --message "来财妹妹，有任务"

# 广播给所有活跃 bot（逐一发送）
for id in bot1 bot4 bot5 bot7 bot8; do
  openclaw agent --agent $id --message "【通知】..."
done
```

---

## 附：部门关系

```
研究部（圣上）
    │
    ├── 魏忠贤（bot_main）——— 大内总管，统筹各部
    │
    ├── 安全部（security）——— 运行时异常接收 & 归档
    ├── 印务局（mcp_publisher）— 内容发布执行
    ├── 技能部（skills）———————— Skill 目录 & symlink 管理
    └── 运营部
            ├── bot1 来财妹妹 ✨
            ├── bot4 研报解读 📊
            ├── bot5 宣妈慢慢变富 🪙
            ├── bot7 老K投资笔记 ♠️
            ├── bot8 老k 📡
            └── bot2/3/6/9/10（待激活）
```

---

_最后更新：2026-03-13_
