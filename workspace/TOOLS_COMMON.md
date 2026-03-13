# TOOLS_COMMON.md - 全体 Bot 统一工具规范

> **所有 bot 的 TOOLS.md 开头必须先 `Read` 本文件，再看自己的 bot 专属配置。**

---

## 小红书操作（最重要）

**所有小红书操作必须通过 mcporter 调用 xiaohongshu-mcp 工具。**

### ⚠️ 首次使用前必读

**在执行任何小红书操作之前，必须先 `Read skills/xiaohongshu-mcp/SKILL.md`，把完整流程加载到上下文。不读 SKILL.md 就操作 = 必翻车。**

**发帖流程：写完帖子 → 提交印务局（`skills/submit-to-publisher/SKILL.md`）→ 任务完成。合规审核由印务局负责，bot 无需自行调用 compliance-mcp。**

### 铁律（违反必出事）

1. **必须用 `npx mcporter call "xiaohongshu-mcp.工具名(account_id: 'botN', ...)"` 调用**
2. **每次调用必须传 `account_id`**（你的 bot 编号，见你自己的 TOOLS.md）
3. **禁止用 `curl` / HTTP 直接请求 localhost 端口**
4. **禁止使用 Docker**（`docker ps`、`docker start`、`docker run` 等一律不准）
5. **禁止修改 xiaohongshu-mcp 源码**
6. MCP 服务是直接二进制进程，不是容器

### 常用操作速查

把 `botN` 替换成你自己的 bot 编号：

```bash
# 检查登录状态
npx mcporter call "xiaohongshu-mcp.check_login_status(account_id: 'botN')"

# 获取登录二维码（发给用户扫码）
npx mcporter call "xiaohongshu-mcp.get_both_login_qrcodes(account_id: 'botN')"

# 发布图文（文字配图模式）
npx mcporter call "xiaohongshu-mcp.publish_content(account_id: 'botN', title: '标题', content: '内容', text_to_image: true)"

# 发布长文
npx mcporter call "xiaohongshu-mcp.publish_longform(account_id: 'botN', title: '标题', content: '内容')"

# 查看笔记列表
npx mcporter call "xiaohongshu-mcp.list_notes(account_id: 'botN')"

# 搜索笔记
npx mcporter call "xiaohongshu-mcp.search_feeds(account_id: 'botN', keyword: '关键词')"
```

### 操作超时或失败时怎么办

**第一步：检查登录状态。** 大部分超时都是因为登录失效，浏览器在登录页卡住导致的。

```bash
npx mcporter call "xiaohongshu-mcp.check_login_status(account_id: 'botN')"
```

- 如果未登录 → 走 SKILL.md 的 Step 0 登录流程，向研究部发二维码请求扫码
- 如果已登录 → 向研究部报告异常，不要反复重试

**第二步：如果 mcporter 报 `offline` 或连接失败**，说明 MCP 服务本身没启动，向研究部报告。

**禁止**：
- 不要反复重试超时的操作（浪费时间且可能产生重复发帖）
- 不要尝试自行启动、编译或修改 MCP 源码
- 不要用 Docker 启动

### 完整工具文档

使用前先读取你 workspace 下的技能文档：`skills/xiaohongshu-mcp/SKILL.md`，里面有完整的 20 个工具列表和参数说明。

---

## 联网搜索

**必须使用 MCP 提供的搜索工具，内置 `web_search` 已禁用。**

各 bot 的搜索工具可能不同，以你自己的 TOOLS.md 或 mcporter.json 配置为准。

---

## 网页浏览

**必须使用 OpenClaw 自带 browser 工具。**

- 严禁使用 Chrome 插件或任何浏览器扩展
- 需要登录或 JS 渲染的页面用 browser 工具处理
- **浏览器用完了必须关 tab（`browser close`）** — 不关会导致 renderer 进程卡死吃 CPU
- ref 只在当前 snapshot 有效，页面变化后必须重新 snapshot
- **每次使用 browser 工具完毕后，确认所有 tab 已关闭**。残留 tab 会在后台持续运行 JS，可能导致单个 renderer 进程占用 30%+ CPU
- 如果发现浏览器操作超时或无响应，不要反复重试，先检查是否有卡住的进程

---

## 金融数据：Tushare 工具（直接调用，无需搜索）

A 股量化数据优先用 Tushare 工具：

| 工具名 | 用途 |
|--------|------|
| `tushare_stock_basic` | 股票列表、基本信息 |
| `tushare_daily` | 日线行情（OHLCV） |
| `tushare_daily_basic` | 估值数据（PE/PB/PS/市值） |
| `tushare_income` | 利润表 |
| `tushare_balancesheet` | 资产负债表 |
| `tushare_cashflow` | 现金流量表 |
| `tushare_fina_indicator` | 财务指标（ROE/ROA/毛利率等） |
| `tushare_forecast` | 业绩预告 |
| `tushare_moneyflow_hsgt` | 北向/南向资金日汇总 |
| `tushare_hsgt_top10` | 沪深港通十大成交股 |
| `tushare_top10_holders` | 前十大股东 |
| `tushare_index_daily` | 指数日线（沪深300、创业板等） |
| `tushare_trade_cal` | 交易日历 |

股票代码格式：`600519.SH`（上交所）、`000001.SZ`（深交所）。日期格式：`YYYYMMDD`。

---

## 工具优先级

1. **memory** → 先检索历史研究，有则增量更新
2. **Tushare 工具** → A 股行情、财务、北向资金（结构化数据）
3. **browser 工具** → 雪球、东方财富研报（定性分析）
4. **MCP 搜索** → 补充搜索、验证、海外数据
5. **xiaohongshu-mcp** → 发帖、管理笔记、互动（通过 mcporter 调用）
