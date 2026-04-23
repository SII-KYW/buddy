#!/bin/bash
PROMPT_FILE="$HOME/.claude/buddy/quip-prompt.txt"
QUIP_FILE="$HOME/.claude/buddy/quip.txt"
LOCK_FILE="$HOME/.claude/buddy/quip.lock"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

[ ! -f "$PROMPT_FILE" ] && exit 0

PROMPT=$(cat "$PROMPT_FILE")
[ -z "$PROMPT" ] && exit 0

OUTPUT=$(claude -p "$PROMPT" --output-format text --no-session-persistence 2>/dev/null)
[ -z "$OUTPUT" ] && exit 0

# Write raw output to temp file, sanitize with node (proper UTF-8 handling)
TMPFILE=$(mktemp /tmp/buddy-quip-XXXXXX)
echo "$OUTPUT" > "$TMPFILE"
node "$SCRIPT_DIR/quip-sanitize.mjs" "$TMPFILE" "$QUIP_FILE"

rm -f "$LOCK_FILE"
