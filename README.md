# Buddy — Coding Health Pet for Claude Code

English | [中文](README_ZH.md)

A coding health dashboard disguised as a Tamagotchi pet in your Claude Code status bar. Stats are auto-computed from your real coding activity — context usage, git status, session time — no manual feeding needed. Your pet generates witty quips via AI, has its own backstory, and evolves as you code.

## Features

- **Zero-interaction pet** — stats auto-update from your real coding activity (commits, pushes, context usage, file edits)
- **AI quips** — your pet comments on what you're doing using your configured LLM provider
- **Inner monologue** — 35% of the time your pet drifts into its own thoughts (💭 marker)
- **Lore system** — each pet gets an AI-generated backstory and detailed personality at hatch
- **Personality evolution** — personality description evolves on level-up
- **Session-aware** — reads Claude Code's own `away_summary` for quip context
- **18 species, 12 personalities** — with rare ✨ shiny variants
- **Provider-agnostic** — works with any Anthropic Messages API compatible provider (GLM, Anthropic, OpenRouter, etc.)
- **Quota display** — automatic usage monitoring for GLM/ZHIPU Coding Plan users
- **Standalone TUI dashboard** — full pet view in a separate terminal

## Statusline

```
glm-5.1[200K] Ctx ▓▓░░░░ 35%  5h ░░░░░░ 8%  week ▓░░░░░ 24%
🦊 Storm ✨ Lv5 ❤73 🍖60 ⚡90  所以我是你commit出来的那我能继承你的发际线吗
```

Line 1: Model info + context bar + provider quota (if applicable)
Line 2: Pet stats + AI-generated quip or inner thought (💭)

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
║ 📖 被一阵异常的流星雨从天空角落吹进了某个程序员的终   ║
║ 🎭 对一切都充满好奇，经常用小爪子戳屏幕上的代码...    ║
║                                                      ║
║ ❤ Happiness  ██████████████░░░░ 73%                  ║
║ 🍖 Hunger    ████████████░░░░░░░░ 60%                ║
║ ⚡ Energy     ████████████████░░ 90%                  ║
║ 🛁 Clean     ██████████████████░░ 100%               ║
║                                                      ║
║ 💭 Storm 深夜的终端里藏着什么秘密呢                   ║
╟──────────────────────────────────────────────────────╢
║ Commits: 5  Pushes: 2  Files: 12                     ║
║ [p]pet [r]efresh [h]atch [x]reset [q]uit             ║
╚══════════════════════════════════════════════════════╝
```

Keys: `[p]` pet `[r]` refresh `[h]` hatch new `[x]` reset (press twice) `[q]` quit

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

Your pet generates witty one-liners via direct API calls (Anthropic Messages compatible — works with any provider). Context is gathered from:

- **Git status** — branch, dirty files, unpushed commits, recent commit messages
- **Session activity** — reads Claude Code's `away_summary` from transcript, or falls back to recent user messages
- **Time & weather** — included randomly (~45% / ~35%) to avoid repetitive quips
- **Pet lore** — backstory and personality detail inform the quip's voice

### Inner Monologue Mode

35% of the time, instead of reacting to your activity, your pet drifts into its own inner world — singing, reminiscing, daydreaming, philosophizing. These are marked with 💭 and shown in parentheses.

### Examples

- *"所以我是你commit出来的那我能继承你的发际线吗"*
- *"你刚刚提交了一只电子宠物然后立刻/clear掉了我会不会是下一个被清掉的"*
- *"刚写完电子宠物就/clear我 程序员都这么赛博弃养的吗"*
- *(💭 晚风从终端的缝隙里溜进来 好像闻到了春天的味道)*

## Lore System

When your pet hatches, the AI generates:

1. **Background story** (~200 chars) — how this creature ended up in your terminal. Permanent once generated.
2. **Personality detail** (~200 chars) — specific habits, speech patterns, quirks based on the personality keyword.

On each level-up, the personality detail is refined by the AI — your pet grows and changes as you code.

## Architecture

```
statusline.mjs          Entry point — called by Claude Code periodically
├── pet-engine.mjs      Core engine — species, stats, ASCII art, hatch/reset
├── quip.mjs            Prompt builder — gathers context, writes prompt file
├── llm.mjs             Direct Anthropic Messages API calls (provider-agnostic)
├── tick.mjs            Lightweight tick for loop agents
└── view.mjs            Standalone TUI dashboard (run in a separate terminal)

Data:
├── ~/.claude/buddy/state.json      Pet state (persists across sessions)
├── ~/.claude/buddy/quip.txt        Cached quip (refreshed every minute)
├── ~/.claude/buddy/quip-prompt.txt Latest prompt for quip generation
├── ~/.claude/buddy/quip-mode.txt   'thought' or 'quip' marker
└── ~/.claude/buddy/git-cache.json  Git info cache (20s TTL)
```

## Install

### 1. Get the files

```bash
git clone https://github.com/SII-KYW/buddy.git ~/.claude/scripts/buddy
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

The statusline reads these environment variables (injected by Claude Code):
- `ANTHROPIC_BASE_URL` — your LLM provider's base URL
- `ANTHROPIC_AUTH_TOKEN` — your API key
- `ANTHROPIC_MODEL` — model to use for quips and lore

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

## 18 Species / 12 Personalities

| Species | | | | | | |
|---------|---|---|---|---|---|---|
| 🐱 Cat | 🐕 Dog | 🐰 Rabbit | 🐹 Hamster | 🐦 Bird | 🐟 Fish | 🐢 Turtle |
| 🐍 Snake | 🐸 Frog | 🐻 Bear | 🦊 Fox | 🐧 Penguin | 🦉 Owl | 🐉 Dragon |
| 👻 Ghost | 🤖 Robot | 👾 Alien | ⭐ Star | | | |

Each species has a rare ✨ shiny variant (5% chance on hatch).

| Personality | Chinese | Voice |
|-------------|---------|-------|
| lazy | 懒洋洋 | Sluggish, trails off with "嘛" "呢" "..." |
| energetic | 元气满满 | Super excited, lots of exclamation marks |
| shy | 社恐 | Timid, occasionally drops a sharp whisper |
| mischievous | 调皮捣蛋 | Sneaky, loves pranks, cheeky tone |
| brave | 勇猛 | Bold and direct, like a warrior |
| curious | 好奇宝宝 | Asks absurd questions about everything |
| proud | 傲娇 | Tsundere — cares but pretends not to |
| gentle | 温柔 | Soft-spoken, nurturing |
| grumpy | 暴躁 | Complains about everything, secretly watches over you |
| clumsy | 冒失鬼 | Keeps saying wrong things, somehow endearing |
| wise | 老成 | Speaks like an old Zen master, dubious wisdom |
| chaotic | 混沌邪恶 | Random, unpredictable, occasionally cosmic |

## Requirements

- Claude Code CLI
- Node.js 18+
- Any LLM provider with Anthropic Messages API compatibility (GLM/ZHIPU, Anthropic, OpenRouter, etc.)

## Acknowledgments

Inspired by [glm-cc-bar](https://github.com/ziHoHe/glm-cc-bar) — GLM quota monitor for Claude Code.

## License

MIT
