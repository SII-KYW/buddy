/**
 * LLM API caller — Anthropic Messages API compatible
 * Reads config from environment variables set by Claude Code.
 */

import https from 'https';

export function callLLM(prompt, { maxTokens = 500, temperature = 0.8 } = {}) {
  return new Promise((resolve, reject) => {
    const baseUrl = process.env.ANTHROPIC_BASE_URL || '';
    const token = process.env.ANTHROPIC_AUTH_TOKEN || '';
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

    if (!token || !baseUrl) return reject(new Error('no API config'));

    const apiUrl = new URL(baseUrl.replace(/\/+$/, '') + '/v1/messages');

    const body = JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature,
    });

    const req = https.request({
      hostname: apiUrl.hostname,
      port: apiUrl.port || 443,
      path: apiUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': token,
        'anthropic-version': '2023-06-01',
      },
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        try {
          const json = JSON.parse(data);
          const content = json.content?.[0]?.text || '';
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
