#!/usr/bin/env node
// generate-music.mjs — text-prompt → instrumental music track via ElevenLabs Music (studio tool).
//
// Cost is NOT in the response, so we bracket the call with the ElevenLabs subscription endpoint and
// report the CREDIT DELTA (character_count) it consumed + the plan tier, logged to studio/logs.
// (ElevenLabs music pricing wasn't verified before this run — this is how we finally measure it.)
//
// Usage (from apps/claude-remotion):
//   node scripts/generate-music.mjs --prompt "..." --length-ms 55000 --out public/promo/audio/music.mp3
//   env: ELEVENLABS_API_KEY (auto-loaded from repo-root .env)

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');

// Minimal .env loader (repo-root) — don't overwrite an already-set env var.
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
const PROMPT = arg('--prompt', '');
// --plan <json>: an ElevenLabs composition plan (global styles + timed sections). The
// score-to-the-EDL mode — each section carries duration_ms, so a drop lands on an exact video
// frame. When set, the plan is the request body and --prompt/--length-ms are ignored.
const PLAN_PATH = arg('--plan', '');
const LENGTH_MS = Number(arg('--length-ms', '55000'));
const OUT = resolve(arg('--out', join(REPO_ROOT, 'apps/claude-remotion/public/promo/audio/music.mp3')));
const MODEL = arg('--model', 'music_v1');

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('error: ELEVENLABS_API_KEY not set (repo-root .env).'); process.exit(2); }
if (!PROMPT && !PLAN_PATH) { console.error('error: --prompt or --plan required.'); process.exit(2); }

let PLAN = null;
if (PLAN_PATH) {
  PLAN = JSON.parse(readFileSync(resolve(PLAN_PATH), 'utf8'));
  const secs = PLAN.sections || [];
  const total = secs.reduce((a, s) => a + (s.duration_ms || 0), 0);
  console.log(`[music] composition plan: ${secs.length} sections, total ${total}ms`);
  for (const s of secs) console.log(`[music]   ${s.section_name}: ${s.duration_ms}ms — ${(s.positive_local_styles || []).join(', ')}`);
}

async function subscriptionUsed() {
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': KEY } });
    if (!r.ok) return null;
    const j = await r.json();
    return { used: j.character_count ?? null, limit: j.character_limit ?? null, tier: j.tier ?? '?' };
  } catch { return null; }
}

const before = await subscriptionUsed();
console.log(`[music] tier=${before?.tier ?? '?'} credits_before=${before?.used ?? '?'}/${before?.limit ?? '?'}`);
console.log(`[music] generating ${PLAN ? 'from composition plan' : `${LENGTH_MS}ms`} via ElevenLabs (${MODEL}, instrumental) …`);

const body = PLAN
  ? { composition_plan: PLAN, model_id: MODEL }
  : { prompt: PROMPT, music_length_ms: LENGTH_MS, model_id: MODEL, force_instrumental: true };
const resp = await fetch('https://api.elevenlabs.io/v1/music', {
  method: 'POST',
  headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

if (!resp.ok) {
  const body = await resp.text();
  console.error(`[music] ElevenLabs error ${resp.status}: ${body.slice(0, 500)}`);
  process.exit(1);
}

const buf = Buffer.from(await resp.arrayBuffer());
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, buf);

const after = await subscriptionUsed();
const delta = (before?.used != null && after?.used != null) ? after.used - before.used : null;

const logDir = join(REPO_ROOT, 'studio', 'logs');
mkdirSync(logDir, { recursive: true });
const rec = {
  ts: new Date().toISOString(), tool: 'generate-music.mjs', provider: 'elevenlabs',
  model: MODEL, length_ms: LENGTH_MS, tier: before?.tier ?? null,
  credits_used: delta, credits_before: before?.used ?? null, credits_after: after?.used ?? null,
  out: OUT, bytes: buf.length,
};
writeFileSync(join(logDir, 'api-usage.log'), JSON.stringify(rec) + '\n', { flag: 'a' });

console.log(`[music] ✔ wrote ${OUT} (${(buf.length / 1024).toFixed(0)} KB)`);
console.log(`[music] CREDITS USED: ${delta ?? '?'}  (tier ${before?.tier ?? '?'}; ${after?.used ?? '?'}/${after?.limit ?? '?'} now used)`);
console.log(`[music] logged → studio/logs/api-usage.log`);
