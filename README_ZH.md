# Buddy — Claude Code 编程健康宠物

[English](README.md) | 中文

一个伪装成拓麻歌子的编程健康仪表盘，住在你的 Claude Code 状态栏里。宠物属性完全由真实编程数据自动计算——上下文用量、git 状态、会话时长——不需要手动喂养。你的宠物还会用 AI 生成骚话。

## 状态栏

```
glm-5.1[200K] Ctx ▓▓░░░░ 35%  5h ░░░░░░ 8%  week ▓░░░░░ 24%  MCP ░░░░░░ 334/4000
🦊 StormLv5 ❤73 🍖60 ⚡90  所以我是你commit出来的那我能继承你的发际线吗
```

第一行：模型信息 + 上下文进度条 + GLM 配额
第二行：宠物属性 + AI 生成的骚话

## 独立面板（单独终端）

```
╔══════════════════════════════════════════════════════╗
║ 🦊 Storm ✨SHINY✨  —  好奇宝宝                      ║
║ 5分钟大  |  Session: 3分钟  |  连续: 1天              ║
║ Lv.5 新手  ▓▓░░░░░░░░░░░░░░  12/125 XP              ║
╟──────────────────────────────────────────────────────╢
║               /\___/\                                ║
║              /  o o  \                               ║
║             (   =^=   )                              ║
║              \  ~_~  /                               ║
║               ^^^^^^^                                ║
║                                                      ║
║ 心情: 😊 开心                                        ║
║ ❤ 幸福度    ██████████████░░░░ 73%                   ║
║ 🍖 饥饿度   ████████████░░░░░░░░░░ 60%  ctx 35%     ║
║ ⚡ 精力值   ████████████████░░░░ 90%  3min           ║
║ 🛁 干净度   ████████████████████░░ 100% 0 dirty      ║
║ 🌟心流中                                            ║
║                                                      ║
║ 💭 Storm 深夜的终端里藏着什么秘密呢                   ║
╟──────────────────────────────────────────────────────╢
║ Commits: 5  Pushes: 2  Files: 12                     ║
║ [p]摸摸 [r]刷新 [h]孵化 [q]退出                      ║
╚══════════════════════════════════════════════════════╝
```

## 属性原理（无需手动互动）

| 属性 | 数据来源 | 含义 |
|------|----------|------|
| **饥饿度** | 上下文占比的反比 | 上下文越长 = 越饿（说明在努力工作） |
| **精力值** | 会话时长 | 会话越久 = 精力越低 |
| **干净度** | Git dirty 文件数 | 未提交的改动越多 = 越脏 |
| **幸福度** | 加权综合分 | 编程健康总指标 |

## 经验系统

宠物从真实编程活动中升级：

| 行为 | 经验 | 触发条件 |
|------|------|----------|
| 会话开始 | +5 | 离开30分钟后新会话 |
| Git commit | +15 | 检测到新提交 |
| Git push | +10 | ahead 数归零 |
| 文件编辑 | +2/文件（上限+8） | 新的 dirty 文件 |
| 上下文增长 | +2 每 5% | 上下文窗口扩大 |
| 压缩 | +12 | 上下文自动压缩 |
| 清理奖励 | +8 | 所有 dirty 文件解决 |

## AI 骚话

宠物用 `claude -p` 生成机智的一句话，它知道：

- **时间** — 深夜？周末？不同氛围
- **天气** — 通过 `wttr.in`
- **Git 状态** — 分支、dirty 文件、未 push 的 commit
- **会话回顾** — 读取 Claude Code 的 `away_summary`，或最近的用户消息
- **宠物性格** — 12 种性格有各自独特的语气

示例：
- *"所以我是你commit出来的那我能继承你的发际线吗"*
- *"你刚刚提交了一只电子宠物然后立刻/clear掉了我会不会是下一个被清掉的"*
- *"刚写完电子宠物就/clear我 程序员都这么赛博弃养的吗"*

## 架构

```
statusline.mjs          入口 — Claude Code 周期性调用
├── pet-engine.mjs      核心引擎 — 物种、属性、ASCII art、性格
├── quip.mjs            Prompt 构建器 — 收集上下文，写入 prompt 文件
├── quip-gen.sh         调 `claude -p` 生成骚话（后台，非阻塞）
├── tick.mjs            轻量 tick，供 loop agent 使用
└── view.mjs            独立 TUI 面板（在单独终端运行）

数据文件：
├── ~/.claude/buddy/state.json      宠物状态（跨会话持久化）
├── ~/.claude/buddy/quip.txt        骚话缓存（每分钟刷新）
├── ~/.claude/buddy/quip-prompt.txt 最新的骚话 prompt
└── ~/.claude/buddy/git-cache.json  Git 信息缓存（20秒 TTL）
```

## 安装

### 1. 获取文件

```bash
git clone https://github.com/cog-mycc/buddy.git ~/.claude/scripts/buddy
```

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

### 3. （可选）设置 /buddy 命令

```bash
mkdir -p ~/.claude/commands
cp ~/.claude/scripts/buddy/../commands/buddy.md ~/.claude/commands/buddy.md
```

### 4. 重启 Claude Code

首次加载会自动孵化宠物！

### 5. （可选）在单独终端打开面板

```bash
node ~/.claude/scripts/buddy/view.mjs
```

按键：`[p]` 摸摸 `[r]` 刷新 `[h]` 孵化新宠物 `[q]` 退出

## 18 种宠物 / 12 种性格

| 物种 | | | | | | |
|------|---|---|---|---|---|---|
| 🐱 猫 | 🐕 狗 | 🐰 兔子 | 🐹 仓鼠 | 🐦 鸟 | 🐟 鱼 | 🐢 乌龟 |
| 🐍 蛇 | 🐸 青蛙 | 🐻 熊 | 🦊 狐狸 | 🐧 企鹅 | 🦉 猫头鹰 | 🐉 龙 |
| 👻 幽灵 | 🤖 机器人 | 👾 外星人 | ⭐ 星星 | | | |

| 性格 | 说明 |
|------|------|
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

## 环境要求

- Claude Code CLI
- Node.js 18+
- （可选）GLM/智谱 Coding Plan 用于配额显示

## 致谢

- 配额显示集成自 [glm-cc-bar](https://github.com/ziHoHe/glm-cc-bar)

## 许可证

MIT
