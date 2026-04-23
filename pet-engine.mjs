/**
 * Buddy Pet Engine — Tamagotchi-style virtual pet for Claude Code
 *
 * 18 species, 1% shiny rate, stat decay, actions (feed/play/sleep)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const HOME = os.homedir();
const STATE_DIR = path.join(HOME, '.claude', 'buddy');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

// ---- Species ----
export const SPECIES = [
  { id: 'cat',     emoji: '🐱', label: 'Cat' },
  { id: 'dog',     emoji: '🐕', label: 'Dog' },
  { id: 'rabbit',  emoji: '🐰', label: 'Rabbit' },
  { id: 'hamster', emoji: '🐹', label: 'Hamster' },
  { id: 'bird',    emoji: '🐦', label: 'Bird' },
  { id: 'fish',    emoji: '🐟', label: 'Fish' },
  { id: 'turtle',  emoji: '🐢', label: 'Turtle' },
  { id: 'snake',   emoji: '🐍', label: 'Snake' },
  { id: 'frog',    emoji: '🐸', label: 'Frog' },
  { id: 'bear',    emoji: '🐻', label: 'Bear' },
  { id: 'fox',     emoji: '🦊', label: 'Fox' },
  { id: 'penguin', emoji: '🐧', label: 'Penguin' },
  { id: 'owl',     emoji: '🦉', label: 'Owl' },
  { id: 'dragon',  emoji: '🐉', label: 'Dragon' },
  { id: 'ghost',   emoji: '👻', label: 'Ghost' },
  { id: 'robot',   emoji: '🤖', label: 'Robot' },
  { id: 'alien',   emoji: '👾', label: 'Alien' },
  { id: 'star',    emoji: '⭐', label: 'Star' },
];

export const NAMES = [
  'Mochi', 'Tofu', 'Nori', 'Wasabi', 'Matcha', 'Kumo', 'Hoshi', 'Sora',
  'Miku', 'Kira', 'Luna', 'Sol', 'Nebula', 'Pixel', 'Byte', 'Ziggy',
  'Cosmo', 'Blip', 'Dot', 'Spark', 'Boba', 'Mango', 'Peach', 'Cleo',
  'Olive', 'Ginger', 'Pepper', 'Miso', 'Pudding', 'Waffle',
];

export const PERSONALITIES = [
  'lazy but affectionate', 'energetic and playful', 'quiet and thoughtful',
  'mischievous and clever', 'brave and loyal', 'shy but curious',
  'wise and calm', 'chaotic and unpredictable', 'gentle and caring',
  'proud and independent', 'clumsy but lovable', 'mysterious and elegant',
];

// ---- ASCII Art (18 species) ----
export const ASCII_ART = {
  cat: [
    '   /\\_/\\   ',
    '  ( °w° )  ',
    '   > ^ <   ',
    '  /|   |\\ ',
    ' (_|   |_) ',
  ],
  dog: [
    '  / \\__    ',
    ' (    @\\   ',
    ' /    \\    ',
    '/  |  | \\  ',
    'V__|__|__/ ',
  ],
  rabbit: [
    '   (\\(\\    ',
    '   (-.-)   ',
    '   (> <)   ',
    '  /|   |\\ ',
    ' (_|   |_) ',
  ],
  hamster: [
    '   q p     ',
    '  ( o.o )  ',
    '   > ^ <   ',
    '  /|   |\\ ',
    ' (_| T |_) ',
  ],
  bird: [
    '    ^ ^    ',
    '   (O,O)   ',
    '   (   )   ',
    '  -"-"---  ',
    ' /       \\ ',
  ],
  fish: [
    '     /\\    ',
    '   /   \\   ',
    ' <·(((>  > ',
    '   \\   /   ',
    '     \\/    ',
  ],
  turtle: [
    '    ____   ',
    '  //    \\  ',
    ' || (°°) | ',
    '  \\\\____/  ',
    '   |    |  ',
  ],
  snake: [
    '   /____\\  ',
    '  / o  o \\ ',
    ' |  ___   |',
    '  \\_____/  ',
    '   ~~~~~   ',
  ],
  frog: [
    '   @   @   ',
    '  (o_o )   ',
    '  /|   |\\  ',
    ' / |___| \\ ',
    '   "   "   ',
  ],
  bear: [
    '   /•  •\\  ',
    '  (  °°  ) ',
    '   \\    /  ',
    '   /|  |\\  ',
    '  ( |  | ) ',
  ],
  fox: [
    '  /\\   /\\  ',
    ' //\\\\_//\\\\ ',
    '( o   o  ) ',
    ' \\  <>  /  ',
    '  \\____/   ',
  ],
  penguin: [
    '   (°°)    ',
    '  /(   )\\  ',
    '  \\ o o /  ',
    '   |   |   ',
    '   "   "   ',
  ],
  owl: [
    '   /\\  /\\  ',
    '  (O ,, O) ',
    '   \\ ^^ /  ',
    '  /|    |\\ ',
    ' (_|____|_)',
  ],
  dragon: [
    '   /\\_/\\   ',
    ' / o   o \\ ',
    '|  \\___/  |',
    ' \\_______/ ',
    '  /|   |\\  ',
  ],
  ghost: [
    '   .---.   ',
    '  / o o \\  ',
    ' |   ^   | ',
    ' |  \\_/  | ',
    '  \\=====/  ',
  ],
  robot: [
    '  _[°]_    ',
    '  |o o|    ',
    '  | = |    ',
    '  |___|    ',
    '  /| |\\   ',
  ],
  alien: [
    '  .-"""-.  ',
    ' /  o o  \\ ',
    '|    ^    |',
    ' \\  ===  / ',
    '  \'-----\'  ',
  ],
  star: [
    '    *      ',
    '   ***     ',
    '  *****    ',
    '   ***     ',
    '    *      ',
  ],
};

// ---- Mood text ----
function getMood(stats) {
  const avg = (stats.hunger + stats.happiness + stats.energy) / 3;
  if (avg > 80) return 'ecstatic';
  if (avg > 60) return 'happy';
  if (avg > 40) return 'content';
  if (avg > 20) return 'gloomy';
  return 'critical';
}

// ---- State Management ----
export function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

export function saveState(state) {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function hatched() {
  return fs.existsSync(STATE_FILE);
}

// Decay: hunger -0.5/min, happiness -0.3/min, energy -0.2/min
export function decayStats(state) {
  const now = Date.now();
  const elapsed = (now - state.lastUpdate) / 60000; // minutes
  if (elapsed < 1) return state;

  state.stats.hunger    = Math.max(0, state.stats.hunger    - 0.5 * elapsed);
  state.stats.happiness = Math.max(0, state.stats.happiness - 0.3 * elapsed);
  state.stats.energy    = Math.max(0, state.stats.energy    - 0.2 * elapsed);
  state.lastUpdate = now;
  saveState(state);
  return state;
}

// ---- Actions ----
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
    lastUpdate: Date.now(),
    stats: { hunger: 100, happiness: 100, energy: 100 },
  };
  saveState(state);
  return state;
}

export function feed(state) {
  state.stats.hunger    = Math.min(100, state.stats.hunger + 30);
  state.stats.happiness = Math.min(100, state.stats.happiness + 5);
  state.lastUpdate = Date.now();
  saveState(state);
  return state;
}

export function play(state) {
  state.stats.happiness = Math.min(100, state.stats.happiness + 25);
  state.stats.energy    = Math.max(0,   state.stats.energy - 15);
  state.stats.hunger    = Math.max(0,   state.stats.hunger - 10);
  state.lastUpdate = Date.now();
  saveState(state);
  return state;
}

export function sleep(state) {
  state.stats.energy    = Math.min(100, state.stats.energy + 40);
  state.stats.happiness = Math.min(100, state.stats.happiness + 5);
  state.stats.hunger    = Math.max(0,   state.stats.hunger - 5);
  state.lastUpdate = Date.now();
  saveState(state);
  return state;
}

// ---- Renderers ----
export function getSpeciesDef(id) {
  return SPECIES.find(s => s.id === id) || SPECIES[0];
}

export function getArt(state) {
  const art = ASCII_ART[state.species] || ASCII_ART.cat;
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
  return `${d}d ${h % 24}h old`;
}

export { getMood };
