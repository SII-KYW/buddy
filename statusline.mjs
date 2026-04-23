#!/usr/bin/env node

/**
 * Combined Statusline: Buddy Pet + GLM Quota
 *
 * Renders: 🐱 Mochi ❤80 🍖60 ⚡90 | glm-5.1[200K] Context ▓▓░ 51% 5h ▓▓░ 20%
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';

const HOME = os.homedir();
const BUDDY_STATE = path.join(HOME, '.claude', 'buddy', 'state.json');
const CACHE_FILE  = path.join(HOME, '.claude', 'glm', 'quota-cache.json');
const CACHE_TTL   = 60_000;

const baseUrl   = process.env.ANTHROPIC_BASE_URL || '';
const authToken = process.env.ANTHROPIC_AUTH_TOKEN || '';
const modelEnv  = process.env.ANTHROPIC_MODEL || 'GLM';

let baseDomain;
if (baseUrl) {
  try { baseDomain = new URL(baseUrl).origin; } catch {}
}

// ANSI colors
const c = {
  g: s => `\x1b[32m${s}\x1b[0m`,
  y: s => `\x1b[33m${s}\x1b[0m`,
  r: s => `\x1b[31m${s}\x1b[0m`,
  c: s => `\x1b[36m${s}\x1b[0m`,
  d: s => `\x1b[2m${s}\x1b[0m`,
  b: s => `\x1b[1m${s}\x1b[0m`,
  m: s => `\x1b[35m${s}\x1b[0m`,
};

function barColor(pct) { return pct < 50 ? 'g' : pct < 80 ? 'y' : 'r'; }

function renderBar(pct, w = 10) {
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
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function resetTag(nextResetMs) {
  if (!nextResetMs) return '';
  const remaining = nextResetMs - Date.now();
  const cd = fmtCountdown(remaining);
  return cd ? c.d(` (resets in ${cd})`) : '';
}

// ---- Buddy Pet Status ----
function petStatus() {
  try {
    const state = JSON.parse(fs.readFileSync(BUDDY_STATE, 'utf8'));

    // Decay
    const now = Date.now();
    const elapsed = (now - state.lastUpdate) / 60000;
    if (elapsed >= 1) {
      state.stats.hunger    = Math.max(0, state.stats.hunger    - 0.5 * elapsed);
      state.stats.happiness = Math.max(0, state.stats.happiness - 0.3 * elapsed);
      state.stats.energy    = Math.max(0, state.stats.energy    - 0.2 * elapsed);
    }

    const SPECIES = ['cat','dog','rabbit','hamster','bird','fish','turtle','snake','frog','bear','fox','penguin','owl','dragon','ghost','robot','alien','star'];
    const EMOJI   = ['🐱','🐕','🐰','🐹','🐦','🐟','🐢','🐍','🐸','🐻','🦊','🐧','🦉','🐉','👻','🤖','👾','⭐'];
    const idx = SPECIES.indexOf(state.species);
    const emoji = idx >= 0 ? EMOJI[idx] : '🐾';
    const shiny = state.shiny ? '✨' : '';

    const h = Math.round(state.stats.hunger);
    const p = Math.round(state.stats.happiness);
    const e = Math.round(state.stats.energy);

    const hCol = h > 50 ? 'g' : h > 20 ? 'y' : 'r';
    const pCol = p > 50 ? 'g' : p > 20 ? 'y' : 'r';
    const eCol = e > 50 ? 'g' : e > 20 ? 'y' : 'r';

    return `${c.m(shiny + emoji + ' ' + state.name)} ${c[pCol]('❤' + p)} ${c[hCol]('🍖' + h)} ${c[eCol]('⚡' + e)}`;
  } catch {
    return c.d('🐾 no buddy yet');
  }
}

// ---- GLM Quota Cache ----
function readCache() {
  try {
    const d = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (Date.now() - d.ts < CACHE_TTL) return d;
    d._stale = true;
    return d;
  } catch { return null; }
}

function writeCache(data) {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(data)); } catch {}
}

function fetchQuota() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseDomain}/api/monitor/usage/quota/limit`);
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'GET',
      headers: {
        'Authorization': authToken,
        'Accept-Language': 'en-US,en',
        'Content-Type': 'application/json',
      },
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

// ---- Read stdin from Claude Code ----
function readStdin() {
  return new Promise(resolve => {
    let data = '';
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    };
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);
    setTimeout(finish, 500);
  });
}

// ---- Main ----
async function main() {
  const cc = await readStdin();

  let model = typeof cc.model === 'string' ? cc.model
    : cc.model?.name || cc.model?.id || modelEnv;
  model = model.replace(/-\d{8,}$/, '');
  const ctxTotal = cc.context_window?.total || 200000;
  const ctxPct = parseFloat(cc.context_window?.used_percentage) || 0;

  const parts = [];

  // Buddy pet status
  parts.push(petStatus());

  // Model + Context
  parts.push(c.b(c.c(`${model}[${fmtCtx(ctxTotal)}]`)) + ` ${c.d('Ctx')} ${renderBar(ctxPct, 6)} ${ctxPct.toFixed(0)}%`);

  // Quota bars
  if (baseDomain && authToken) {
    const cached = readCache();
    let limits;

    if (cached && !cached._stale) {
      limits = cached.limits;
    } else {
      try {
        const resp = await fetchQuota();
        limits = (resp.data || resp)?.limits;
        if (limits) writeCache({ ts: Date.now(), limits });
      } catch {
        if (cached) limits = cached.limits;
      }
    }

    if (limits) {
      for (const l of limits) {
        const pct = l.percentage;
        const reset = l.nextResetTime ? resetTag(l.nextResetTime) : '';

        if (l.type === 'TOKENS_LIMIT') {
          const label = l.unit === 6 ? 'week' : '5h';
          parts.push(`${c.d(label)} ${renderBar(pct, 6)} ${pct}%${reset}`);
        } else if (l.type === 'TIME_LIMIT') {
          const cur = l.currentValue ?? '?';
          const tot = l.usage ?? '?';
          parts.push(`${c.d('MCP')} ${renderBar(pct, 6)} ${cur}/${tot}${reset}`);
        }
      }
    }
  }

  console.log(parts.join('  '));
}

main().catch(() => console.log(c.d('statusline: error')));
