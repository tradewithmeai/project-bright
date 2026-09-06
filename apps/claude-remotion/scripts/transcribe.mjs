#!/usr/bin/env node
/**
 * transcribe.mjs — speech-to-text for a video/audio file (OpenAI transcription).
 *
 * Extracts the audio (if given a video) with Remotion's bundled ffmpeg, then sends it to the
 * OpenAI transcription API. Prints the transcript and (with --out) saves it. Auto-detects language.
 *
 * Env (auto-loaded from the repo-root .env): OPENAI_API_KEY
 * Usage:
 *   node transcribe.mjs <input.mp4|.mp3|.wav> [--out transcript.txt] [--model gpt-4o-transcribe]
 *                       [--timestamps] [--language en] [--ffmpeg <path>]
 *   --model        gpt-4o-transcribe (default, best) | gpt-4o-mini-transcribe | whisper-1
 *   --timestamps   use whisper-1 verbose_json to also get per-segment start/end times (JSON to --out)
 *   --language     ISO code hint (e.g. en, pl); omit to auto-detect
 */
import '../../../scripts/load-env.mjs';
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

function flag(name, fb = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fb;
}
const has = (n) => process.argv.includes(`--${n}`);

const input = process.argv[2];
if (!input || input.startsWith('--')) {
  console.error('Usage: node transcribe.mjs <input.mp4|.mp3|.wav> [--out t.txt] [--model gpt-4o-transcribe] [--timestamps] [--language en]');
  process.exit(2);
}
const inAbs = resolve(process.cwd(), input);
if (!existsSync(inAbs)) { console.error(`[stt] input not found: ${inAbs}`); process.exit(1); }
if (!OPENAI_KEY) { console.error('[stt] OPENAI_API_KEY not set (repo-root .env). Cannot transcribe.'); process.exit(1); }

const timestamps = has('timestamps');
const model = flag('model', timestamps ? 'whisper-1' : 'gpt-4o-transcribe');
const language = flag('language');
const outPath = flag('out');

function resolveFfmpeg() {
  if (flag('ffmpeg')) return flag('ffmpeg');
  if (process.env.FFMPEG) return process.env.FFMPEG;
  const bundled = resolve(dirname(fileURLToPath(import.meta.url)),
    '../node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe');
  return existsSync(bundled) ? bundled : 'ffmpeg';
}

// If the input is a video (or anything non-audio), extract a compact mp3 first.
const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.oga', '.mpga']);
let audioPath = inAbs;
let tmpMade = null;
if (!AUDIO_EXT.has(extname(inAbs).toLowerCase())) {
  const ff = resolveFfmpeg();
  tmpMade = mkdtempSync(join(tmpdir(), 'stt-'));
  audioPath = join(tmpMade, basename(inAbs, extname(inAbs)) + '.mp3');
  console.error(`[stt] extracting audio → mp3 (${ff === 'ffmpeg' ? 'PATH ffmpeg' : 'bundled ffmpeg'})`);
  const r = spawnSync(ff, ['-y', '-i', inAbs, '-vn', '-c:a', 'libmp3lame', '-q:a', '4', audioPath], { encoding: 'utf8' });
  if (r.status !== 0 || !existsSync(audioPath)) {
    console.error(`[stt] audio extract failed:\n${(r.stderr || r.error?.message || '').toString().slice(-400)}`);
    process.exit(1);
  }
}

const bytes = readFileSync(audioPath);
console.error(`[stt] transcribing ${basename(audioPath)} (${Math.round(bytes.length / 1024)} KB) with ${model}${language ? ` [lang=${language}]` : ' [auto-detect]'} …`);

const form = new FormData();
form.append('file', new Blob([bytes], { type: 'audio/mpeg' }), basename(audioPath));
form.append('model', model);
form.append('response_format', timestamps ? 'verbose_json' : 'json');
if (language) form.append('language', language);

const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${OPENAI_KEY}` },
  body: form,
});
if (!res.ok) {
  console.error(`[stt] HTTP ${res.status} — ${(await res.text().catch(() => '')).slice(0, 300)}`);
  process.exit(1);
}
const data = await res.json();
const text = (data.text || '').trim();
const lang = data.language || language || '(auto)';
const dur = data.duration ? `${Math.round(data.duration)}s` : '?';

// Cost estimate (always-log-API-cost): ~$0.006/min whisper-1 & gpt-4o-transcribe; ~$0.003/min mini.
const mins = data.duration ? data.duration / 60 : 0;
const rate = /mini/.test(model) ? 0.003 : 0.006;
console.error(`[stt] done — language=${lang} audio=${dur}  est cost ~$${(mins * rate).toFixed(4)} (${model})`);

if (timestamps && Array.isArray(data.segments)) {
  const segs = data.segments.map((s) => ({ start: Math.round(s.start * 100) / 100, end: Math.round(s.end * 100) / 100, text: (s.text || '').trim() }));
  if (outPath) { writeFileSync(resolve(process.cwd(), outPath), JSON.stringify({ language: lang, duration: data.duration, text, segments: segs }, null, 2), 'utf8'); console.error(`[stt] wrote ${outPath}`); }
  console.error('\n[stt] segments:');
  for (const s of segs) console.error(`  ${String(s.start).padStart(6)}–${String(s.end).padEnd(6)}s  ${s.text}`);
}

if (outPath && !timestamps) { writeFileSync(resolve(process.cwd(), outPath), text + '\n', 'utf8'); console.error(`[stt] wrote ${outPath}`); }

// The transcript itself → stdout (so it can be piped/captured cleanly).
console.log(text);
