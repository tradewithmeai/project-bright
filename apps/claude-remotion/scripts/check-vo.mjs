#!/usr/bin/env node
/**
 * check-vo.mjs — look at a voiceover instead of listening to it.
 *
 *   node scripts/check-vo.mjs --dir public/linel/vo            # report
 *   node scripts/check-vo.mjs --dir public/linel/vo --fix      # report and trim
 *
 * WHY THIS EXISTS. TTS does not always stop where the script does. ElevenLabs will occasionally
 * begin another word and the file simply ends mid-syllable, which plays as a stutter or a click.
 * You cannot see it in a waveform length and you cannot see it in a frame count — the file is a
 * perfectly ordinary duration. The only tell is that the LAST sample is still loud, and rising.
 *
 * Caught in the wild on the Linel promo: two of six lines ended mid-word, and the operator heard
 * one of them at 41.8s in a finished render. This makes that a build check rather than a listen.
 *
 * What it measures, per file: a 10ms RMS envelope, a speech gate at 4% of peak, then
 *   - a TRUNCATED TAIL — a short final burst (< 350ms) whose last frame is above the gate;
 *   - a CLIPPED HEAD — the very first frame already above the gate;
 *   - LEADING / TRAILING SILENCE, which is padding worth knowing about when fitting to a budget.
 *
 * --fix trims a truncated tail back to the end of the last real word, plus a short natural tail.
 * It never touches the head, and it never re-synthesises: no API call, no cost.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolveFfmpeg } from './ffmpeg-bin.mjs';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const FIX = argv.includes('--fix');
const DIR = resolve(arg('--dir', ''));
if (!DIR || !existsSync(DIR)) { console.error('error: --dir <folder of mp3s> is required'); process.exit(2); }

const FFMPEG = resolveFfmpeg();
const TMP = join(tmpdir(), 'pb-vo-check');
mkdirSync(TMP, { recursive: true });
const SR = 16000;
const WIN = SR / 100;              // 10ms
const GATE = 0.04;                 // fraction of peak that counts as speech
const SHORT_BURST_S = 0.35;        // a final run shorter than this, still loud, is a cut-off word
const KEEP_TAIL_S = 0.18;          // natural air to leave after the last real word
// A clipped head starts LOUD. A natural one ramps up through the first syllable, and can easily
// cross the 4% speech gate on its very first frame — 'A hundred and eighty' opens at 5.6% of peak
// and rises, which the gate alone called clipped. Calibrated on that false positive.
const CLIP_HEAD_FRAC = 0.25;

/**
 * Decode to mono 16k PCM and return a 10ms RMS envelope.
 *
 * Via a temporary wav, not `-f s16le -`: the bundled compositor ffmpeg is a minimal build with no
 * raw-PCM muxer, so piping raw samples fails. The wav muxer is present.
 */
function envelope(file) {
  const tmp = join(TMP, `${basename(file).replace(/\W+/g, '_')}.wav`);
  const r = spawnSync(FFMPEG, ['-y', '-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), tmp], { encoding: 'utf8' });
  if (r.status !== 0 || !existsSync(tmp)) throw new Error(`decode failed: ${file} — ${r.stderr || ''}`);
  const buf = readFileSync(tmp);
  unlinkSync(tmp);
  // Walk the RIFF chunks to find `data`; the header is not always a fixed 44 bytes.
  let off = 12;
  while (off + 8 <= buf.length && buf.toString('ascii', off, off + 4) !== 'data') {
    off += 8 + buf.readUInt32LE(off + 4);
  }
  if (off + 8 > buf.length) throw new Error(`no data chunk: ${file}`);
  const start = off + 8;
  const bytes = Math.min(buf.readUInt32LE(off + 4), buf.length - start);
  const pcm = new Int16Array(buf.buffer, buf.byteOffset + start, Math.floor(bytes / 2));
  const out = [];
  for (let i = 0; i + WIN <= pcm.length; i += WIN) {
    let s = 0;
    for (let j = 0; j < WIN; j++) s += pcm[i + j] * pcm[i + j];
    out.push(Math.sqrt(s / WIN));
  }
  return { rms: out, seconds: pcm.length / SR };
}

function inspect(file) {
  const { rms, seconds } = envelope(file);
  const peak = Math.max(...rms);
  const thr = peak * GATE;
  const voiced = rms.map((r) => r > thr);
  const first = voiced.indexOf(true);
  const last = voiced.lastIndexOf(true);
  if (first < 0) return { file, seconds, silent: true };

  // Walk back from the last voiced frame to the start of that final run.
  let i = last;
  while (i > 0 && voiced[i - 1]) i--;
  const finalRun = (last - i + 1) / 100;
  const endsLoud = voiced[voiced.length - 1];
  const truncated = endsLoud && finalRun < SHORT_BURST_S;

  // Where the last REAL word ended: the end of the run before the stray burst.
  let prevEnd = null;
  if (truncated) {
    let j = i - 1;
    while (j > 0 && !voiced[j]) j--;
    prevEnd = (j + 1) / 100;
  }

  return {
    file, seconds, peak: Math.round(peak),
    lead_silence: first / 100,
    trail_silence: (rms.length - 1 - last) / 100,
    final_run: finalRun,
    ends_loud: endsLoud,
    clipped_head: rms[0] > peak * CLIP_HEAD_FRAC,
    head_frac: Math.round((rms[0] / peak) * 1000) / 1000,
    truncated,
    last_real_word_ends: prevEnd,
    trim_to: truncated && prevEnd != null ? Math.round((prevEnd + KEEP_TAIL_S) * 1000) / 1000 : null,
  };
}

const files = readdirSync(DIR).filter((f) => /\.mp3$/i.test(f)).sort();
if (!files.length) { console.error(`error: no mp3s in ${DIR}`); process.exit(2); }

const report = [];
let bad = 0;
console.log(`[vo] ${files.length} file(s) in ${DIR}`);
console.log(`[vo] ${'file'.padEnd(18)} ${'dur'.padStart(8)} ${'lead'.padStart(6)} ${'trail'.padStart(6)}  verdict`);
for (const f of files) {
  const r = inspect(join(DIR, f));
  report.push(r);
  const verdict = r.silent ? 'SILENT'
    : r.truncated ? `TRUNCATED — ends mid-word (${r.final_run.toFixed(2)}s burst); trim to ${r.trim_to}s`
      : r.clipped_head ? 'CLIPPED HEAD — starts mid-word'
        : 'ok';
  if (r.truncated || r.clipped_head || r.silent) bad++;
  console.log(`[vo] ${basename(f).padEnd(18)} ${r.seconds.toFixed(3).padStart(7)}s ${r.lead_silence.toFixed(2).padStart(6)} ${r.trail_silence.toFixed(2).padStart(6)}  ${verdict}`);
}

if (FIX) {
  for (const r of report) {
    if (!r.truncated || r.trim_to == null) continue;
    const src = r.file;
    const tmp = src.replace(/\.mp3$/i, '.trimmed.mp3');
    const keep = src.replace(/\.mp3$/i, '.untrimmed.mp3');
    const x = spawnSync(FFMPEG, ['-y', '-v', 'error', '-i', src, '-t', String(r.trim_to), '-c:a', 'libmp3lame', '-b:a', '128k', tmp], { encoding: 'utf8' });
    if (x.status !== 0) { console.error(`[vo] trim FAILED for ${basename(src)}: ${x.stderr}`); continue; }
    if (!existsSync(keep)) renameSync(src, keep); else unlinkSync(src);
    renameSync(tmp, src);
    console.log(`[vo] trimmed ${basename(src)} to ${r.trim_to}s (original kept as ${basename(keep)})`);
  }
  console.log('[vo] re-run the bake so the manifest and the fit check pick up the new durations');
}

const outPath = join(DIR, 'vo.check.json');
writeFileSync(outPath, `${JSON.stringify({ at: new Date().toISOString(), dir: DIR, gate: GATE, files: report }, null, 2)}\n`);
console.log(`[vo] ${bad} problem file(s) · report → ${outPath}`);
if (bad && !FIX) process.exitCode = 1;
