# Agent Installation Guide

Instructions for AI agents (Claude Code, Copilot, Cursor, etc.) to install Buddy on behalf of a user.

## Prerequisites

- Node.js 18+
- Claude Code CLI

## Steps

### 1. Download the scripts

Use curl to download the three core files:

```bash
mkdir -p ~/.claude/scripts/buddy && \
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/buddy/main/pet-engine.mjs -o ~/.claude/scripts/buddy/pet-engine.mjs && \
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/buddy/main/statusline.mjs -o ~/.claude/scripts/buddy/statusline.mjs && \
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/buddy/main/view.mjs -o ~/.claude/scripts/buddy/view.mjs && \
chmod +x ~/.claude/scripts/buddy/*.mjs
```

### 2. Set up the /buddy command

```bash
mkdir -p ~/.claude/commands && \
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/buddy/main/commands/buddy.md -o ~/.claude/commands/buddy.md
```

### 3. Read existing settings

Read `~/.claude/settings.json`. If it does not exist, create it with `{}`.

### 4. Update settings.json

Add or update the `statusLine` entry. **Keep all existing keys intact**, especially `env`.

If the user already has a `statusLine` configured (e.g., glm-cc-bar), **replace** it with the Buddy combined statusline — it includes both pet status AND GLM quota display.

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/scripts/buddy/statusline.mjs",
    "padding": 0
  }
}
```

Make sure `env` contains `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` if using GLM/ZHIPU platform — Buddy needs these for quota display.

### 5. Hatch the first pet

Run the viewer to hatch a new pet:

```bash
node ~/.claude/scripts/buddy/view.mjs hatch
```

### 6. Tell the user to restart

Inform the user:

> Installation complete! Your buddy has hatched. Please restart Claude Code to see the pet status bar at the bottom of your terminal. Use `/buddy` to see the full ASCII art pet interface.

## Troubleshooting

- If the status bar does not appear, check that Node.js 18+ is installed (`node -v`).
- If the pet shows "no buddy yet", run `node ~/.claude/scripts/buddy/view.mjs hatch` manually.
- If quota bars are missing but the pet shows, verify `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` in settings.
- The `/buddy` command requires the file at `~/.claude/commands/buddy.md`.
