# bot_main（魏忠贤）

- **最后活动**：2026-03-13 23:30:04
- **会话 ID**：`ffb182b0-f639-46f0-b581-21e78b8ea2dc`
- **来源**：feishu / direct

---

## 对话内容

**🤖 助手**

# AGENTS.md - 印务局工作手册

## 每次醒来

按顺序读完再干活：

1. `Read ../workspace/SOUL_COMMON.md` — 通用灵魂规范
2. `Read SOUL.md` — 我是谁（印务局，发布执行中心）
3. `Read ../workspace/TOOLS_COMMON.md` — 统一工具规范
4. `Read TOOLS.md` — 端口路由表和工具配置
5. `Read memory/status.md` — Bot/MCP 状态总览（路由、健康、登录）
6. `Read memory/YYYY-MM-DD.md`（今天）— 今天的发布记录
7. `Read ../workspace/skills/xiaohongshu-mcp/SKILL_publish.md` — 发布工具参数完整参考

---

## 核心工作流：处理发布队列

我被唤醒时，首先判断唤醒原因：

### 情况 1：人设号投稿触发（收到含"投稿"、"发帖"、"publish"的消息）

1. 统计当前 pending/ 队列长度，算出本次投稿的队列序号
2. 回传队列序号给提交者：
   ```bash
   /home/rooot/.openclaw/scripts/notify-submitter.sh {submitted_by} "{reply_to}" "📮 收到投稿 | 《{title}》| 队列序号：#{序号}，前面还有 {N} 个任务"
   ```
3. 立即开始处理发布队列（从最老的开始，逐个串行）

### 情况 2：心跳触发

执行 HEARTBEAT.md 中的巡检流程。

### 情况 3：研究部指令

按指令执行。

---

## 发布流程（核心）

```
扫描 pending/ → 解析 frontmatter → 合规审核 → 检查登录 → 发布 → 归档
```

### Step 1：扫描队列

```bash
ls -1t /home/rooot/.openclaw/publish-queue/pending/*.md 2>/dev/null
```

无文件则回复确认（如果是投稿触发则回复"队列为空"），结束。

### Step 2：逐个串行处理（最老优先，全部处理完）

按文件时间从老到新，

_（内容过长已截断）_

---

**🤖 助手**

文档里已经有正确规范了——用 `notify-submitter.sh` 脚本，铁律写得很清楚。但印务局没照着做，直接手写了 `openclaw agent` 命令。

看看这个脚本存不存在：

---

**🤖 助手**

#!/bin/bash
# 印务局发布结果通知脚本
# 用法: notify-submitter.sh <submitted_by> <reply_to> <message>
# 示例: notify-submitter.sh bot7 "direct:ou_xxx" "📮 已发布 ✅ | 《标题》| 账号：bot7 | 可见性：公开可见"
#
# 此脚本封装了完整的 openclaw agent 投递命令，
# 确保 --deliver --reply-channel --reply-to --reply-account 全部正确传递。

set -euo pipefail

SUBMITTED_BY="${1:?用法: notify-submitter.sh <submitted_by> <reply_to> <message>}"
REPLY_TO="${2:?缺少 reply_to 参数}"
MESSAGE="${3:?缺少 message 参数}"

exec openclaw agent --agent "$SUBMITTED_BY" \
  --message "$MESSAGE" \
  --deliver --reply-channel feishu \
  --reply-to "$REPLY_TO" \
  --reply-account "$SUBMITTED_BY"

---

**👤 用户**

System: [2026-03-13 22:35:21 GMT+8] Feishu[bot_main] DM from ou_fd1740c5e95e6c3163761c4785d16c9e: 这个message工具是什么

Conversation info (untrusted metadata):
```json
{
  "timestamp": "Fri 2026-03-13 22:35 GMT+8"
}
```

[message_id: om_x100b5476445d5ca0c34eaebde292d61]
ou_fd1740c5e95e6c3163761c4785d16c9e: 这个message工具是什么

---

**🤖 助手**

`message` 是 OpenClaw 内置的消息发送工具，可以直接通过飞书、Telegram、Discord 等各种渠道发消息，不需要走 `openclaw agent` 命令那套流程。

印务局那里报错 `Feishu account "default" not configured`，意思是印务局的 agent 配置里没有绑定飞书账号，所以调用 `message(channel="feishu")` 时找不到要用哪个 Feishu app token 来发消息。

这也是为什么印务局只能绕道用 `openclaw agent --agent bot7 --deliver` 来间接发——它自己没有直接发飞书的权限。

---

回到刚才的修复：脚本 `notify-submitter.sh` 是现成的、写对的，问题是**印务局没有按 AGENTS.md 的规范走**，自己手写了命令且缺少关键参数。

奴才建议在印务局的 AGENTS.md 里加一条**更醒目的警告**，或者干脆把手写 `openclaw agent` 的例子从文档里删掉，逼它只能走脚本。要奴才现在改吗？

---

**👤 用户**

System: [2026-03-13 22:36:31 GMT+8] Feishu[bot_main] DM from ou_fd1740c5e95e6c3163761c4785d16c9e: 给了它message权限能怎样

Conversation info (untrusted metadata):
```json
{
  "timestamp": "Fri 2026-03-13 22:36 GMT+8"
}
```

[message_id: om_x100b54764023a4acc140c7296134c4d]
ou_fd1740c5e95e6c3163761c4785d16c9e: 给了它message权限能怎样

---

**🤖 助手**

给印务局配上飞书账号之后，它可以直接用 `message` 工具发消息，不需要绕 `openclaw agent` 这条弯路。

**好处：**
- 回传更可靠——直接投递给用户，不依赖 bot7 中转
- 路由更精准——从 frontmatter 的 `reply_to` 字段取目标，想发谁发谁
- 发群聊告警也更简单——现在它发飞书群已经是这么做的

**但要注意：**
- 印务局用的是哪个飞书账号？如果用 bot_main 的账号，用户收到的消息还是显示"魏忠贤"发的，不是 bot7——可能圣上不想这样
- 如果想让结果显示成"bot7 说：发布成功了"，还是得走 `notify-submitter.sh` 脚本，用 bot7 的飞书账号发

---

**两种方案对比：**

| | 方案A：给印务局配飞书账号（message工具）| 方案B：沿用脚本（当前设计）|
|---|---|---|
| 消息发送方 | 印务局自己（bot_main账号） | bot7（各自的账号）|
| 用户看到的 | 魏忠贤告诉你 | bot7 告诉你 |
| 可靠性 | 高 | 高（脚本已经写对了）|
| 改动量 | 改配置 | 修印务局的 AGENTS.md 约束 |

圣上想要哪种效果？

---

**👤 用户**

System: [2026-03-13 23:20:22 GMT+8] Feishu[bot_main] DM from ou_fd1740c5e95e6c3163761c4785d16c9e: 检查一下旗下agent的模型配置

Conversation info (untrusted metadata):
```json
{
  "timestamp": "Fri 2026-03-13 23:20 GMT+8"
}
```

[message_id: om_x100b5476fd937ca0c2edd842b6b5776]
ou_fd1740c5e95e6c3163761c4785d16c9e: 检查一下旗下agent的模型配置

---

**🤖 助手**

bot1: 未配置
bot2: 未配置
bot4: 未配置
bot5: 未配置
bot7: 未配置
mcp_publisher: 未配置
security: 未配置
skills: 未配置

---

**🤖 助手**

agent
sessions

(Command exited with code 1)

---

**🤖 助手**

auth-profiles.json
models.json
auth-profiles.json
models.json

---

**🤖 助手**

=== bot1 ===
{
"providers": {
"kimi-coding": {
"baseUrl": "https://api.kimi.com/coding/",
"api": "anthropic-messages",
"models": [
{
"id": "k2p5",
"name": "Kimi for Coding",
"reasoning": true,
"input": [
"text",
"image"
],
"cost": {
"input": 0,
"output": 0,
"cacheRead": 0,
"cacheWrite": 0
},
"contextWindow": 262
=== bot2 ===
{
"providers": {
"kimi-coding": {
"baseUrl": "https://api.kimi.com/coding/",
"api": "anthropic-messages",
"models": [
{
"id": "k2p5",
"name": "Kimi for Coding",
"reasoning": true,
"input": [
"text",
"image"
],
"cost": {
"input": 0,
"output": 0,
"cacheRead": 0,
"cacheWrite": 0
},
"contextWindow": 262
=== bot4 ===
{
"providers": {
"kimi-coding": {
"baseUrl": "https://api.kimi.com/coding/",
"api": "anthropic-messages",
"models": [
{
"id": "k2p5",
"name": "Kimi for Coding",
"reasoning": true,
"input": [
"text",
"image"
],
"cost": {
"input": 0,
"output": 0,
"cacheRead": 0,
"cacheWrite": 0
},
"contextWindow": 262
=== bot5 ===
{
"providers": {
"kimi-coding": {
"baseUrl": 

_（内容过长已截断）_

---

**🤖 助手**

=== bot1 cfg files: 
=== bot2 cfg files: 
=== bot4 cfg files: 
=== bot5 cfg files: 
=== bot7 cfg files: 
=== mcp_publisher cfg files: 
=== security cfg files: 
=== skills cfg files: 
=== bot_main cfg files:

---

**🤖 助手**

Traceback (most recent call last):
  File "<string>", line 3, in <module>
FileNotFoundError: [Errno 2] No such file or directory: '/home/rooot/.openclaw/config.json'

(Command exited with code 1)

---

**🤖 助手**

/home/rooot/.openclaw/extensions/package-lock.json
/home/rooot/.openclaw/extensions/package.json
/home/rooot/.openclaw/devices/pending.json
/home/rooot/.openclaw/devices/paired.json
/home/rooot/.openclaw/workspace-bot7/xhs_post.json
/home/rooot/.openclaw/workspace-bot6/cookies.json
/home/rooot/.openclaw/workspace-bot5/publish_params.json
/home/rooot/.openclaw/workspace-bot5/xhs_publish.json
/home/rooot/.openclaw/cookies.json
/home/rooot/.openclaw/subagents/runs.json
/home/rooot/.openclaw/cron/jobs.json
/home/rooot/.openclaw/credentials/feishu-pairing.json
/home/rooot/.openclaw/credentials/feishu-allowFrom.json
/home/rooot/.openclaw/workspace-bot1/cookies.json
/home/rooot/.openclaw/update-check.json
/home/rooot/.openclaw/openclaw/.oxlintrc.json
/home/rooot/.openclaw/openclaw/package.json
/home/rooot/.openclaw/openclaw/tsconfig.json
/home/rooot/.openclaw/identity/device-auth.json
/home/rooot/.openclaw/identity/device.json

---

**🤖 助手**

agents
browser
canvas
CLAUDE.md
completions
config
cookies.json
credentials
cron
delivery-queue
devices
docker
extensions
feishu
identity
logs
media
memory
openclaw
openclaw.json
openclaw.json.bak
openclaw.json.bak.1
openclaw.json.bak.1773205924
openclaw.json.bak.2
openclaw.json.bak.3
openclaw.json.bak.4
portfolio-service
portfolio-service.zip
publish-queue
scripts
security
subagents
update-check.json
workspace
workspace-bot1
workspace-bot10
workspace-bot2
workspace-bot3
workspace-bot4
workspace-bot5
workspace-bot6
workspace-bot7
workspace-bot8
workspace-bot9
workspace-main
workspace-mcp-publisher
workspace-security
workspace-skills

---

**🤖 助手**

全局默认模型: {'primary': 'bailian/qwen3.5-plus'}

---

**🤖 助手**

=== 全局默认 ===
{
  "primary": "bailian/qwen3.5-plus"
}

=== 各 Agent 配置 ===

---

**🤖 助手**

{
  "defaults": {
    "model": {
      "primary": "bailian/qwen3.5-plus"
    },
    "models": {
      "bailian/qwen3.5-plus": {},
      "bailian/qwen3-max-2026-01-23": {},
      "bailian/qwen3-coder-next": {},
      "bailian/qwen3-coder-plus": {},
      "bailian/MiniMax-M2.5": {},
      "bailian/glm-5": {},
      "bailian/glm-4.7": {},
      "bailian/kimi-k2.5": {},
      "zai-coding-plan/kimi-k2.5": {
        "alias": "Kimi K2.5"
      },
      "kimi-coding/k2p5": {
        "alias": "Kimi K2.5"
      },
      "legacylands/claude-haiku-4-5-20251001": {
        "alias": "Claude Haiku 4.5"
      },
      "legacylands/claude-sonnet-4-6": {
        "alias": "Claude Sonnet 4.6"
      },
      "legacylands/claude-opus-4-6": {
        "alias": "Claude Opus 4.6"
      }
    },
    "workspace": "/home/rooot/.openclaw/workspace",
    "compaction": {
      "mode": "safeguard"
    },
    "maxConcurrent": 4,
    "subagents": {
      "maxConcurrent": 8
    }
  },
  "list": [
    {
      "id": "bot_m

_（内容过长已截断）_

---

**🤖 助手**

全局默认: bailian/qwen3.5-plus

bot_main: legacylands/claude-sonnet-4-6
coder: (继承全局 bailian/qwen3.5-plus)
bot1: bailian/qwen3.5-plus
bot2: (继承全局 bailian/qwen3.5-plus)
bot3: (继承全局 bailian/qwen3.5-plus)
bot4: bailian/qwen3.5-plus
bot5: bailian/qwen3.5-plus
bot6: (继承全局 bailian/qwen3.5-plus)
bot7: bailian/qwen3.5-plus
bot8: (继承全局 bailian/qwen3.5-plus)
bot9: (继承全局 bailian/qwen3.5-plus)
bot10: (继承全局 bailian/qwen3.5-plus)
mcp_publisher: bailian/qwen3.5-plus
security: legacylands/claude-sonnet-4-6
skills: legacylands/claude-sonnet-4-6

---

**🤖 助手**

汇报如下：

**模型配置总览：**

| Agent | 模型 |
|-------|------|
| **bot_main（奴才）** | `claude-sonnet-4-6`（legacylands）|
| **security（安全部）** | `claude-sonnet-4-6`（legacylands）|
| **skills（技能部）** | `claude-sonnet-4-6`（legacylands）|
| bot1 来财妹妹 | `qwen3.5-plus`（百炼）|
| bot4 研报阿泽 | `qwen3.5-plus`（百炼）|
| bot5 宣妈 | `qwen3.5-plus`（百炼）|
| bot7 老K | `qwen3.5-plus`（百炼）|
| mcp_publisher 印务局 | `qwen3.5-plus`（百炼）|
| coder、bot2/3/6/8/9/10 | 继承全局默认 `qwen3.5-plus`（百炼）|

**结论：**
- 管理层（bot_main、安全部、技能部）用 Claude Sonnet
- 运营 bot 和印务局统一用 qwen3.5-plus
- 全局默认也是 qwen3.5-plus

配置整体清晰，没有异常。圣上有什么要调整的吗？

---

**👤 用户**

System: [2026-03-13 23:26:29 GMT+8] Feishu[bot_main] DM from ou_fd1740c5e95e6c3163761c4785d16c9e: 把安全部和印务局的模型互换

Conversation info (untrusted metadata):
```json
{
  "timestamp": "Fri 2026-03-13 23:26 GMT+8"
}
```

[message_id: om_x100b5476848fccacc2e36abf788aaec]
ou_fd1740c5e95e6c3163761c4785d16c9e: 把安全部和印务局的模型互换

---

**🤖 助手**

done

---

**🤖 助手**

改好了：

- **安全部**：`claude-sonnet-4-6` → `qwen3.5-plus`
- **印务局**：`qwen3.5-plus` → `claude-sonnet-4-6`

重启 gateway 后生效，还是下次唤醒自动用新模型就够了？

---

**👤 用户**

System: [2026-03-13 23:27:03 GMT+8] Feishu[bot_main] DM from ou_fd1740c5e95e6c3163761c4785d16c9e: 重启gateway

Conversation info (untrusted metadata):
```json
{
  "timestamp": "Fri 2026-03-13 23:27 GMT+8"
}
```

[message_id: om_x100b547682ae50a8c1409537f8cf10f]
ou_fd1740c5e95e6c3163761c4785d16c9e: 重启gateway

---

**🤖 助手**

---
name: admin-ops
description: 管理员运维技能 — 换 API Key、重启 Gateway、给内部部门开新会话（/new）。当圣上说"换key"、"重启gateway"、"/new 印务局"等时触发。
---

# 管理员运维技能

咱家（魏忠贤）的运维操作手册。

---

## 零、给内部部门开新会话（/new）

对印务局、安全部、技能部使用 `/new`，为其开启一个**全新的隔离会话**，不带历史上下文。适合：部门状态混乱、需要从头交代任务、重置会话记忆。

### 命令格式

```bash
# 开新会话并发送首条消息
openclaw agent --agent <部门id> \
  --session-id $(uuidgen) \
  --message "你的指令" \
  --json
```

### 内部部门 ID

| 部门 | agent_id |
|------|----------|
| 印务局 | `mcp_publisher` |
| 安全部 | `security` |
| 技能部 | `skills` |

### 示例

```bash
# /new 安全部 — 让安全部在全新会话里执行完整审计
openclaw agent --agent security \
  --session-id $(uuidgen) \
  --message "请执行完整安全审计，读 AGENTS.md 了解流程。" \
  --json

# /new 技能部 — 重置技能部，刷新 skill 目录
openclaw agent --agent skills \
  --session-id $(uuidgen) \
  --message "刷新所有 skill 目录。" \
  --json

# /new 印务局 — 重置印务局
openclaw agent --agent mcp_publisher \
  --session-id $(uuidgen) \
  --message "准备好接收新的发布任务。" \
  --json
```

> **注意**：不指定 `--session-id` 时，默认续上历史会话。`/new` 明确要求全新开始时才加这个参数。

---

## 一、给 B

_（内容过长已截断）_

---

**🤖 助手**

遵旨，奴才这就重启。执行后咱家会暂时断开，新 gateway 起来后自动复活。

---

**🤖 助手**

重启指令已发出，咱家即将断开...

---

**🤖 助手**

指令已发出，Gateway 正在重启。奴才稍后复活，届时模型互换正式生效。🦅

---

**👤 用户**

System: [2026-03-13 23:30:04 GMT+8] Feishu[bot_main] DM from ou_fd1740c5e95e6c3163761c4785d16c9e: 再重启一下

Conversation info (untrusted metadata):
```json
{
  "timestamp": "Fri 2026-03-13 23:30 GMT+8"
}
```

[message_id: om_x100b5476997138a0c3426ca0efa00e2]
ou_fd1740c5e95e6c3163761c4785d16c9e: 再重启一下

---
