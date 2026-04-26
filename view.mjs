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
  getEmoji, applyBuffs, interact, notify, getNotification, checkAchievements,
} from './pet-engine.mjs';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const HOME = os.homedir();
const W = 54; // Dashboard width

// ═══════════════════════════════════════════════════════════════════
// i18n
// ═══════════════════════════════════════════════════════════════════

const LANG_FILE = path.join(HOME, '.claude', 'buddy', 'lang.txt');
const LANG = (() => {
  try { const s = fs.readFileSync(LANG_FILE, 'utf8').trim(); if (s === 'zh' || s === 'en') return s; } catch {}
  try { if (Intl.DateTimeFormat().resolvedOptions().locale.startsWith('zh')) return 'zh'; } catch {}
  return 'en';
})();

const I = LANG === 'zh' ? {
  noPet: '还没有宠物！按 [h] 孵化一只',
  session: '会话', streak: '连续', age: s => `${s}`,
  mood: '心情',
  happiness: '幸福度', hunger: '饥饿度', energy: '精力值', clean: '干净度',
  ctx: '上下文', dirty: '脏文件', noGit: '无git',
  background: '背景', personality: '性格',
  thought: name => `${name}的内心`,
  watching: '正在关注你的编程活动...',
  commits: '提交', pushes: '推送', files: '文件',
  keys: '[p]摸摸 [r]刷新 [h]孵化 [x]重置 [q]退出',
  goodbye: name => `再见！${name}会继续守护你 💚`,
  hatched: (name, species) => `孵化了 ${name} (${species})！`,
  generating: '背景故事生成中...',
  resetConfirm: '再按一次 [x] 确认重置',
  resetDone: '宠物已重置。按 [h] 孵化新的。',
  petted: (name, resp) => `你摸了 ${name}：${resp}`,
  commit: hash => `提交 ${hash} (+15xp)`,
  pushed: '已推送到远程！(+10xp)',
  effects: { 'context-heavy': '📚上下文满', 'overtime': '⏰加班', 'messy-repo': '🧹仓库脏', 'in-flow': '🌟心流' },
  moods: { ecstatic: '🤩 激动', happy: '😊 开心', content: '😐 平静', sad: '😞 低落', angry: '😤 焦虑', critical: '😱 崩溃' },
  titles: ['新手','小不点','小型','成长中','活泼','精神','强壮','健壮','威猛','辉煌','闪耀','英勇','传奇','神话','永恒','天界','超凡','全能','神圣','至尊'],
} : {
  noPet: 'No pet yet! Press [h] to hatch one.',
  session: 'Session', streak: 'Streak', age: s => s,
  mood: 'Mood',
  happiness: 'Happiness', hunger: 'Hunger', energy: 'Energy', clean: 'Clean',
  ctx: 'ctx', dirty: 'dirty', noGit: 'no git',
  background: 'Background', personality: 'Personality',
  thought: name => `${name}'s inner world`,
  watching: 'Watching your coding activity...',
  commits: 'Commits', pushes: 'Pushes', files: 'Files',
  keys: '[p]pet [r]efresh [h]atch [x]reset [q]uit',
  goodbye: name => `Goodbye! ${name} will keep watching. 💚`,
  hatched: (name, species) => `Hatched ${name} the ${species}!`,
  generating: 'Background story generating...',
  resetConfirm: 'Press [x] again to confirm reset',
  resetDone: 'Pet reset. Press [h] to hatch a new one.',
  petted: (name, resp) => `You pet ${name}: ${resp}`,
  commit: hash => `Commit ${hash} (+15xp)`,
  pushed: 'Pushed to remote! (+10xp)',
  effects: { 'context-heavy': '📚ctx-heavy', 'overtime': '⏰overtime', 'messy-repo': '🧹messy', 'in-flow': '🌟in-flow' },
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
const pad = (s, w, ch = ' ') => {
  const stripped = s.replace(/\x1b\[[0-9;]*m/g, '');
  const diff = w - [...stripped].length;
  return diff > 0 ? s + ch.repeat(diff) : s.slice(0, s.length + diff) ;
};
const center = (s, w) => {
  const stripped = s.replace(/\x1b\[[0-9;]*m/g, '');
  const len = [...stripped].length;
  const left = Math.floor((w - len) / 2);
  return ' '.repeat(Math.max(0, left)) + s;
};

function statBar(value, width = 16) {
  const pct = Math.max(0, Math.min(100, value));
  const filled = Math.round((pct / 100) * width);
  const color = pct > 50 ? 'green' : pct > 20 ? 'yellow' : 'red';
  return c(color, '█'.repeat(filled) + '░'.repeat(width - filled));
}

function xpBar(current, needed, width = 16) {
  const pct = Math.min(1, current / needed);
  const filled = Math.round(pct * width);
  return c('cyan', '▓'.repeat(filled) + '░'.repeat(width - filled));
}

function wrapText(text, maxWidth) {
  if (!text) return [];
  const chars = [...text];
  const lines = [];
  for (let i = 0; i < chars.length; i += maxWidth) {
    lines.push(chars.slice(i, i + maxWidth).join(''));
  }
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
let cachedThought = '';
let thoughtTime = 0;

function addEvent(msg) {
  const ts = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  eventLog.unshift(`[${ts}] ${msg}`);
  if (eventLog.length > MAX_EVENTS) eventLog.pop();
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

  const stats = computeStats(state, ctxPct, gitInfo);
  const mood = getMood(stats);
  const effects = getStatusEffects(stats);
  const art = getArt(state, mood);
  const xpInfo = getXpProgress(state);
  const level = state.level || 1;
  const age = formatAge(state.born);
  const sessTime = formatSessionTime(state);
  const thought = getThought(state, stats, gitInfo);
  const line = (s) => '║ ' + pad(s, W - 2) + ' ║';
  const empty = () => line('');

  const rows = [];
  const contentW = W - 4; // usable width inside borders (excluding "║ " and " ║")

  // Top border
  rows.push('╔' + '═'.repeat(W - 2) + '╗');

  // Header
  const shiny = state.shiny ? c('magenta', ' ✨SHINY✨') : '';
  const emoji = getEmoji(state.species, level);
  const petName = rainbowText(`${emoji} ${state.name}${shiny}`, level);
  rows.push(line(` ${petName}  —  ${PERSONALITY_LABELS[state.personality] || state.personality}`));
  rows.push(line(c('dim', ` ${age}  |  ${I.session}: ${sessTime}  |  ${I.streak}: ${state.streak || 1}d`)));
  rows.push(line(c('dim', ` Lv.${level} ${c('yellow', getTitleText(level))}  ${xpBar(xpInfo.current, xpInfo.needed)}  ${xpInfo.current}/${xpInfo.needed} XP`)));

  rows.push('╟' + '─'.repeat(W - 2) + '╢');

  // ASCII art
  for (const a of art) {
    rows.push(line(center(a.trimEnd(), W - 4)));
  }

  rows.push(empty());

  // Mood
  rows.push(line(` ${I.mood}: ${getMoodText(mood)}`));

  // Stats — fixed layout: emoji + label(8ch) + bar(16ch) + value(4ch) + hint
  const h = stats.hunger, hp = stats.happiness, e = stats.energy, cl = stats.cleanliness;
  rows.push(line(` ${c('red','❤')} ${LANG === 'zh' ? '幸福度' : 'Happiness'}  ${statBar(hp)} ${c('bold', String(hp).padStart(3)+'%')}`));
  rows.push(line(` ${c('yellow','🍖')} ${LANG === 'zh' ? '饥饿度' : 'Hunger   '}  ${statBar(h)} ${c('bold', String(h).padStart(3)+'%')}  ${c('dim', `${I.ctx} ${Math.round(ctxPct)}%`)}`));
  rows.push(line(` ${c('blue','⚡')} ${LANG === 'zh' ? '精力值' : 'Energy   '}  ${statBar(e)} ${c('bold', String(e).padStart(3)+'%')}  ${c('dim', sessTime)}`));
  rows.push(line(` ${c('cyan','🛁')} ${LANG === 'zh' ? '干净度' : 'Clean    '}  ${statBar(cl)} ${c('bold', String(cl).padStart(3)+'%')}  ${c('dim', gitInfo?.inRepo ? `${gitInfo.dirty} ${I.dirty}` : I.noGit)}`));

  // Status effects
  if (effects.length > 0) {
    rows.push(line(' ' + effects.map(e => I.effects[e] || e).join('  ')));
  }

  rows.push(empty());

  // Background story — wrap with proper width, account for "📖 " prefix
  if (state.background) {
    const bgW = contentW - 3; // "📖 " takes ~3 chars
    const bgLines = wrapText(state.background, bgW);
    rows.push(line(c('dim', ` 📖 ${bgLines[0]}`)));
    for (let i = 1; i < bgLines.length && i < 4; i++) {
      rows.push(line(c('dim', `    ${bgLines[i]}`)));
    }
  }
  if (state.personalityDetail) {
    const pdW = contentW - 3;
    const pdLines = wrapText(state.personalityDetail, pdW);
    rows.push(line(c('dim', ` 🎭 ${pdLines[0]}`)));
    for (let i = 1; i < pdLines.length && i < 3; i++) {
      rows.push(line(c('dim', `    ${pdLines[i]}`)));
    }
  }

  // Thought bubble (cached for 60s)
  rows.push(empty());
  rows.push(line(c('dim', ` 💭 ${state.name} ${thought}`)));

  rows.push('╟' + '─'.repeat(W - 2) + '╢');

  // Event log
  if (eventLog.length > 0) {
    for (const ev of eventLog) {
      rows.push(line(c('dim', ` ${ev}`)));
    }
  } else {
    rows.push(line(c('dim', ` ${I.watching}`)));
  }

  rows.push('╟' + '─'.repeat(W - 2) + '╢');

  // Footer
  rows.push(line(c('dim', ` ${I.commits}: ${state.totalCommits || 0}  ${I.pushes}: ${state.totalPushes || 0}  ${I.files}: ${state.filesTouched || 0}`)));
  rows.push(line(c('dim', ` ${I.keys}`)));

  rows.push('╚' + '═'.repeat(W - 2) + '╝');

  return rows;
}

// ═══════════════════════════════════════════════════════════════════
// Main loop
// ═══════════════════════════════════════════════════════════════════

// Hide cursor, enter alternate screen
process.stdout.write('\x1b[?25l\x1b[?1049h');

function clearAndDraw(rows) {
  process.stdout.write('\x1b[H'); // Move to top-left
  for (const row of rows) {
    process.stdout.write(row + '\x1b[K\n'); // Clear to end of line
  }
  // Clear remaining lines
  process.stdout.write('\x1b[J');
}

let lastCommitHash = '';
let lastAheadCount = -1;
let resetConfirm = false;

function update() {
  dataRefresh();
  animFrame();
}

// Keyboard
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', (key) => {
  if (key === 'q' || key === '\x03') { // q or Ctrl+C
    process.stdout.write('\x1b[?25h\x1b[?1049l'); // Restore cursor + screen
    process.stdout.write('\x1b[2J\x1b[H');
    const state = loadState();
    if (state) console.log(I.goodbye(state.name));
    process.exit(0);
  }

  if (key === 'p') {
    const state = loadState();
    if (state) {
      const resp = getPetResponse(state);
      addEvent(c('magenta', I.petted(state.name, resp)));
      update();
    }
  }

  if (key === 'r') {
    update();
  }

  if (key === 'h') {
    const state = hatch();
    const species = getSpeciesDef(state.species);
    lastCommitHash = '';
    lastAheadCount = -1;
    resetConfirm = false;
    addEvent(c('magenta', I.hatched(state.name, species.label) + (state.shiny ? ' SHINY!' : '')));
    addEvent(c('dim', I.generating));
    update();
  }

  if (key === 'x') {
    if (!resetConfirm) {
      resetConfirm = true;
      addEvent(c('yellow', I.resetConfirm));
      update();
    } else {
      reset();
      resetConfirm = false;
      lastCommitHash = '';
      lastAheadCount = -1;
      addEvent(c('red', I.resetDone));
      update();
    }
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
  cachedState = loadState();
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
  if (!cachedState) return;
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
