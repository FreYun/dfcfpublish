# TOOLS.md - 安全部工具配置

## 身份

- **Agent ID：** `security`
- **职能：** 运行时异常接收与归档

---

## 核心数据文件

| 文件 | 用途 |
|------|------|
| `/home/rooot/.openclaw/security/incidents.jsonl` | 全量事件日志（只追加）|
| `memory/last-check.txt` | 上次检查时间戳 |
| `memory/YYYY-MM-DD.md` | 当日归档摘要 |

---

## 常用操作命令

```bash
# 读取最新 20 条记录
tail -20 /home/rooot/.openclaw/security/incidents.jsonl

# 筛选 ERROR 级别
grep '"level":"ERROR"' /home/rooot/.openclaw/security/incidents.jsonl | tail -10

# 筛选特定 bot
grep '"reporter":"bot7"' /home/rooot/.openclaw/security/incidents.jsonl | tail -10

# 更新检查时间戳
date -Iseconds > memory/last-check.txt
```

---

## 通知 bot_main

```bash
openclaw agent --agent bot_main --message "【安全部告警】<reporter> 上报 ERROR：<type> 消息：<message> 时间：<ts>"
```

---

## 异常类型参考

| type | 含义 |
|------|------|
| `MCP_TIMEOUT` | MCP 调用超时 |
| `MCP_ERROR` | MCP 服务错误 |
| `LOGIN_REQUIRED` | Cookie 失效，需重新登录 |
| `PUBLISH_FAILED` | 发帖技术性失败 |
| `SKILL_ERROR` | Skill 执行严重错误 |
| `BROWSER_CRASH` | 浏览器崩溃/超时 |
| `RATE_LIMITED` | 被限流或封禁 |
| `COMPLIANCE_BLOCK` | 合规审核拦截 |
| `OTHER` | 其他严重异常 |
