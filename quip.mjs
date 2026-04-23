#!/usr/bin/env node

/**
 * Buddy Quip Generator v2
 *
 * Reads session transcript for recap, builds a rich prompt,
 * calls claude -p (glm-5.1) for a witty one-liner.
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
  const isWeekend = day === 0 || day === 6;
  const weekday = ['日','一','二','三','四','五','六'][day];
  const dateStr = `${d.getMonth()+1}月${d.getDate()}日`;
  let period;
  if (h >= 0 && h < 6) period = '深夜凌晨';
  else if (h < 9)  period = '早上';
  else if (h < 12) period = '上午';
  else if (h < 14) period = '中午';
  else if (h < 18) period = '下午';
  else if (h < 22) period = '晚上';
  else period = '深夜';
  return { period, hour: h, minute: m, isWeekend, weekday, dateStr, timeStr: `${h}:${String(m).padStart(2,'0')}` };
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

    // Current session = most recently modified transcript
    for (const t of transcripts) {
      try {
        const lines = fs.readFileSync(t.path, 'utf8').split('\n').filter(Boolean);

        // Priority 1: away_summary from this session
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

        // Priority 2: last 5 user messages from current session
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
        if (userTasks.length > 0) return userTasks.slice(-5).join('；');
      } catch {}
      break; // only check current (most recent) session
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
  const species = SPECIES_CN[state.species] || state.species;
  const personality = PERSONALITY_CN[state.personality] || state.personality;
  const sessionMin = Math.round((Date.now() - (state.lastSessionStart || state.born)) / 60000);
  const ctxPct = state.lastCtxPct || 0;
  const level = state.level || 1;
  const streak = state.streak || 1;

  // Build situational summary
  const situations = [];
  situations.push(`时间：${time.dateStr} 周${time.weekday} ${time.timeStr}（${time.period}${time.isWeekend ? '，周末' : ''}）`);
  if (weather) situations.push(`天气：${weather}`);
  situations.push(`会话：${sessionMin}分钟 | Lv.${level} | ${streak}天连续在线`);
  if (ctxPct > 0) situations.push(`上下文：${Math.round(ctxPct)}%`);
  if (git.inRepo) {
    const gitParts = [`分支${git.branch}`];
    if (git.dirty > 0) gitParts.push(`${git.dirty}个文件未提交`);
    if (git.ahead > 0) gitParts.push(`${git.ahead}个commit没push`);
    if (git.dirty === 0 && git.ahead === 0) gitParts.push('工作区干净');
    situations.push(`Git：${gitParts.join('，')}`);
  }
  if (git.recentCommits) {
    const msgs = git.recentCommits.split('\n').filter(Boolean);
    situations.push(`最近提交：${msgs.join(' → ')}`);
  }
  if (recap) {
    situations.push(`最近在忙：${recap}`);
  }
  if (sessionMin > 120) situations.push(`⚠️ 连续工作超过${Math.round(sessionMin/60)}小时`);

  const situationText = situations.join('\n');

  // Personality-specific voice hints
  const voiceMap = {
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
  };
  const voice = voiceMap[state.personality] || '说话随性自然';

  // Lore context
  const loreParts = [];
  if (state.background) loreParts.push(`背景：${state.background}`);
  if (state.personalityDetail) loreParts.push(`性格细节：${state.personalityDetail}`);
  const loreText = loreParts.length > 0 ? '\n' + loreParts.join('\n') : '';

  // 35% chance: inner monologue mode (first-person thought, not reactive)
  const isInnerThought = Math.random() < 0.35;

  let prompt;
  if (isInnerThought && state.background) {
    const thoughtTypes = [
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
    ];
    const thought = thoughtTypes[Math.floor(Math.random() * thoughtTypes.length)];

    prompt = `${name}是一只${personality}的${species}，住在程序员的终端状态栏里。${voice}。${loreText}

此刻，${name}没有在看程序员，它沉浸在自己的世界里。它在${thought}。

请以${name}的第一人称视角，写一句它的内心独白。
要求：
- 要有角色感和沉浸感，像是一个真实的小生物在想东西
- 可以是唱歌、碎碎念、发呆、回忆、吐槽、许愿、感慨，风格随机
- 要符合它的背景故事和性格，不要OOC
- 不要提到程序员或当前工作状态，纯粹是它自己的内心世界
- 30字以内，中文，不要引号不要标点结尾
- 只输出这句话本身`;
  } else {
    prompt = `${name}是一只${personality}的${species}，住在程序员的终端状态栏里。${voice}。${loreText}

它此刻观察到的信息：
${situationText}

请替${name}说一句话，要求：
- 真正有趣、有梗、有灵魂，不要那种AI味很重的模板句
- 可以是吐槽、撒娇、抖机灵、关心、讲烂梗、自言自语，风格随机切换
- 必须结合上面的具体信息（时间/天气/git/最近在忙什么），不要泛泛而谈
- 30字以内，中文，不要引号不要标点结尾
- 只输出这句话本身`;
  }

  return prompt;
}

// ---- Main ----

const prompt = buildPrompt();
if (!prompt) { console.log('no state'); process.exit(1); }

const PROMPT_FILE = path.join(DIR, 'quip-prompt.txt');
fs.writeFileSync(PROMPT_FILE, prompt);

// Prompt written — LLM call is done externally (quip-gen.sh / cron)
// Just report what we have
const existing = fs.existsSync(QUIP_FILE) ? fs.readFileSync(QUIP_FILE, 'utf8').trim() : '';
console.log(existing || '(prompt ready, run quip-gen.sh to generate)');
