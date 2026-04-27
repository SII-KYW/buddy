#!/usr/bin/env node

/**
 * Buddy — Real-time Pet Dashboard
 *
 * Run in a separate terminal:
 *   node view.mjs
 *
 * Auto-refreshes every 5s, reads state from ~/.claude/buddy/state.json
 * (updated by statusline & loop agent in your Claude Code terminal).
 *
 * Keys: [p]pet [r]efresh [h]atch [q]uit
 */

import {
  loadState, saveState, hatch, hatched, getGitInfo, reset,
  computeStats, getMood, getMoodLabel, getStatusEffects,
  getSpeciesDef, getArt, formatAge, formatSessionTime,
  getContextualThought, getXpProgress, getLevelTitle, xpForLevel,
  PERSONALITY_LABELS, getPetResponse, trackSession, trackCommit,
  trackPush, trackFileChanges, trackContextGrowth,
  getEmoji, applyBuffs, interact, notify, getNotification, checkAchievements, getQuip,
} from './pet-engine.mjs';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const HOME = os.homedir();

// Detect language early (needed for border width calculation)
const LANG_FILE = path.join(HOME, '.claude', 'buddy', 'lang.txt');
const LANG = (() => {
  try { const s = fs.readFileSync(LANG_FILE, 'utf8').trim(); if (s === 'zh' || s === 'en') return s; } catch {}
  try { if (Intl.DateTimeFormat().resolvedOptions().locale.startsWith('zh')) return 'zh'; } catch {}
  return 'en';
})();

// Box drawing chars are 1 col on macOS terminals regardless of locale
const W = 64;
const CONTENT_W = W - 4; // inside "║ " and " ║"
const DASH_N = W - 2; // number of ═/─ chars

// ═══════════════════════════════════════════════════════════════════
// i18n
// ═══════════════════════════════════════════════════════════════════
// i18n
// ═══════════════════════════════════════════════════════════════════

const I = LANG === 'zh' ? {
  noPet: '还没有宠物！按 [h] 孵化一只',
  session: '会话', streak: '连续', age: s => `${s}`,
  mood: '心情',
  happiness: '幸福度', hunger: '饥饿度', energy: '精力值', clean: '干净度',
  ctx: '上下文', dirty: '脏文件', noGit: '无git',
  background: '背景', personality: '性格', status: '观察', murmur: '碎碎念',
  thought: name => `${name}的内心`,
  watching: '正在关注你的编程活动...',
  commits: '提交', pushes: '推送', files: '文件',
  keys: '[p]摸 [f]喂 [l]玩 [c]洗 [r]刷新 [x]放生 [↑↓]滚动 [q]退出',
  goodbye: name => `再见！${name}会继续守护你 💚`,
  hatched: (name, species) => `孵化了 ${name} (${species})！`,
  generating: '背景故事生成中...',
  resetConfirm1: '是否确定放生？',
  resetConfirm2: '真的确定吗？(最后1次)',
  resetDone: '宠物已放生。按 [h] 孵化新的。',
  petted: (name, resp) => `你摸了 ${name}：${resp}`,
  fed: name => `你喂了 ${name} 🍖 (+20饥饿度)`,
  played: name => `你和 ${name} 玩了 ⚽ (+15精力)`,
  cleaned: name => `你给 ${name} 洗了个澡 🛁 (+20干净度)`,
  commit: hash => `提交 ${hash} (+15xp)`,
  pushed: '已推送到远程！(+10xp)',
  effects: { 'context-heavy': '📚 上下文满', 'overtime': '⏰ 加班', 'messy-repo': '🧹 仓库脏', 'in-flow': '🌟 心流' },
  moods: { ecstatic: '🤩 激动', happy: '😊 开心', content: '😐 平静', sad: '😞 低落', angry: '😤 焦虑', critical: '😱 崩溃' },
  titles: ['新手','小不点','小型','成长中','活泼','精神','强壮','健壮','威猛','辉煌','闪耀','英勇','传奇','神话','永恒','天界','超凡','全能','神圣','至尊'],
} : {
  noPet: 'No pet yet! Press [h] to hatch one.',
  session: 'Session', streak: 'Streak', age: s => s,
  mood: 'Mood',
  happiness: 'Happiness', hunger: 'Hunger', energy: 'Energy', clean: 'Clean',
  ctx: 'ctx', dirty: 'dirty', noGit: 'no git',
  background: 'Background', personality: 'Personality', status: 'Status', murmur: 'Murmur',
  thought: name => `${name}'s inner world`,
  watching: 'Watching your coding activity...',
  commits: 'Commits', pushes: 'Pushes', files: 'Files',
  keys: '[p]pet [f]feed [l]play [c]wash [r]efresh [x]release [↑↓]scroll [q]uit',
  goodbye: name => `Goodbye! ${name} will keep watching. 💚`,
  hatched: (name, species) => `Hatched ${name} the ${species}!`,
  generating: 'Background story generating...',
  resetConfirm1: 'Release your pet?',
  resetConfirm2: 'Really sure? (last chance)',
  resetDone: 'Pet released. Press [h] to hatch a new one.',
  petted: (name, resp) => `You pet ${name}: ${resp}`,
  fed: name => `You fed ${name} 🍖 (+20 hunger)`,
  played: name => `You played with ${name} ⚽ (+15 energy)`,
  cleaned: name => `You washed ${name} 🛁 (+20 clean)`,
  commit: hash => `Commit ${hash} (+15xp)`,
  pushed: 'Pushed to remote! (+10xp)',
  effects: { 'context-heavy': '📚 ctx-heavy', 'overtime': '⏰ overtime', 'messy-repo': '🧹 messy', 'in-flow': '🌟 in-flow' },
  moods: { ecstatic: '🤩 ecstatic', happy: '😊 happy', content: '😐 content', sad: '😞 sad', angry: '😤 stressed', critical: '😱 critical' },
  titles: LEVEL_TITLES,
};

function getMoodText(mood) { return I.moods[mood] || I.moods.content; }
function getTitleText(level) { return I.titles[Math.min(level - 1, I.titles.length - 1)]; }

// ═══════════════════════════════════════════════════════════════════
// ANSI helpers
// ═══════════════════════════════════════════════════════════════════

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  black: '\x1b[30m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m',
  cyan: '\x1b[36m', white: '\x1b[37m',
};

const c = (color, s) => `${C[color]}${s}${C.reset}`;

// Terminal display width: CJK/emoji = 2 columns, ASCII = 1
function termWidth(str) {
  let w = 0;
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp <= 0x1F) continue;                        // control
    if (cp >= 0x1F300 && cp <= 0x1FAFF) { w += 2; continue; } // emoji
    if (cp === 0x2764) { w += 1; continue; }                // ❤ renders as 1 col on macOS
    if (cp >= 0x2600 && cp <= 0x27BF) { w += 2; continue; } // symbols
    if (cp >= 0x200B && cp <= 0x200F) continue;      // zero-width
    if (cp >= 0x2028 && cp <= 0x202E) continue;
    if (cp >= 0x2060 && cp <= 0x206F) continue;
    if (cp >= 0xFE00 && cp <= 0xFE0F) continue;      // variation
    if (cp >= 0x300 && cp <= 0x36F) continue;         // combining
    // CJK: 2
    if ((cp >= 0x1100 && cp <= 0x115F) || (cp >= 0x2E80 && cp <= 0xA4CF) ||
        (cp >= 0xAC00 && cp <= 0xD7AF) || (cp >= 0xF900 && cp <= 0xFAFF) ||
        (cp >= 0xFE30 && cp <= 0xFE6F) || (cp >= 0xFF01 && cp <= 0xFF60) ||
        (cp >= 0x20000 && cp <= 0x2FFFF)) { w += 2; continue; }
    w += 1;
  }
  return w;
}

function visLen(s) { return termWidth(s.replace(/\x1b\[[0-9;]*m/g, '')); }

const pad = (s, w, ch = ' ') => {
  const diff = w - visLen(s);
  return diff > 0 ? s + ch.repeat(diff) : s;
};
const center = (s, w) => {
  const len = visLen(s);
  const left = Math.floor((w - len) / 2);
  return ' '.repeat(Math.max(0, left)) + s;
};

function statBar(value, width = 16) {
  const pct = Math.max(0, Math.min(100, value));
  const filled = Math.round((pct / 100) * width);
  const color = pct > 50 ? 'green' : pct > 20 ? 'yellow' : 'red';
  return c(color, '▓'.repeat(filled) + '░'.repeat(width - filled));
}

function xpBar(current, needed, width = 16) {
  const pct = Math.min(1, current / needed);
  const filled = Math.round(pct * width);
  return c('cyan', '▓'.repeat(filled) + '░'.repeat(width - filled));
}

function wrapText(text, maxCols) {
  if (!text) return [];
  const chars = [...text];
  const lines = [];
  let line = [];
  let col = 0;
  for (const ch of chars) {
    const cw = termWidth(ch);
    if (col + cw > maxCols && line.length > 0) {
      lines.push(line.join(''));
      line = [];
      col = 0;
    }
    line.push(ch);
    col += cw;
  }
  if (line.length) lines.push(line.join(''));
  return lines;
}

function rainbowText(text, level) {
  if (level < 10) return c('magenta', text);
  const palettes = [
    [213, 216, 122],
    [213, 216, 122, 117, 153],
    [213, 216, 122, 117, 153, 183, 217],
  ];
  const tier = level >= 20 ? 2 : level >= 15 ? 1 : 0;
  const colors = palettes[tier];
  const shift = Math.floor(Date.now() / 300) % colors.length;
  return Array.from(text).map((ch, i) => {
    const ci = (i + shift) % colors.length;
    return `\x1b[38;5;${colors[ci]}m${ch}\x1b[0m`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// Event log + cached thought
// ═══════════════════════════════════════════════════════════════════

const eventLog = [];
const MAX_EVENTS = 5;
const EVENT_TTL = 30000; // events auto-expire after 30s
let lastPetTime = 0;
let cachedThought = '';
let thoughtTime = 0;

function addEvent(msg) {
  const ts = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  eventLog.unshift({ time: Date.now(), text: `[${ts}] ${msg}` });
  if (eventLog.length > MAX_EVENTS) eventLog.pop();
}

function getEvents() {
  const now = Date.now();
  // Remove expired
  while (eventLog.length && now - eventLog[eventLog.length - 1].time > EVENT_TTL) eventLog.pop();
  return eventLog.map(e => e.text);
}

function getThought(state, stats, gitInfo) {
  const now = Date.now();
  if (!cachedThought || now - thoughtTime > 60000) {
    cachedThought = getContextualThought(state, stats, gitInfo);
    thoughtTime = now;
  }
  return cachedThought;
}

// ═══════════════════════════════════════════════════════════════════
// Rendering
// ═══════════════════════════════════════════════════════════════════

function render(state, ctxPct, gitInfo) {
  if (!state) return [I.noPet];

  const stats = applyBuffs(computeStats(state, ctxPct, gitInfo), state);
  const mood = getMood(stats);
  const effects = getStatusEffects(stats);
  const art = getArt(state, mood);
  const xpInfo = getXpProgress(state);
  const level = state.level || 1;
  const age = formatAge(state.born);
  const sessTime = formatSessionTime(state);
  const thought = getThought(state, stats, gitInfo);
  const line = (s) => '║ ' + pad(s, CONTENT_W) + ' ║';
  const empty = () => line('');

  const rows = [];

  // Top border
  rows.push('╔' + '═'.repeat(DASH_N) + '╗');

  // Header
  const shiny = state.shiny ? c('magenta', ' ✨SHINY✨') : '';
  const emoji = getEmoji(state.species, level);
  const petName = rainbowText(`${emoji} ${state.name}${shiny}`, level);
  rows.push(line(` ${petName}  —  ${PERSONALITY_LABELS[state.personality] || state.personality}`));
  rows.push(line(c('dim', ` ${age}  |  ${I.session}: ${sessTime}  |  ${I.streak}: ${state.streak || 1}d`)));
  rows.push(line(c('dim', ` Lv.${level} ${c('yellow', getTitleText(level))}  ${xpBar(xpInfo.current, xpInfo.needed)}  ${xpInfo.current}/${xpInfo.needed} XP`)));

  rows.push('╟' + '─'.repeat(DASH_N) + '╢');

  // ASCII art
  for (const a of art) {
    rows.push(line(center(a.trimEnd(), CONTENT_W)));
  }

  rows.push(empty());

  // Mood
  rows.push(line(` ${I.mood}: ${getMoodText(mood)}`));

  // Stats — fixed layout: emoji + label(8ch) + bar(16ch) + value(4ch) + hint
  const h = stats.hunger, hp = stats.happiness, e = stats.energy, cl = stats.cleanliness;
  rows.push(line(` ${c('red','❤️')}  ${LANG === 'zh' ? '幸福度' : 'Happiness'}  ${statBar(hp)} ${c('bold', String(hp).padStart(3)+'%')}`));
  rows.push(line(` ${c('yellow','🍖')} ${LANG === 'zh' ? '饥饿度' : 'Hunger   '}  ${statBar(h)} ${c('bold', String(h).padStart(3)+'%')}  ${c('dim', `${I.ctx} ${Math.round(ctxPct)}%`)}`));
  rows.push(line(` ${c('blue','⚡')} ${LANG === 'zh' ? '精力值' : 'Energy   '}  ${statBar(e)} ${c('bold', String(e).padStart(3)+'%')}  ${c('dim', sessTime)}`));
  rows.push(line(` ${c('cyan','🛁')} ${LANG === 'zh' ? '干净度' : 'Clean    '}  ${statBar(cl)} ${c('bold', String(cl).padStart(3)+'%')}  ${c('dim', gitInfo?.inRepo ? `${gitInfo.dirty} ${I.dirty}` : I.noGit)}`));

  // Status effects
  if (effects.length > 0) {
    rows.push(line(' ' + effects.map(e => I.effects[e] || e).join('  ')));
  }

  rows.push(empty());

  // Background story
  if (state.background) {
    rows.push(empty());
    rows.push(line(` 📖 ${c('white', c('bold', I.background))}`));
    const bgW = CONTENT_W - 4;
    const bgLines = wrapText(state.background, bgW);
    for (const bl of bgLines) {
      rows.push(line(c('dim', `    ${bl}`)));
    }
  }
  if (state.personalityDetail) {
    rows.push(empty());
    rows.push(line(` 🎭 ${c('white', c('bold', I.personality))}`));
    const pdW = CONTENT_W - 4;
    const pdLines = wrapText(state.personalityDetail, pdW);
    for (const pl of pdLines) {
      rows.push(line(c('dim', `    ${pl}`)));
    }
  }

  // Status observation (cached for 60s)
  rows.push(empty());
  rows.push(line(` 📡 ${c('white', c('bold', I.status))}`));
  const thoughtW = CONTENT_W - 4;
  const thoughtLines = wrapText(thought, thoughtW);
  for (const tl of thoughtLines) {
    rows.push(line(c('dim', `    ${tl}`)));
  }

  // Quip (murmur)
  const quip = getQuip(state, stats, gitInfo);
  if (quip) {
    rows.push(empty());
    rows.push(line(` 💭 ${c('white', c('bold', I.murmur))}`));
    const nameHL = c('cyan', state.name);
    const quipText = `${state.name}: ${quip}`;
    const quipW = CONTENT_W - 4;
    const quipLines = wrapText(quipText, quipW);
    rows.push(line(c('dim', `    ${nameHL}${c('dim', ': ' + quipLines[0].substring(state.name.length + 2))}`)));
    for (let i = 1; i < quipLines.length; i++) {
      rows.push(line(c('dim', `    ${quipLines[i]}`)));
    }
  }

  rows.push('╟' + '─'.repeat(DASH_N) + '╢');

  // Event log
  const events = getEvents();
  if (events.length > 0) {
    for (const ev of events) {
      rows.push(line(c('dim', ` ${ev}`)));
    }
  } else {
    rows.push(line(c('dim', ` ${I.watching}`)));
  }

  rows.push('╟' + '─'.repeat(DASH_N) + '╢');

  // Footer
  rows.push(line(c('dim', ` ${I.commits}: ${state.totalCommits || 0}  ${I.pushes}: ${state.totalPushes || 0}  ${I.files}: ${state.filesTouched || 0}`)));
  rows.push(line(c('dim', ` ${I.keys}`)));

  rows.push('╚' + '═'.repeat(DASH_N) + '╝');

  return rows;
}

// ═══════════════════════════════════════════════════════════════════
// Main loop
// ═══════════════════════════════════════════════════════════════════

// Hide cursor, enter alternate screen
process.stdout.write('\x1b[?25l\x1b[?1049h');

let scrollOffset = 0;
let lastRows = [];
const SCROLL_HINT_MS = 1500;
let scrollHintUntil = 0;

function clearAndDraw(rows) {
  lastRows = rows;
  const total = rows.length;
  const viewH = process.stdout.rows || 24;
  const maxOffset = Math.max(0, total - viewH);

  // Clamp scroll offset
  if (scrollOffset > maxOffset) scrollOffset = maxOffset;

  const start = scrollOffset;
  const end = Math.min(start + viewH, total);
  const visible = rows.slice(start, end);

  process.stdout.write('\x1b[H');
  for (const row of visible) {
    process.stdout.write(row + '\x1b[K\n');
  }
  process.stdout.write('\x1b[J');

  // Scroll indicator
  if (total > viewH) {
    const pct = Math.round(((start + visible.length) / total) * 100);
    const indicator = c('dim', ` ${start > 0 ? '↑' : ''}${end < total ? '↓' : ''} ${start + 1}-${end}/${total}`);
    process.stdout.write('\x1b[s'); // Save cursor
    process.stdout.write('\x1b[' + viewH + ';1H');
    process.stdout.write(indicator + '\x1b[K');
    process.stdout.write('\x1b[u'); // Restore cursor
    scrollHintUntil = Date.now() + SCROLL_HINT_MS;
  }
}

let lastCommitHash = '';
let lastAheadCount = -1;
let resetConfirm = 0; // 0=none, 1=first warning, 2=second warning, 3=execute

function update() {
  dataRefresh();
  animFrame();
}

// Keyboard
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', (key) => {
  // Scrolling: arrow keys, j/k, PgUp/PgDn, Home/End
  const viewH = process.stdout.rows || 24;
  const maxOffset = Math.max(0, lastRows.length - viewH);
  let scrolled = false;
  if (key === '\x1b[A' || key === '\x1bOA' || key === 'k') { scrollOffset = Math.max(0, scrollOffset - 1); scrolled = true; }
  if (key === '\x1b[B' || key === '\x1bOB' || key === 'j') { scrollOffset = Math.min(maxOffset, scrollOffset + 1); scrolled = true; }
  if (key === '\x1b[5~') { scrollOffset = Math.max(0, scrollOffset - (viewH - 2)); scrolled = true; } // PgUp
  if (key === '\x1b[6~') { scrollOffset = Math.min(maxOffset, scrollOffset + (viewH - 2)); scrolled = true; } // PgDn
  if (key === '\x1b[H' || key === '\x1b[1~') { scrollOffset = 0; scrolled = true; } // Home
  if (key === '\x1b[F' || key === '\x1b[4~') { scrollOffset = maxOffset; scrolled = true; } // End
  if (scrolled) { clearAndDraw(lastRows); return; }

  if (key === 'q' || key === '\x03') { // q or Ctrl+C
    process.stdout.write('\x1b[?25h\x1b[?1049l'); // Restore cursor + screen
    process.stdout.write('\x1b[2J\x1b[H');
    const state = loadState();
    if (state) console.log(I.goodbye(state.name));
    process.exit(0);
  }

  if (key === 'p') {
    const now = Date.now();
    if (now - lastPetTime < 300) return;
    lastPetTime = now;
    const state = loadState();
    if (state) {
      interact(state, 'pet');
      saveState(state);
      cachedThought = ''; thoughtTime = 0;
      const resp = getPetResponse(state);
      addEvent(c('magenta', I.petted(state.name, resp)));
      update();
    }
  }

  if (key === 'f') {
    const now = Date.now();
    if (now - lastPetTime < 300) return;
    lastPetTime = now;
    const state = loadState();
    if (state) {
      interact(state, 'feed');
      saveState(state);
      cachedThought = ''; thoughtTime = 0;
      addEvent(c('yellow', I.fed(state.name)));
      update();
    }
  }

  if (key === 'l') {
    const now = Date.now();
    if (now - lastPetTime < 300) return;
    lastPetTime = now;
    const state = loadState();
    if (state) {
      interact(state, 'play');
      saveState(state);
      cachedThought = ''; thoughtTime = 0;
      addEvent(c('blue', I.played(state.name)));
      update();
    }
  }

  if (key === 'c') {
    const now = Date.now();
    if (now - lastPetTime < 300) return;
    lastPetTime = now;
    const state = loadState();
    if (state) {
      interact(state, 'clean');
      saveState(state);
      cachedThought = ''; thoughtTime = 0;
      addEvent(c('cyan', I.cleaned(state.name)));
      update();
    }
  }

  if (key === 'r') {
    update();
  }

  if (key === 'h') {
    if (cachedState) return; // already have a pet
    const state = hatch();
    const species = getSpeciesDef(state.species);
    lastCommitHash = '';
    lastAheadCount = -1;
    resetConfirm = 0;
    addEvent(c('magenta', I.hatched(state.name, species.label) + (state.shiny ? ' SHINY!' : '')));
    addEvent(c('dim', I.generating));
    update();
  }

  if (key === 'x') {
    resetConfirm++;
    if (resetConfirm === 1) {
      addEvent(c('yellow', I.resetConfirm1));
    } else if (resetConfirm === 2) {
      addEvent(c('red', I.resetConfirm2));
    } else {
      reset();
      resetConfirm = 0;
      lastCommitHash = '';
      lastAheadCount = -1;
      addEvent(c('red', I.resetDone));
    }
    update();
  }
});

// Graceful exit on signals
const cleanup = () => {
  process.stdout.write('\x1b[?25h\x1b[?1049l\x1b[2J\x1b[H');
  process.exit(0);
};
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

// Cached data for animation frames (avoid heavy git/exec every 400ms)
let cachedState = null;
let cachedGit = null;
let cachedCtxPct = 0;
let lastDataRefresh = 0;

function dataRefresh() {
  const prevRowCount = lastRows.length;
  cachedState = loadState();
  // Clean expired buffs & interact log
  if (cachedState) {
    const now = Date.now();
    let dirty = false;
    if (cachedState.buffs) {
      for (const key of Object.keys(cachedState.buffs)) {
        if (now >= cachedState.buffs[key].until) { delete cachedState.buffs[key]; dirty = true; }
      }
    }
    if (cachedState.interactLog) {
      const cleaned = cachedState.interactLog.filter(e => now - e.time < 10_000);
      if (cleaned.length !== cachedState.interactLog.length) {
        cachedState.interactLog = cleaned;
        dirty = true;
      }
    }
    if (dirty) { saveState(cachedState); cachedThought = ''; thoughtTime = 0; }
  }
  // New data → scroll to bottom
  if (cachedState) {
    const newRows = render(cachedState, cachedCtxPct, cachedGit);
    if (newRows.length > prevRowCount && prevRowCount > 0) scrollOffset = 0;
  }
  cachedGit = getGitInfo();
  if (cachedState) {
    const sessionMin = (Date.now() - (cachedState.lastSessionStart || cachedState.born)) / 60000;
    cachedCtxPct = Math.min(95, sessionMin * 0.5);
  }
  lastDataRefresh = Date.now();
  // Detect events
  if (cachedGit?.hash && cachedGit.hash !== lastCommitHash) {
    if (lastCommitHash) addEvent(c('green', I.commit(cachedGit.hash)));
    lastCommitHash = cachedGit.hash;
  }
  if (cachedGit?.inRepo && lastAheadCount >= 0 && lastAheadCount > 0 && cachedGit.ahead === 0) {
    addEvent(c('cyan', I.pushed));
  }
  if (cachedGit) lastAheadCount = cachedGit.ahead;
}

function animFrame() {
  const rows = render(cachedState, cachedCtxPct, cachedGit);
  clearAndDraw(rows);
}

// Initial
dataRefresh();
animFrame();

// Heavy data refresh every 5s
setInterval(dataRefresh, 5000);

// Light animation frame every 200ms (rainbow color shift)
setInterval(animFrame, 200);
