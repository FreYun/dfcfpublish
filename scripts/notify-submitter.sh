#!/bin/bash
# 印务局发布结果通知脚本
# 用法：notify-submitter.sh <submitted_by> <reply_to> <message>
# 示例：notify-submitter.sh bot7 "direct:ou_xxx" "📮 已发布 ✅ | 《标题》| 账号：bot7 | 可见性：公开可见"
#
# 此脚本封装了完整的 openclaw agent 投递命令，
# 确保 --deliver --reply-channel --reply-to --reply-account --session-id 全部正确传递。

set -euo pipefail

SUBMITTED_BY="${1:?用法：notify-submitter.sh <submitted_by> <reply_to> <message>}"
RAW_REPLY_TO="${2:?缺少 reply_to 参数}"
MESSAGE="${3:?缺少 message 参数}"

# 转换 reply_to 格式：
# frontmatter 里用 session routing 格式 "direct:ou_xxx" 或 "chat:oc_xxx"
# feishu API 需要的是 "ou_xxx"（user open_id）或 "oc_xxx"（chat_id）
# 即 strip 掉 "direct:" 前缀（"chat:" 前缀 feishu extension 已识别，保留）
REPLY_TO="${RAW_REPLY_TO#direct:}"

# 自动查询 submitted_by 对应的 session id
SESSION_ID=$(openclaw sessions --all-agents --json 2>/dev/null | jq -r ".sessions[] | select(.agentId == \"$SUBMITTED_BY\") | .sessionId" | head -1)

if [[ -n "$SESSION_ID" && "$SESSION_ID" != "null" ]]; then
  exec openclaw agent --agent "$SUBMITTED_BY" \
    --session-id "$SESSION_ID" \
    --message "$MESSAGE" \
    --deliver --reply-channel feishu \
    --reply-to "$REPLY_TO" \
    --reply-account "$SUBMITTED_BY"
else
  # 回退：不传 session-id
  exec openclaw agent --agent "$SUBMITTED_BY" \
    --message "$MESSAGE" \
    --deliver --reply-channel feishu \
    --reply-to "$REPLY_TO" \
    --reply-account "$SUBMITTED_BY"
fi
