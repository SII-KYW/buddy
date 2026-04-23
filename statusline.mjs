#!/usr/bin/env node

/**
 * Buddy Statusline v3 — Coding Health + GLM Quota
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
import { execSync, spawn } from 'child_process';

const HOME = os.homedir();
const BUDDY_STATE = path.join(HOME, '.claude', 'buddy', 'state.json');
const CACHE_FILE  = path.join(HOME, '.claude', 'glm', 'quota-cache.json');
const CACHE_TTL   = 60_000;

const baseUrl   = process.env.ANTHROPIC_BASE_URL || '';
const authToken = process.env.ANTHROPIC_AUTH_TOKEN || '';
const modelEnv  = process.env.ANTHROPIC_MODEL || 'GLM';

let baseDomain;
if (baseUrl) { try { baseDomain = new URL(baseUrl).origin; } catch {} }

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

// ---- Lore (background + personality) triggers ----
const LORE_LOCK = path.join(HOME, '.claude/buddy/lore.lock');

function triggerLoreEvolution(state) {
  try {
    const st = fs.statSync(LORE_LOCK);
    if (Date.now() - st.mtimeMs < 60000) return;
  } catch {}
  try { fs.writeFileSync(LORE_LOCK, String(Date.now())); } catch {}
  const SPECIES_CN = {cat:'猫',dog:'狗',rabbit:'兔子',hamster:'仓鼠',bird:'鸟',fish:'鱼',turtle:'乌龟',snake:'蛇',frog:'青蛙',bear:'熊',fox:'狐狸',penguin:'企鹅',owl:'猫头鹰',dragon:'龙',ghost:'幽灵',robot:'机器人',alien:'外星人',star:'星星'};
  const PERSONALITY_CN = {lazy:'懒洋洋',energetic:'元气满满',shy:'社恐',mischievous:'调皮捣蛋',brave:'勇猛',curious:'好奇宝宝',proud:'傲娇',gentle:'温柔',grumpy:'暴躁',clumsy:'冒失鬼',wise:'老成',chaotic:'混沌邪恶'};
  const sp = SPECIES_CN[state.species] || state.species;
  const ps = PERSONALITY_CN[state.personality] || state.personality;
  const prompt = `你是一个创意作家。一只住在终端里的电子${sp}升级到了Lv.${state.level}。\n\n当前性格描写：${state.personalityDetail || '刚出生'}\n性格关键词：${ps}\n\n请在保持核心性格不变的前提下，微调性格描写，体现成长（更成熟/更有趣/新习惯）。\n\n只输出更新后的性格描写（200字以内），不要其他内容。`;
  const promptFile = path.join(HOME, '.claude/buddy/lore-prompt.txt');
  fs.writeFileSync(promptFile, prompt);
  try {
    const child = spawn('bash', [path.join(HOME, '.claude/scripts/buddy/lore-gen.sh')], {
      detached: true, stdio: 'ignore',
    });
    child.unref();
  } catch {}
}

function triggerLoreMissing(state) {
  try {
    const st = fs.statSync(LORE_LOCK);
    if (Date.now() - st.mtimeMs < 60000) return;
  } catch {}
  try { fs.writeFileSync(LORE_LOCK, String(Date.now())); } catch {}
  const SPECIES_CN = {cat:'猫',dog:'狗',rabbit:'兔子',hamster:'仓鼠',bird:'鸟',fish:'鱼',turtle:'乌龟',snake:'蛇',frog:'青蛙',bear:'熊',fox:'狐狸',penguin:'企鹅',owl:'猫头鹰',dragon:'龙',ghost:'幽灵',robot:'机器人',alien:'外星人',star:'星星'};
  const PERSONALITY_CN = {lazy:'懒洋洋',energetic:'元气满满',shy:'社恐',mischievous:'调皮捣蛋',brave:'勇猛',curious:'好奇宝宝',proud:'傲娇',gentle:'温柔',grumpy:'暴躁',clumsy:'冒失鬼',wise:'老成',chaotic:'混沌邪恶'};
  const sp = SPECIES_CN[state.species] || state.species;
  const ps = PERSONALITY_CN[state.personality] || state.personality;
  const prompt = `你是一个创意作家。为一只住在程序员终端里的电子宠物生成设定。\n\n宠物信息：\n- 名字：${state.name}\n- 物种：${sp}\n- 性格关键词：${ps}${state.shiny ? '\n- 特殊：✨闪光变种（稀有）' : ''}\n\n请生成以下内容，用 === 分隔两部分：\n\n第一部分（背景故事，200字以内）：写一段有趣的背景故事，描述这只${sp}是怎么来到程序员的终端里的。\n\n第二部分（性格描写，200字以内）：基于"${ps}"这个性格关键词，描写它的具体行为习惯、说话方式、小动作。\n\n只输出这两部分，用 === 分隔，不要其他内容。`;
  const promptFile = path.join(HOME, '.claude/buddy/lore-prompt.txt');
  fs.writeFileSync(promptFile, prompt);
  try {
    const child = spawn('bash', [path.join(HOME, '.claude/scripts/buddy/lore-gen.sh')], {
      detached: true, stdio: 'ignore',
    });
    child.unref();
  } catch {}
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
    const cleanliness = git.inRepo ? Math.round(Math.max(5, 100 - git.dirty * 6)) : 100;
    const happiness = Math.round(hunger * 0.3 + energy * 0.3 + cleanliness * 0.25 + Math.min(15, (state.streak || 1) * 3));

    const SPECIES_ARR = ['cat','dog','rabbit','hamster','bird','fish','turtle','snake','frog','bear','fox','penguin','owl','dragon','ghost','robot','alien','star'];
    const EMOJI_ARR = ['🐱','🐕','🐰','🐹','🐦','🐟','🐢','🐍','🐸','🐻','🦊','🐧','🦉','🐉','👻','🤖','👾','⭐'];
    const idx = SPECIES_ARR.indexOf(state.species);
    const emoji = idx >= 0 ? EMOJI_ARR[idx] : '🐾';
    const shiny = state.shiny ? '✨' : '';
    const level = state.level || 1;

    const cleanTag = cleanliness < 50 ? ` ${c[col(cleanliness)]('🛁' + cleanliness)}` : '';

    // Quip — read from cache (generated by quip.mjs)
    let quip = '';
    try { quip = fs.readFileSync(path.join(HOME, '.claude', 'buddy', 'quip.txt'), 'utf8').trim(); } catch {}
    const quipTag = quip ? `  ${c.d(quip)}` : '';

    return `${c.m(shiny + emoji + ' ' + state.name)}${c.d('Lv' + level)} ${c[col(happiness)]('❤' + happiness)} ${c[col(hunger)]('🍖' + hunger)} ${c[col(energy)]('⚡' + energy)}${cleanTag}${quipTag}`;
  } catch {
    return c.d('🐾 no buddy yet');
  }
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

// ---- Quip refresh (background, non-blocking) ----
const QUIP_FILE  = path.join(HOME, '.claude', 'buddy', 'quip.txt');
const QUIP_CACHE_MS = 60 * 1000; // refresh every 1min

function refreshQuip() {
  const LOCK_FILE = path.join(HOME, '.claude/buddy/quip.lock');
  try {
    // Refresh prompt file
    execSync('node ' + path.join(HOME, '.claude/scripts/buddy/quip.mjs'), {
      timeout: 5000, encoding: 'utf8', stdio: 'pipe',
    });
    // Check cache age
    const st = fs.statSync(QUIP_FILE);
    if (Date.now() - st.mtimeMs < QUIP_CACHE_MS) return;
    // Check lock — don't spawn if already generating
    try {
      const lockSt = fs.statSync(LOCK_FILE);
      if (Date.now() - lockSt.mtimeMs < 60000) return; // lock < 1min = still running
    } catch {}
    fs.writeFileSync(LOCK_FILE, String(Date.now()));
  } catch {}
  // Cache expired — fire-and-forget background quip generation
  try {
    const child = spawn('bash', [path.join(HOME, '.claude/scripts/buddy/quip-gen.sh')], {
      detached: true, stdio: 'ignore',
    });
    child.unref();
  } catch {}
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

  // Background quip refresh (non-blocking)
  refreshQuip();

  // Line 1: Pet (auto stats from context + git)
  line1.push(petStatus(ctxPct));

  // Line 2: Model + Context
  line2.push(c.b(c.c(`${model}[${fmtCtx(ctxTotal)}]`)) + ` ${c.d('Ctx')} ${renderBar(ctxPct)} ${ctxPct.toFixed(0)}%`);

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
