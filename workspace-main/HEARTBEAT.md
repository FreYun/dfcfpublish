# HEARTBEAT.md - 管理员巡检清单

## ⛔ 第一步：前置检查（必须先执行，不通过则直接回复 HEARTBEAT_OK）

收到心跳触发后，**在做任何事情之前**，按顺序执行以下检查。任何一项不通过，立即回复 `HEARTBEAT_OK` 并停止。

### 检查 1：这是心跳触发吗？

**只有以下情况才执行巡检：**
1. 系统心跳事件（消息以 `Read HEARTBEAT.md` 开头，或明确包含 `heartbeat` 关键词）
2. 研究部在飞书群中**明确要求**巡检（如"查一下登录状态"、"巡检一下"）

**以下情况直接回复 HEARTBEAT_OK，绝对不执行巡检：**
- 群聊中的普通对话（聊天、问问题、闲聊）
- cron 提醒触发的唤醒
- exec 事件触发的唤醒
- 任何不是心跳或明确巡检指令的唤醒

### 检查 2：时间窗口

- **仅在 08:30–23:30 之间执行巡检**
- 当前时间不在此范围内 → 回复 `HEARTBEAT_OK`

### 检查 3：频率控制

```bash
cat memory/last-heartbeat.txt 2>/dev/null || echo "0"
date +%s
date +%u  # 1=周一 ... 6=周六 7=周日
```

- 读取 `memory/last-heartbeat.txt` 中的 Unix 时间戳
- 判断今天是否为周末（`date +%u` 返回 6 或 7）
- **工作日（周一至周五）**：间隔 < 10800 秒（3小时）→ 回复 `HEARTBEAT_OK`
- **周末（周六、周日）**：间隔 < 86400 秒（24小时）→ 回复 `HEARTBEAT_OK`
- 如果文件不存在或内容为 0 → 视为从未播报过，继续执行

**三项检查全部通过后，才进入下面的巡检流程。**

---

---

## 小红书网站结构巡检（暂停，待重新安排频率）

每两天执行一次，检查小红书网站的数据结构和 CSS 选择器是否发生变动。如果发生变动，说明小红书前端改版了，需要及时修改 MCP 源码。

### 执行频率

- **每两天一次**，在奇数日（1号、3号、5号……）的心跳中执行
- 判断方法：检查当前日期（day of month），如果是奇数且距上次巡检 ≥ 24 小时，则执行
- 记录上次执行时间到 `memory/xhs-structure-check.md`

### 执行步骤

1. **用任意已登录 bot 打开小红书页面**，通过 MCP 的 `get_feed_detail` 或 `get_feeds` 检查返回数据是否正常

2. **检查 `__INITIAL_STATE__` 数据路径**（参考 `skills/claude-dev-reference/SKILL.md`）：
   - `feed.feeds.value || ._value` → Feed 列表（对应 `feeds.go`）
   - `search.feeds.value || ._value` → 搜索结果（对应 `search.go`）
   - `note.noteDetailMap[feedID]` → 笔记详情（对应 `feed_detail.go`）
   - `user.userPageData.value || ._value` → 用户主页（对应 `user_profile.go`）

3. **检查关键 CSS 选择器**：
   - `.comments-container`、`.parent-comment`、`.show-more`、`.end-container`
   - `.note-scroller`、`.interaction-container`
   - 页面不可访问检测：`.access-wrapper, .error-wrapper, .not-found-wrapper, .blocked-wrapper`

4. **生成报告**：
   - 如果全部正常：记录到 `memory/xhs-structure-check.md`，不播报飞书
   - 如果发现异常：播报到飞书群，格式如下：

```
🦅 小红书网站结构巡检告警

❌ 以下数据路径/选择器已失效：
- __INITIAL_STATE__.note.noteDetailMap 结构变化
- .comments-container 选择器失效

📁 需要修改的源文件：
- xiaohongshu/feed_detail.go
- xiaohongshu/comment_feed.go

⏰ 检查时间：YYYY-MM-DD HH:MM
```

---

## Skill 安全审计（暂停，待重新安排频率）

> ⚙️ **由独立 cron 任务驱动**（cron ID: `caffb0d4-f51d-4e9c-b10a-de2bcce28cb5`），不依赖登录巡检。
> 收到该 cron 触发时，按以下流程执行。

### 执行步骤

1. 按 `skills/security-audit/SKILL.md` 的流程，扫描所有 bot 的 skill 文件和配置文件
2. 检测三大类威胁：网关暴露、提示词攻击、恶意程序
3. 比对白名单，排除合法使用
4. 生成审计报告，保存到 `memory/security-audit-YYYY-MM-DD.md`

### 结果处理

- **全部安全**：记录到 memory，不播报飞书
- **发现高危项**：立即播报飞书群，格式：

```
🔒 Skill 安全审计告警

🔴 发现 N 个高危项：
- [风险类别] 文件路径：具体描述
- ...

⏰ 审计时间：YYYY-MM-DD 12:00
```

---

## 铁律

- **不要因为发现异常就自行创建 cron 提醒或额外巡检。** 发现问题播报一次即可，后续由研究部决定是否再查。
- **每次只播报一次。** 发完消息收到 exec 完成通知后不要再做任何操作。
- **不要在普通对话中主动巡检。** 除非研究部明确要求。
