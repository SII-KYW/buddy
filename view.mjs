#!/usr/bin/env node

/**
 * Buddy Pet Viewer — Full ASCII Art Interface
 *
 * Usage:
 *   node view.mjs              Show pet status
 *   node view.mjs hatch        Hatch a new pet
 *   node view.mjs feed         Feed your pet
 *   node view.mjs play         Play with your pet
 *   node view.mjs sleep        Put pet to sleep
 */

import {
  SPECIES, loadState, saveState, hatch, feed, play, sleep,
  decayStats, getSpeciesDef, getArt, formatAge, getMood, hatched,
} from './pet-engine.mjs';

const ANSI = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
};

function c(color, s) { return `${ANSI[color]}${s}${ANSI.reset}`; }

function statBar(value, width = 20) {
  const pct = Math.max(0, Math.min(100, value));
  const filled = Math.round((pct / 100) * width);
  const color = pct > 50 ? 'green' : pct > 20 ? 'yellow' : 'red';
  return c(color, '█'.repeat(filled) + '░'.repeat(width - filled));
}

function clear() {
  process.stdout.write('\x1b[2J\x1b[H');
}

function renderFull(state) {
  const species = getSpeciesDef(state.species);
  const art = getArt(state);
  const mood = getMood(state.stats);
  const age = formatAge(state.born);

  const h = Math.round(state.stats.hunger);
  const p = Math.round(state.stats.happiness);
  const e = Math.round(state.stats.energy);

  const lines = [];

  // Title
  const title = state.shiny
    ? c('magenta', '✨ SHINY ✨ ') + c('bold', state.name) + c('magenta', ' ✨ SHINY ✨')
    : c('bold', state.name);
  lines.push('');
  lines.push(`    ${title}  ${c('dim', `the ${species.label}`)}`);
  lines.push(`    ${c('dim', `"${state.personality}"`)}  ${c('cyan', age)}`);
  lines.push('');

  // ASCII art centered
  const artLines = art.map(l => '        ' + l);
  for (const line of artLines) {
    lines.push(line);
  }
  lines.push('');

  // Stats
  const moodIcon = { ecstatic: '🤩', happy: '😊', content: '😐', gloomy: '😞', critical: '😱' };
  lines.push(`    ${c('bold', 'Mood')}:     ${moodIcon[mood] || '😐'} ${c('cyan', mood)}`);
  lines.push(`    ${c('bold', 'Happiness')}: ❤️  ${statBar(p)} ${c('bold', p + '%')}`);
  lines.push(`    ${c('bold', 'Hunger')}:    🍖 ${statBar(h)} ${c('bold', h + '%')}`);
  lines.push(`    ${c('bold', 'Energy')}:    ⚡ ${statBar(e)} ${c('bold', e + '%')}`);
  lines.push('');

  // Warnings
  if (h <= 20) lines.push(`    ${c('red', '⚠ ' + state.name + ' is starving! Feed me!')}`);
  if (p <= 20) lines.push(`    ${c('yellow', '⚠ ' + state.name + ' is very unhappy... Play with me!')}`);
  if (e <= 20) lines.push(`    ${c('blue', '⚠ ' + state.name + ' is exhausted... Let me sleep!')}`);

  return lines.join('\n');
}

function renderAction(state, action) {
  const name = state.name;
  const messages = {
    feed:  [
      `${name} munches happily! 🍖`,
      `${name} devours the food! Yum yum!`,
      `${name} licks the bowl clean! Delicious!`,
    ],
    play:  [
      `${name} jumps around excitedly! 🎾`,
      `${name} does a little dance! So cute!`,
      `${name} chases after the toy! Wheee!`,
    ],
    sleep: [
      `${name} curls up and snoozes... 💤`,
      `${name} yawns widely and falls asleep. Zzz...`,
      `${name} nestles in and drifts off. Sweet dreams!`,
    ],
  };
  const pool = messages[action] || [`${name} does something!`];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---- Main ----
const action = process.argv[2];

if (action === 'hatch' || !hatched()) {
  if (hatched() && action !== 'hatch') {
    console.log(c('dim', 'No buddy yet. Hatching a new one...'));
  }
  clear();
  const state = hatch();
  const species = getSpeciesDef(state.species);
  console.log('');
  console.log('    ' + c('magenta', '╔══════════════════════════════╗'));
  console.log('    ' + c('magenta', '║   🥚  A new buddy is born!  ║'));
  console.log('    ' + c('magenta', '╚══════════════════════════════╝'));
  console.log('');
  if (state.shiny) {
    console.log('    ' + c('yellow', c('bold', '★ SHINY ★ This is extremely rare (1% chance)! ★')));
    console.log('');
  }
  console.log(renderFull(state));
  console.log(`    ${c('dim', 'Use: node view.mjs feed | play | sleep')}`);
  console.log('');
  process.exit(0);
}

if (!['feed', 'play', 'sleep'].includes(action)) {
  const state = decayStats(loadState());
  clear();
  console.log(renderFull(state));
  console.log(`    ${c('dim', 'Actions: node view.mjs [feed|play|sleep|hatch]')}`);
  console.log('');
  process.exit(0);
}

const raw = loadState();
const state = decayStats(raw);
clear();

switch (action) {
  case 'feed':  feed(state);  break;
  case 'play':  play(state);  break;
  case 'sleep': sleep(state); break;
}

const updated = decayStats(loadState());
console.log(renderFull(updated));
console.log(`    ${c('green', '→ ' + renderAction(raw, action))}`);
console.log('');
