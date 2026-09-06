#!/usr/bin/env node
/**
 * render-sections.mjs — render a composition AS ITS PARTS, and mark each part as it is produced.
 *
 *   node scripts/render-sections.mjs --record <VIDEO_RECORD.json> [--only <id,id>] [--concurrency 3]
 *
 * WHY THIS EXISTS — and why the previous approach was backwards.
 *
 * These videos are BUILT from sections. `PromoTV.tsx` is literally a `<Series>` of thirteen of them,
 * and the composition knows every part's identity and frame range while it renders. The first pass
 * at a reviewer threw that away — rendered one monolithic mp4, then tried to recover the structure
 * afterwards by deriving a timeline, seeking stills back out of the file, scoring frames to guess
 * which one represented a section, and guarding against the derived timeline disagreeing with the
 * video. Every one of those mechanisms existed only to undo the information loss at render time.
 *
 * So: render the parts. A section is a FILE. Its identity is not inferred, its boundaries cannot
 * drift from the video because they ARE the video, and a reviewer just lists files. The stills
 * heuristic, the drift guard and the timeline-confidence flag all stop being load-bearing.
 *
 * The record is updated AFTER EACH PART, not at the end. If this dies halfway the record says
 * exactly which parts exist — a half-finished render is visible instead of silent.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFfprobe } from './ffmpeg-bin.mjs';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);

const recordPath = resolve(arg('--record', ''));
if (!recordPath || !existsSync(recordPath)) {
  console.error('error: --record <VIDEO_RECORD.json> is required and must exist');
  process.exit(2);
}
const record = JSON.parse(readFileSync(recordPath, 'utf8'));
const comp = record.composition_id;
const fps = record.fps || 30;
const sections = record.sections || [];
if (!comp) { console.error('error: record has no composition_id'); process.exit(2); }
if (!sections.length || !sections[0].id) {
  console.error('error: record needs sections[] with ids (v2)');
  process.exit(2);
}

const only = (arg('--only', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const concurrency = arg('--concurrency', '3');
const outDir = join(APP, 'out', 'sections', comp);
mkdirSync(outDir, { recursive: true });

// Probe the VIDEO STREAM's frame count, not the container duration.
//
// format=duration is the CONTAINER length, which is max(video, audio) — and an AAC track never
// lines up with a video frame boundary (1024-sample frames), so it reads ~2 frames long every time.
// Both test sections came back "declared 120 got 122" and "declared 180 got 182", which looked like
// an off-by-two in the frame range and was not: the video streams were exactly 120 and 180.
// Measuring the wrong thing produces a mismatch report that sends you hunting a bug that isn't there.
const probeFrames = (f) => {
  const r = spawnSync(resolveFfprobe(), ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=nb_frames', '-of', 'csv=p=0', f], { encoding: 'utf8', timeout: 30000 });
  const n = parseInt(String(r.stdout).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const save = () => writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);

const todo = sections.filter((s) => !only.length || only.includes(s.id));
console.log(`[sections] ${comp} · ${todo.length} part${todo.length === 1 ? '' : 's'} -> out/sections/${comp}/`);

let ok = 0;
for (const s of todo) {
  const dest = join(outDir, `${s.id}.mp4`);
  // --frames is INCLUSIVE at both ends, so the last frame of a section is end-1: a section running
  // [start, end) in the record is [start, end-1] here. Off by one and every part overlaps the next.
  const range = `${s.start}-${s.end - 1}`;
  const t0 = Date.now();
  const r = spawnSync('npx', ['remotion', 'render', comp, dest,
    `--frames=${range}`, `--concurrency=${concurrency}`],
    { encoding: 'utf8', cwd: APP, timeout: 900000, shell: true });

  if (r.status !== 0 || !existsSync(dest)) {
    console.error(`[sections] ${s.id}: FAILED — ${(r.stderr || r.stdout || '').slice(-200)}`);
    s.render = { status: 'failed', at: new Date().toISOString() };
    save();
    continue;
  }

  const actual = probeFrames(dest);
  const bytes = statSync(dest).size;
  const secs = ((Date.now() - t0) / 1000).toFixed(0);

  // The part is only "produced" if it is the length it claimed. This is the check the monolithic
  // approach could never make cheaply, and it is now free: the file either has the frames or it does
  // not. A mismatch is recorded rather than swallowed.
  const matches = actual != null && Math.abs(actual - s.frames) <= 1;
  s.render = {
    status: matches ? 'produced' : 'length-mismatch',
    file: `out/sections/${comp}/${s.id}.mp4`,
    frames_declared: s.frames,
    frames_actual: actual,
    bytes,
    range,
    at: new Date().toISOString(),
  };
  save();

  console.log(`[sections] ${s.id.padEnd(17)} ${String(s.frames).padStart(4)}f  ` +
    `${(bytes / 1048576).toFixed(1).padStart(5)} MB  ${secs.padStart(3)}s  ` +
    (matches ? 'produced' : `LENGTH MISMATCH declared ${s.frames} got ${actual}`));
  if (matches) ok++;
}

record.sections_rendered = {
  at: new Date().toISOString(),
  dir: `out/sections/${comp}`,
  produced: ok,
  of: sections.length,
};
save();

console.log(`[sections] ${ok}/${todo.length} produced · record updated after each part`);
process.exitCode = ok === todo.length ? 0 : 1;
