#!/usr/bin/env node
/**
 * broadcast-conform.mjs — conform any MP4 to the SPLITFIRE broadcast interstitial spec.
 *
 * The stream/feed re-encodes and holds the last frame, so every interstitial we deliver has to be a
 * dead-clean, constant-frame-rate, loudness-normalised MP4 with a keyframe on frame 0 — otherwise the
 * cut-in flashes and the break jumps in volume. This tool enforces the spec (§2 of
 * 4-player-shooter/docs/BROADCAST-MEDIA-SPEC.md) EXACTLY so produced files "just work":
 *
 *   Video : H.264 High, yuv420p, 1920x1080, CFR 30fps, ~10 Mbps VBV-capped, ~2s GOP, IDR on frame 0.
 *   Audio : AAC stereo 48 kHz, normalised to -16 LUFS integrated / true-peak <= -1 dBTP via a
 *           TWO-PASS loudnorm (pass 1 measures, pass 2 applies the measured values for accuracy).
 *           No / near-silent audio -> a proper silent AAC 48k stereo track is added instead (running
 *           loudnorm on silence produces garbage).
 *   Poster: <name>-poster.jpg (first frame, 1920x1080) so the feed has no black flash while buffering.
 *
 * Uses the ffmpeg/ffprobe the render app already bundles (no separate install) via ffmpeg-bin.mjs.
 *
 * Usage:
 *   node studio/tools/broadcast-conform.mjs <in.mp4> --out <out.mp4>
 */
import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve, basename, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Resolve the bundled ffmpeg/ffprobe from the render app (studio tools carry no ffmpeg of their own).
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const APP_ROOT = join(REPO_ROOT, 'apps', 'claude-remotion');
process.env.APP_ROOT = process.env.APP_ROOT || APP_ROOT;
const { resolveFfmpeg, resolveFfprobe } = await import(
  pathToFileURL(join(APP_ROOT, 'scripts', 'ffmpeg-bin.mjs')).href
);
const FFMPEG = resolveFfmpeg();
const FFPROBE = resolveFfprobe();

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
// First bare token that is neither a flag nor a flag's value is the input file.
const positional = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const IN = resolve(positional || '');
const OUT = resolve(arg('--out', ''));

if (!IN || !existsSync(IN)) { console.error(`error: input mp4 not found: ${IN || '(none)'}`); process.exit(2); }
if (!OUT) { console.error('error: --out <out.mp4> required'); process.exit(2); }

const POSTER = join(dirname(OUT), basename(OUT, extname(OUT)) + '-poster.jpg');

// ── target spec (§2) ──
const W = 1920, H = 1080, FPS = 30;
// NB: the render app's bundled ffmpeg is a stripped build — no `setsar`/`volumedetect`. We enforce
// pixel format in the filtergraph (`format=yuv420p`) and via -pix_fmt; source is already SAR 1:1.
const VIDEO_ARGS = [
  '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
  // Remotion renders FULL-range (yuvj420p). Convert to LIMITED (tv) range so the encoder tags the
  // stream yuv420p, not yuvj420p — the spec is explicit about yuv420p.
  '-vf', `scale=${W}:${H}:flags=lanczos:in_range=full:out_range=tv,format=yuv420p`,
  '-color_range', 'tv',
  '-r', String(FPS), '-fps_mode', 'cfr',         // constant frame rate (was -vsync cfr)
  '-b:v', '10M', '-maxrate', '12M', '-bufsize', '24M',
  '-g', '60', '-keyint_min', '60', '-sc_threshold', '0', // ~2s fixed GOP; x264 emits an IDR at frame 0
];
const AUDIO_ARGS = ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2'];

function run(bin, args, { capture = false } = {}) {
  const r = spawnSync(bin, args, { encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 26 });
  if (r.error) throw r.error;
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// ── probe: does the input have an audio stream at all? ──
function hasAudioStream() {
  const r = run(FFPROBE, ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'json', IN], { capture: true });
  try { return (JSON.parse(r.stdout || '{}').streams || []).length > 0; } catch { return false; }
}

// ── pass 1: measure loudness. Doubles as the near-silence guard — if the measured integrated
// loudness is non-finite or below ~-60 LUFS, the track is effectively silent and must NOT be
// loudnorm'd (it would try to lift the noise floor to -16 LUFS = garbage). Returns null if silent.
function measureLoudness() {
  const r = run(FFMPEG, [
    '-hide_banner', '-i', IN,
    '-af', 'loudnorm=I=-16:TP=-1:LRA=11:print_format=json',
    '-vn', '-sn', '-f', 'null', '-',
  ], { capture: true });
  // loudnorm prints its JSON block last on stderr.
  const start = r.stderr.lastIndexOf('{');
  const end = r.stderr.lastIndexOf('}');
  if (start < 0 || end < 0 || end < start) throw new Error('loudnorm pass-1 JSON not found in ffmpeg output');
  const m = JSON.parse(r.stderr.slice(start, end + 1));
  const ii = parseFloat(m.input_i);
  if (!Number.isFinite(ii) || ii <= -60) return null; // effectively silent
  return m;
}

console.log(`[conform] in : ${IN}`);
console.log(`[conform] out: ${OUT}`);
console.log(`[conform] ffmpeg: ${FFMPEG}`);

const measured = hasAudioStream() ? measureLoudness() : null;
const audioReal = measured !== null;

if (audioReal) {
  console.log('[conform] audio: real signal detected — running two-pass loudnorm');
  console.log('[conform] loudnorm PASS-1 measured:');
  console.log(`[conform]   input_i     (LUFS)  = ${measured.input_i}`);
  console.log(`[conform]   input_tp    (dBTP)  = ${measured.input_tp}`);
  console.log(`[conform]   input_lra   (LU)    = ${measured.input_lra}`);
  console.log(`[conform]   input_thresh(LUFS)  = ${measured.input_thresh}`);
  console.log(`[conform]   target_offset(LU)   = ${measured.target_offset}`);

  const loud = [
    'loudnorm=I=-16:TP=-1:LRA=11',
    `measured_I=${measured.input_i}`,
    `measured_TP=${measured.input_tp}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset}`,
    'linear=true:print_format=summary',
  ].join(':');

  const r = run(FFMPEG, [
    '-y', '-i', IN,
    '-map', '0:v:0', '-map', '0:a:0',
    ...VIDEO_ARGS,
    '-af', loud,
    ...AUDIO_ARGS,
    '-movflags', '+faststart',
    OUT,
  ], { capture: true });
  if (r.code !== 0) { console.error(r.stderr.slice(-2000)); process.exit(1); }
} else {
  console.log('[conform] audio: none / near-silent — adding a proper silent AAC 48k stereo track');
  const r = run(FFMPEG, [
    '-y', '-i', IN,
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-map', '0:v:0', '-map', '1:a:0', '-shortest',
    ...VIDEO_ARGS,
    ...AUDIO_ARGS,
    '-movflags', '+faststart',
    OUT,
  ], { capture: true });
  if (r.code !== 0) { console.error(r.stderr.slice(-2000)); process.exit(1); }
}

// ── poster: first frame of the conformed output ──
{
  const r = run(FFMPEG, ['-y', '-ss', '0', '-i', OUT, '-frames:v', '1', '-vf', `scale=${W}:${H}`, '-q:v', '2', POSTER], { capture: true });
  if (r.code !== 0) { console.error('[conform] poster write failed:\n' + r.stderr.slice(-1000)); }
}

// ── final ffprobe summary ──
function summarise(path) {
  const r = run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path], { capture: true });
  const j = JSON.parse(r.stdout || '{}');
  const v = (j.streams || []).find((s) => s.codec_type === 'video') || {};
  const a = (j.streams || []).find((s) => s.codec_type === 'audio') || {};
  const fr = v.r_frame_rate && v.r_frame_rate.includes('/')
    ? (() => { const [n, d] = v.r_frame_rate.split('/').map(Number); return d ? n / d : null; })()
    : null;
  return {
    duration_s: j.format?.duration ? Math.round(parseFloat(j.format.duration) * 100) / 100 : null,
    bitrate_kbps: j.format?.bit_rate ? Math.round(Number(j.format.bit_rate) / 1000) : null,
    video: { codec: v.codec_name, profile: v.profile, pix_fmt: v.pix_fmt, w: v.width, h: v.height, fps: fr },
    audio: { codec: a.codec_name, sample_rate: a.sample_rate, channels: a.channels, layout: a.channel_layout },
  };
}

const sum = summarise(OUT);
console.log('[conform] ── final ffprobe summary ──');
console.log(`[conform]   file      : ${OUT} (${(statSync(OUT).size / 1024 / 1024).toFixed(2)} MB)`);
console.log(`[conform]   duration  : ${sum.duration_s}s  bitrate ~${sum.bitrate_kbps} kbps`);
console.log(`[conform]   video     : ${sum.video.codec} ${sum.video.profile} ${sum.video.pix_fmt} ${sum.video.w}x${sum.video.h} @ ${sum.video.fps}fps`);
console.log(`[conform]   audio     : ${sum.audio.codec} ${sum.audio.sample_rate}Hz ${sum.audio.channels}ch (${sum.audio.layout})`);
console.log(`[conform]   poster    : ${existsSync(POSTER) ? POSTER : '(FAILED)'}`);

// Spec conformance gate (report; non-zero exit if a hard field is wrong).
// This ffmpeg build reports the H.264 profile numerically: profile_idc 100 === "High".
const isHigh = /high/i.test(sum.video.profile || '') || String(sum.video.profile) === '100';
const ok =
  sum.video.codec === 'h264' && isHigh && sum.video.pix_fmt === 'yuv420p' &&
  sum.video.w === W && sum.video.h === H && Math.round(sum.video.fps) === FPS &&
  sum.audio.codec === 'aac' && String(sum.audio.sample_rate) === '48000' && sum.audio.channels === 2;
console.log(`[conform] ${ok ? '[OK] conforms to spec §2' : '[WARN] output does not fully conform — check summary above'}`);
process.exit(ok ? 0 : 1);
