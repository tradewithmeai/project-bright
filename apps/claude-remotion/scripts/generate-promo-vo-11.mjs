#!/usr/bin/env node
// generate-promo-vo-11.mjs — per-line promo voiceover via ElevenLabs, with optional prompt-based
// VOICE DESIGN (text-to-voice). Studio tool. Mirrors generate-promo-vo.mjs's output so compositions
// consume it identically: one mp3 per line + vo.manifest.json (id → file, cue_s, duration_s).
//
// Design a voice from a prompt, then read a cue file and render each line with it:
//   node scripts/generate-promo-vo-11.mjs --describe "loud jokey British army colonel…" \
//        --cues <cues.json> --out-dir public/yourgov/audio
// Reuse an existing voice: --voice-id <id> instead of --describe.
//   env: ELEVENLABS_API_KEY (auto-loaded from repo-root .env). Cost/credits logged.
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
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

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const KEY = process.env.ELEVENLABS_API_KEY;
const MODEL = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
const API = 'https://api.elevenlabs.io';
if (!KEY) { console.error('[vo11] ELEVENLABS_API_KEY not set'); process.exit(2); }

const FP = resolveFfprobe();
function durationOf(file) {
  try {
    const r = spawnSync(FP, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nw=1', file], { encoding: 'utf8' });
    return Math.round(parseFloat((r.stdout || '').trim()) * 1000) / 1000 || 0;
  } catch { return 0; }
}

async function designVoice(description) {
  // A demo line 100–1000 chars so the previews show the character.
  const demo = "Right! Listen up! Type in your postcode and there is your Member of Parliament — every single vote, on the record. " +
    "Don't like what you see? Then email them at once! Your finger, soldier, is a weapon. Check! Click! Change! Move, move, move!";
  console.log('[vo11] designing voice from prompt …');
  let r = await fetch(`${API}/v1/text-to-voice/create-previews`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice_description: description, text: demo }),
  });
  if (!r.ok) throw new Error(`design/create-previews ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const previews = (await r.json()).previews || [];
  if (!previews.length) throw new Error('no previews returned');
  const gen = previews[0].generated_voice_id;
  console.log(`[vo11] ${previews.length} previews; creating voice from the first …`);
  r = await fetch(`${API}/v1/text-to-voice`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice_name: 'YourGov Colonel', voice_description: description, generated_voice_id: gen }),
  });
  if (!r.ok) throw new Error(`design/create-voice ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const voiceId = (await r.json()).voice_id;
  console.log(`[vo11] voice created: ${voiceId}`);
  return voiceId;
}

// A promo read is DIRECTED, not defaulted. stability 0.4 / style 0.6 is a lively advert read; a
// measured, credible one wants higher stability and much lower style. The cue file can set
// `voice_settings` globally and per line, so the direction lives with the script rather than here.
const BASE_SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.6 };

async function tts(voiceId, text, outFile, settings, prev, next) {
  const r = await fetch(`${API}/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: { ...BASE_SETTINGS, ...(settings || {}) },
      // Continuity: the model reads each line knowing what surrounds it, so line 4 does not
      // restart at cold-open energy. Lines are still separate files with their own durations.
      ...(prev ? { previous_text: prev } : {}),
      ...(next ? { next_text: next } : {}),
    }),
  });
  if (!r.ok) throw new Error(`tts ${r.status}: ${(await r.text()).slice(0, 200)}`);
  writeFileSync(outFile, Buffer.from(await r.arrayBuffer()));
}

async function main() {
  const cuesPath = arg('--cues');
  const outDir = arg('--out-dir');
  if (!cuesPath || !outDir) { console.error('need --cues and --out-dir'); process.exit(2); }
  const cues = JSON.parse(readFileSync(resolve(cuesPath), 'utf8'));
  const outAbs = resolve(outDir);
  mkdirSync(outAbs, { recursive: true });

  let voiceId = arg('--voice-id');
  if (!voiceId) {
    const desc = arg('--describe') || cues.voice_description;
    if (!desc) { console.error('need --voice-id or --describe'); process.exit(2); }
    voiceId = await designVoice(desc);
  }

  const lines = [];
  let chars = 0;
  for (let i = 0; i < cues.lines.length; i++) {
    const l = cues.lines[i];
    const file = `${l.id}.mp3`;
    const settings = { ...(cues.voice_settings || {}), ...(l.voice_settings || {}) };
    // Alternates (a pronunciation trial, say) sit beside the main line and are not part of the read.
    const neighbours = l.alt ? [undefined, undefined] : [cues.lines[i - 1]?.text, cues.lines[i + 1]?.text];
    await tts(voiceId, l.text, join(outAbs, file), settings, neighbours[0], neighbours[1]);
    const dur = durationOf(join(outAbs, file));
    chars += l.text.length;
    lines.push({ id: l.id, file, cue_s: l.cue_s ?? 0, duration_s: dur, text: l.text, alt: l.alt ?? false, voice_settings: settings });
    console.log(`[vo11] ${l.id.padEnd(14)} ${String(dur).padStart(6)}s  ${Math.round(dur * 30)}f  ${l.alt ? '(alt) ' : ''}→ ${file}`);
  }
  const manifest = { voice_id: voiceId, model: MODEL, voice_settings: cues.voice_settings || BASE_SETTINGS, lines };
  writeFileSync(join(outAbs, 'vo.manifest.json'), JSON.stringify(manifest, null, 2));

  const est = Math.round(chars / 1000 * 100) / 100; // ~1 credit/char on multilingual; report chars
  const LOG = join(REPO_ROOT, 'studio', 'logs', 'api-usage.log');
  try {
    mkdirSync(dirname(LOG), { recursive: true });
    writeFileSync(LOG, JSON.stringify({ ts: new Date().toISOString().slice(0, 19), tool: 'generate-promo-vo-11.mjs', provider: 'elevenlabs', voice_id: voiceId, chars, est_credits: chars }) + '\n', { flag: 'a' });
  } catch {}
  console.log(`[vo11] ✔ ${lines.length} lines, ${chars} chars (~${chars} credits), voice ${voiceId} → ${join(outDir, 'vo.manifest.json')}`);
}

main().catch((e) => { console.error('[vo11]', e.message); process.exit(1); });
