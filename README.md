# Buddy — Tamagotchi Pet for Claude Code CLI 🐾

English | [中文](README_ZH.md)

A Tamagotchi-style virtual pet that lives in your Claude Code status bar. 18 species, 1% shiny rate, and real stat decay — take care of your buddy while you code!

## Screenshot

```
    Sora  the Dog
    "energetic and playful"  just born

          / \__
         (    @\
         /    \
        /  |  | \
        V__|__|__/

    Mood:     🤩 ecstatic
    Happiness: ❤️  ████████████████████ 100%
    Hunger:    🍖 ████████████████████ 100%
    Energy:    ⚡ ████████████████████ 100%
```

Statusline (bottom of Claude Code):

```
🐕 Sora ❤100 🍖90 ⚡85  glm-5.1[200K] Ctx ▓░░░░░ 0%  5h ▓░░░░░ 20%  MCP ░░░░░░ 72/1000
```

## Features

| Feature | Description |
|---------|-------------|
| **18 species** | Cat, Dog, Rabbit, Hamster, Bird, Fish, Turtle, Snake, Frog, Bear, Fox, Penguin, Owl, Dragon, Ghost, Robot, Alien, Star |
| **1% shiny rate** | Rare shiny variant with ✨ sparkle effect |
| **Stat decay** | Hunger, Happiness, and Energy decrease over time |
| **Actions** | Feed, Play, Sleep — each affects stats differently |
| **Personality** | Random name + personality trait for each pet |
| **Statusline** | Compact pet status in Claude Code bottom bar |
| **GLM/ZHIPU quota** | Integrated with [glm-cc-bar](https://github.com/ziHoHe/glm-cc-bar) quota display |
| **`/buddy` command** | Full ASCII art viewer via Claude Code slash command |
| **Zero dependencies** | Pure Node.js, no npm install needed |

## Requirements

- Claude Code CLI
- Node.js 18+
- (Optional) A GLM/ZHIPU Coding Plan for quota display

## Install

### 1. Get the files

**Option A: git clone**

```bash
git clone https://github.com/YOUR_USERNAME/buddy.git ~/.claude/scripts/buddy
```

**Option B: curl (core files only)**

```bash
mkdir -p ~/.claude/scripts/buddy
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/buddy/main/pet-engine.mjs -o ~/.claude/scripts/buddy/pet-engine.mjs
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/buddy/main/statusline.mjs -o ~/.claude/scripts/buddy/statusline.mjs
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/buddy/main/view.mjs -o ~/.claude/scripts/buddy/view.mjs
chmod +x ~/.claude/scripts/buddy/*.mjs
```

**Option C: Tell Claude Code**

Paste this into your Claude Code chat:

> Install the buddy pet statusline from https://github.com/YOUR_USERNAME/buddy — read AGENT_INSTALL.md in the repo for instructions.

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

If you have GLM/ZHIPU env vars, the statusline will also show quota bars. Make sure your `env` block includes `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN`.

### 3. Set up the /buddy command

Create the slash command file:

```bash
mkdir -p ~/.claude/commands
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/buddy/main/commands/buddy.md -o ~/.claude/commands/buddy.md
```

### 4. Restart Claude Code

Restart to see your buddy in the status bar. A new pet will hatch automatically on first load!

## Usage

### Statusline

Your pet status appears at the bottom of Claude Code:

```
🐕 Sora ❤100 🍖60 ⚡85  glm-5.1[200K] Ctx ▓▓░░░░ 51%  5h ▓▓░░░░ 20%
```

Stats color-code automatically:
- **Green** — stat above 50%
- **Yellow** — stat between 20% and 50%
- **Red** — stat below 20% (your buddy needs help!)

### /buddy command

Type `/buddy` in Claude Code to see the full ASCII art viewer, then ask Claude to feed, play, or put your pet to sleep.

### Direct CLI

```bash
# View pet status
node ~/.claude/scripts/buddy/view.mjs

# Hatch a new pet (random species, 1% shiny!)
node ~/.claude/scripts/buddy/view.mjs hatch

# Interact
node ~/.claude/scripts/buddy/view.mjs feed
node ~/.claude/scripts/buddy/view.mjs play
node ~/.claude/scripts/buddy/view.mjs sleep
```

## How it works

1. **State** is persisted to `~/.claude/buddy/state.json`
2. **Stat decay** runs automatically — Hunger decreases 0.5/min, Happiness 0.3/min, Energy 0.2/min
3. **Statusline** reads state on each render cycle (every few seconds)
4. **Actions** modify stats: Feed (+30 hunger), Play (+25 happiness, -15 energy), Sleep (+40 energy)

### Actions at a glance

| Action | Hunger | Happiness | Energy |
|--------|--------|-----------|--------|
| Feed   | +30    | +5        | —      |
| Play   | -10    | +25       | -15    |
| Sleep  | -5     | +5        | +40    |

## All 18 Species

| # | Species | Emoji | # | Species | Emoji |
|---|---------|-------|---|---------|-------|
| 1 | Cat     | 🐱   | 10 | Bear   | 🐻  |
| 2 | Dog     | 🐕   | 11 | Fox    | 🦊  |
| 3 | Rabbit  | 🐰   | 12 | Penguin| 🐧  |
| 4 | Hamster | 🐹   | 13 | Owl    | 🦉  |
| 5 | Bird    | 🐦   | 14 | Dragon | 🐉  |
| 6 | Fish    | 🐟   | 15 | Ghost  | 👻  |
| 7 | Turtle  | 🐢   | 16 | Robot  | 🤖  |
| 8 | Snake   | 🐍   | 17 | Alien  | 👾  |
| 9 | Frog    | 🐸   | 18 | Star   | ⭐  |

## License

MIT
