#!/usr/bin/env node
// generate-promo-vo.mjs — per-line promo voiceover via OpenAI TTS (studio tool).
//
// Reads a cue file ({ voice, lines:[{id,cue_s,text}] }) and renders one mp3 per line into an audio
// dir, plus a vo.manifest.json (id → file, cue_s, duration_s) the composition consumes. Cost logged.
//
// Usage (from apps/claude-remotion):
//   node scripts/generate-promo-vo.mjs --cues <vo_cues.json> --out-dir public/promo/audio
//   env: OPENAI_API_KEY (auto-loaded from repo-root .env)

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFfprobe } from './ffmpeg-bin.mjs';

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

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const CUES = resolve(arg('--cues', ''));
const OUT_DIR = resolve(arg('--out-dir', join(REPO_ROOT, 'apps/claude-remotion/public/promo/audio')));
const MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('error: OPENAI_API_KEY not set.'); process.exit(2); }
if (!existsSync(CUES)) { console.error(`error: --cues file not found: ${CUES}`); process.exit(2); }

const cues = JSON.parse(readFileSync(CUES, 'utf8'));
const voice = cues.voice || 'onyx';
mkdirSync(OUT_DIR, { recursive: true });

function durationOf(path) {
  const r = spawnSync(resolveFfprobe(), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path], { encoding: 'utf8', timeout: 30000 });
  const d = parseFloat((r.stdout || '').trim());
  return Number.isFinite(d) ? Math.round(d * 100) / 100 : null;
}

const out = [];
let chars = 0;
for (const line of cues.lines) {
  const resp = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, voice, input: line.text, response_format: 'mp3' }),
  });
  if (!resp.ok) {
    console.error(`[vo] ${line.id} error ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
    process.exit(1);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  const file = `${line.id}.mp3`;
  writeFileSync(join(OUT_DIR, file), buf);
  chars += line.text.length;
  const dur = durationOf(join(OUT_DIR, file));
  out.push({ id: line.id, file, cue_s: line.cue_s, duration_s: dur, text: line.text });
  console.log(`[vo] ${line.id} @${line.cue_s}s (${dur}s) → ${file}`);
}

const manifest = { voice, model: MODEL, lines: out, messaging: cues.messaging || [] };
writeFileSync(join(OUT_DIR, 'vo.manifest.json'), JSON.stringify(manifest, null, 2));

// Cost log — gpt-4o-mini-tts ~ $0.60 / 1M input chars (rough).
const estUsd = Math.round((chars / 1e6) * 0.6 * 1e5) / 1e5;
const logDir = join(REPO_ROOT, 'studio', 'logs');
mkdirSync(logDir, { recursive: true });
writeFileSync(join(logDir, 'api-usage.log'),
  JSON.stringify({ ts: new Date().toISOString(), tool: 'generate-promo-vo.mjs', provider: 'openai', model: MODEL, voice, lines: out.length, chars, cost_usd_est: estUsd }) + '\n',
  { flag: 'a' });

console.log(`[vo] ✔ ${out.length} lines, ${chars} chars, ~$${estUsd}. manifest → ${join(OUT_DIR, 'vo.manifest.json')}`);
