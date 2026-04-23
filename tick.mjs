#!/usr/bin/env node

/**
 * Buddy Tick — Lightweight pet engine update
 *
 * Called by the loop agent every few minutes.
 * Checks git activity, updates XP, returns a status summary.
 *
 * Output: single-line summary for the agent to report.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const HOME = os.homedir();
const DIR = path.join(HOME, '.claude', 'buddy');
const STATE_FILE = path.join(DIR, 'state.json');

function loadState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; } }
function saveState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

function getGit() {
  let dirty = 0, hash = '', ahead = 0, inRepo = false, branch = '';
  try {
    dirty = execSync('git status --porcelain 2>/dev/null', { encoding: 'utf8', timeout: 3000 }).split('\n').filter(Boolean).length;
    hash = execSync('git rev-parse --short HEAD 2>/dev/null', { encoding: 'utf8', timeout: 3000 }).trim();
    branch = execSync('git branch --show-current 2>/dev/null', { encoding: 'utf8', timeout: 3000 }).trim();
    inRepo = true;
    try { ahead = parseInt(execSync('git rev-list --count @{upstream}..HEAD 2>/dev/null', { encoding: 'utf8', timeout: 3000 }).trim()) || 0; } catch {}
  } catch {}
  return { dirty, hash, ahead, inRepo, branch };
}

function gainXP(state, amount) {
  state.xp = (state.xp || 0) + amount;
  while (state.xp >= (state.level || 1) * 25) {
    state.xp -= (state.level || 1) * 25;
    state.level = (state.level || 1) + 1;
  }
}

const events = [];

function tick() {
  const state = loadState();
  if (!state) { console.log('no pet'); return; }

  const git = getGit();
  const now = Date.now();
  let save = false;

  // Survival XP (+1)
  state.lastTick = now;
  state.ticks = (state.ticks || 0) + 1;
  gainXP(state, 1);
  save = true;

  // Commit
  if (git.hash && git.hash !== state.lastCommitHash) {
    state.totalCommits = (state.totalCommits || 0) + 1;
    state.lastCommitHash = git.hash;
    state.lastCommitTime = now;
    gainXP(state, 15);
    events.push(`commit:${git.hash}(+15xp)`);
    save = true;
  }

  // Push
  if (git.inRepo) {
    const lastAhead = state.lastAheadCount ?? -1;
    state.lastAheadCount = git.ahead;
    if (lastAhead > 0 && git.ahead === 0) {
      state.totalPushes = (state.totalPushes || 0) + 1;
      gainXP(state, 10);
      events.push('push(+10xp)');
      save = true;
    }
  }

  // File activity
  if (git.inRepo) {
    const lastDirty = state.lastDirtyCount ?? 0;
    state.lastDirtyCount = git.dirty;
    if (git.dirty > lastDirty && git.dirty > 0) {
      const n = git.dirty - lastDirty;
      gainXP(state, Math.min(8, n * 2));
      state.filesTouched = (state.filesTouched || 0) + n;
      events.push(`edit:+${n}files(+${Math.min(8, n * 2)}xp)`);
      save = true;
    }
    if (lastDirty > 3 && git.dirty === 0) {
      gainXP(state, 8);
      events.push('cleanup(+8xp)');
      save = true;
    }
  }

  // Session
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
    events.push('new-session(+5xp)');
    save = true;
  }

  if (save) saveState(state);

  // Output compact summary
  const e = events.length > 0 ? ` events:${events.join(',')}` : '';
  const level = state.level || 1;
  const xp = state.xp || 0;
  const needed = level * 25;
  console.log(`${state.name} Lv${level} (${xp}/${needed}xp) commits:${state.totalCommits || 0} pushes:${state.totalPushes || 0} streak:${state.streak || 1}d dirty:${git.dirty}${e}`);
}

tick();
