# TOOLS.md - bot_main（管理员）工具配置

> **首先 `Read ../workspace/TOOLS_COMMON.md` 获取统一工具规范，再看下面的 bot 专属配置。**

---

## Bot 专属配置

- **account_id**: `bot_main`（管理员 agent，不直接发小红书）
- **角色**: 系统管理，负责监控各 bot 登录状态、MCP 服务健康、基础设施巡检

## 向 Bot / Agent 发消息（Gateway 直连）

通过 gateway 直接触达任意 agent，不经过 feishu，立即处理：

```bash
# 基本用法：发消息给指定 agent
openclaw agent --agent <bot_id> --message "指令内容"

# 让 bot 把回复发到飞书群
openclaw agent --agent bot1 --message "..." \
  --deliver --reply-channel feishu \
  --reply-to "chat:oc_e59188e3ecdb04acd9b33843870a2249" \
  --reply-account bot1

# 静默发送（只触发执行，不需要回复）
openclaw agent --agent bot7 --message "执行 /sector-pulse 半导体"
```

### 所有 Agent ID 速查

| agent_id | 名字 | 状态 |
|----------|------|------|
| bot1 | 来财妹妹 | 活跃 |
| bot2 | bot2 | 活跃（私信） |
| bot4 | 研报搬运工阿泽 | 活跃 |
| bot5 | 宣妈慢慢变富 | 活跃 |
| bot6 | bot6 | 活跃（私信） |
| bot7 | 老K投资笔记 | 活跃 |
| bot3/8/9/10 | — | 无活跃 session |
| security | 安全部 | 活跃 |
| mcp_publisher | 印务局 | 活跃 |
| bot_main | 魏忠贤（自己） | — |

---

## 管理范围

管理以下 bot 的小红书登录状态（由印务局负责巡检，异常时汇报魏忠贤）：

| Bot | 名字 | account_id |
|-----|------|-----------|
| bot1 | 来财妹妹 | bot1 |
| bot4 | 研报搬运工阿泽 | bot4 |
| bot5 | 宣妈慢慢变富 | bot5 |
| bot7 | 老K投资笔记 | bot7 |

## 小红书相关操作（一律交给印务局）

**魏忠贤不直接操作小红书 MCP。** 每个 bot 有独立的 MCP 端口，直接调 `xiaohongshu-mcp` 会走错端口导致登录串号。

遇到以下情况，**发消息给印务局处理**：
- 登录状态检查
- 登录二维码获取
- 发布问题排查
- MCP 服务异常

```bash
# 让印务局检查 bot5 登录状态
openclaw agent --agent mcp_publisher --message "检查 bot5 的小红书登录状态，结果回报飞书群"

# 让印务局帮 bot5 取登录二维码
openclaw agent --agent mcp_publisher --message "bot5 小红书掉线了，取登录二维码发到飞书群 oc_e59188e3ecdb04acd9b33843870a2249"
```

## Gateway 重启

需要重启 gateway 时，**必须调用外部脚本，禁止用 kill -HUP 或直接 kill**（会导致自己也死掉）：

```bash
nohup bash /home/rooot/.openclaw/scripts/restart-gateway.sh > /dev/null 2>&1 &
```

**原理**：脚本通过 nohup 独立运行，先停旧 gateway 再启新的。你会随旧 gateway 一起断开，但新 gateway 启动后会自动重新加载你。

**注意**：
- 调用后你的当前会话会中断，这是正常的
- 不要等待脚本结果，发出命令即可
- 脚本有防重复锁（30 秒内不会重复重启）
- 日志写入 `/tmp/openclaw.log`

---

## 开发参考

详见 `skills/claude-dev-reference/SKILL.md`（即 CLAUDE.md），包含：
- 小红书网页解析原理
- 有头浏览器调试方法
- Agent Skill 管理手册
- Workspace 文件管理手册
