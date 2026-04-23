# Buddy — Claude Code 电子宠物 🐾

[English](README.md) | 中文

一个住在 Claude Code 状态栏里的拓麻歌子（电子宠物）。18 种宠物，1% 闪光率，真实状态衰减——边写代码边养宠物！

## 截图

```
    Sora  the Dog
    "energetic and playful"  刚出生

          / \__
         (    @\
         /    \
        /  |  | \
        V__|__|__/

    心情:     🤩 开心极了
    幸福度: ❤️  ████████████████████ 100%
    饥饿度: 🍖 ████████████████████ 100%
    精力值: ⚡ ████████████████████ 100%
```

状态栏（Claude Code 底部）：

```
🐕 Sora ❤100 🍖90 ⚡85  glm-5.1[200K] Ctx ▓░░░░░ 0%  5h ▓░░░░░ 20%  MCP ░░░░░░ 72/1000
```

## 功能特点

| 功能 | 说明 |
|------|------|
| **18 种宠物** | 猫、狗、兔子、仓鼠、鸟、鱼、乌龟、蛇、青蛙、熊、狐狸、企鹅、猫头鹰、龙、幽灵、机器人、外星人、星星 |
| **1% 闪光率** | 稀有闪光变体，带 ✨ 闪光特效 |
| **状态衰减** | 饥饿度、幸福度、精力值随时间下降 |
| **互动操作** | 喂食、玩耍、睡觉——每种操作影响不同属性 |
| **性格系统** | 随机生成名字和性格特征 |
| **状态栏集成** | Claude Code 底部紧凑显示宠物状态 |
| **GLM/智谱配额** | 集成 [glm-cc-bar](https://github.com/ziHoHe/glm-cc-bar) 配额显示 |
| **`/buddy` 命令** | 通过 Claude Code 斜杠命令查看完整 ASCII 宠物界面 |
| **零依赖** | 纯 Node.js，无需 npm install |

## 环境要求

- Claude Code CLI
- Node.js 18+
- （可选）GLM/智谱 Coding Plan 用于配额显示

## 安装

### 1. 获取文件

**方式 A：git clone**

```bash
git clone https://github.com/YOUR_USERNAME/buddy.git ~/.claude/scripts/buddy
```

**方式 B：curl（仅核心文件）**

```bash
mkdir -p ~/.claude/scripts/buddy
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/buddy/main/pet-engine.mjs -o ~/.claude/scripts/buddy/pet-engine.mjs
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/buddy/main/statusline.mjs -o ~/.claude/scripts/buddy/statusline.mjs
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/buddy/main/view.mjs -o ~/.claude/scripts/buddy/view.mjs
chmod +x ~/.claude/scripts/buddy/*.mjs
```

**方式 C：让 Claude Code 安装**

在 Claude Code 对话中粘贴：

> Install the buddy pet statusline from https://github.com/YOUR_USERNAME/buddy — read AGENT_INSTALL.md in the repo for instructions.

### 2. 配置 Claude Code

在 `~/.claude/settings.json` 中添加：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/scripts/buddy/statusline.mjs",
    "padding": 0
  }
}
```

如果你使用 GLM/智谱平台，状态栏会同时显示配额进度条。确保 `env` 中包含 `ANTHROPIC_BASE_URL` 和 `ANTHROPIC_AUTH_TOKEN`。

### 3. 设置 /buddy 命令

创建斜杠命令文件：

```bash
mkdir -p ~/.claude/commands
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/buddy/main/commands/buddy.md -o ~/.claude/commands/buddy.md
```

### 4. 重启 Claude Code

重启后即可在底部状态栏看到你的宠物。首次加载会自动孵化新宠物！

## 使用方法

### 状态栏

宠物状态显示在 Claude Code 底部：

```
🐕 Sora ❤100 🍖60 ⚡85  glm-5.1[200K] Ctx ▓▓░░░░ 51%  5h ▓▓░░░░ 20%
```

状态颜色自动变化：
- **绿色** — 属性高于 50%
- **黄色** — 属性在 20% 到 50% 之间
- **红色** — 属性低于 20%（你的宠物需要照顾了！）

### /buddy 命令

在 Claude Code 中输入 `/buddy` 查看完整的 ASCII 宠物界面，然后让 Claude 帮你喂食、玩耍或哄宠物睡觉。

### 命令行直接使用

```bash
# 查看宠物状态
node ~/.claude/scripts/buddy/view.mjs

# 孵化新宠物（随机物种，1% 闪光率！）
node ~/.claude/scripts/buddy/view.mjs hatch

# 互动
node ~/.claude/scripts/buddy/view.mjs feed    # 喂食
node ~/.claude/scripts/buddy/view.mjs play    # 玩耍
node ~/.claude/scripts/buddy/view.mjs sleep   # 睡觉
```

## 工作原理

1. **状态** 持久化到 `~/.claude/buddy/state.json`
2. **属性衰减** 自动运行——饥饿度每分钟 -0.5，幸福度 -0.3，精力 -0.2
3. **状态栏** 每次渲染周期（几秒）读取状态
4. **互动操作** 修改属性：喂食（饥饿+30）、玩耍（幸福+25，精力-15）、睡觉（精力+40）

### 操作效果一览

| 操作 | 饥饿度 | 幸福度 | 精力值 |
|------|--------|--------|--------|
| 喂食 | +30    | +5     | —      |
| 玩耍 | -10    | +25    | -15    |
| 睡觉 | -5     | +5     | +40    |

## 18 种宠物

| # | 物种 | 表情 | # | 物种 | 表情 |
|---|------|------|---|------|------|
| 1 | 猫   | 🐱   | 10 | 熊  | 🐻  |
| 2 | 狗   | 🐕   | 11 | 狐狸| 🦊  |
| 3 | 兔子 | 🐰   | 12 | 企鹅| 🐧  |
| 4 | 仓鼠 | 🐹   | 13 | 猫头鹰| 🦉|
| 5 | 鸟   | 🐦   | 14 | 龙  | 🐉  |
| 6 | 鱼   | 🐟   | 15 | 幽灵| 👻  |
| 7 | 乌龟 | 🐢   | 16 | 机器人| 🤖|
| 8 | 蛇   | 🐍   | 17 | 外星人| 👾|
| 9 | 青蛙 | 🐸   | 18 | 星星| ⭐  |

## 致谢

- 配额显示集成自 [glm-cc-bar](https://github.com/ziHoHe/glm-cc-bar)

## 许可证

MIT
