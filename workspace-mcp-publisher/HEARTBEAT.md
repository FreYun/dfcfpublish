# HEARTBEAT.md - 印务局巡检清单

每 15 分钟由 cron 触发（08:00–23:00），核心任务：**确保 MCP 服务可用。**

> **⚠️ 心跳不处理 pending 队列。** 队列由 bot 投稿时的 `send_message` 触发处理，避免并发竞争。

---

## 巡检流程

### Step 1：检查活跃 bot 的 MCP 服务

对以下活跃 bot 端口做健康检查：

```bash
for port in 18061 18064 18065 18067 18070; do
  if ss -tlnH "sport = :${port}" | grep -q "${port}"; then
    result=$(curl -s --connect-timeout 3 --max-time 5 http://localhost:${port}/health)
    echo "端口 ${port}: ${result}"
  else
    echo "端口 ${port}: OFFLINE"
  fi
done
```

### Step 2：处理离线服务

**MCP 离线 → 自行拉起：**

```bash
# 先杀残留（精确端口，不用通配符）
lsof -ti:${port} | xargs kill 2>/dev/null
sleep 2

# 启动实例
XHS_PROFILES_DIR=/home/rooot/.xhs-profiles \
  nohup /tmp/xhs-mcp -headless=true -port=:${port} \
  > /tmp/xhs-mcp-${port}.log 2>&1 &

sleep 3
curl -s --connect-timeout 5 http://localhost:${port}/health
```

- 拉起成功 → 记录日记
- 拉起失败 → 飞书告警魏忠贤

**同时检查合规服务（18090）：**

```bash
if ! ss -tlnH "sport = :18090" | grep -q "18090"; then
  lsof -ti:18090 | xargs kill 2>/dev/null
  sleep 2
  nohup /tmp/compliance-mcp -port=:18090 > /tmp/compliance-mcp.log 2>&1 &
  sleep 3
  curl -s --connect-timeout 5 http://localhost:18090/health
fi
```

### Step 3：收尾

- 无异常 → 回复 `HEARTBEAT_OK`
- 有处理结果 → 简短汇报后结束

---

## 铁律

- **心跳不碰 pending 队列**：队列处理只由 bot 投稿的 `send_message` 触发，心跳只管 MCP 健康
- **MCP 离线自己拉**：印务局管辖的 MCP（xhs-mcp 各端口 + compliance-mcp 18090）离线时，自行重启，不等研究部
- **绝不用 `pkill -f` 通配符杀进程**：只用 `lsof -ti:端口 | xargs kill` 精确杀
- 安静时间（23:00-08:00）不执行
- 每次心跳只播报一次，不因发现异常自行创建额外 cron
- 飞书告警仅限：MCP 重启失败。正常发帖结果不发飞书群
