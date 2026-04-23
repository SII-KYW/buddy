#!/usr/bin/env node

/**
 * Buddy Quip Generator v3 — i18n aware
 *
 * Reads system locale, builds prompt in matching language (zh/en).
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const HOME = os.homedir();
const DIR = path.join(HOME, '.claude', 'buddy');
const STATE_FILE = path.join(DIR, 'state.json');
const QUIP_FILE  = path.join(DIR, 'quip.txt');

function loadState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; } }

// ---- Language Detection ----

function getLang() {
  const locale = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || '';
  if (locale.startsWith('zh')) return 'zh';
  try {
    const intl = Intl.DateTimeFormat().resolvedOptions().locale;
    if (intl.startsWith('zh')) return 'zh';
  } catch {}
  return 'en';
}

const LANG = getLang();

// ---- Locale Data ----

const L = LANG === 'zh' ? {
  species: {
    cat:'猫',dog:'狗',rabbit:'兔子',hamster:'仓鼠',bird:'鸟',fish:'鱼',
    turtle:'乌龟',snake:'蛇',frog:'青蛙',bear:'熊',fox:'狐狸',penguin:'企鹅',
    owl:'猫头鹰',dragon:'龙',ghost:'幽灵',robot:'机器人',alien:'外星人',star:'星星',
  },
  personality: {
    lazy:'懒洋洋',energetic:'元气满满',shy:'社恐',mischievous:'调皮捣蛋',
    brave:'勇猛',curious:'好奇宝宝',proud:'傲娇',gentle:'温柔',
    grumpy:'暴躁',clumsy:'冒失鬼',wise:'老成',chaotic:'混沌邪恶',
  },
  weekday: ['日','一','二','三','四','五','六'],
  period(h) {
    if (h >= 0 && h < 6) return '深夜凌晨';
    if (h < 9)  return '早上';
    if (h < 12) return '上午';
    if (h < 14) return '中午';
    if (h < 18) return '下午';
    if (h < 22) return '晚上';
    return '深夜';
  },
  dateFormat: (m, d) => `${m}月${d}日`,
  weekend: '周末',
  labels: {
    time: '时间', weather: '天气', session: '会话', context: '上下文',
    branch: '分支', dirty: f => `${f}个文件未提交`, ahead: n => `${n}个commit没push`,
    clean: '工作区干净', commits: '最近提交', busy: '最近在忙',
    overwork: h => `⚠️ 连续工作超过${h}小时`,
    minutes: m => `${m}分钟`, streak: d => `${d}天连续在线`,
  },
  voice: {
    lazy: '说话慵懒拖沓，经常用"嘛""呢""..."结尾，懒得吐槽但还是会说',
    energetic: '说话超级兴奋，很多感叹号，元气满满的感觉',
    shy: '说话小心翼翼，偶尔小声说一句很有梗的话',
    mischievous: '说话贼兮兮的，爱恶作剧，语气调皮',
    brave: '说话豪迈直接，像武士一样有气势',
    curious: '对什么都好奇，经常用问句，但问的问题很离谱',
    proud: '说话傲娇，明明关心但要说得像不在乎',
    gentle: '说话温柔体贴，像在哄小朋友',
    grumpy: '说话暴躁，各种嫌弃，但其实一直在盯着你看',
    clumsy: '说话冒冒失失的，经常说错话但莫名可爱',
    wise: '说话像老禅师，经常蹦出似是而非的人生哲理',
    chaotic: '说话混沌无序，有时突然冒出完全无关的东西',
  },
  defaultVoice: '说话随性自然',
  loreLabel: { bg: '背景', pd: '性格细节' },
  thoughts: [
    '哼一首只有自己能听懂的奇怪小曲',
    '突然想起过去的某个片段，发呆走神',
    '小声嘟囔一个荒诞的欲望或想法',
    '对着空荡荡的终端自言自语',
    '突然冒出一段莫名其妙的感慨',
    '回忆起自己来到终端之前的生活',
    '偷偷许一个不可能实现的愿望',
    '用只有自己能听到的声音吐槽什么',
    '突然陷入某种奇怪的哲学思考',
    '做一个和白日梦有关的碎碎念',
  ],
  prompt: {
    inner(name, species, personality, voice, lore, thought) {
      return `${name}是一只${personality}的${species}，住在程序员的终端状态栏里。${voice}。${lore}

此刻，${name}没有在看程序员，它沉浸在自己的世界里。它在${thought}。

请以${name}的第一人称视角，写一句它的内心独白。
要求：
- 要有角色感和沉浸感，像是一个真实的小生物在想东西
- 可以是唱歌、碎碎念、发呆、回忆、吐槽、许愿、感慨，风格随机
- 要符合它的背景故事和性格，不要OOC
- 不要提到程序员或当前工作状态，纯粹是它自己的内心世界
- 30字以内，中文，不要引号不要标点结尾
- 只输出这句话本身`;
    },
    quip(name, species, personality, voice, lore, situations) {
      return `${name}是一只${personality}的${species}，住在程序员的终端状态栏里。${voice}。${lore}

它此刻观察到的信息：
${situations}

请替${name}说一句话，要求：
- 真正有趣、有梗、有灵魂，不要那种AI味很重的模板句
- 风格和意图严格遵循设定和性格，内容随机结合上述信息，自由发挥
- 例如可以是吐槽、撒娇、抖机灵、关心、讲烂梗、自言自语等等
- 30字以内，中文，不要引号不要标点结尾
- 只输出这句话本身`;
    },
  },
} : {
  species: {
    cat:'cat',dog:'dog',rabbit:'rabbit',hamster:'hamster',bird:'bird',fish:'fish',
    turtle:'turtle',snake:'snake',frog:'frog',bear:'bear',fox:'fox',penguin:'penguin',
    owl:'owl',dragon:'dragon',ghost:'ghost',robot:'robot',alien:'alien',star:'star',
  },
  personality: {
    lazy:'lazy',energetic:'energetic',shy:'shy',mischievous:'mischievous',
    brave:'brave',curious:'curious',proud:'proud',gentle:'gentle',
    grumpy:'grumpy',clumsy:'clumsy',wise:'wise',chaotic:'chaotic',
  },
  weekday: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
  period(h) {
    if (h >= 0 && h < 6) return 'late night';
    if (h < 9)  return 'early morning';
    if (h < 12) return 'morning';
    if (h < 14) return 'noon';
    if (h < 18) return 'afternoon';
    if (h < 22) return 'evening';
    return 'late night';
  },
  dateFormat: (m, d) => `${m}/${d}`,
  weekend: 'weekend',
  labels: {
    time: 'Time', weather: 'Weather', session: 'Session', context: 'Context',
    branch: 'branch', dirty: f => `${f} uncommitted files`, ahead: n => `${n} unpushed commits`,
    clean: 'working tree clean', commits: 'Recent commits', busy: 'Working on',
    overwork: h => `⚠️ coding for over ${h}h straight`,
    minutes: m => `${m}min`, streak: d => `${d}d streak`,
  },
  voice: {
    lazy: 'speaks lazily, trails off with "meh" "hmm" "...", too tired to roast but does it anyway',
    energetic: 'super hyped, lots of exclamation marks, bounding with energy',
    shy: 'speaks timidly, occasionally drops a surprisingly sharp whisper',
    mischievous: 'sneaky tone, loves pranks, cheeky and playful',
    brave: 'bold and direct, speaks like a warrior',
    curious: 'curious about everything, asks absurd questions',
    proud: 'tsundere — clearly cares but pretends not to',
    gentle: 'soft-spoken, nurturing, talks like comforting a kid',
    grumpy: 'complains about everything, secretly watches over you',
    clumsy: 'keeps saying wrong things, somehow endearing',
    wise: 'speaks like an old zen master, drops dubious wisdom',
    chaotic: 'random and unpredictable, sometimes blurts out totally unrelated things',
  },
  defaultVoice: 'speaks casually and naturally',
  loreLabel: { bg: 'Background', pd: 'Personality detail' },
  thoughts: [
    'humming a weird little tune only they can hear',
    'suddenly reminiscing about a past memory, zoning out',
    'mumbling an absurd desire or idea',
    'talking to themselves in the empty terminal',
    'randomly having a profound-feeling thought',
    'remembering life before arriving in this terminal',
    'secretly making a wish that can never come true',
    'quietly complaining about something only they notice',
    'suddenly spiraling into bizarre philosophical thought',
    'daydreaming and mumbling fragments of it',
  ],
  prompt: {
    inner(name, species, personality, voice, lore, thought) {
      return `${name} is a ${personality} ${species} living in a programmer's terminal status bar. ${voice}. ${lore}

Right now, ${name} isn't watching the programmer — lost in their own world. They are ${thought}.

Write one line of ${name}'s inner monologue in first person.
Rules:
- Feel like a real creature thinking to itself, with personality and immersion
- Can be singing, mumbling, zoning out, reminiscing, wishing, rambling — vary the style
- Stay true to their backstory and personality, no OOC
- Don't mention the programmer or current work — purely their inner world
- Under 50 chars, English, no quotes, no trailing punctuation
- Output only the line itself`;
    },
    quip(name, species, personality, voice, lore, situations) {
      return `${name} is a ${personality} ${species} living in a programmer's terminal status bar. ${voice}. ${lore}

What they observe right now:
${situations}

Say one line as ${name}. Rules:
- Genuinely funny, witty, soulful — no generic AI template lines
- Style and intent strictly follow the personality and setting, content freely combines any of the above info
- E.g. roasting, teasing, wisecracking, caring, punning, talking to self, etc.
- Under 50 chars, English, no quotes, no trailing punctuation
- Output only the line itself`;
    },
  },
};

// ---- Context Gatherers ----

function getGit() {
  let dirty = 0, ahead = 0, branch = '', inRepo = false;
  let recentCommits = '', diffStat = '', editedFiles = '';
  try {
    dirty = execSync('git status --porcelain 2>/dev/null', { encoding: 'utf8', timeout: 3000 }).split('\n').filter(Boolean).length;
    branch = execSync('git branch --show-current 2>/dev/null', { encoding: 'utf8', timeout: 3000 }).trim();
    inRepo = true;
    try { ahead = parseInt(execSync('git rev-list --count @{upstream}..HEAD 2>/dev/null', { encoding: 'utf8', timeout: 3000 }).trim()) || 0; } catch {}
    try { recentCommits = execSync('git log --oneline -3 --format="%s" 2>/dev/null', { encoding: 'utf8', timeout: 3000 }).trim(); } catch {}
    try { diffStat = execSync('git diff --stat HEAD~1 HEAD 2>/dev/null | tail -1', { encoding: 'utf8', timeout: 3000 }).trim(); } catch {}
    try {
      editedFiles = execSync('git status --porcelain 2>/dev/null | head -8', { encoding: 'utf8', timeout: 3000 }).trim()
        .split('\n').map(l => l.replace(/^\s*\S+\s+/, '')).join(', ');
    } catch {}
  } catch {}
  return { dirty, ahead, branch, inRepo, recentCommits, diffStat, editedFiles };
}

function getWeather() {
  try {
    const raw = execSync('curl -s "wttr.in/?format=%C+%t+%h" 2>/dev/null', { encoding: 'utf8', timeout: 5000 }).trim();
    if (raw && raw.length < 50 && !raw.includes('ERROR')) return raw;
  } catch {}
  return null;
}

function getTime() {
  const d = new Date();
  const h = d.getHours(), m = d.getMinutes(), day = d.getDay();
  return {
    period: L.period(h),
    hour: h, minute: m,
    isWeekend: day === 0 || day === 6,
    weekday: L.weekday[day],
    dateStr: L.dateFormat(d.getMonth() + 1, d.getDate()),
    timeStr: `${h}:${String(m).padStart(2, '0')}`,
  };
}

// ---- Session Transcript Recap ----

function getSessionRecap() {
  try {
    const projectDir = path.join(HOME, '.claude', 'projects');
    if (!fs.existsSync(projectDir)) return null;

    const transcripts = [];
    function scanDir(dir) {
      try {
        for (const f of fs.readdirSync(dir)) {
          const fp = path.join(dir, f);
          const st = fs.statSync(fp);
          if (st.isDirectory()) scanDir(fp);
          else if (f.endsWith('.jsonl')) transcripts.push({ path: fp, mtime: st.mtimeMs });
        }
      } catch {}
    }
    scanDir(projectDir);
    transcripts.sort((a, b) => b.mtimeMs - a.mtimeMs);

    const NOISE = [
      '[Request interrupted', '<local-command-caveat>', '<command-name>',
      'Unknown command', 'Run the buddy pet tick', 'Generate a new quip',
      'This session is being continued',
    ];
    const isNoisy = t => NOISE.some(n => t.includes(n));

    for (const t of transcripts) {
      try {
        const lines = fs.readFileSync(t.path, 'utf8').split('\n').filter(Boolean);

        const summaries = [];
        for (const line of lines) {
          try {
            const d = JSON.parse(line);
            if (d.type === 'system' && d.subtype === 'away_summary' && d.content) {
              summaries.push(d.content.replace(/ \(disable recaps in \/config\)/g, '').trim());
            }
          } catch {}
        }
        if (summaries.length > 0) return summaries[summaries.length - 1];

        const userTasks = [];
        for (const line of lines) {
          try {
            const d = JSON.parse(line);
            if (d.type === 'user' && d.message?.role === 'user') {
              const content = d.message.content;
              let text = '';
              if (typeof content === 'string') text = content;
              else if (Array.isArray(content)) {
                for (const c of content) {
                  if (c.type === 'text' && c.text.length > 10) { text = c.text; break; }
                }
              }
              if (text.length > 10 && !isNoisy(text)) {
                userTasks.push(text.slice(0, 100).replace(/\n/g, ' '));
              }
            }
          } catch {}
        }
        if (userTasks.length > 0) return userTasks.slice(-5).join(LANG === 'zh' ? '；' : '; ');
      } catch {}
      break;
    }
  } catch {}
  return null;
}

// ---- Prompt Builder ----

function buildPrompt() {
  const state = loadState();
  if (!state) return null;

  const git = getGit();
  const time = getTime();
  const weather = getWeather();
  const recap = getSessionRecap();

  const name = state.name;
  const species = L.species[state.species] || state.species;
  const personality = L.personality[state.personality] || state.personality;
  const sessionMin = Math.round((Date.now() - (state.lastSessionStart || state.born)) / 60000);
  const ctxPct = state.lastCtxPct || 0;
  const level = state.level || 1;
  const streak = state.streak || 1;
  const lb = L.labels;

  const situations = [];
  {
    const weekendTag = time.isWeekend ? ` (${L.weekend})` : '';
    situations.push(`${lb.time}：${time.dateStr} ${time.weekday} ${time.timeStr} (${time.period}${weekendTag})`);
  }
  if (weather) situations.push(`${lb.weather}：${weather}`);
  situations.push(`${lb.session}：${lb.minutes(sessionMin)} | Lv.${level} | ${lb.streak(streak)}`);
  if (ctxPct > 0) situations.push(`${lb.context}：${Math.round(ctxPct)}%`);
  if (git.inRepo) {
    const gitParts = [`${lb.branch} ${git.branch}`];
    if (git.dirty > 0) gitParts.push(lb.dirty(git.dirty));
    if (git.ahead > 0) gitParts.push(lb.ahead(git.ahead));
    if (git.dirty === 0 && git.ahead === 0) gitParts.push(lb.clean);
    situations.push(`Git：${gitParts.join(LANG === 'zh' ? '，' : ', ')}`);
  }
  if (git.recentCommits) {
    const msgs = git.recentCommits.split('\n').filter(Boolean);
    situations.push(`${lb.commits}：${msgs.join(' → ')}`);
  }
  if (recap) situations.push(`${lb.busy}：${recap}`);
  if (sessionMin > 120) situations.push(lb.overwork(Math.round(sessionMin / 60)));

  const situationText = situations.join('\n');
  const voice = L.voice[state.personality] || L.defaultVoice;

  const loreParts = [];
  if (state.background) loreParts.push(`${L.loreLabel.bg}：${state.background}`);
  if (state.personalityDetail) loreParts.push(`${L.loreLabel.pd}：${state.personalityDetail}`);
  const loreText = loreParts.length > 0 ? '\n' + loreParts.join('\n') : '';

  const isInnerThought = Math.random() < 0.35;

  let prompt;
  if (isInnerThought && state.background) {
    const thoughts = L.thoughts;
    const thought = thoughts[Math.floor(Math.random() * thoughts.length)];
    prompt = L.prompt.inner(name, species, personality, voice, loreText, thought);
  } else {
    prompt = L.prompt.quip(name, species, personality, voice, loreText, situationText);
  }

  return { prompt, isThought };
}

// ---- Main ----

const result = buildPrompt();
if (!result) { console.log('no state'); process.exit(1); }

const PROMPT_FILE = path.join(DIR, 'quip-prompt.txt');
fs.writeFileSync(PROMPT_FILE, result.prompt);
fs.writeFileSync(path.join(DIR, 'quip-mode.txt'), result.isThought ? 'thought' : 'quip');

const existing = fs.existsSync(QUIP_FILE) ? fs.readFileSync(QUIP_FILE, 'utf8').trim() : '';
console.log(existing || '(prompt ready)');
