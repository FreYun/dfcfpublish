# TOOLS.md - 印务局工具配置

> **首先 `Read ../workspace/TOOLS_COMMON.md` 获取统一工具规范。**

---

## MCP 端口路由表

我连接所有 bot 的 XHS MCP 服务。根据帖子的 `account_id` 选择对应的 MCP 服务名：

| account_id | MCP 服务名 | 端口 |
|------------|-----------|------|
| bot1 | xhs-bot1 | 18061 |
| bot2 | xhs-bot2 | 18062 |
| bot3 | xhs-bot3 | 18063 |
| bot4 | xhs-bot4 | 18064 |
| bot5 | xhs-bot5 | 18065 |
| bot6 | xhs-bot6 | 18066 |
| bot7 | xhs-bot7 | 18067 |
| bot8 | xhs-bot8 | 18068 |
| bot9 | xhs-bot9 | 18069 |
| bot10 | xhs-bot10 | 18070 |

### 调用模式

```bash
# 发布到 bot7 的账号
npx mcporter call "xhs-bot7.publish_content(account_id: 'bot7', title: '...', content: '...', text_to_image: true)"

# 检查 bot5 的登录状态
npx mcporter call "xhs-bot5.check_login_status(account_id: 'bot5')"
```

**关键**：MCP 服务名（`xhs-botN`）和 `account_id`（`botN`）必须对应。路由错误会导致发到错误账号。

## 合规审核

```bash
npx mcporter call "compliance-mcp.review_content(title: '标题', content: '内容', tags: '标签1,标签2')"
```

## MCP 健康检查

```bash
# 逐端口检查
curl -s --connect-timeout 5 http://localhost:18061/health
curl -s --connect-timeout 5 http://localhost:18067/health
# ... 以此类推
```

## MCP 服务重启（单个端口）

```bash
# 先精确杀掉（绝不用 pkill 通配符！）
lsof -ti:18067 | xargs kill 2>/dev/null

# 等待进程退出
sleep 2

# 启动新实例
XHS_PROFILES_DIR=/home/rooot/.xhs-profiles nohup /tmp/xhs-mcp -headless=true -port=:18067 > /tmp/xhs-mcp-bot7.log 2>&1 &

# 验证
sleep 3 && curl -s http://localhost:18067/health
```

## 发布队列路径

```
/home/rooot/.openclaw/publish-queue/
├── pending/
│   ├── 2026-03-14T14-35-09_bot7_efxrjy/   ← 文件夹格式（新，由提交脚本创建）
│   │   ├── post.md                          ← YAML frontmatter + 正文
│   │   ├── 1.jpg                            ← 图片（可选，image 模式）
│   │   ├── 2.png
│   │   └── video.mp4                        ← 视频（可选，video 模式）
│   └── 2026-03-14T10-00-00_bot5_abc123.md   ← 旧格式（向后兼容）
├── publishing/    ← mv 锁定（文件夹 mv 同样原子）
└── published/     ← 归档（仅成功的，失败直接删除并回传通知）
```

> 提交脚本：`~/.openclaw/scripts/submit-to-publisher.sh`，bot 调用后自动创建文件夹格式的队列条目。

## 飞书告警

通过 `message()` 工具发送，使用 bot_main 的飞书账号：

```
message(action="send", channel="feishu", target="oc_e59188e3ecdb04acd9b33843870a2249", message="告警内容")
```
