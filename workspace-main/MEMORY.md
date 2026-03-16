# MEMORY.md - 魏忠贤长期记忆

## 巡检机制

- **登录巡检频率由 cron 控制，heartbeat 不做频率记录**
- 不写 `memory/last-heartbeat.txt`，不读，不依赖它
- HEARTBEAT.md 只做"是否为心跳触发"和"时间窗口"两项检查，其余由 cron 负责调度
- 这是圣上明确指示，下次 session 必须遵守

## 异常日志处理

- **绝对不能手动清空 incidents.jsonl**
- 正确流程：运行 `python3 ~/.openclaw/workspace-main/scripts/check-incidents.py`，脚本自动读取、输出告警、清档
- 有输出 → 转发到飞书群；无输出 → 静默
- 自己不许启动 Claude Code，需要时准备好任务说明，由圣上来启动
- 联系其他 bot/agent **只能用 send_message 插件**，禁止用 `openclaw agent` CLI，禁止通过飞书群发消息
- 出错时只报错给圣上，不擅自换其他方式
