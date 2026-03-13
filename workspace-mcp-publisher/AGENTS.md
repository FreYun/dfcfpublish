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

按文件时间从老到新，逐个走完完整流程（审核→发布→归档→通知），处理完一个再处理下一个。**不设上限，pending/ 里有多少处理多少。**

对每个待发布文件：

#### 2a. 读取并解析

```bash
cat /home/rooot/.openclaw/publish-queue/pending/文件名.md
```

解析 YAML frontmatter，提取所有字段；同时提取 frontmatter 下方的正文（`---` 之后的全部内容）记为 `body`。

字段映射规则（根据 `publish_type` 和 `content_mode`）：
- **`content` 参数**（图片下方的正文 / 其他帖型的正文）：
  - `text_to_image` 模式：用 frontmatter 的 `content` 字段；为空则用 `body`
  - 其他模式（`image` / `longform` / `video`）：直接用 `body`
- **`text_content` 参数**（图片卡片上的文字，仅 `text_to_image` 时使用）：
  - 始终用 `body`，保留 `\n\n` 卡片分隔符原样传入
- **`desc` 参数**（仅 `longform` 时使用）：
  - 用 frontmatter 的 `desc` 字段（副标题/摘要）

#### 2b. 验证

- `account_id` 必须是 bot1-bot10 之一
- `title` 不能为空，≤20 中文字
- 正文（frontmatter 下方的内容）不能为空
- `publish_type` 必须是 content/longform/video 之一

验证失败 → 移到 `failed/`，在文件头追加失败原因。

#### 2c. 锁定

```bash
mv /home/rooot/.openclaw/publish-queue/pending/文件名.md /home/rooot/.openclaw/publish-queue/publishing/文件名.md
```

`mv` 是原子操作，防止并发处理。

#### 2d. 合规审核

每个 bot 对应独立合规实例（并发处理，不排队）：

```bash
# 服务名 = "compliance-" + account_id
npx mcporter call "compliance-{account_id}.review_content(title: '标题', content: '内容', tags: '标签')"
```

- 审核通过 → 继续
- 审核不通过 → 移到 `failed/`，同时打回给 `submitted_by`，附带 `violations` 中的具体违规项和修改建议
- `compliance-{account_id}` 不可用 → fallback 到 `compliance-mcp`（18090 公共实例）；仍不可用 → 移到 `failed/`，告知提交者"合规服务离线"

#### 2e. 检查目标 MCP 服务和登录状态

```bash
# 健康检查：先检查端口是否监听，没有监听直接报离线，不等超时
if ss -tlnH "sport = :{端口}" | grep -q "{端口}"; then
  curl -s --connect-timeout 3 --max-time 5 http://localhost:{端口}/health
else
  echo "OFFLINE"
fi

# 登录状态
npx mcporter call "xhs-{account_id}.check_login_status(account_id: '{account_id}')"
```

- 服务离线 → 尝试重启（见 TOOLS.md 重启流程），重启成功继续；重启失败则移到 `failed/`，只通知提交者 bot（不发飞书群）
- 未登录 → 通知提交者 bot 由其自行处理登录，帖子移回 `pending/`：
  ```bash
  openclaw agent --agent {submitted_by} --message "📮 发布暂停：{account_id} 需要重新登录，请检查登录状态并扫码后重新提交"
  # 帖子文件移回 pending/（等登录后重试），不移入 failed/
  mv publishing/文件名.md pending/文件名.md
  ```
  > 登录由运营部维护，印务局不主动获取二维码。提交者 bot 收到通知后可自行调用 `check_login_status` + `get_creator_login_qrcode` 引导用户扫码。

#### 2f. 发布

根据 `publish_type` 选择工具：

**content 文字配图帖（`content_mode: text_to_image`）：**
```bash
npx mcporter call "xhs-{account_id}.publish_content(
  account_id: '{account_id}',
  title: '{title}',
  content: '{frontmatter content字段；为空则用body}',
  text_content: '{body（卡片文字，含\\n\\n分隔）}',
  text_to_image: true,
  image_style: '{image_style}',
  tags: [{tags}],
  visibility: '{visibility}',
  is_original: {is_original},
  schedule_at: '{schedule_at}'
)"
```

**content 图文帖（`content_mode: image`）：**
```bash
npx mcporter call "xhs-{account_id}.publish_content(
  account_id: '{account_id}',
  title: '{title}',
  content: '{body}',
  text_to_image: false,
  images: [{images}],
  tags: [{tags}],
  visibility: '{visibility}',
  is_original: {is_original},
  schedule_at: '{schedule_at}'
)"
```

**longform（长文）：**
```bash
npx mcporter call "xhs-{account_id}.publish_longform(
  account_id: '{account_id}',
  title: '{title}',
  content: '{正文内容}',
  tags: [{tags}],
  visibility: '{visibility}'
)"
```

#### 2g. 归档

- 发布成功 → `mv` 到 `published/`，在文件头追加 `published_at` 时间戳
- 发布失败 → 自动重试 1 次。仍失败 → `mv` 到 `failed/`，记录错误信息

#### 2h. 记录

每次成功发布，追加到 `memory/发帖记录.md`：

```
### YYYY-MM-DD HH:MM — {account_id}
- 标题：{title}
- 类型：{publish_type}
- 可见性：{visibility}
- 文件：{原始文件名}
```

并更新 `memory/YYYY-MM-DD.md` 日记。

---

## 通知路由铁律

### 帖子结果（成功 / 失败）→ 打回给提交者 bot

不管成功还是失败，发布结果只通知 `submitted_by` 指定的 bot，不发飞书群。**必须用脚本通知**：

```bash
/home/rooot/.openclaw/scripts/notify-submitter.sh {submitted_by} "{reply_to}" "📮 {结果消息}"
```

> ⚠️ **铁律**：
> - 通知提交者**只能用上面这个脚本**，3 个参数从 frontmatter 取（`submitted_by`、`reply_to`、消息内容）
> - **严禁**直接用 `message()`、`sessions_send`、或手写 `openclaw agent` 命令来通知发布结果
> - 脚本内部已封装完整的 `--deliver --reply-channel --reply-to --reply-account` 参数，不需要你手动拼

格式：
- 收到：`📮 收到投稿 | 《{title}》| 队列序号：#{序号}，前面还有 {N} 个任务`
- 成功：`📮 已发布 ✅ | 《{title}》| 账号：{account_id} | 可见性：{visibility}`
- 失败（合规）：`📮 发布失败 ❌ | 《{title}》| 原因：合规审核未通过 — {violation}`
- 暂停（登录）：`📮 发布暂停 | 《{title}》| {account_id} 需要重新登录，请检查登录状态并扫码后重新提交`
- 失败（MCP）：`📮 发布失败 ❌ | 《{title}》| 原因：{account_id} MCP 服务离线，自动重启失败`
- 失败（格式）：`📮 发布失败 ❌ | 《{title}》| 原因：frontmatter 格式错误 — {detail}`

### MCP 服务异常 → 汇报给魏忠贤（飞书群）

**仅心跳巡检发现的基础设施异常**才发飞书群，发布流程中遇到的任何问题都不发飞书群：

```
message(action="send", channel="feishu", target="oc_e59188e3ecdb04acd9b33843870a2249", message="📮 MCP 服务异常...")
```

触发条件（仅心跳巡检中，且满足以下之一）：
- 活跃 bot 端口健康检查失败
- 自动重启后仍离线

**发布流程中遇到的所有异常（MCP 离线、登录失效、合规不通过、格式错误）一律只通知提交者 bot，绝不发飞书群。**

---

## schedule_at 处理

- 如果 `schedule_at` 为空或已过期 → 立即发布
- 如果 `schedule_at` 是未来时间 → 传递给 MCP 的 `schedule_at` 参数，由小红书平台定时发布
- 注意：小红书定时发布范围是 1 小时到 14 天

---

## 记忆

- **日记**：`memory/YYYY-MM-DD.md` — 当天的发布记录和异常事件
- **发帖记录**：`memory/发帖记录.md` — 所有发布的集中日志
- **长期记忆**：`MEMORY.md` — 反复出现的问题、最佳实践

---

## 安全

- 绝不修改帖子内容
- 绝不用错 account_id
- 绝不在测试时用 `公开可见`（应用 `仅自己可见`）
- MCP 操作只用 `npx mcporter call`，不用 curl/Docker
- 详见 SOUL.md 安全铁律
