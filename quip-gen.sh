#!/bin/bash
PROMPT_FILE="$HOME/.claude/buddy/quip-prompt.txt"
QUIP_FILE="$HOME/.claude/buddy/quip.txt"

[ ! -f "$PROMPT_FILE" ] && exit 0

PROMPT=$(cat "$PROMPT_FILE")
[ -z "$PROMPT" ] && exit 0

OUTPUT=$(claude -p "$PROMPT" --model glm-5.1 --output-format text --no-session-persistence 2>/dev/null)
[ -z "$OUTPUT" ] && exit 0

echo "$OUTPUT" | sed "s/^[\"'"'"'"'"'"'"'"]*//;s/[\"'"'"'"'"'"'"'"]*$//;s/[。！？.!?]+$//" | head -c 40 > "$QUIP_FILE"
cat "$QUIP_FILE"
