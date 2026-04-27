#!/bin/bash
# Lore Generator — calls claude -p to generate pet backstory + personality
# Input: ~/.claude/buddy/lore-prompt.txt
# Output: writes background and personalityDetail into state.json

PROMPT_FILE="$HOME/.claude/buddy/lore-prompt.txt"
STATE_FILE="$HOME/.claude/buddy/state.json"
LOCK_FILE="$HOME/.claude/buddy/lore.lock"

[ ! -f "$PROMPT_FILE" ] && exit 0
[ ! -f "$STATE_FILE" ] && exit 0

PROMPT=$(cat "$PROMPT_FILE")
[ -z "$PROMPT" ] && exit 0

OUTPUT=$(claude -p "$PROMPT" --output-format text --no-session-persistence 2>/dev/null)
[ -z "$OUTPUT" ] && exit 0

# Skip API error responses
echo "$OUTPUT" | grep -qiE "error|429|rate.limit|rejected|forbidden" && { rm -f "$LOCK_FILE"; exit 0; }

# Write raw output to temp file for node to parse
TMPFILE=$(mktemp)
echo "$OUTPUT" > "$TMPFILE"

node --input-type=module -e "
import fs from 'fs';
const stateFile = process.env.STATE_FILE;
const tmpFile = process.argv[1];
const raw = fs.readFileSync(tmpFile, 'utf8').trim();
const parts = raw.split(/\\n===\\n/);
const bg = (parts[0] || '').trim().slice(0, 200);
const pd = (parts[1] || '').trim().slice(0, 300);
try {
  const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (bg) s.background = bg;
  if (pd) s.personalityDetail = pd;
  fs.writeFileSync(stateFile, JSON.stringify(s, null, 2));
} catch {}
fs.unlinkSync(tmpFile);
" "$TMPFILE"

rm -f "$LOCK_FILE"
