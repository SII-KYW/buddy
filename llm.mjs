/**
 * LLM API caller — direct HTTP to GLM API
 * Replaces `claude -p` for reliable, fast generation.
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';

const HOME = os.homedir();
const SETTINGS_FILE = path.join(HOME, '.claude', 'settings.json');

function getConfig() {
  try {
    const s = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    const env = s.env || {};
    return {
      token: env.ANTHROPIC_AUTH_TOKEN || '',
      model: 'glm-5.1',
    };
  } catch {
    return { token: '', model: 'glm-5.1' };
  }
}

export function callLLM(prompt, { maxTokens = 500, temperature = 0.8 } = {}) {
  return new Promise((resolve, reject) => {
    const config = getConfig();
    if (!config.token) return reject(new Error('no API token'));

    const body = JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature,
    });

    const req = https.request({
      hostname: 'open.bigmodel.cn',
      port: 443,
      path: '/api/paas/v4/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`,
      },
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.message?.content || '';
          resolve(content.trim());
        } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}
