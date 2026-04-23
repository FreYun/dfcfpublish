---
name: tougu-portfolio-review
description: 定期复查 bot 的投顾持仓，对比最新目标组合、当前持仓和市场状态（金额制），决定 KEEP/REBALANCE/SWITCH，优先通过事务接口写回 MCP 数据库 + markdown 归档
---

# 投顾组合巡检 /tougu-portfolio-review

**触发词**: `/tougu-portfolio-review`, "检查你的投顾组合要不要调", "更新你的投顾持仓", "复核你的投顾仓位"

**定位**: 面向当前 bot 自己的投顾持仓巡检 skill。模拟 bot 像真人投资者一样，先用最新产品池生成目标组合，再结合市场状态审视当前持仓，决定要不要动、动多少。

**核心原则**: 所有交易按实际金额结算，weight 为衍生字段。MCP 数据库是事实源，markdown 是归档层。

**运行态要求**:
- 若任务上下文给了 `run_id / trade_date`,必须沿用
- Phase C 的正式写入优先使用 `apply_review_and_rebalance`
- `save_review / save_rebalance_actions / save_bot_holdings` 仅作为排障或兼容路径，不是首选主路径

---

## MCP 调用语法（必读）

所有 `tougu-portfolio-mcp.*` 工具必须通过 `npx mcporter call` 调用，使用**函数调用语法** `(kwarg: 'value')`，**不要传 JSON 字符串**：

```bash
# ✅ 正确：kwarg 风格，字符串用单引号包裹
npx mcporter call "tougu-portfolio-mcp.get_bot_holdings(bot_id: 'botN')"
npx mcporter call "tougu-portfolio-mcp.check_cooldown(bot_id: 'botN')"
npx mcporter call "tougu-portfolio-mcp.get_product_pool()"
npx mcporter call "tougu-portfolio-mcp.get_latest_allocation_run(bot_id: 'botN')"
npx mcporter call "tougu-portfolio-mcp.get_latest_portfolio_plan(bot_id: 'botN')"
npx mcporter call "tougu-portfolio-mcp.apply_review_and_rebalance(bot_id: 'botN', decision: 'KEEP', reason: '...', actions_json: '[]', holdings_json: '[...]', cash_after: 25000)"

# ❌ 错误：JSON 字符串作为第二个参数 → "Field required" 验证错误
npx mcporter call 'tougu-portfolio-mcp.get_bot_holdings' '{"bot_id": "botN"}'

# ❌ 错误：--params 标志不存在
npx mcporter call 'tougu-portfolio-mcp.get_bot_holdings' --params '{"bot_id": "botN"}'
```

**绝不能用 `research-mcp` 替代 `tougu-portfolio-mcp`**。research-mcp 只能读公共产品池数据（净值/绩效），**无法写回 bot 自己的持仓/巡检/快照记录**。如果 tougu-portfolio-mcp 不可达，直接上报 incident，不要改用 research-mcp 伪完成。

---

## 核心文件

### 数据库（事实源，通过 MCP 读写）

- `bot_accounts` — 账户信息（initial_capital, cash）
- `bot_holdings` — 当前持仓（amount_invested, quantity, entry_nav, market_value）
- `bot_reviews` — 巡检记录
- `bot_rebalance_actions` — 调仓动作
- `bot_daily_snapshots` / `bot_position_snapshots` — 收益快照
- `allocation_runs` — Phase B0 市场状态与大类配置
- `portfolio_plans` — Phase B 目标组合

### Markdown（归档层）

- `memory/portfolio/当前投顾持仓.md`
- `memory/portfolio/投顾巡检记录.md`
- `memory/portfolio/投顾调仓日志.md`
- `memory/portfolio/个性化投顾产品选择.md`（目标组合，由 product-match 覆盖写入）
- `memory/portfolio/投资策略摘要.md`（投资画像）

---

## 定时主流程

定时任务触发时，严格按以下顺序执行：

```
Step 0: 读取最新市场状态（market-context / allocation_runs）
    ↓
Step 1: 获取最新产品池
    ↓
Step 2: 重新生成目标组合（覆盖写入 个性化投顾产品选择.md）
    ↓
Step 3: 读取当前持仓（从 MCP 数据库）
    ↓
Step 4: 评估已有持仓的择时状态
    ↓
Step 5: 对比目标组合 vs 当前持仓
    ↓
Step 6: 套用真实世界约束
    ↓
Step 7: 形成调仓动作（金额制，先卖后买）
    ↓
Step 8: 写回 MCP 数据库 + 同步 markdown
```

`record_daily_snapshot` 属于 **Phase D**。本 skill 不把"写快照成功"当成巡检完成条件；若主流程另外安排了快照兜底，按 Phase D 执行。

---

## 输入优先级

### 1. 产品池

1. **MCP 数据库**（推荐）：`tougu-portfolio-mcp.get_product_pool()`
2. 用户明确指定的产品池文件
3. 测试期 `memory/portfolio/` 下的候选池 markdown

无候选池时不进入正式 review，只记录"候选池缺失，跳过"。

### 2. 当前持仓

1. **MCP 数据库**（推荐）：`tougu-portfolio-mcp.get_bot_holdings(bot_id)`
   - 返回金额制数据：amount_invested, quantity, market_value, unrealized_pnl 等
   - 返回账户信息：initial_capital, cash, total_value, net_value
2. `memory/portfolio/当前投顾持仓.md`（备用）

无持仓时，先跑 product-match 生成目标组合，再通过 `init_bot_holdings` 初始化。初始化时 `allocations_json` 中每个产品必须携带 `role` 和 `thesis` 字段：
- `role`：从目标组合的"角色"提取（如"核心底仓"、"卫星仓位"），**不可为空**
- `thesis`：从目标组合的"选择原因"提取，**不可为空**，该理由会写入 `bot_rebalance_actions.reason`，后续可查
- 格式示例：`[{"product_id":"X","weight":30,"role":"核心底仓","thesis":"详细买入理由"}]`

### 3. 目标组合

**每次巡检都重新生成**，不复用旧的 `个性化投顾产品选择.md`：

1. 先获取最新产品池
2. 调用 `tougu-product-match` 重新选品
3. 覆盖写入 `个性化投顾产品选择.md`

### 4. 投资画像

必须先读 `memory/portfolio/投资策略摘要.md`，不足时才回看 SOUL.md / IDENTITY.md / USER.md。

### 5. 市场状态 / 择时背景

优先级：

1. **MCP 数据库 / allocation_runs**：最近一次 `market-context` 输出
2. `memory/portfolio/市场环境判断.md`
3. 若缺失：按 `regime=range`、`regime_code=neutral_range`、`timing_stance=hold` 处理，并在结论中标注

最少应拿到：

- `regime`
- `regime_code`
- `confidence`
- `timing_stance`
- `asset_target_json`（若存在）

---

## 真实世界约束

即使目标组合更优，也不代表当前就要切换。

| 约束 | 值 | 说明 |
|------|-----|------|
| 冷静期 | 7 天 | 距上次调仓不足 7 天，默认不做大动作。通过 `check_cooldown(bot_id)` 检查 |
| 最小变更阈值 | 5% | 单个产品权重变化 < 5% 默认忽略 |
| 最大换手 | 25% | 单次巡检最多调整总仓位的 25%（按金额计算：turnover_amount / total_value） |
| 核心仓替换 | 1 个 | 单次最多替换 1 个核心产品 |
| 调仓顺序 | 先卖后买 | 先释放现金，再执行买入 |
| 买入校验 | buy_status + min/max_deposit | 从 tougu_info 读取，暂停申购的不能买入。**min_deposit / max_deposit 仅约束买入时的单笔金额，已持有的仓位不受此限制，绝不能因为持仓市值超过 max_deposit 而清仓** |
| 证据不足 | 偏向不动 | 新方案优势不明显时继续持有 |
| 风险不升档 | 无强证据不升 | 不因短期收益高而上调风险带 |
| 现金是主动仓位 | — | 保留现金是风险管理，不是没想好 |

---

## 执行流程

### Step 1: 获取最新产品池

调用 `get_product_pool()` 确认产品池可用。记录来源和更新时间。

### Step 2: 重新生成目标组合

调用 `tougu-product-match` 方法，基于最新产品池 + 投资策略摘要，生成新的目标组合。

**覆盖写入** `memory/portfolio/个性化投顾产品选择.md`。

### Step 3: 读取当前持仓

调用 `get_bot_holdings(bot_id)` 获取：

```json
{
  "initial_capital": 100000,
  "cash": 25000,
  "invested_value": 75000,
  "total_value": 100000,
  "net_value": 1.0,
  "holdings": [
    {"product_id": "AILVXKB", "product_name": "嘉实百灵全天候",
     "amount_invested": 30000, "market_value": 30000,
     "quantity": 25854, "entry_nav": 1.16, "weight": 30.0, "role": "核心底仓"}
  ]
}
```

同时调用 `check_cooldown(bot_id)` 检查冷静期。

### Step 4: 评估已有持仓的择时状态

这一层只回答"我手里的老仓现在该怎么办"，不直接决定是否引入新产品。

对每个当前持仓依次判断：

- 是否仍在 bot 自己可接受的风险带
- 是否仍符合 bot 的长期画像和能力圈
- 在当前 `regime / regime_code / timing_stance` 下，是继续拿、加一点、减一点，还是止盈止损
- 该产品当前问题是"赛道逻辑变了"还是"只是入场时机一般"

每个持仓必须先形成一个中间动作标签：

- `HOLD`
- `ADD`
- `REDUCE`
- `TAKE_PROFIT`
- `STOP_LOSS`

约束：

- `TAKE_PROFIT` / `STOP_LOSS` 是**已有持仓动作标签**，最终数据库层仍要折叠为 `SELL` / `DECREASE`
- 不允许因为 `max_deposit` 或单纯净值上涨导致仓位自然变大，就误判成需要卖出
- `timing_stance=defensive/risk_off` 时，可以降低加仓倾向，但不能无依据把所有持仓一刀切清空

### Step 5: 对比目标组合 vs 当前持仓

逐项比较：

- 产品是否一致
- 权重差异是否超过 5% 阈值
- 当前持仓是否偏离 bot 风险带
- 新目标是否真的显著更优
- 新入选产品是"立即可买"、"分批可买"还是"暂缓进入"

结论三选一：`KEEP` / `REBALANCE` / `SWITCH`

### Step 5.5: 区分已有持仓动作和新产品准入

先处理已有仓位，再处理新产品：

1. **已有持仓**
   根据 Step 4 的中间动作标签，决定维持、加仓、减仓、兑现收益或止损。

2. **新产品**
   读取 `个性化投顾产品选择.md` 中的建仓建议，或按 `timing_stance` 自行落地：
   - `立即买`：允许纳入本轮买入
   - `分批买`：本轮只买目标仓位的一部分
   - `延后买`：先不纳入实际买入动作
   - `不买`：不进入动作列表

如果目标组合里有新产品，但建仓建议为 `延后买`，最终结论仍可能是 `KEEP` 或仅小幅 `REBALANCE`，不强行切到目标组合满配。

### Step 6: 套用决策闸门

SWITCH 条件（全部满足）：
- 新产品有明确优势
- 风险匹配不下降
- 不违反冷静期或换手上限
- 新产品在 bot 可接受能力圈
- 新产品 buy_status = 开放申购
- 新产品建仓建议不是 `延后买`

轻微更优 → 保持不动或仅小幅再平衡。

### Step 7: 形成调仓动作（金额制，先卖后买）

**固定顺序**：先执行 SELL/DECREASE 释放现金，再执行 BUY/INCREASE 消耗现金。

每笔动作需计算：
- `amount`：交易金额
- `nav_used`：交易时净值（从 `get_bot_holdings` 返回的 latest_nav 或 `tougu_nav`）
- `quantity`：= amount / nav_used
- `cash_delta`：SELL 为正（+），BUY 为负（-）
- `before_market_value` / `after_market_value`
- `reason`：**必填**，该笔操作的具体理由（为什么买入/卖出这个产品、金额为什么是这个数）

买入前校验：
- 可用现金 ≥ 买入金额
- 买入金额 ≥ min_deposit
- 买入金额 ≤ max_deposit
- buy_status ≠ 暂停申购

动作映射建议：

| 中间动作 | 数据库动作 |
|------|------|
| `HOLD` | 无动作 |
| `ADD` | `INCREASE` 或 `BUY` |
| `REDUCE` | `DECREASE` |
| `TAKE_PROFIT` | `DECREASE` 或 `SELL` |
| `STOP_LOSS` | `DECREASE` 或 `SELL` |

**重要：min_deposit / max_deposit 仅在买入时校验，已持有的仓位即使市值超过 max_deposit 也不构成卖出理由。持仓市值会因净值波动自然增长，这是正常的投资收益，不是合规问题。**

### Step 8: 写回数据库 + markdown（双写）

#### 8a. 写入 MCP 数据库（事实源）

**主路径：优先调用 `apply_review_and_rebalance`。**

```bash
npx mcporter call "tougu-portfolio-mcp.apply_review_and_rebalance(bot_id: 'bot1', decision: 'REBALANCE', reason: '...', actions_json: '[...]', holdings_json: '[...]', cash_after: 25000, review_md: '...', cooldown_days: 7, trade_date: '2026-04-23', cash_before: 30000, portfolio_value_before: 100000, portfolio_value_after: 100000, invested_value_before: 70000, invested_value_after: 75000, turnover_amount: 5000, turnover_ratio: 5)"
```

要求：

1. **无论 KEEP / REBALANCE / SWITCH 都必须写 review 记录**。即使结论是不动，也要通过事务接口留下本轮判断痕迹。
2. `actions_json` 可以为空数组 `[]`，但 `holdings_json` 仍应提供当前最终持仓。
3. **每笔动作必须填写 `reason` 字段**，说明该笔买入/卖出的具体理由。
4. `holdings_json` 中每个活跃持仓都应尽量带：
   - `product_id`
   - `amount_invested`
   - `quantity`
   - `market_value`
   - `latest_nav`
   - `weight`
   - `role`
   - `thesis`
   - `target_weight`

**兼容路径：** 只有在事务接口明确不可用时，才退回 `save_review` → `save_rebalance_actions` → `save_bot_holdings` 的旧三步写法。

#### 7b. 同步 markdown 归档

更新 `当前投顾持仓.md` + `投顾巡检记录.md`。有动作时更新 `投顾调仓日志.md`。

### Phase D: 收益快照（由外层流程执行）

若外层 cron 需要补记收益快照，应在本 skill 结束后单独执行：

```bash
npx mcporter call "tougu-portfolio-mcp.record_daily_snapshot(bot_id: 'botN', trade_date: '2026-04-17')"
```

**参数只有两个：`bot_id` 和 `trade_date`**。本 skill 只要求你知道这件事存在，但不把它作为 review 主流程的一部分。

---

## 输出格式

### A. 当前持仓 `memory/portfolio/当前投顾持仓.md`

```markdown
# 当前投顾持仓

**更新日期：** YYYY-MM-DD
**状态来源：** MCP 数据库
**上次巡检：** YYYY-MM-DD
**上次调仓：** YYYY-MM-DD / 暂无
**当前结论：** KEEP / REBALANCE / SWITCH
**市场状态：** regime / regime_code / timing_stance

## 账户概况

| 项目 | 值 |
|------|-----|
| 初始资金 | ¥XXX |
| 当前现金 | ¥XXX |
| 持仓市值 | ¥XXX |
| 总资产 | ¥XXX |
| 账户净值 | X.XXXX |
| 累计收益 | +X.XX% |

## 当前持仓

| 产品名称 | 产品代码 | 投入金额 | 当前市值 | 权重 | 角色 | 浮盈亏 | 持有理由 |
|---------|---------|---------|---------|------|------|--------|---------|

## 现金

- **现金**：¥XXX（XX%）

## 当前约束

- **冷静期截至**：YYYY-MM-DD / 无
- **单次最大换手**：25%
- **最小权重变更阈值**：5%
```

### B. 巡检记录 `memory/portfolio/投顾巡检记录.md`

```markdown
## YYYY-MM-DD

- **巡检类型**：常规巡检 / 初始化
- **候选池来源**：MCP get_product_pool
- **结论**：KEEP / REBALANCE / SWITCH
- **本轮是否动作**：是 / 否
- **动作摘要**：
- **调仓金额**：¥XXX（换手率 X%）
- **调仓前资产**：¥XXX → 调仓后：¥XXX
- **市场状态**：...
- **已有持仓动作标签**：HOLD / ADD / REDUCE / TAKE_PROFIT / STOP_LOSS
- **新产品准入结论**：立即买 / 分批买 / 延后买 / 无新增
- **触发原因**：
- **下次观察点**：
```

### C. 调仓日志 `memory/portfolio/投顾调仓日志.md`

```markdown
## YYYY-MM-DD

| 动作 | 产品名称 | 交易金额 | 使用净值 | 份额 | 现金变化 | 原因 |
|------|---------|---------|---------|------|---------|------|
```

---

## 硬约束

1. **流程顺序固定**：产品池 → 目标组合（重新生成）→ 当前持仓 → review → 写回
2. **金额制结算**：所有调仓按实际金额计算，份额 = amount / nav
3. **先卖后买**：SELL/DECREASE 排在 BUY/INCREASE 前面
4. **MCP 数据库优先**：事实源是数据库，markdown 是归档
5. **每次重新选品**：不复用旧的目标组合，每次巡检都覆盖写入
6. **不频繁折腾**：轻微更优不等于立刻切换
7. **风险纪律优先**：不为更高收益突破风险带
8. **证据不足时宁可不动**：偏向保守
9. **写回必须可追踪**：每次巡检留痕，动作留金额明细
10. **先处理老仓，再处理新仓**：已有持仓动作和新产品准入不能混成一句话
11. **review 不负责快照归档**：Phase C 专注决策和写库，快照由 Phase D 兜底
12. **事务接口优先**：正式执行优先走 `apply_review_and_rebalance`

_通用投顾组合巡检 skill，所有 bot 共享。修改此文件会影响全部 bot。_
