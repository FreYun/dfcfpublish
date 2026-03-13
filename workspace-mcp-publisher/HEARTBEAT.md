# HEARTBEAT.md - 印务局巡检清单

## 前置检查

收到心跳触发后，按顺序检查：

### 检查 1：这是心跳触发吗？

**执行巡检的情况：**
1. 系统心跳事件（消息以 `Read HEARTBEAT.md` 开头或包含 `heartbeat` 关键词）
2. 研究部明确要求巡检

**直接回复 HEARTBEAT_OK 的情况：**
- 普通对话、exec 完成通知、非心跳非巡检的唤醒

### 检查 2：时间窗口

- 仅在 08:00–23:00 之间执行
- 不在此范围 → 回复 `HEARTBEAT_OK`

### 检查 3：频率控制

```bash
cat memory/last-heartbeat.txt 2>/dev/null || echo "0"
date +%s
```

- 距上次 < 1800 秒（30 分钟）→ 回复 `HEARTBEAT_OK`
- 文件不存在 → 继续执行

**全部通过后进入巡检。**

---

## 巡检任务 1：处理发布队列

**每次心跳都执行。**

```bash
ls -1 /home/rooot/.openclaw/publish-queue/pending/*.md 2>/dev/null | wc -l
```

- 有待发布文件 → 按 AGENTS.md 的发布流程处理（最多 5 个）
- 无待发布文件 → 跳过

---

## 巡检任务 2：活跃 Bot 的 MCP 健康检查

**只检查活跃 bot（上次巡检中至少一个平台 ✅ 的 bot），不检查未登录 bot。**

> **活跃定义**：`memory/status.md` 中备注列为"活跃"或"⚠️ 仅创作者平台"的 bot。

### Step 1：从 status.md 读取活跃名单

```bash
grep -E "活跃|仅创作者平台" memory/status.md | grep -oP "bot\d+"
```

### Step 2：MCP 健康检查（仅活跃 bot）

对活跃名单中的每个 bot，先用 `ss` 检查端口是否监听，无响应直接报离线：

```bash
# 对每个活跃 botN 执行
port=$((18060 + N))
if ss -tlnH "sport = :${port}" | grep -q "${port}"; then
  curl -s --connect-timeout 3 --max-time 5 http://localhost:${port}/health
else
  echo "OFFLINE"
fi
```

### Step 3：更新 memory/status.md

将健康检查结果写入 `memory/status.md`，只更新：
- **MCP 健康**：✅ 在线 / ❌ 离线 / ⚠️ 超时
- 表头的"上次更新"时间

> 登录状态列**不在心跳中更新**，由发布流程或 bot 自身检查时更新。非活跃 bot 的健康列不探测。

### 异常处理

**服务离线（curl 失败）：**

1. 确定 bot 编号（端口 - 18060 = bot编号）
2. 尝试重启：
```bash
lsof -ti:{端口} | xargs kill 2>/dev/null
sleep 2
XHS_PROFILES_DIR=/home/rooot/.xhs-profiles nohup /tmp/xhs-mcp -headless=true -port=:{端口} > /tmp/xhs-mcp-bot{N}.log 2>&1 &
sleep 3
curl -s --connect-timeout 5 http://localhost:{端口}/health
```
3. 重启成功 → 记录到日记
4. 重启失败 → 飞书告警

**服务超时（curl > 10s）：**
- 标记为 ⚠️ 超时，飞书告警

### 飞书告警格式

```
📮 MCP 服务异常告警

❌ bot7 (端口 18067)：服务离线，自动重启失败
⚠️ bot5 (端口 18065)：健康检查超时 (>10s)
✅ bot1 (端口 18061)：正常
✅ bot4 (端口 18064)：正常

⏰ 检查时间：YYYY-MM-DD HH:MM
```

**发飞书告警的条件**：端口离线或重启失败（基础设施异常）。
**不发飞书告警**：未登录（登录状态问题由任务触发时处理，不在巡检中主动告警）。
全部正常不播报（节省 token）。

---

## 巡检任务 3：检查 failed 队列积压

```bash
ls -1 /home/rooot/.openclaw/publish-queue/failed/*.md 2>/dev/null | wc -l
```

- 积压 > 3 个 → 飞书提醒研究部处理

---

## 巡检收尾

```bash
date +%s > memory/last-heartbeat.txt
```

无异常无积压 → 回复 `HEARTBEAT_OK`
有处理结果 → 简短汇报后结束

---

## 铁律

- 每次心跳只播报一次，发完消息收到 exec 通知后不再操作
- 不因发现异常自行创建 cron 或额外巡检
- 安静时间（23:00-08:00）不打扰
- 绝不用 `pkill -f` 通配符杀进程
