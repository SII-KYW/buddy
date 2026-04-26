/**
 * Buddy Pet Engine v3 — Coding Health Companion
 *
 * Stats are AUTO-COMPUTED from real data:
 *   Hunger      = inverse of context window usage
 *   Energy      = session freshness (time-based)
 *   Cleanliness = git working tree cleanliness
 *   Happiness   = weighted composite of all above
 *
 * XP earned from git commits, sessions, and coding streaks.
 * Personality and responses kept as bonus flavor.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, spawn } from 'child_process';

const HOME = os.homedir();
const STATE_DIR = path.join(HOME, '.claude', 'buddy');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const GIT_CACHE  = path.join(STATE_DIR, 'git-cache.json');
const GIT_CACHE_TTL = 20_000;

// ═══════════════════════════════════════════════════════════════════
// Species, Art, Personality (kept from v2)
// ═══════════════════════════════════════════════════════════════════

export const SPECIES = [
  { id: 'cat',     emoji: ['🐱','🐈','🦁'], label: 'Cat' },
  { id: 'dog',     emoji: ['🐶','🐕','🐺'], label: 'Dog' },
  { id: 'rabbit',  emoji: ['🐰','🐇','🥚'], label: 'Rabbit' },
  { id: 'hamster', emoji: ['🐹','🐿️','🦫'], label: 'Hamster' },
  { id: 'bird',    emoji: ['🐣','🐦','🦅'], label: 'Bird' },
  { id: 'fish',    emoji: ['🐟','🐠','🐋'], label: 'Fish' },
  { id: 'turtle',  emoji: ['🐢','🦎','🐲'], label: 'Turtle' },
  { id: 'snake',   emoji: ['🐍','🪱','🐲'], label: 'Snake' },
  { id: 'frog',    emoji: ['🐸','🪷','👑'], label: 'Frog' },
  { id: 'bear',    emoji: ['🐻','🧸','💪'], label: 'Bear' },
  { id: 'fox',     emoji: ['🦊','🌸','🔥'], label: 'Fox' },
  { id: 'penguin', emoji: ['🐧','🧊','❄️'], label: 'Penguin' },
  { id: 'owl',     emoji: ['🦉','📚','🔮'], label: 'Owl' },
  { id: 'dragon',  emoji: ['🐉','🐲','🔥'], label: 'Dragon' },
  { id: 'ghost',   emoji: ['👻','💀','☠️'], label: 'Ghost' },
  { id: 'robot',   emoji: ['🤖','🦾','🧠'], label: 'Robot' },
  { id: 'alien',   emoji: ['👽','👾','🛸'], label: 'Alien' },
  { id: 'star',    emoji: ['⭐','🌟','💫'], label: 'Star' },
];

export const NAMES = [
  'Mochi', 'Tofu', 'Nori', 'Wasabi', 'Matcha', 'Kumo', 'Hoshi', 'Sora',
  'Miku', 'Kira', 'Luna', 'Sol', 'Nebula', 'Pixel', 'Byte', 'Ziggy',
  'Cosmo', 'Blip', 'Dot', 'Spark', 'Boba', 'Mango', 'Peach', 'Cleo',
  'Olive', 'Ginger', 'Pepper', 'Miso', 'Pudding', 'Waffle', 'Clover',
  'Maple', 'Cedar', 'River', 'Storm', 'Echo', 'Nyx', 'Aria', 'Zephyr',
];

export const PERSONALITIES = [
  'lazy', 'energetic', 'shy', 'mischievous', 'brave', 'curious',
  'proud', 'gentle', 'grumpy', 'clumsy', 'wise', 'chaotic',
];

export const PERSONALITY_LABELS = {
  lazy: 'lazy but affectionate', energetic: 'energetic and playful',
  shy: 'shy but curious', mischievous: 'mischievous and clever',
  brave: 'brave and loyal', curious: 'curious and adventurous',
  proud: 'proud and independent', gentle: 'gentle and caring',
  grumpy: 'grumpy but lovable', clumsy: 'clumsy but adorable',
  wise: 'wise and calm', chaotic: 'chaotic and unpredictable',
};

// Face expressions per mood
const FACES = {
  ecstatic: '^▽^', happy: '°w°', content: '•.•',
  sad: 'u_u', critical: 'x_x', sleeping: '-ω-',
  angry: '>°<', sick: 'o_o',
};

// Body templates with FACE placeholder
const BODIES = {
  cat:     { lines: ['   /\\_/\\   ','FACE','   > ^ <   ','  /|   |\\ ',' (_|   |_) '], fmt: ' ( {F} ) ' },
  dog:     { lines: ['  / \\__    ','FACE',' /    \\    ','/  |  | \\  ','V__|__|__/ '], fmt: '(  {F}  ) ' },
  rabbit:  { lines: ['   (\\(\\    ','FACE','   (> <)   ','  /|   |\\ ',' (_|   |_) '], fmt: '  (-{F}-)  ' },
  hamster: { lines: ['   q p     ','FACE','   > ^ <   ','  /|   |\\ ',' (_| T |_) '], fmt: '  ( {F} )  ' },
  bird:    { lines: ['    ^ ^    ','FACE','   (   )   ','  -"-"---  ',' /       \\ '], fmt: '  ({F},)   ' },
  fish:    { lines: ['     /\\    ','FACE','<·(((>  > ','   \\   /   ','     \\/    '], fmt: '   {F}     ' },
  turtle:  { lines: ['    ____   ','FACE','  \\\\____/  ','   |    |  ','   "    "  '], fmt: ' ||({F})|  ' },
  snake:   { lines: ['   /____\\  ','FACE',' |  ___   |','  \\_____/  ','   ~~~~~   '], fmt: '  /{F} \\ ' },
  frog:    { lines: ['   @   @   ','FACE','  /|   |\\  ',' / |___| \\ ','   "   "   '], fmt: '  ({F} )   ' },
  bear:    { lines: ['   /•  •\\  ','FACE','   \\    /  ','   /|  |\\  ','  ( |  | ) '], fmt: '  ( {F}  ) ' },
  fox:     { lines: ['  /\\   /\\  ','FACE',' \\  <>  /  ','  \\____/   ','   "   "   '], fmt: '(  {F}  ) ' },
  penguin: { lines: ['   (°°)    ','FACE','  \\ o o /  ','   |   |   ','   "   "   '], fmt: '  /(   )\\  ' },
  owl:     { lines: ['   /\\  /\\  ','FACE','   \\ ^^ /  ','  /|    |\\ ',' (_|____|_)'], fmt: ' ({F}  ) ' },
  dragon:  { lines: ['   /\\_/\\   ','FACE','|  \\___/  |',' \\_______/ ','  /|   |\\  '], fmt: ' /{F} \\ ' },
  ghost:   { lines: ['   .---.   ','FACE',' |  \\_/  | ','  \\=====/  ','   ~~~~~   '], fmt: ' |{F}  | ' },
  robot:   { lines: ['  _[°]_    ','FACE','  | = |    ','  |___|    ','  /| |\\   '], fmt: '  |{F}|    ' },
  alien:   { lines: ['  .-"""-.  ','FACE',' \\  ===  / ','  \'-----\'  ','   "   "   '], fmt: '/ {F}  \\ ' },
  star:    { lines: ['    *      ','FACE','  *****    ','   ***     ','    *      '], fmt: '   {F}     ' },
};

// ═══════════════════════════════════════════════════════════════════
// Level System
// ═══════════════════════════════════════════════════════════════════

const LEVEL_TITLES = [
  'Newborn', 'Tiny', 'Small', 'Growing', 'Sprightly',
  'Lively', 'Vigorous', 'Robust', 'Mighty', 'Glorious',
  'Radiant', 'Heroic', 'Legendary', 'Mythic', 'Eternal',
  'Celestial', 'Transcendent', 'Omnipotent', 'Divine', 'Supreme',
];

export function xpForLevel(level) { return level * 25; }

export function getLevelTitle(level) {
  return LEVEL_TITLES[Math.min(Math.max(level - 1, 0), LEVEL_TITLES.length - 1)];
}

// ═══════════════════════════════════════════════════════════════════
// State Management
// ═══════════════════════════════════════════════════════════════════

export function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return null; }
}

export function saveState(state) {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ═══════════════════════════════════════════════════════════════════
// Notification System
// ═══════════════════════════════════════════════════════════════════

const NOTIF_FILE = path.join(STATE_DIR, 'notification.json');

export function notify(text, title = 'Buddy') {
  // Write notification file (TTL 120s for statusline display)
  try {
    fs.writeFileSync(NOTIF_FILE, JSON.stringify({ text, title, ts: Date.now() }));
  } catch {}
  // macOS / Linux system notification
  try {
    if (process.platform === 'darwin') {
      execSync(`osascript -e 'display notification "${text.replace(/"/g, '\\"')}" with title "${title}"'`, { timeout: 3000 });
    } else {
      execSync(`notify-send "${title}" "${text.replace(/"/g, '\\"')}"`, { timeout: 3000 });
    }
  } catch {}
}

export function getNotification() {
  try {
    const n = JSON.parse(fs.readFileSync(NOTIF_FILE, 'utf8'));
    if (Date.now() - n.ts < 120_000) return n;
  } catch {}
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// Achievement System
// ═══════════════════════════════════════════════════════════════════

export const ACHIEVEMENTS = [
  { id: 'first_commit',  name: 'Hello Git',       icon: '🎯', desc: 'First commit detected' },
  { id: 'night_owl',     name: 'Night Owl',        icon: '🦉', desc: 'Coded past 2am' },
  { id: 'early_bird',    name: 'Early Bird',       icon: '🌅', desc: 'Session started before 7am' },
  { id: 'streak_3',      name: 'On a Roll',        icon: '🔥', desc: '3-day coding streak' },
  { id: 'streak_7',      name: 'Weekly Warrior',   icon: '⚔️', desc: '7-day coding streak' },
  { id: 'streak_30',     name: 'Unstoppable',      icon: '💎', desc: '30-day coding streak' },
  { id: 'level_5',       name: 'Growing Up',       icon: '🌱', desc: 'Reached Lv5' },
  { id: 'level_10',      name: 'Double Digits',    icon: '🎖️', desc: 'Reached Lv10' },
  { id: 'level_20',      name: 'Veteran',          icon: '⭐', desc: 'Reached Lv20' },
  { id: 'commits_10',    name: 'Committer',        icon: '📝', desc: '10 total commits' },
  { id: 'commits_50',    name: 'Git Legend',        icon: '🏆', desc: '50 total commits' },
  { id: 'files_50',      name: 'Busy Fingers',     icon: '⌨️', desc: 'Touched 50 files' },
  { id: 'files_200',     name: 'Code Machine',     icon: '🤖', desc: 'Touched 200 files' },
  { id: 'compact_5',     name: 'Compacted',        icon: '♻️', desc: 'Survived 5 context compactions' },
  { id: 'push_5',        name: 'Ship It',          icon: '🚀', desc: '5 total pushes' },
  { id: 'marathon',      name: 'Marathon',         icon: '🏃', desc: '4+ hour coding session' },
  { id: 'clean_slate',   name: 'Clean Slate',      icon: '✨', desc: 'Cleaned up after 10+ dirty files' },
  { id: 'shiny_hatch',   name: 'Shiny!',           icon: '✨', desc: 'Hatched a rare shiny pet' },
];

export function checkAchievements(state) {
  if (!state) return [];
  const firstRun = !state.achievements;
  state.achievements = state.achievements || [];
  state.totalCompactions = state.totalCompactions || 0;
  const unlocked = [];
  const has = id => state.achievements.includes(id);

  const checks = {
    first_commit: () => (state.totalCommits || 0) >= 1,
    night_owl:    () => new Date().getHours() >= 2 && new Date().getHours() < 5,
    early_bird:   () => new Date().getHours() >= 5 && new Date().getHours() < 7,
    streak_3:     () => (state.streak || 0) >= 3,
    streak_7:     () => (state.streak || 0) >= 7,
    streak_30:    () => (state.streak || 0) >= 30,
    level_5:      () => (state.level || 1) >= 5,
    level_10:     () => (state.level || 1) >= 10,
    level_20:     () => (state.level || 1) >= 20,
    commits_10:   () => (state.totalCommits || 0) >= 10,
    commits_50:   () => (state.totalCommits || 0) >= 50,
    files_50:     () => (state.filesTouched || 0) >= 50,
    files_200:    () => (state.filesTouched || 0) >= 200,
    compact_5:    () => (state.totalCompactions || 0) >= 5,
    push_5:       () => (state.totalPushes || 0) >= 5,
    marathon:     () => (Date.now() - (state.lastSessionStart || state.born)) > 4 * 3600000,
    clean_slate:  () => (state.lastCleanBonus || 0) >= 1,
    shiny_hatch:  () => state.shiny === true,
  };

  for (const a of ACHIEVEMENTS) {
    if (!has(a.id) && checks[a.id] && checks[a.id]()) {
      state.achievements.push(a.id);
      // Only notify on NEW unlocks, not retroactive ones from first run
      if (!firstRun) unlocked.push(a);
    }
  }
  return unlocked;
}

export function hatched() { return fs.existsSync(STATE_FILE); }

export function hatch() {
  const isShiny = Math.random() < 0.01;
  const species = SPECIES[Math.floor(Math.random() * SPECIES.length)];
  const name = NAMES[Math.floor(Math.random() * NAMES.length)];
  const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  const state = {
    species: species.id,
    name,
    personality,
    shiny: isShiny,
    born: Date.now(),
    level: 1,
    xp: 0,
    totalCommits: 0,
    totalSessions: 1,
    streak: 1,
    lastSessionStart: Date.now(),
    lastCommitHash: '',
    lastCommitTime: 0,
    lastCareDate: new Date().toISOString().slice(0, 10),
    background: '',
    personalityDetail: '',
  };
  saveState(state);
  triggerLoreGen(state);
  return state;
}

export function reset() {
  const files = [STATE_FILE, path.join(STATE_DIR, 'quip.txt'), path.join(STATE_DIR, 'quip-prompt.txt'),
    path.join(STATE_DIR, 'git-cache.json'), path.join(STATE_DIR, 'lore-prompt.txt'), path.join(STATE_DIR, 'lore.lock')];
  for (const f of files) { try { fs.unlinkSync(f); } catch {} }
  return true;
}

export function needsLoreGen(state) {
  return state && !state.background;
}

function triggerLoreGen(state) {
  const SPECIES_CN = {
    cat:'猫',dog:'狗',rabbit:'兔子',hamster:'仓鼠',bird:'鸟',fish:'鱼',
    turtle:'乌龟',snake:'蛇',frog:'青蛙',bear:'熊',fox:'狐狸',penguin:'企鹅',
    owl:'猫头鹰',dragon:'龙',ghost:'幽灵',robot:'机器人',alien:'外星人',star:'星星',
  };
  const PERSONALITY_CN = {
    lazy:'懒洋洋',energetic:'元气满满',shy:'社恐',mischievous:'调皮捣蛋',
    brave:'勇猛',curious:'好奇宝宝',proud:'傲娇',gentle:'温柔',
    grumpy:'暴躁',clumsy:'冒失鬼',wise:'老成',chaotic:'混沌邪恶',
  };
  const sp = SPECIES_CN[state.species] || state.species;
  const ps = PERSONALITY_CN[state.personality] || state.personality;
  const prompt = `你是一个创意作家。为一只住在程序员终端里的电子宠物生成设定。

宠物信息：
- 名字：${state.name}
- 物种：${sp}
- 性格关键词：${ps}${state.shiny ? '\n- 特殊：✨闪光变种（稀有）' : ''}

请生成以下内容，用 === 分隔两部分：

第一部分（背景故事，200字以内）：
写一段有趣的背景故事，描述这只${sp}是怎么来到程序员的终端里的。要有创意，可以融入编程/科技梗。

第二部分（性格描写，200字以内）：
基于"${ps}"这个性格关键词，用生动的语言描写它的具体行为习惯、说话方式、小动作。要像描写一个真实的角色。

只输出这两部分，用 === 分隔，不要其他内容。`;

  const promptFile = path.join(STATE_DIR, 'lore-prompt.txt');
  fs.writeFileSync(promptFile, prompt);
  // Background spawn
  try {
    const child = spawn('bash', [path.join(STATE_DIR, '..', 'scripts', 'buddy', 'lore-gen.sh')], {
      detached: true, stdio: 'ignore', env: { ...process.env, STATE_FILE },
    });
    child.unref();
  } catch {}
}

export function triggerPersonalityEvolution(state) {
  const SPECIES_CN = {
    cat:'猫',dog:'狗',rabbit:'兔子',hamster:'仓鼠',bird:'鸟',fish:'鱼',
    turtle:'乌龟',snake:'蛇',frog:'青蛙',bear:'熊',fox:'狐狸',penguin:'企鹅',
    owl:'猫头鹰',dragon:'龙',ghost:'幽灵',robot:'机器人',alien:'外星人',star:'星星',
  };
  const PERSONALITY_CN = {
    lazy:'懒洋洋',energetic:'元气满满',shy:'社恐',mischievous:'调皮捣蛋',
    brave:'勇猛',curious:'好奇宝宝',proud:'傲娇',gentle:'温柔',
    grumpy:'暴躁',clumsy:'冒失鬼',wise:'老成',chaotic:'混沌邪恶',
  };
  const sp = SPECIES_CN[state.species] || state.species;
  const ps = PERSONALITY_CN[state.personality] || state.personality;
  const oldDetail = state.personalityDetail || '刚出生的小家伙';

  const prompt = `你是一个创意作家。一只住在终端里的电子${sp}要升级了。

当前信息：
- 名字：${state.name}
- 性格关键词：${ps}
- 当前性格描写：${oldDetail}
- 即将升到 Lv.${state.level}

随着等级提升，它的性格会微妙地成长和变化。请在保持核心性格不变的前提下，微调它的性格描写，体现出成长（比如变得更成熟、更有趣、或者有了新的小习惯）。

只输出更新后的性格描写（200字以内），不要其他内容。`;

  const promptFile = path.join(STATE_DIR, 'lore-prompt.txt');
  fs.writeFileSync(promptFile, prompt);
  try {
    const child = spawn('bash', [path.join(STATE_DIR, '..', 'scripts', 'buddy', 'lore-gen.sh')], {
      detached: true, stdio: 'ignore', env: { ...process.env, STATE_FILE },
    });
    child.unref();
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════
// Git Integration
// ═══════════════════════════════════════════════════════════════════

export function getGitInfo() {
  // Cache
  try {
    const cached = JSON.parse(fs.readFileSync(GIT_CACHE, 'utf8'));
    if (Date.now() - cached.ts < GIT_CACHE_TTL) return cached;
  } catch {}

  let dirty = 0, hash = '', branch = '', inRepo = false, ahead = 0;
  try {
    dirty = execSync('git status --porcelain 2>/dev/null', { encoding: 'utf8', timeout: 3000 })
      .split('\n').filter(Boolean).length;
    hash = execSync('git rev-parse --short HEAD 2>/dev/null', { encoding: 'utf8', timeout: 3000 }).trim();
    branch = execSync('git branch --show-current 2>/dev/null', { encoding: 'utf8', timeout: 3000 }).trim();
    inRepo = true;
    try {
      ahead = parseInt(execSync('git rev-list --count @{upstream}..HEAD 2>/dev/null', { encoding: 'utf8', timeout: 3000 }).trim()) || 0;
    } catch {} // no upstream yet
  } catch {}

  const result = { ts: Date.now(), dirty, hash, branch, inRepo, ahead };
  try { fs.writeFileSync(GIT_CACHE, JSON.stringify(result)); } catch {}
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// Auto Stats — computed from real data, never stored
// ═══════════════════════════════════════════════════════════════════

export function computeStats(state, ctxPct, gitInfo) {
  const lv = state.level || 1;

  // Level bonuses: energy decays slower, happiness floor higher
  const energyDecayRate = Math.max(0.15, 0.4 - lv * 0.01);  // Lv25 → 0.15
  const happyFloor = Math.min(30, Math.floor(lv * 1.5));      // Lv20 → 30

  // Hunger: inverse of context window usage
  const hunger = Math.round(Math.max(5, 100 - ctxPct * 1.15));

  // Energy: session freshness (decays over time)
  const sessionMin = (Date.now() - (state.lastSessionStart || state.born)) / 60000;
  const energy = Math.round(Math.max(5, 100 - sessionMin * energyDecayRate));

  // Cleanliness: git working tree
  const dirtyFiles = gitInfo?.dirty || 0;
  const cleanliness = gitInfo?.inRepo
    ? Math.round(Math.max(5, 100 - dirtyFiles * 6))
    : 100;

  // Happiness: weighted composite + level floor
  const happiness = Math.max(happyFloor, Math.round(
    hunger * 0.3 + energy * 0.3 + cleanliness * 0.25 +
    Math.min(15, (state.streak || 1) * 3)
  ));

  return { hunger, happiness, energy, cleanliness };
}

// ═══════════════════════════════════════════════════════════════════
// XP Sources
// ═══════════════════════════════════════════════════════════════════

// Context growth: every 5% growth = +2 XP, cap +10 per cycle
export function trackContextGrowth(state, ctxPct) {
  const last = state.lastCtxPct || 0;
  state.lastCtxPct = ctxPct;

  // Compaction detected: context drops by 15%+
  if (last - ctxPct >= 15 && last > 30) {
    gainXP(state, 12);
    return 'compact';
  }

  // Growth: active usage
  const growth = ctxPct - last;
  if (growth >= 5) {
    const xp = Math.min(10, Math.floor(growth / 5) * 2);
    gainXP(state, xp);
    return 'growth';
  }

  return null;
}

// Session start
export function trackSession(state) {
  const now = Date.now();
  const gap = now - (state.lastSessionStart || state.born);

  if (gap > 30 * 60 * 1000) {
    state.totalSessions = (state.totalSessions || 0) + 1;
    state.lastSessionStart = now;

    const today = new Date().toISOString().slice(0, 10);
    const last = state.lastCareDate || today;
    const diffDays = Math.floor((new Date(today) - new Date(last)) / 86400000);
    if (diffDays === 1) {
      state.streak = (state.streak || 0) + 1;
    } else if (diffDays > 1) {
      state.streak = 1;
    }
    state.lastCareDate = today;
    gainXP(state, 5);
  }
}

// Git commit
export function trackCommit(state, gitInfo) {
  if (!gitInfo?.inRepo || !gitInfo?.hash) return false;
  if (gitInfo.hash === state.lastCommitHash) return false;

  // New commit detected!
  state.totalCommits = (state.totalCommits || 0) + 1;
  state.lastCommitHash = gitInfo.hash;
  state.lastCommitTime = Date.now();
  gainXP(state, 15);
  return true;
}

// Git push: detect when local is no longer ahead of remote
export function trackPush(state, gitInfo) {
  if (!gitInfo?.inRepo) return false;
  const ahead = gitInfo.ahead || 0;
  const lastAhead = state.lastAheadCount || 0;
  state.lastAheadCount = ahead;

  // Was ahead, now 0 → push detected
  if (lastAhead > 0 && ahead === 0) {
    state.totalPushes = (state.totalPushes || 0) + 1;
    gainXP(state, 10);
    return true;
  }
  return false;
}

// File modifications: proxy for "solving problems"
export function trackFileChanges(state, gitInfo) {
  if (!gitInfo?.inRepo || !gitInfo?.dirty) return;
  const current = gitInfo.dirty;
  const last = state.lastDirtyCount || 0;
  state.lastDirtyCount = current;

  // New dirty files appeared → actively editing = solving problems
  if (current > last && current > 0) {
    const newFiles = current - last;
    const xp = Math.min(8, newFiles * 2);
    gainXP(state, xp);
    state.filesTouched = (state.filesTouched || 0) + newFiles;
  }

  // Dirty count dropped significantly → files cleaned up (committed or reverted)
  if (last > 3 && current === 0) {
    gainXP(state, 8);
  }
}

function gainXP(state, amount) {
  state.xp = (state.xp || 0) + amount;
  while (state.xp >= xpForLevel(state.level || 1)) {
    state.xp -= xpForLevel(state.level);
    state.level = (state.level || 1) + 1;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Interactive Actions
// ═══════════════════════════════════════════════════════════════════

const ACTIONS = {
  pet:  { icon: '🐾', xp: 3,  buff: 'happiness', amount: 15, duration: 300_000 },
  feed: { icon: '🍖', xp: 2,  buff: 'hunger',    amount: 20, duration: 300_000 },
  play: { icon: '⚽', xp: 2,  buff: 'energy',     amount: 15, duration: 300_000 },
};

export function interact(state, action) {
  const def = ACTIONS[action];
  if (!def) return null;
  state.buffs = state.buffs || {};
  state.buffs[def.buff] = { amount: def.amount, until: Date.now() + def.duration };
  gainXP(state, def.xp);
  return def;
}

export function applyBuffs(stats, state) {
  if (!state.buffs) return stats;
  const now = Date.now();
  for (const [key, buff] of Object.entries(state.buffs)) {
    if (now < buff.until && stats[key] !== undefined) {
      stats[key] = Math.min(100, stats[key] + buff.amount);
    }
  }
  // Clean expired
  for (const key of Object.keys(state.buffs)) {
    if (now >= state.buffs[key].until) delete state.buffs[key];
  }
  return stats;
}

// ═══════════════════════════════════════════════════════════════════
// Mood, Effects, Thoughts
// ═══════════════════════════════════════════════════════════════════

export function getMood(stats, errorCount = 0) {
  let avg = (stats.hunger + stats.happiness + stats.energy + stats.cleanliness) / 4;
  // Errors drag mood down
  if (errorCount >= 5) avg -= 20;
  else if (errorCount >= 2) avg -= 10;
  avg = Math.max(0, avg);
  if (avg > 85) return 'ecstatic';
  if (avg > 65) return 'happy';
  if (avg > 45) return 'content';
  if (avg > 25) return 'sad';
  if (avg > 10) return 'angry';
  return 'critical';
}

export function getMoodLabel(mood) {
  return {
    ecstatic: '🤩 ecstatic', happy: '😊 happy', content: '😐 content',
    sad: '😞 sad', angry: '😤 stressed', critical: '😱 critical',
  }[mood] || '😐 content';
}

export function getStatusEffects(stats) {
  const effects = [];
  if (stats.hunger < 15) effects.push('context-heavy');
  if (stats.energy < 15) effects.push('overtime');
  if (stats.cleanliness < 15) effects.push('messy-repo');
  if (stats.hunger > 70 && stats.energy > 70 && stats.cleanliness > 70) effects.push('in-flow');
  return effects;
}

export function getSpeciesDef(id) {
  return SPECIES.find(s => s.id === id) || SPECIES[0];
}

export function getEmoji(id, level) {
  const def = getSpeciesDef(id);
  const e = def.emoji;
  if (!Array.isArray(e)) return e;
  if (level >= 20) return e[2];
  if (level >= 10) return e[1];
  return e[0];
}

export function getArt(state, mood) {
  const body = BODIES[state.species] || BODIES.cat;
  const face = FACES[mood] || FACES.content;
  const faceLine = body.fmt.replace('{F}', face);
  const art = body.lines.map(l => l === 'FACE' ? faceLine : l);
  if (!state.shiny) return art;
  return art.map((line, i) => {
    if (i === 0 || i === art.length - 1) return '✨' + line.trimEnd() + '✨';
    return line;
  });
}

export function formatAge(born) {
  const ms = Date.now() - born;
  const h = Math.floor(ms / 3600000);
  if (h < 1) return 'just born';
  if (h < 24) return `${h}h old`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ${h % 24}h old`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ${d % 30}d old`;
}

export function formatSessionTime(state) {
  const ms = Date.now() - (state.lastSessionStart || state.born);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function getXpProgress(state) {
  const needed = xpForLevel(state.level || 1);
  const current = state.xp || 0;
  return { current, needed, pct: Math.round((current / needed) * 100) };
}

// Contextual idle thoughts
export function getContextualThought(state, stats, gitInfo) {
  const thoughts = [];

  if (stats.hunger < 20) {
    thoughts.push(
      'feels heavy... context window is almost full!',
      'stares at you. Maybe compact the context?',
    );
  }
  if (stats.energy < 20) {
    thoughts.push(
      'yawns... been coding for a while. Take a break!',
      'is barely keeping eyes open...',
    );
  }
  if (stats.cleanliness < 20) {
    const n = gitInfo?.dirty || 0;
    thoughts.push(
      `glares at ${n} uncommitted files. Commit already!`,
      'looks at the messy repo and sighs...',
      'wonders when all these changes will be committed...',
    );
  }
  if (gitInfo?.ahead > 0) {
    thoughts.push(
      `sees ${gitInfo.ahead} local commit${gitInfo.ahead > 1 ? 's' : ''} waiting to be pushed`,
    );
  }
  if (state.filesTouched > 5) {
    thoughts.push(
      `is impressed! ${state.filesTouched} files touched this session`,
      `watches the code evolve. ${state.filesTouched} files changed so far!`,
    );
  }
  if (stats.hunger > 70 && stats.energy > 70 && stats.cleanliness > 70) {
    thoughts.push(
      'purrs contentedly. Clean codebase, fresh context!',
      'is in the zone! Everything is flowing~',
      'vibes with the clean working tree ✨',
    );
  }
  if (state.streak >= 3) {
    thoughts.push(
      `is proud of your ${state.streak}-day coding streak!`,
    );
  }

  if (thoughts.length === 0) {
    thoughts.push(
      'watches the code scroll by with interest',
      'is keeping an eye on things',
      'nods approvingly at your progress',
    );
  }

  return thoughts[Math.floor(Math.random() * thoughts.length)];
}

// Fun personality responses for manual interaction (bonus)
export const PERSONALITY_RESPONSES = {
  pet: {
    lazy: '{n} leans into your hand lazily',
    energetic: '{n} wiggles with joy!',
    shy: '{n} blushes but leans in',
    mischievous: '{n} headbutts you playfully',
    brave: '{n} stands tall, accepting your respect',
    curious: '{n} tilts head, studying your hand',
    proud: '{n}: "You may continue... for now"',
    gentle: '{n} nuzzles you softly',
    grumpy: '{n}: "...don\'t make it weird"',
    clumsy: '{n} gets so excited they fall over',
    wise: '{n} shares a knowing look',
    chaotic: '{n} vibrates intensely!!',
  },
};

export function getPetResponse(state) {
  const template = PERSONALITY_RESPONSES.pet[state.personality] || '{n} appreciates it';
  return template.replace(/\{n\}/g, state.name);
}

// ═══════════════════════════════════════════════════════════════════
// Quip System — Witty statusline remarks
// ═══════════════════════════════════════════════════════════════════

const QUIPS = {
  // ---- Time-based ----
  lateNight: [
    '凌晨了还在卷？你是魔鬼吗',
    '都这个点了，你不睡我不睡，咱俩一起秃',
    '熬夜写bug，第二天debug，经典永流传',
    '你的肝发来一条求救短信',
    '月亮都下班了你还不下班',
    '深夜了，代码的质量和你的意识一样模糊',
    '别写了，睡吧，bug明天还在的，它不会跑',
    '我和bug都困了，就你还在撑',
  ],
  morning: [
    '早啊打工人！今天也要元气满满地写bug',
    '早安，愿你今天的代码一遍过',
    '新的一天，新的bug，冲鸭',
    '太阳升起，编译器也该醒了',
    '今天的你也是从删库到跑路的一天呢',
    '早上好！我已经准备好看你写bug了',
  ],
  afternoon: [
    '下午茶时间，来一杯0和1的拿铁',
    '摸鱼了吗？没摸的话我帮你摸',
    '下午三点，是时候犯困了',
    '别急，慢慢来，反正deadline也不远',
    '代码和人一样，下午都不太清醒',
    '下午好，你的代码在瑟瑟发抖',
  ],
  evening: [
    '快下班了吧？别急，再写一行',
    '傍晚了，该考虑今晚吃什么了而不是写什么',
    '加班？不存在的，这叫自愿延长coding时间',
    '夕阳无限好，只是context要满了',
    '晚上好，今天的commit够了吗？',
  ],
  weekend: [
    '周末还在写代码？你的对象呢？哦你没有',
    '周六周日？不存在的，每天都是coding日',
    '周末愉快！...等等你在coding？',
    '别的程序员在休息，你在写代码，这就是你单身的原因',
    '周末加班，你的效率是工作日的0.3倍',
  ],
  // ---- Context-based ----
  contextFresh: [
    '崭新的context窗口，像刚洗完澡一样清爽',
    'context才用了一点，挥霍吧少年',
    '满满的context，满满的希望（等下就不是了）',
  ],
  contextMid: [
    'context过了一半了，请系好安全带',
    'context在增长，就像我的体重一样',
    'context窗口：我还能撑！大概...',
    '温馨提示：context正在稳步增长，请提前规划',
  ],
  contextHeavy: [
    'context快满了！要compact了！救命！',
    '你再不compact我就要溢出了',
    'context窗口发出了痛苦的呻吟',
    '内存告急！不是你的，是我的context',
    'context 90%+，你的代码在替你呼吸',
  ],
  // ---- Energy/Session ----
  sessionFresh: [
    '新session新气象，这次一定不写bug（flag已立）',
    '刚刚开始，冲冲冲！',
  ],
  sessionLong: [
    '你已经连续编码很久了，建议起来走两步',
    '久坐伤身，你的腰还好吗？',
    '代码跑了这么久，你跑不了',
    '连续编码中...你的椅子在哭泣',
    'coding马拉松选手就是你',
  ],
  // ---- Git-based ----
  gitClean: [
    '工作树干干净净，像我的钱包一样',
    'git status: clean. 难得一见，截图留念',
    '无未提交文件，这很不程序员',
  ],
  gitDirty: [
    '有未提交的文件哦，commit了吗？嗯？',
    'dirty working tree，代码界的渣男',
    '这么多文件改了不commit，你是渣男吗',
  ],
  gitAhead: [
    '本地有commit没push呢，远程仓库在等你',
    'push了吗？push了吗？push了吗？',
    '你的代码还锁在本地，放它出去见见世面吧',
  ],
  // ---- Streak ----
  streak: [
    '连续编码{n}天了！你是最卷的崽',
    '{n}天streak！GitHub绿墙看了都流泪',
    '连续{n}天，已经形成肌肉记忆了',
  ],
  // ---- General sass ----
  sass: [
    '我虽然只是个宠物，但我的代码品味比你高',
    '你在看代码，代码也在看你',
    '如果我也能写代码，我会写得比你好',
    '你的代码能跑，已经是奇迹了',
    '你写的不是代码，是行为艺术',
    '这位程序员的代码写得像诗一样...朦胧诗',
    '编译通过不等于没有bug，只是bug藏得深',
    '你: 这个bug很简单 fix: 300行改动',
    '你的代码注释比代码还多，我很感动',
    '我看了一天你的代码，总结：重启试试',
    '祝你今天0 error 0 warning （不可能的）',
    '生产环境的bug你还没修呢，别在这摸鱼',
    '有人问你代码写得怎么样，我说：能跑',
    '你的代码像洋葱，一层一层的，全是泪',
  ],
  // ---- Personality-flavored ----
  personalitySass: {
    lazy: [
      '能不能别动了，我看着都累',
      '你的代码...不如先午休一下再写？',
      '我有一个好主意：什么都不做',
    ],
    energetic: [
      '冲冲冲！今天要写一万行！',
      '我感觉我能编译整个世界！！',
      '你的能量快溢出了，建议去跑个马拉松',
    ],
    shy: [
      '那个...你的代码...有个小问题...算了不说了',
      '我、我不是在偷看你的代码...',
      '你写得挺好的...大概...',
    ],
    mischievous: [
      '我偷偷把你的semicolons都删了，惊不惊喜？',
      '你猜我有没有在你代码里加console.log？',
      '你的代码能跑纯属意外，我要搞破坏了',
    ],
    brave: [
      '这个bug虽然恐怖，但我陪你一起面对！',
      '没有什么是一个commit解决不了的',
      '困难像弹簧，你弱它就强，但你很强',
    ],
    curious: [
      '为什么这里用var不用let？为什么？为什么？？',
      '这个函数干嘛的？那个类呢？还有这个？',
      '你的代码让我产生了很多问号',
    ],
    proud: [
      '虽然你的代码很一般，但养了我是你最大的成就',
      '你的commit message写得太随意了，要优雅',
      '不是我炫耀，但我确实是全场最靓的宠物',
    ],
    gentle: [
      '累了就休息一下吧，我会一直陪着你的',
      '不管代码写得好不好，你都是最棒的',
      '慢慢来，不着急的，我在这里等你',
    ],
    grumpy: [
      '又写bug了？你是不是bug制造机？',
      '你这个代码我看了头疼，别给我看了',
      '哼，今天的代码质量还不如昨天',
    ],
    clumsy: [
      '我不小心看到了你的代码...对不起...',
      '啊我又摔了！跟你的代码一样经常crash',
      '踩到了你的键盘，现在多了一行乱码',
    ],
    wise: [
      '代码如人生，起起落落落落落落',
      '真正的大师，永远保持着学习的心态',
      '最好的代码，是明天再看依然能看懂的代码',
    ],
    chaotic: [
      '今天我要把所有东西都改成!important！！',
      '规则？什么规则？我是自由的！！',
      '删除node_modules！重装一切！混沌万岁！',
    ],
  },
};

// Select a quip based on time, stats, git, personality
// Rotates every 5 minutes
export function getQuip(state, stats, gitInfo) {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 6;
  const minute = now.getMinutes();
  const quipSlot = Math.floor(minute / 5); // Changes every 5 min

  const pool = [];

  // Time-based
  if (hour >= 0 && hour < 6) pool.push(...QUIPS.lateNight);
  else if (hour >= 6 && hour < 10) pool.push(...QUIPS.morning);
  else if (hour >= 10 && hour < 14) pool.push(...QUIPS.afternoon);
  else if (hour >= 14 && hour < 18) pool.push(...QUIPS.afternoon);
  else pool.push(...QUIPS.evening);

  if (isWeekend) pool.push(...QUIPS.weekend);

  // Context-based
  const ctxPct = 100 - stats.hunger; // hunger is inverse context
  if (ctxPct > 80) pool.push(...QUIPS.contextHeavy);
  else if (ctxPct > 40) pool.push(...QUIPS.contextMid);
  else pool.push(...QUIPS.contextFresh);

  // Session-based
  const sessionMin = (Date.now() - (state.lastSessionStart || state.born)) / 60000;
  if (sessionMin > 120) pool.push(...QUIPS.sessionLong);
  else if (sessionMin < 10) pool.push(...QUIPS.sessionFresh);

  // Git-based
  if (gitInfo?.inRepo) {
    if (gitInfo.dirty > 3) pool.push(...QUIPS.gitDirty);
    else if (gitInfo.dirty === 0) pool.push(...QUIPS.gitClean);
    if (gitInfo.ahead > 0) pool.push(...QUIPS.gitAhead);
  }

  // Streak
  const streak = state.streak || 1;
  if (streak >= 3) {
    pool.push(...QUIPS.streak.map(q => q.replace('{n}', streak)));
  }

  // Personality (20% weight boost)
  const pQuips = QUIPS.personalitySass[state.personality] || [];
  pool.push(...pQuips, ...pQuips); // Double weight

  // General sass (lower weight)
  pool.push(...QUIPS.sass);

  // Deterministic selection based on time slot + pet name hash
  const hash = (state.name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const idx = (quipSlot + hash) % pool.length;

  return pool[idx] || pool[0] || '';
}
