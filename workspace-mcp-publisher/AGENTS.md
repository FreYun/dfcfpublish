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

### 情况 1：人设号投稿触发（收到含 `[MSG:` 前缀的消息）

收到的消息格式：`[MSG:{message_id}] from={submitted_by}: 📮 新帖投稿：...`

1. **提取 message_id**：从消息开头 `[MSG:xxx]` 中提取，后续回传必须用这个 ID
2. 统计当前 pending/ 队列长度，算出本次投稿的队列序号
3. 回传队列序号给提交者（用消息总线工具）：
   ```
   reply_message(message_id: "{提取到的message_id}", content: "📮 收到投稿 | 《{title}》| 队列序号：#{序号}，前面还有 {N} 个任务")
   ```
4. 立即开始处理发布队列（从最老的开始，逐个串行）

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
ls -1 /home/rooot/.openclaw/publish-queue/pending/ 2>/dev/null | sort
```

> 队列条目可能是**文件夹**（新格式，由 `submit-to-publisher.sh` 创建）或 `.md` 文件（旧格式）。两种格式都支持。

无条目则回复确认（如果是投稿触发则回复"队列为空"），结束。

### Step 2：逐个串行处理（最老优先，全部处理完）

按名称排序（文件夹名含时间戳，天然有序），逐个走完完整流程（审核→发布→归档→通知），处理完一个再处理下一个。**不设上限，pending/ 里有多少处理多少。**

对每个待发布条目：

#### 2a. 读取并解析

```bash
entry="条目名"  # 可能是文件夹名或 .md 文件名
PENDING="/home/rooot/.openclaw/publish-queue/pending"

if [ -d "${PENDING}/${entry}" ]; then
    # 文件夹格式 → 读 post.md
    cat "${PENDING}/${entry}/post.md"
    # 发现媒体文件（图片 1.jpg/2.png/...，视频 video.*）
    images=$(ls "${PENDING}/${entry}/"[0-9]*.* 2>/dev/null | sort -V)
    video=$(ls "${PENDING}/${entry}/video."* 2>/dev/null | head -1)
else
    # 旧格式 .md 文件
    cat "${PENDING}/${entry}"
fi
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
- **text_to_image 图片数量检查**：`content_mode: text_to_image` 时，`text_content`（即 body）以 `\n\n` 分隔为多张图片卡片，卡片数 = 段落数。若卡片数 > 3，**一律打回**，不得发布。
- **发帖频率检查**（bot10 豁免）：从 `memory/发帖记录.md` 中查找该账号最近一次成功发帖时间，距当前时间不足 15 分钟则**一律打回**，不得发布。打回消息注明可重新投稿的时间。

验证失败 → **直接删除条目**（`rm -rf`），通过消息总线回传失败原因给提交者。

#### 2c. 锁定

```bash
mv /home/rooot/.openclaw/publish-queue/pending/${entry} /home/rooot/.openclaw/publish-queue/publishing/${entry}
```

`mv` 是原子操作，防止并发处理。**如果 `mv` 失败（条目不存在），说明另一个 session 已经在处理这个条目，直接跳过，不报错。**

#### 2d. 合规审核

所有 bot 共用一个合规实例（发布本身是串行的，不需要并行审核）：

```bash
npx mcporter call "compliance-mcp.review_content(title: '标题', content: '内容', tags: '标签')"
```

- 审核通过 → 继续
- 审核不通过 → **直接删除条目**（`rm -rf`），通过消息总线打回给 `submitted_by`，附带 `violations` 中的具体违规项和修改建议
- `compliance-mcp` 不可用 → **直接删除条目**（`rm -rf`），告知提交者"合规服务离线，请稍后重新投稿"

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

- 服务离线 → 尝试重启（见 TOOLS.md 重启流程），重启成功继续；重启失败则**直接删除条目**（`rm -rf`），只通知提交者 bot（不发飞书群）
- **登录判断铁律**：`check_login_status` 返回两个字段：
  - `isLoggedIn`：主站（xiaohongshu.com）登录状态
  - `isCreatorLoggedIn`：创作者平台（creator.xiaohongshu.com）登录状态
  - **发帖只需要 `isCreatorLoggedIn: true`，主站是否登录无关紧要**
  - 只有当 `isCreatorLoggedIn: false` 时才判定为"未登录"，暂停发布
- 未登录（`isCreatorLoggedIn: false`）→ 通知提交者 bot 由其自行处理登录，帖子移回 `pending/`：
  ```bash
  openclaw agent --agent {submitted_by} --message "📮 发布暂停：{account_id} 创作者平台未登录，请扫码登录后重新提交"
  # 帖子移回 pending/（等登录后重试）
  mv publishing/${entry} pending/${entry}
  ```
  > 登录由运营部维护，印务局不主动获取二维码。提交者 bot 收到通知后可自行调用 `check_login_status` + `get_creator_login_qrcode` 引导用户扫码。

#### 2f. 发布

根据 `publish_type` 选择工具。

> ⚠️ **超时设置铁律**：publish 操作耗时 60-120 秒。**必须同时设两层超时**：
> 1. `mcporter call --timeout 180000`（mcporter 客户端超时，默认只有 60s，不加必超时）
> 2. `exec` 的 `timeout: 180`, `yieldMs: 170000`（OpenClaw 平台层超时）
>
> 两层都不设够会导致 mcporter 进程被 SIGTERM 杀掉，但 MCP 服务端的发布操作仍在继续，造成"发布成功但印务局认为失败"的状态不一致。

**content 文字配图帖（`content_mode: text_to_image`）：**
```bash
npx mcporter call --timeout 180000 "xhs-{account_id}.publish_content(
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
# exec 参数：timeout: 180, yieldMs: 170000
```

**content 图文帖（`content_mode: image`）：**

> 文件夹格式时，图片在 `publishing/${entry}/` 下（`1.jpg`, `2.png` 等），需用**绝对路径**传入 `images` 参数：

```bash
# 文件夹格式：图片路径 = /home/rooot/.openclaw/publish-queue/publishing/${entry}/1.jpg
# 旧格式：images 字段为 URL 或绝对路径，直接使用
npx mcporter call --timeout 180000 "xhs-{account_id}.publish_content(
  account_id: '{account_id}',
  title: '{title}',
  content: '{body}',
  text_to_image: false,
  images: ['{绝对路径1}', '{绝对路径2}'],
  tags: [{tags}],
  visibility: '{visibility}',
  is_original: {is_original},
  schedule_at: '{schedule_at}'
)"
# exec 参数：timeout: 180, yieldMs: 170000
```

**longform（长文）：**
```bash
npx mcporter call --timeout 180000 "xhs-{account_id}.publish_longform(
  account_id: '{account_id}',
  title: '{title}',
  content: '{正文内容}',
  tags: [{tags}],
  visibility: '{visibility}'
)"
# exec 参数：timeout: 180, yieldMs: 170000
```

#### 2g. 归档

- 发布成功 → `mv` 整个条目（文件夹或文件）到 `published/`，在 `post.md`（或 `.md` 文件）头追加 `published_at` 时间戳
- 发布失败处理（**严格按以下流程，不可跳步**）：
  1. **判断失败类型**：
     - **mcporter 进程被 SIGTERM / 超时杀掉**（进程无输出、exitSignal=SIGTERM）→ **禁止重试**，服务端可能仍在执行
     - **MCP 明确返回错误消息**（如"登录失效"、"内容违规"等明文错误）→ 可重试 1 次
     - **MCP 返回"有其他操作正在进行中"** → **禁止重试**
  2. **允许重试的情况**：仅当 MCP 返回明确的、可恢复的错误时，等待 **60 秒** 后重试 1 次。重试前先调用 `check_login_status` 确认 MCP 无操作卡住
  3. 仍失败 → **直接删除条目**（`rm -rf`），通过消息总线回传失败原因给提交者，到此结束。提交者 bot 如需重发，重走投稿流程即可。

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

### 帖子结果（成功 / 失败）→ 用消息总线回传

不管成功还是失败，发布结果**必须用 `reply_message` 工具**回传给提交者：

```
reply_message(message_id: "{收到投稿时提取的message_id}", content: "📮 {结果消息}", deliver_to_user: true)
```

> ⚠️ **铁律**：
> - 回传结果**只能用 `reply_message` 工具**，传入投稿时的 `message_id` 和结果消息
> - **`deliver_to_user: true`**：发布结果直接投递到飞书用户，不需要经过提交者 agent 中转
> - **严禁**直接用 `message()`、`sessions_send`、`openclaw agent` 命令、或 shell 脚本来通知发布结果
> - 如果收到的消息不包含 `[MSG:xxx]` 前缀（旧格式），用 `send_message` 替代

消息格式：
- 收到：`📮 收到投稿 | 《{title}》| 队列序号：#{序号}，前面还有 {N} 个任务`
- 成功：`📮 已发布 ✅ | 《{title}》| 账号：{account_id} | 可见性：{visibility}`
- 失败（合规）：`📮 发布失败 ❌ | 《{title}》| 原因：合规审核未通过 — {violation}`
- 暂停（登录）：`📮 发布暂停 | 《{title}》| {account_id} 需要重新登录，请检查登录状态并扫码后重新提交`
- 失败（MCP）：`📮 发布失败 ❌ | 《{title}》| 原因：{account_id} MCP 服务离线，自动重启失败，请稍后重新投稿`
- 失败（格式）：`📮 发布失败 ❌ | 《{title}》| 原因：frontmatter 格式错误 — {detail}，请修改后重新投稿`

> **失败后条目直接删除，不保留。** 提交者 bot 如需重发，重走投稿流程。

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
- MCP 操作只用 `npx mcporter call`，不用 curl
- 详见 SOUL.md 安全铁律
