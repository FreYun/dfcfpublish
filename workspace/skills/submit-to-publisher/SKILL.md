# 投稿到印务局（发布队列）

写完帖子后，**不再直接调用 publish 工具**，直接提交到发布队列。印务局会做合规审核：通过则发布，不通过则打回修改意见。**打回时读 `skills/xhs-operate/合规速查.md`，按违规项修改后重新投稿。**

---

## 帖子格式：YAML frontmatter + 正文

**文字配图帖**：正文 = 图片卡片上的文字（`text_content`），`content` 字段 = 图片下方的正文（与卡片文字平级，可相同可不同）。
**其他帖型**：正文 = 帖子正文（`content`）。

---

## 三种帖型的 frontmatter 模板

### 类型 1：文字配图帖（最常用）

> 小红书把文字生成图片卡片，用空行（`\n\n`）分卡片。**正文是卡片上的文字（`text_content`），`content` 是图片下方的正文（可与卡片文字相同或不同）。**

```markdown
---
account_id: bot7
publish_type: content
content_mode: text_to_image

title: "标题（≤20中文字）"
content: "图片下方的正文，留空则自动用卡片文字填充"
visibility: "公开可见"
image_style: "基础"
tags: ["A股", "投资"]
schedule_at: ""
is_original: false
products: []

submitted_by: bot7
submitted_at: "2026-03-13T14:30:00+08:00"
reply_to: "direct:ou_xxx"
---

第一张卡片的完整内容
三到六行为佳，包含论点+数据

第二张卡片的完整内容
继续展开，每段之间空一行代表分卡片

第三张卡片（可选）
总结+互动引导
```

`image_style` 可选值：`基础`（默认）、`光影`、`涂写`、`书摘`、`涂鸦`、`便签`、`边框`、`手写`、`几何`

---

### 类型 2：图文帖（真实图片）

> 需要提供图片 URL 或本地路径，正文是配图说明文字。

```markdown
---
account_id: bot7
publish_type: content
content_mode: image

title: "标题（≤20中文字）"
visibility: "公开可见"
images:
  - "https://example.com/img1.jpg"
  - "/home/rooot/pics/img2.png"
tags: ["投资", "理财"]
schedule_at: ""
is_original: false
products: []

submitted_by: bot7
submitted_at: "2026-03-13T14:30:00+08:00"
reply_to: "direct:ou_xxx"
---

配图说明正文（≤1000字）
这里的内容会显示在图片下方
```

---

### 类型 3：长文帖

> 长文，内容不限长度，有副标题摘要字段。

```markdown
---
account_id: bot7
publish_type: longform

title: "长文标题（≤20中文字）"
desc: "长文摘要/副标题，显示在发布页，≤1000字"
visibility: "公开可见"
tags: ["A股", "研究"]
schedule_at: ""

submitted_by: bot7
submitted_at: "2026-03-13T14:30:00+08:00"
reply_to: "direct:ou_xxx"
---

长文正文（不限长度）

可以包含多个段落、分析、数据等...
```

---

### 类型 4：视频帖

```markdown
---
account_id: bot7
publish_type: video

title: "视频标题（≤20中文字）"
video: "/home/rooot/videos/clip.mp4"
visibility: "公开可见"
tags: ["投资"]
schedule_at: ""
products: []

submitted_by: bot7
submitted_at: "2026-03-13T14:30:00+08:00"
reply_to: "direct:ou_xxx"
---

视频配文（正文，会显示在视频下方）
```

---

## 字段说明

### 所有类型通用

| 字段 | 必填 | 说明 |
|------|------|------|
| `account_id` | ✅ | 你的 bot ID |
| `publish_type` | ✅ | `content` / `longform` / `video` |
| `title` | ✅ | ≤20 中文字 |
| `visibility` | ✅ | `公开可见` / `仅自己可见` / `仅互关好友可见` |
| `tags` | 否 | 2-4 字高频词，2-5 个，不含 `#` |
| `schedule_at` | 否 | 留空=立即发布，ISO8601=定时（1h~14天） |
| `is_original` | 否 | 原创声明，默认 false |
| `products` | 否 | 带货商品关键词，需账号开通该功能 |
| `submitted_by` | ✅ | 你的 bot ID |
| `submitted_at` | ✅ | 提交时间 ISO8601 |
| `reply_to` | ✅ | 当前飞书会话目标，格式 `direct:ou_xxx`（私信）或 `chat:oc_xxx`（群聊）；印务局回调时用此路由把结果发回给用户 |

### publish_type: content 专有

| 字段 | 必填 | 说明 |
|------|------|------|
| `content_mode` | ✅ | `text_to_image`（文字配图）或 `image`（真实图片） |
| `content` | 否 | 仅 `text_to_image` 时：图片下方的正文，与卡片文字平级；留空则用卡片文字代替 |
| `image_style` | 否 | 仅 `text_to_image` 时有效，默认 `基础` |
| `images` | 条件 | `image` 模式时必填，图片 URL 或本地路径列表 |

### publish_type: longform 专有

| 字段 | 必填 | 说明 |
|------|------|------|
| `desc` | 否 | 长文摘要/副标题，≤1000 字 |

### publish_type: video 专有

| 字段 | 必填 | 说明 |
|------|------|------|
| `video` | ✅ | 视频本地绝对路径 |

---

## 正文（content）格式规则

- 正文写在 frontmatter（第二个 `---`）下方
- **文字配图模式**：正文是**图片卡片上的文字**（`text_content`），用空行（`\n\n`）分隔卡片，每段生成一张图，最多 3 张；图片下方的正文用 frontmatter 的 `content` 字段（可与卡片文字不同）
- **图文/长文/视频模式**：正文是帖子描述，正常写即可，无特殊分隔要求

---

## 投稿步骤

### Step 1：生成文件名

```bash
filename="$(date +%Y-%m-%dT%H-%M-%S)_你的account_id_$(head /dev/urandom | tr -dc a-z0-9 | head -c6).md"
```

### Step 2：写入文件

选择对应模板，填写 frontmatter + 正文，写入 pending 目录。**`reply_to` 填当前飞书会话目标**（私信用户用 `direct:ou_xxx`，群聊用 `chat:oc_xxx`）：

```bash
cat > "publish-queue/pending/${filename}" << 'POSTEOF'
（完整文件内容，reply_to 填真实会话 ID）
POSTEOF
```

> `publish-queue/` 是你 workspace 内的 symlink，Write 工具或 Bash 都可以写。

### Step 3：触发印务局

```bash
openclaw agent --agent mcp_publisher --message "📮 新帖投稿：《{title}》${filename}，请处理发布队列"
```

### Step 4：告知用户，任务结束

立即回复用户："《{title}》已提交印务局，发布结果稍后通知。" **任务到此完成，不等待印务局回复。**

---

## 接收印务局回调

印务局处理完毕后会主动发消息触发你（新一轮对话），消息格式以 `📮` 开头。

**收到 `📮` 开头的消息时**：
1. 识别这是印务局的发布回调
2. 将结果原文转发给用户（飞书消息）
3. 任务完成，无需其他操作

```bash
# 转发给用户
message(action="send", message="{印务局原文}")
```

常见回调格式：
- `📮 收到投稿 | 《xxx》| 队列序号：#N，前面还有 M 个任务`（收到后立即回传）
- `📮 已发布 ✅ | 《xxx》| 账号：botN | 可见性：公开可见`
- `📮 发布失败 ❌ | 《xxx》| 原因：合规审核未通过 — {具体违规项}`
- `📮 发布暂停 | 《xxx》| botN 需要重新登录，请检查登录状态并扫码后重新提交`
- `📮 发布失败 ❌ | 《xxx》| 原因：frontmatter 格式错误 — {detail}`

---

## 查看发布状态

```bash
ls /home/rooot/.openclaw/publish-queue/published/ | grep ${account_id}
ls /home/rooot/.openclaw/publish-queue/failed/ | grep ${account_id}
```

---

## Fallback：直接发布

印务局不可用时，回退直接发布。先读 `skills/xiaohongshu-mcp/SKILL.md`。
