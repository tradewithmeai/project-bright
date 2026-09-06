#!/usr/bin/env node
// generate-sfx.mjs — text-prompt → sound effect via ElevenLabs Sound Generation (studio tool).
// Usage (from apps/claude-remotion):
//   node scripts/generate-sfx.mjs --prompt "comedic stampede rumble" --duration 1.2 --out public/yourgov/audio/stampede.mp3
//   env: ELEVENLABS_API_KEY (auto-loaded from repo-root .env). Credits/chars logged.
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
function loadEnv(p) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv(join(REPO_ROOT, '.env'));

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('[sfx] ELEVENLABS_API_KEY not set'); process.exit(2); }

const prompt = arg('--prompt');
const out = arg('--out');
const duration = parseFloat(arg('--duration', '1.5'));
const influence = parseFloat(arg('--influence', '0.5'));
if (!prompt || !out) { console.error('need --prompt and --out'); process.exit(2); }

const body = { text: prompt, duration_seconds: duration, prompt_influence: influence };
const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
  method: 'POST',
  headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
if (!r.ok) { console.error(`[sfx] ${r.status}: ${(await r.text()).slice(0, 300)}`); process.exit(1); }
const outAbs = resolve(out);
mkdirSync(dirname(outAbs), { recursive: true });
writeFileSync(outAbs, Buffer.from(await r.arrayBuffer()));

const LOG = join(REPO_ROOT, 'studio', 'logs', 'api-usage.log');
try {
  mkdirSync(dirname(LOG), { recursive: true });
  writeFileSync(LOG, JSON.stringify({ ts: new Date().toISOString().slice(0, 19), tool: 'generate-sfx.mjs', provider: 'elevenlabs', duration_s: duration, prompt: prompt.slice(0, 60) }) + '\n', { flag: 'a' });
} catch {}
console.log(`[sfx] ✔ ${duration}s → ${out}`);
