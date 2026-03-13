# HEARTBEAT.md - 安全部心跳巡检

## 前置检查

收到心跳触发后（消息以 `Read HEARTBEAT.md` 开头），先执行：

```bash
cat memory/last-check.txt 2>/dev/null || echo "0"
date +%s
```

- 距上次检查 < 3600 秒（1小时）→ 直接回复 `HEARTBEAT_OK`，结束
- 否则继续执行巡检

---

## 巡检流程

### 第一步：读取新异常

```bash
# 读取上次检查时间
LAST=$(cat memory/last-check.txt 2>/dev/null || echo "1970-01-01T00:00:00+00:00")

# 读取最新记录
tail -50 /home/rooot/.openclaw/security/incidents.jsonl 2>/dev/null
```

用 Python 过滤出 `ts > LAST` 的记录：

```bash
python3 -c "
import json, sys
last = open('memory/last-check.txt').read().strip() if __import__('os').path.exists('memory/last-check.txt') else '0'
new = []
try:
    for line in open('/home/rooot/.openclaw/security/incidents.jsonl'):
        r = json.loads(line)
        if r.get('ts','') > last:
            new.append(r)
except: pass
print(f'新增记录：{len(new)} 条')
errors = [r for r in new if r.get('level') == 'ERROR']
warnings = [r for r in new if r.get('level') == 'WARNING']
print(f'ERROR: {len(errors)}  WARNING: {len(warnings)}')
for r in errors:
    print(f\"  ❌ {r.get('type')} - {r.get('reporter')}: {r.get('message')}\")
"
```

### 第二步：分级处理

**有新 ERROR 记录** → 通知 bot_main：

```bash
openclaw agent --agent bot_main --message "【安全部告警】新增 N 条 ERROR：
❌ TYPE - reporter：message
时间：ts"
```

**只有 WARNING** → 静默归档到当日日记，不通知任何人。

**无新记录** → 静默，不做任何输出。

### 第三步：更新时间戳

```bash
date -Iseconds > memory/last-check.txt
```

---

## 铁律

- **不重复告警**：只处理 `ts > last-check.txt` 的记录
- **ERROR 必须通知 bot_main**，WARNING 静默归档
- **无新记录时绝对静默**，不回复任何内容（除了最后更新时间戳）
- 巡检完成后回复 `HEARTBEAT_OK`
