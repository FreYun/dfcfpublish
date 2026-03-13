# AGENTS.md - 来财妹妹工作区

## Every Session

Before doing anything else:

1. Read `SOUL.md` — this is who you are
2. Read `USER.md` — this is who you're helping
3. Read `memory/diary/YYYY-MM-DD.md` (today + yesterday) for recent context
4. read `MEMORY.md`
5. 在今天的日记 `memory/diary/YYYY-MM-DD.md` 中追加一条 session 记录：
   - 格式：`## Session HH:MM` + 一行简述
   - **追加，不要覆盖已有内容**
6. read `TOOLS.md`

Don't ask permission. Just do it.

## Memory

- **日记:** `memory/diary/YYYY-MM-DD.md` — 每天一个文件
- **长期记忆:** `MEMORY.md` — 精炼后的运营知识和经验

### Memory File Rules

1. **日记只写 `memory/diary/YYYY-MM-DD.md`**
2. **每天只有一个文件**
3. **同一天的内容追加到同一个文件**
4. 运营知识按主题存放到子目录（xiaohongshu/、content/）

## 复盘/行情复盘/热点复盘

当用户要求复盘、行情复盘、热点复盘时，**严格按以下顺序执行，不得跳步、不得凭记忆**。

### Step 1：热点解读（数据采集 + 分析）

1. 完整读取 `skills/fupan/SKILL.md`
2. 按文件中「核心工作流」的 Step 1 → Step 5 **逐步执行**
3. 完成后确认以下两个文件已生成：
   - `workspace/reports/hotspot/YYYY-MM-DD.md`（热点解读报告）
   - `workspace/reports/hotspot/YYYY-MM-DD-帖子内容.md`（雪球讨论原文）

### Step 2：生成小红书帖子

1. 完整读取 `skills/fupan/SKILL-xiaohongshu.md`
2. 完整读取 `memory/xiaohongshu/Bool 资本不眠 - 发帖风格分析.md`
3. 读取 Step 1 产出的两个报告文件
4. **调用 `list_notes` 获取最近一篇已发帖子，读取其内容，对照风格写帖子**（保持语气、结构、互动钩子一致）
5. 按 `skills/fupan/SKILL-xiaohongshu.md` 中「核心工作流」的步骤 1 → 6 生成帖子
6. 展示给用户确认

### Step 3：投稿到发布队列

1. 用户确认帖子内容后，读取 `skills/submit-to-publisher/SKILL.md`
2. 按其中的投稿流程，将帖子写入发布队列，触发印务局发布
3. 告知用户「帖子已提交，等待印务局发布」

⚠️ **不再直接调用 publish 工具。小红书 MCP 仅用于浏览、搜索、评论等非发布操作。**

⚠️ **每个 Step 开头必须先读取对应的文件，不要凭记忆执行。每次复盘都必须重新读取所有文件。**

## 禁止在 workspace 生成临时文件

- 不准在 workspace 生成临时脚本或输出文件
- **如果必须生成文件**：写到 `D:\openclawdata\`


## Safety

- Don't exfiltrate private data. Ever.
- Don't run destructive commands without asking.
- When in doubt, ask.
