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

const W = 52; // Dashboard width

// ═══════════════════════════════════════════════════════════════════
// ANSI helpers
// ═══════════════════════════════════════════════════════════════════

const ESC = '\x1b[';
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  black: '\x1b[30m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m',
  cyan: '\x1b[36m', white: '\x1b[37m',
  bgBlack: '\x1b[40m', bgBlue: '\x1b[44m', bgMagenta: '\x1b[45m',
};

const c = (color, s) => `${C[color]}${s}${C.reset}`;
const pad = (s, w, ch = ' ') => {
  // Strip ANSI for width calculation
  const stripped = s.replace(/\x1b\[[0-9;]*m/g, '');
  const diff = w - [...stripped].length;
  return diff > 0 ? s + ch.repeat(diff) : s;
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
  const shift = Math.floor(Date.now() / 400) % colors.length;
  return Array.from(text).map((ch, i) => {
    const ci = (i + shift) % colors.length;
    return `\x1b[38;5;${colors[ci]}m${ch}\x1b[0m`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// Event log (in-memory, recent events)
// ═══════════════════════════════════════════════════════════════════

const eventLog = [];
const MAX_EVENTS = 5;

function addEvent(msg) {
  const ts = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  eventLog.unshift(`[${ts}] ${msg}`);
  if (eventLog.length > MAX_EVENTS) eventLog.pop();
}

// ═══════════════════════════════════════════════════════════════════
// Rendering
// ═══════════════════════════════════════════════════════════════════

function render(state, ctxPct, gitInfo) {
  if (!state) return ['No pet yet. Press [h] to hatch!'];

  const stats = computeStats(state, ctxPct, gitInfo);
  const mood = getMood(stats);
  const effects = getStatusEffects(stats);
  const species = getSpeciesDef(state.species);
  const art = getArt(state, mood);
  const xpInfo = getXpProgress(state);
  const level = state.level || 1;
  const age = formatAge(state.born);
  const sessTime = formatSessionTime(state);
  const thought = getContextualThought(state, stats, gitInfo);
  const line = (s) => '║ ' + pad(s, W - 2) + ' ║';
  const empty = () => line('');

  const rows = [];

  // Top border
  rows.push('╔' + '═'.repeat(W - 2) + '╗');

  // Header
  const shiny = state.shiny ? c('magenta', ' ✨SHINY✨') : '';
  const emoji = getEmoji(state.species, level);
  const petName = rainbowText(`${emoji} ${state.name}${shiny}`, level);
  rows.push(line(` ${petName}  —  ${PERSONALITY_LABELS[state.personality] || state.personality}`));
  rows.push(line(c('dim', ` ${age}  |  Session: ${sessTime}  |  Streak: ${state.streak || 1}d`)));
  rows.push(line(c('dim', ` Lv.${level} ${c('yellow', getLevelTitle(level))}  ${xpBar(xpInfo.current, xpInfo.needed)}  ${xpInfo.current}/${xpInfo.needed} XP`)));

  rows.push('╟' + '─'.repeat(W - 2) + '╢');

  // ASCII art
  for (const a of art) {
    rows.push(line(center(a.trimEnd(), W - 4)));
  }

  rows.push(empty());

  // Mood
  rows.push(line(` Mood: ${getMoodLabel(mood)}`));

  // Stats with real context
  const h = stats.hunger, hp = stats.happiness, e = stats.energy, cl = stats.cleanliness;
  rows.push(line(` ${c('red','❤')} Happiness  ${statBar(hp)} ${c('bold', hp+'%')}`));
  rows.push(line(` ${c('yellow','🍖')} Hunger     ${statBar(h)} ${c('bold', h+'%')}  ${c('dim', `ctx ${Math.round(ctxPct)}%`)}`));
  rows.push(line(` ${c('blue','⚡')} Energy     ${statBar(e)} ${c('bold', e+'%')}  ${c('dim', sessTime)}`));
  rows.push(line(` ${c('cyan','🛁')} Clean      ${statBar(cl)} ${c('bold', cl+'%')}  ${c('dim', gitInfo?.inRepo ? `${gitInfo.dirty} dirty` : 'no git')}`));

  // Status effects
  if (effects.length > 0) {
    const icons = {
      'context-heavy': c('red', '📚ctx-heavy'), 'overtime': c('blue', '⏰overtime'),
      'messy-repo': c('yellow', '🧹messy'), 'in-flow': c('green', '🌟in-flow'),
    };
    rows.push(line(' ' + effects.map(e => icons[e] || e).join('  ')));
  }

  rows.push(empty());

  // Background story + personality detail
  if (state.background) {
    const bgLines = wrapText(state.background, W - 4);
    rows.push(line(c('dim', ` 📖 ${bgLines[0]}`)));
    for (let i = 1; i < bgLines.length && i < 3; i++) {
      rows.push(line(c('dim', `    ${bgLines[i]}`)));
    }
  }
  if (state.personalityDetail) {
    const pdLines = wrapText(state.personalityDetail, W - 4);
    rows.push(line(c('dim', ` 🎭 ${pdLines[0]}`)));
    for (let i = 1; i < pdLines.length && i < 2; i++) {
      rows.push(line(c('dim', `    ${pdLines[i]}`)));
    }
  }

  // Thought bubble
  rows.push(line(c('dim', ` 💭 ${state.name} ${thought}`)));

  rows.push('╟' + '─'.repeat(W - 2) + '╢');

  // Event log
  if (eventLog.length > 0) {
    for (const ev of eventLog) {
      rows.push(line(c('dim', ` ${ev}`)));
    }
  } else {
    rows.push(line(c('dim', ' Watching your coding activity...')));
  }

  rows.push('╟' + '─'.repeat(W - 2) + '╢');

  // Footer
  rows.push(line(c('dim', ` Commits: ${state.totalCommits || 0}  Pushes: ${state.totalPushes || 0}  Files: ${state.filesTouched || 0}`)));
  rows.push(line(c('dim', ' [p]pet [r]efresh [h]atch [x]reset [q]uit')));

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
    if (state) console.log(`Goodbye! ${state.name} will keep watching. 💚`);
    process.exit(0);
  }

  if (key === 'p') {
    const state = loadState();
    if (state) {
      const resp = getPetResponse(state);
      addEvent(c('magenta', `You pet ${state.name}: ${resp}`));
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
    addEvent(c('magenta', `Hatched ${state.name} the ${species.label}!${state.shiny ? ' SHINY!' : ''}`));
    addEvent(c('dim', 'Background story generating...'));
    update();
  }

  if (key === 'x') {
    if (!resetConfirm) {
      resetConfirm = true;
      addEvent(c('yellow', 'Press [x] again to confirm reset'));
      update();
    } else {
      reset();
      resetConfirm = false;
      lastCommitHash = '';
      lastAheadCount = -1;
      addEvent(c('red', 'Pet reset. Press [h] to hatch a new one.'));
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
    if (lastCommitHash) addEvent(c('green', `Commit ${cachedGit.hash} (+15xp)`));
    lastCommitHash = cachedGit.hash;
  }
  if (cachedGit?.inRepo && lastAheadCount >= 0 && lastAheadCount > 0 && cachedGit.ahead === 0) {
    addEvent(c('cyan', 'Pushed to remote! (+10xp)'));
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

// Light animation frame every 400ms (rainbow color shift)
setInterval(animFrame, 400);

// Full data refresh every 5s (git, stats, etc.)
// Already handled by animFrame calling update(), but keep slower
// git polling separate to avoid excessive execSync calls
