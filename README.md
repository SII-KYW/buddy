# Buddy — Coding Health Pet for Claude Code

English | [中文](README_ZH.md)

A coding health dashboard disguised as a Tamagotchi pet in your Claude Code status bar. Stats are auto-computed from your real coding activity — context usage, git status, session time — no manual feeding needed. Plus, your pet generates witty quips using AI.

## Statusline

```
glm-5.1[200K] Ctx ▓▓░░░░ 35%  5h ░░░░░░ 8%  week ▓░░░░░ 24%  MCP ░░░░░░ 334/4000
🦊 StormLv5 ❤73 🍖60 ⚡90  所以我是你commit出来的那我能继承你的发际线吗
```

Line 1: Model info + context bar + GLM quota
Line 2: Pet stats + AI-generated quip

## Dashboard (separate terminal)

```
╔══════════════════════════════════════════════════════╗
║ 🦊 Storm ✨SHINY✨  —  好奇宝宝                      ║
║ 5分钟大  |  Session: 3分钟  |  Streak: 1d            ║
║ Lv.5 新手  ▓▓░░░░░░░░░░░░░░  12/125 XP              ║
╟──────────────────────────────────────────────────────╢
║               /\___/\                                ║
║              /  o o  \                               ║
║             (   =^=   )                              ║
║              \  ~_~  /                               ║
║               ^^^^^^^                                ║
║                                                      ║
║ Mood: 😊 happy                                       ║
║ ❤ Happiness  ██████████████████░░░░ 73%              ║
║ 🍖 Hunger     ████████████░░░░░░░░░░ 60%  ctx 35%    ║
║ ⚡ Energy      ██████████████████░░░░ 90%  3min      ║
║ 🛁 Clean       ████████████████████░░ 100% 0 dirty   ║
║ 🌟in-flow                                           ║
║                                                      ║
║ 💭 Storm 深夜的终端里藏着什么秘密呢                    ║
╟──────────────────────────────────────────────────────╢
║ Commits: 5  Pushes: 2  Files: 12                     ║
║ [p]pet [r]efresh [h]atch [q]uit                      ║
╚══════════════════════════════════════════════════════╝
```

## How Stats Work (no manual interaction)

| Stat | Driven by | Meaning |
|------|-----------|---------|
| **Hunger** | Inverse of context % | More context = hungrier pet (working hard) |
| **Energy** | Session duration | Longer session = lower energy |
| **Cleanliness** | Git dirty files | More uncommitted changes = messier |
| **Happiness** | Weighted composite | Overall coding health indicator |

## XP System

Your pet levels up from real coding activity:

| Action | XP | Trigger |
|--------|----|---------|
| Session start | +5 | New session after 30min gap |
| Git commit | +15 | New commit detected |
| Git push | +10 | `ahead` count drops to 0 |
| File changes | +2/file (cap +8) | New dirty files detected |
| Context growth | +2 per 5% | Context window expanding |
| Compaction | +12 | Context auto-compacted |
| Cleanup bonus | +8 | All dirty files resolved |

## AI Quips

Your pet generates witty one-liners using `claude -p` (runs your configured model). It knows about:

- **Time** — late night? weekend? different vibes
- **Weather** — via `wttr.in`
- **Git status** — branch, dirty files, unpushed commits
- **Session recap** — reads Claude Code's `away_summary` from transcript, or falls back to recent user messages
- **Pet personality** — 12 personalities with distinct voice styles

Examples:
- *"所以我是你commit出来的那我能继承你的发际线吗"*
- *"你刚刚提交了一只电子宠物然后立刻/clear掉了我会不会是下一个被清掉的"*
- *"刚写完电子宠物就/clear我 程序员都这么赛博弃养的吗"*

## Architecture

```
statusline.mjs          Entry point — called by Claude Code periodically
├── pet-engine.mjs      Core engine — species, stats, ASCII art, personalities
├── quip.mjs            Prompt builder — gathers context, writes prompt file
├── quip-gen.sh         Calls `claude -p` to generate quip (background, non-blocking)
├── tick.mjs            Lightweight tick for loop agents
└── view.mjs            Standalone TUI dashboard (run in a separate terminal)

Data:
├── ~/.claude/buddy/state.json      Pet state (persists across sessions)
├── ~/.claude/buddy/quip.txt        Cached quip (refreshed every minute)
├── ~/.claude/buddy/quip-prompt.txt Latest prompt for quip generation
└── ~/.claude/buddy/git-cache.json  Git info cache (20s TTL)
```

## Install

### 1. Get the files

```bash
git clone https://github.com/cog-mycc/buddy.git ~/.claude/scripts/buddy
```

### 2. Configure Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/scripts/buddy/statusline.mjs",
    "padding": 0
  }
}
```

### 3. (Optional) Set up /buddy command

```bash
mkdir -p ~/.claude/commands
cp ~/.claude/scripts/buddy/../commands/buddy.md ~/.claude/commands/buddy.md
```

### 4. Restart Claude Code

Your pet hatches automatically on first load!

### 5. (Optional) Dashboard in separate terminal

```bash
node ~/.claude/scripts/buddy/view.mjs
```

Keys: `[p]` pet `[r]` refresh `[h]` hatch new `[q]` quit

## 18 Species / 12 Personalities

| Species | | | | | | |
|---------|---|---|---|---|---|---|
| 🐱 Cat | 🐕 Dog | 🐰 Rabbit | 🐹 Hamster | 🐦 Bird | 🐟 Fish | 🐢 Turtle |
| 🐍 Snake | 🐸 Frog | 🐻 Bear | 🦊 Fox | 🐧 Penguin | 🦉 Owl | 🐉 Dragon |
| 👻 Ghost | 🤖 Robot | 👾 Alien | ⭐ Star | | | |

| Personality | Chinese |
|-------------|---------|
| lazy | 懒洋洋 |
| energetic | 元气满满 |
| shy | 社恐 |
| mischievous | 调皮捣蛋 |
| brave | 勇猛 |
| curious | 好奇宝宝 |
| proud | 傲娇 |
| gentle | 温柔 |
| grumpy | 暴躁 |
| clumsy | 冒失鬼 |
| wise | 老成 |
| chaotic | 混沌邪恶 |

## Requirements

- Claude Code CLI
- Node.js 18+
- (Optional) GLM/ZHIPU Coding Plan for quota display

## License

MIT
