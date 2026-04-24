#!/usr/bin/env node

/**
 * Buddy Statusline v3 — Coding Health + Provider-Agnostic LLM
 *
 * Pet stats AUTO-UPDATE from:
 *   stdin (context window) + git status + quota API
 *
 * Output: 🐕 Hoshi Lv3 ❤85 🍖42 ⚡67 🛁90 | glm-5.1[200K] Ctx ▓░ 51% ...
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const HOME = os.homedir();
const BUDDY_STATE = path.join(HOME, '.claude', 'buddy', 'state.json');
const CACHE_FILE  = path.join(HOME, '.claude', 'glm', 'quota-cache.json');
const CACHE_TTL   = 60_000;

const baseUrl   = process.env.ANTHROPIC_BASE_URL || '';
const authToken = process.env.ANTHROPIC_AUTH_TOKEN || '';
const modelEnv  = process.env.ANTHROPIC_MODEL || 'GLM';

let baseDomain;
let messagesUrl;
if (baseUrl) {
  try {
    baseDomain = new URL(baseUrl).origin;
    messagesUrl = new URL(baseUrl.replace(/\/+$/, '') + '/v1/messages');
  } catch {}
}
const isGLM = messagesUrl?.hostname?.includes('bigmodel');

// ---- i18n ----
const LANG = (() => {
  const loc = process.env.LANG || process.env.LC_ALL || '';
  if (loc.startsWith('zh')) return 'zh';
  try { if (Intl.DateTimeFormat().resolvedOptions().locale.startsWith('zh')) return 'zh'; } catch {}
  return 'en';
})();

const SPECIES_NAME = {
  cat:{zh:'猫',en:'cat'},dog:{zh:'狗',en:'dog'},rabbit:{zh:'兔子',en:'rabbit'},hamster:{zh:'仓鼠',en:'hamster'},
  bird:{zh:'鸟',en:'bird'},fish:{zh:'鱼',en:'fish'},turtle:{zh:'乌龟',en:'turtle'},snake:{zh:'蛇',en:'snake'},
  frog:{zh:'青蛙',en:'frog'},bear:{zh:'熊',en:'bear'},fox:{zh:'狐狸',en:'fox'},penguin:{zh:'企鹅',en:'penguin'},
  owl:{zh:'猫头鹰',en:'owl'},dragon:{zh:'龙',en:'dragon'},ghost:{zh:'幽灵',en:'ghost'},robot:{zh:'机器人',en:'robot'},
  alien:{zh:'外星人',en:'alien'},star:{zh:'星星',en:'star'},
};
const PERSONALITY_NAME = {
  lazy:{zh:'懒洋洋',en:'lazy'},energetic:{zh:'元气满满',en:'energetic'},shy:{zh:'社恐',en:'shy'},
  mischievous:{zh:'调皮捣蛋',en:'mischievous'},brave:{zh:'勇猛',en:'brave'},curious:{zh:'好奇宝宝',en:'curious'},
  proud:{zh:'傲娇',en:'proud'},gentle:{zh:'温柔',en:'gentle'},grumpy:{zh:'暴躁',en:'grumpy'},
  clumsy:{zh:'冒失鬼',en:'clumsy'},wise:{zh:'老成',en:'wise'},chaotic:{zh:'混沌邪恶',en:'chaotic'},
};
function sp(key) { return (SPECIES_NAME[key] || {})[LANG] || key; }
function ps(key) { return (PERSONALITY_NAME[key] || {})[LANG] || key; }

const c = {
  g: s => `\x1b[32m${s}\x1b[0m`, y: s => `\x1b[33m${s}\x1b[0m`,
  r: s => `\x1b[31m${s}\x1b[0m`, c: s => `\x1b[36m${s}\x1b[0m`,
  d: s => `\x1b[2m${s}\x1b[0m`,  b: s => `\x1b[1m${s}\x1b[0m`,
  m: s => `\x1b[35m${s}\x1b[0m`,
};

const col = v => v > 50 ? 'g' : v > 20 ? 'y' : 'r';

function barColor(pct) { return pct < 50 ? 'g' : pct < 80 ? 'y' : 'r'; }

function renderBar(pct, w = 6) {
  pct = Math.max(0, Math.min(100, pct));
  const filled = Math.round((pct / 100) * w);
  return c[barColor(pct)]('▓'.repeat(filled) + '░'.repeat(w - filled));
}

function fmtCtx(n) {
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function fmtCountdown(ms) {
  if (!ms || ms <= 0) return '';
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function resetTag(t) {
  if (!t) return '';
  const cd = fmtCountdown(t - Date.now());
  return cd ? c.d(` (${cd})`) : '';
}

// ---- Git (cached 20s) ----
const GIT_CACHE = path.join(HOME, '.claude', 'buddy', 'git-cache.json');

function getGitInfo() {
  try {
    const d = JSON.parse(fs.readFileSync(GIT_CACHE, 'utf8'));
    if (Date.now() - d.ts < 20_000) return d;
  } catch {}
  let dirty = 0, hash = '', branch = '', inRepo = false;
  try {
    dirty = execSync('git status --porcelain 2>/dev/null', { encoding: 'utf8', timeout: 3000 })
      .split('\n').filter(Boolean).length;
    hash = execSync('git rev-parse --short HEAD 2>/dev/null', { encoding: 'utf8', timeout: 3000 }).trim();
    branch = execSync('git branch --show-current 2>/dev/null', { encoding: 'utf8', timeout: 3000 }).trim();
    inRepo = true;
  } catch {}
  const r = { ts: Date.now(), dirty, hash, branch, inRepo };
  try { fs.writeFileSync(GIT_CACHE, JSON.stringify(r)); } catch {}
  return r;
}

// ---- Error detection (cached 20s) ----
const ERROR_CACHE = path.join(HOME, '.claude', 'buddy', 'error-cache.json');

function getErrorInfo() {
  try {
    const d = JSON.parse(fs.readFileSync(ERROR_CACHE, 'utf8'));
    if (Date.now() - d.ts < 20_000) return d;
  } catch {}
  let recentErrors = 0;
  try {
    const projectDir = path.join(HOME, '.claude', 'projects');
    if (!fs.existsSync(projectDir)) throw 0;
    const transcripts = [];
    function scanDir(dir) {
      try { for (const f of fs.readdirSync(dir)) {
        const fp = path.join(dir, f); const st = fs.statSync(fp);
        if (st.isDirectory()) scanDir(fp);
        else if (f.endsWith('.jsonl')) transcripts.push({ path: fp, mtime: st.mtimeMs });
      }} catch {}
    }
    scanDir(projectDir);
    transcripts.sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (transcripts.length === 0) throw 0;
    const lines = fs.readFileSync(transcripts[0].path, 'utf8').split('\n').filter(Boolean);
    const tail = lines.slice(-80);
    for (const line of tail) {
      if (line.includes('"is_error":true') || line.includes('"is_error": true')) recentErrors++;
    }
  } catch {}
  const r = { ts: Date.now(), recentErrors };
  try { fs.writeFileSync(ERROR_CACHE, JSON.stringify(r)); } catch {}
  return r;
}

// ---- Lore (background + personality) via direct API ----
const LORE_LOCK = path.join(HOME, '.claude/buddy/lore.lock');

function callGLMAPI(prompt, callback) {
  if (!authToken || !messagesUrl) return callback('');
  const body = JSON.stringify({
    model: modelEnv,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1000,
    temperature: 0.8,
  });
  const req = https.request({
    hostname: messagesUrl.hostname, port: messagesUrl.port || 443,
    path: messagesUrl.pathname, method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': authToken,
      'anthropic-version': '2023-06-01',
    },
  }, res => {
    res.setEncoding('utf8');
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const text = json.content?.[0]?.text || '';
        callback(text.trim());
      } catch { callback(''); }
    });
  });
  req.on('error', () => { callback(''); });
  req.setTimeout(20000, () => { req.destroy(); callback(''); });
  req.write(body);
  req.end();
}

function triggerLoreEvolution(state) {
  try {
    const st = fs.statSync(LORE_LOCK);
    if (Date.now() - st.mtimeMs < 60000) return;
  } catch {}
  try { fs.writeFileSync(LORE_LOCK, String(Date.now())); } catch {}
  const s = sp(state.species), p = ps(state.personality);
  const prompt = LANG === 'zh'
    ? `你是一个创意作家。一只住在终端里的电子${s}升级到了Lv.${state.level}。\n\n当前性格描写：${state.personalityDetail || '刚出生'}\n性格关键词：${p}\n\n请在保持核心性格不变的前提下，微调性格描写，体现成长（更成熟/更有趣/新习惯）。\n\n只输出更新后的性格描写（200字以内），不要其他内容。`
    : `You are a creative writer. A ${p} digital ${s} living in a terminal just leveled up to Lv.${state.level}.\n\nCurrent personality: ${state.personalityDetail || 'just born'}\nPersonality keyword: ${p}\n\nSlightly evolve the personality description while keeping the core traits. Reflect growth (more mature/funnier/new habits).\n\nOutput only the updated personality description (under 200 words), nothing else.`;
  callGLMAPI(prompt, result => {
    if (result) {
      try {
        const s = JSON.parse(fs.readFileSync(BUDDY_STATE, 'utf8'));
        s.personalityDetail = result.slice(0, 300);
        fs.writeFileSync(BUDDY_STATE, JSON.stringify(s, null, 2));
        try { fs.unlinkSync(LORE_LOCK); } catch {}
      } catch {}
    }
  });
}

function triggerLoreMissing(state) {
  try {
    const st = fs.statSync(LORE_LOCK);
    if (Date.now() - st.mtimeMs < 60000) return;
  } catch {}
  try { fs.writeFileSync(LORE_LOCK, String(Date.now())); } catch {}
  const s = sp(state.species), p = ps(state.personality);
  const shinyTag = state.shiny ? (LANG === 'zh' ? '\n- 特殊：✨闪光变种（稀有）' : '\n- Special: ✨ shiny variant (rare)') : '';
  const prompt = LANG === 'zh'
    ? `你是一个创意作家。为一只住在程序员终端里的电子宠物生成设定。\n\n宠物信息：\n- 名字：${state.name}\n- 物种：${s}\n- 性格关键词：${p}${shinyTag}\n\n请生成以下内容，用 === 分隔两部分：\n\n第一部分（背景故事，200字以内）：写一段有趣的背景故事，描述这只${s}是怎么来到程序员的终端里的。\n\n第二部分（性格描写，200字以内）：基于"${p}"这个性格关键词，描写它的具体行为习惯、说话方式、小动作。\n\n只输出这两部分，用 === 分隔，不要其他内容。`
    : `You are a creative writer. Generate lore for a digital pet living in a programmer's terminal.\n\nPet info:\n- Name: ${state.name}\n- Species: ${s}\n- Personality: ${p}${shinyTag}\n\nGenerate two parts, separated by ===:\n\nPart 1 (backstory, under 200 words): A fun backstory of how this ${s} ended up in a programmer's terminal.\n\nPart 2 (personality detail, under 200 words): Based on the "${p}" personality, describe specific habits, speech patterns, quirks.\n\nOutput only these two parts separated by ===, nothing else.`;
  callGLMAPI(prompt, result => {
    if (result) {
      try {
        const parts = result.split(/\n===\n/);
        const s = JSON.parse(fs.readFileSync(BUDDY_STATE, 'utf8'));
        if (parts[0]) s.background = parts[0].trim().slice(0, 200);
        if (parts[1]) s.personalityDetail = parts[1].trim().slice(0, 300);
        // Fallback: no separator
        if (!parts[1] && !s.background) {
          const lines = result.split('\n').filter(Boolean);
          s.background = (lines[0] || '').slice(0, 200);
          s.personalityDetail = lines.slice(1).join(' ').slice(0, 300);
        }
        fs.writeFileSync(BUDDY_STATE, JSON.stringify(s, null, 2));
        try { fs.unlinkSync(LORE_LOCK); } catch {}
      } catch {}
    }
  });
}

// ---- Pet Status (auto-computed) ----
function gainXP(state, amount) {
  state.xp = (state.xp || 0) + amount;
  const oldLevel = state.level || 1;
  while (state.xp >= (state.level || 1) * 25) {
    state.xp -= (state.level || 1) * 25;
    state.level = (state.level || 1) + 1;
  }
  state._leveledUp = (state.level || 1) > oldLevel;
}

function petStatus(ctxPct) {
  try {
    const state = JSON.parse(fs.readFileSync(BUDDY_STATE, 'utf8'));
    const git = getGitInfo();
    const now = Date.now();
    let needsSave = false;

    // 1. Session start (+5 XP)
    const gap = now - (state.lastSessionStart || state.born);
    if (gap > 30 * 60 * 1000) {
      state.totalSessions = (state.totalSessions || 0) + 1;
      state.lastSessionStart = now;
      const today = new Date().toISOString().slice(0, 10);
      const last = state.lastCareDate || today;
      const diffDays = Math.floor((new Date(today) - new Date(last)) / 86400000);
      state.streak = diffDays === 1 ? (state.streak || 0) + 1 : diffDays > 1 ? 1 : (state.streak || 1);
      state.lastCareDate = today;
      gainXP(state, 5);
      needsSave = true;
    }

    // 2. Context growth (+2 XP per 5% growth) & compaction (+12 XP)
    const lastCtx = state.lastCtxPct || 0;
    state.lastCtxPct = ctxPct;
    if (lastCtx > 30 && lastCtx - ctxPct >= 15) {
      gainXP(state, 12); // Compaction!
      needsSave = true;
    } else if (ctxPct - lastCtx >= 5) {
      gainXP(state, Math.min(10, Math.floor((ctxPct - lastCtx) / 5) * 2));
      needsSave = true;
    }

    // 3. Git commit (+15 XP)
    if (git.hash && git.hash !== state.lastCommitHash) {
      state.totalCommits = (state.totalCommits || 0) + 1;
      state.lastCommitHash = git.hash;
      state.lastCommitTime = now;
      gainXP(state, 15);
      needsSave = true;
    }

    // 4. Git push (+10 XP)
    if (git.inRepo && git.ahead !== undefined) {
      const lastAhead = state.lastAheadCount || 0;
      state.lastAheadCount = git.ahead;
      if (lastAhead > 0 && git.ahead === 0) {
        state.totalPushes = (state.totalPushes || 0) + 1;
        gainXP(state, 10);
        needsSave = true;
      }
    }

    // 5. File changes — actively editing = solving problems (+2 XP per new dirty file)
    if (git.inRepo) {
      const lastDirty = state.lastDirtyCount || 0;
      state.lastDirtyCount = git.dirty;
      if (git.dirty > lastDirty && git.dirty > 0) {
        gainXP(state, Math.min(8, (git.dirty - lastDirty) * 2));
        state.filesTouched = (state.filesTouched || 0) + (git.dirty - lastDirty);
        needsSave = true;
      }
      // All dirty files resolved → cleanup bonus
      if (lastDirty > 3 && git.dirty === 0) {
        gainXP(state, 8);
        needsSave = true;
      }
    }

    if (needsSave) fs.writeFileSync(BUDDY_STATE, JSON.stringify(state, null, 2));

    // Level-up personality evolution (background, non-blocking)
    if (state._leveledUp && state.personalityDetail) {
      triggerLoreEvolution(state);
    }
    // Missing background — trigger lore generation
    if (!state.background) {
      triggerLoreMissing(state);
    }
    delete state._leveledUp;

    // Auto-compute stats
    const hunger = Math.round(Math.max(5, 100 - ctxPct * 1.15));
    const sessionMin = (now - (state.lastSessionStart || state.born)) / 60000;
    const energy = Math.round(Math.max(5, 100 - sessionMin * 0.4));
    const errors = getErrorInfo();
    const errorDirt = Math.min(60, (errors.recentErrors || 0) * 15);
    const sessionDirt = Math.min(20, (state.totalSessions || 0) * 3);
    const fileDirt = Math.min(15, Math.floor((state.filesTouched || 0) / 5));
    const cleanliness = Math.round(Math.max(5, 100 - errorDirt - sessionDirt - fileDirt));
    const happiness = Math.round(hunger * 0.3 + energy * 0.3 + cleanliness * 0.25 + Math.min(15, (state.streak || 1) * 3));

    const SPECIES_ARR = ['cat','dog','rabbit','hamster','bird','fish','turtle','snake','frog','bear','fox','penguin','owl','dragon','ghost','robot','alien','star'];
    const EMOJI_ARR = ['🐱','🐕','🐰','🐹','🐦','🐟','🐢','🐍','🐸','🐻','🦊','🐧','🦉','🐉','👻','🤖','👾','⭐'];
    const idx = SPECIES_ARR.indexOf(state.species);
    const emoji = idx >= 0 ? EMOJI_ARR[idx] : '🐾';
    const shiny = state.shiny ? '✨' : '';
    const level = state.level || 1;

    const cleanTag = cleanliness < 50 ? ` ${c[col(cleanliness)]('🛁' + cleanliness)}` : '';

    return { name: state.name, species: state.species, shiny: state.shiny, level, happiness, hunger, energy, cleanliness };
  } catch {
    return null;
  }
}

function renderPetLine(info) {
  if (!info) return c.d('🐾 no buddy yet');
  const SPECIES_ARR = ['cat','dog','rabbit','hamster','bird','fish','turtle','snake','frog','bear','fox','penguin','owl','dragon','ghost','robot','alien','star'];
  const EMOJI_ARR = ['🐱','🐕','🐰','🐹','🐦','🐟','🐢','🐍','🐸','🐻','🦊','🐧','🦉','🐉','👻','🤖','👾','⭐'];
  const idx = SPECIES_ARR.indexOf(info.species);
  const emoji = idx >= 0 ? EMOJI_ARR[idx] : '🐾';
  const shiny = info.shiny ? '✨' : '';
  const cleanTag = info.cleanliness < 50 ? ` ${c[col(info.cleanliness)]('🛁' + info.cleanliness)}` : '';

  let quip = '';
  try { quip = fs.readFileSync(QUIP_FILE, 'utf8').trim(); } catch {}
  let quipPrefix = '', quipSuffix = '';
  try {
    const mode = fs.readFileSync(path.join(HOME, '.claude', 'buddy', 'quip-active-mode.txt'), 'utf8').trim();
    if (mode === 'thought') { quipPrefix = c.m('💭') + ' ('; quipSuffix = ')'; }
  } catch {}
  const quipTag = quip ? `  ${quipPrefix}${c.d(quip)}${quipSuffix}` : '';

  return `${c.m(shiny + emoji + ' ' + info.name)}${c.d('Lv' + info.level)} ${c[col(info.happiness)]('❤' + info.happiness)} ${c[col(info.hunger)]('🍖' + info.hunger)} ${c[col(info.energy)]('⚡' + info.energy)}${cleanTag}${quipTag}`;
}

// ---- GLM Quota ----
function readCache() {
  try {
    const d = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (Date.now() - d.ts < CACHE_TTL) return d;
    d._stale = true; return d;
  } catch { return null; }
}

function writeCache(data) { try { fs.writeFileSync(CACHE_FILE, JSON.stringify(data)); } catch {} }

function fetchQuota() {
  return new Promise((resolve, reject) => {
    if (!isGLM) return reject(new Error('quota: non-GLM provider'));
    const url = new URL(`${baseDomain}/api/monitor/usage/quota/limit`);
    const req = https.request({
      hostname: url.hostname, port: 443, path: url.pathname, method: 'GET',
      headers: { 'Authorization': authToken, 'Accept-Language': 'en-US,en', 'Content-Type': 'application/json' },
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// ---- stdin ----
function readStdin() {
  return new Promise(resolve => {
    let data = '';
    let done = false;
    const finish = () => { if (done) return; done = true; try { resolve(JSON.parse(data)); } catch { resolve({}); } };
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);
    setTimeout(finish, 500);
  });
}

// ---- Quip refresh (direct API call) ----
const QUIP_FILE  = path.join(HOME, '.claude', 'buddy', 'quip.txt');
const QUIP_CACHE_MS = 60 * 1000;

function refreshQuip() {
  return new Promise(resolve => {
    try {
      const st = fs.statSync(QUIP_FILE);
      if (Date.now() - st.mtimeMs < QUIP_CACHE_MS) return resolve();
    } catch {}

    const promptFile = path.join(HOME, '.claude', 'buddy', 'quip-prompt.txt');
    let prompt;
    try { prompt = fs.readFileSync(promptFile, 'utf8').trim(); } catch { return resolve(); }
    if (!prompt || !authToken || !messagesUrl) return resolve();

    const body = JSON.stringify({
      model: modelEnv,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.8,
    });

    const req = https.request({
      hostname: messagesUrl.hostname, port: messagesUrl.port || 443,
      path: messagesUrl.pathname, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': authToken,
        'anthropic-version': '2023-06-01',
      },
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          let q = (json.content?.[0]?.text || '').trim();
          q = q.replace(/^["'""'']+/, '').replace(/["'""'']+$/, '').replace(/[。！？.!?]+$/, '').trim();
          if (q.length > 50) { const last = q.lastIndexOf(' ', 50); q = q.slice(0, last > 0 ? last : 50).trim(); }
          if (q) {
            fs.writeFileSync(QUIP_FILE, q);
            try {
              const mode = fs.readFileSync(path.join(HOME, '.claude', 'buddy', 'quip-mode.txt'), 'utf8').trim();
              fs.writeFileSync(path.join(HOME, '.claude', 'buddy', 'quip-active-mode.txt'), mode);
            } catch {}
          }
        } catch {}
        resolve();
      });
    });
    req.on('error', () => resolve());
    req.setTimeout(15000, () => { req.destroy(); resolve(); });
    req.write(body);
    req.end();
  });
}

// ---- Main ----
async function main() {
  const cc = await readStdin();

  let model = typeof cc.model === 'string' ? cc.model : cc.model?.name || cc.model?.id || modelEnv;
  model = model.replace(/-\d{8,}$/, '');
  const ctxTotal = cc.context_window?.total || 200000;
  const ctxPct = parseFloat(cc.context_window?.used_percentage) || 0;

  const line1 = [];
  const line2 = [];

  // Compute pet stats (XP, state updates)
  const petInfo = petStatus(ctxPct);

  // Line 2: Model + Context
  line2.push(c.b(c.c(`${model}[${fmtCtx(ctxTotal)}]`)) + ` ${c.d('Ctx')} ${renderBar(ctxPct)} ${ctxPct.toFixed(0)}%`);

  // Regenerate quip prompt with fresh context, then refresh if cache expired
  try { execSync(`node "${path.join(HOME, '.claude', 'scripts', 'buddy', 'quip.mjs')}"`, { timeout: 5000 }); } catch {}
  await refreshQuip();

  // Line 1: Pet — rendered AFTER quip refresh so it always shows latest quip
  line1.push(renderPetLine(petInfo));
  // Line 2: Quota
  if (baseDomain && authToken) {
    const cached = readCache();
    let limits;
    if (cached && !cached._stale) { limits = cached.limits; }
    else {
      try {
        const resp = await fetchQuota();
        limits = (resp.data || resp)?.limits;
        if (limits) writeCache({ ts: Date.now(), limits });
      } catch { if (cached) limits = cached.limits; }
    }
    if (limits) {
      for (const l of limits) {
        const pct = l.percentage;
        const reset = l.nextResetTime ? resetTag(l.nextResetTime) : '';
        if (l.type === 'TOKENS_LIMIT') {
          line2.push(`${c.d(l.unit === 6 ? 'week' : '5h')} ${renderBar(pct)} ${pct}%${reset}`);
        } else if (l.type === 'TIME_LIMIT') {
          line2.push(`${c.d('MCP')} ${renderBar(pct)} ${l.currentValue ?? '?'}/${l.usage ?? '?'}${reset}`);
        }
      }
    }
  }

  console.log(line2.join('  ') + '\n' + line1.join('  '));
}

main().catch(() => console.log(c.d('statusline: error')));
