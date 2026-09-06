#!/usr/bin/env node
/**
 * record-ai-top5.mjs — generate an accurate VIDEO_RECORD for a rendered AI Top 5 daily.
 *
 * Reads the exact rendered content (data.json emitted by make-ai-top5, else the live API) + the
 * rendered .mp4 (probed for size/duration/dims) + the frame budgets in tokens.ts, and writes
 * VIDEO_RECORD.md + VIDEO_RECORD.json. This keeps the companion record CONSISTENT with the video —
 * the daily was going stale because the record wasn't refreshed per render.
 *
 * Usage (from apps/claude-remotion):
 *   node scripts/record-ai-top5.mjs --video out/ai-top5_<date>_ed<ed>.mp4 [--out-dir <dir>]
 *     [--data src/templates/ai_top5/data.json] [--url https://solvx.uk/api/ai-news.json]
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFfprobe } from './ffmpeg-bin.mjs';

const ROOT = process.env.APP_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = join(ROOT, '..', '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };

const VIDEO = resolve(arg('--video', ''));
if (!VIDEO || !existsSync(VIDEO)) { console.error(`error: --video not found: ${VIDEO}`); process.exit(2); }
const OUT_DIR = resolve(arg('--out-dir', join(REPO_ROOT, 'studio/projects/ai-top5/records')));
const DATA_JSON = resolve(arg('--data', join(ROOT, 'src/templates/ai_top5/data.json')));
const URL = arg('--url', 'https://solvx.uk/api/ai-news.json');

const CUE_BY_RANK = { 5: 'At number five this week…', 4: 'In at number four…', 3: 'Number three on the list…', 2: 'And at number two…', 1: 'Which brings us to number one…' };

// ── content: prefer the exact rendered bulletin (data.json); else rebuild from the live API ──
async function getBulletin() {
  if (existsSync(DATA_JSON)) {
    try { return { ...JSON.parse(readFileSync(DATA_JSON, 'utf8')), _src: 'data.json' }; } catch { /* fall through */ }
  }
  const res = await fetch(URL);
  if (!res.ok) { console.error(`[record] no data.json and API ${URL} → HTTP ${res.status}`); process.exit(1); }
  const d = await res.json();
  const raw = Array.isArray(d) ? d : (d.stories || d.items || d.data || []);
  const stories = raw.map((s) => {
    const beats = Array.isArray(s.beats) ? s.beats.slice(0, 2) : [];
    while (beats.length < 2) beats.push('');
    return { n: s.rank, category: String(s.category || 'AI').toUpperCase().replace(/[-_]/g, ' '), cue: CUE_BY_RANK[s.rank] || '', headline: s.headline || s.title || '', beats, takeaway: s.takeaway || '', voiceover: s.voiceover || s.summary || '', vo: null };
  }).sort((a, b) => b.n - a.n);
  return { brand: 'AI TOP 5', tagline: "the day's biggest AI news — counted down", date: d.date || '', edition: typeof d.edition === 'number' ? d.edition : 1, bed: null, intro_vo: null, signoff_vo: null, stories, _src: 'live API' };
}

// ── frame budgets from tokens.ts (authoritative; read, not assumed) ──
function tokenNums() {
  const t = readFileSync(join(ROOT, 'src/templates/ai_top5/tokens.ts'), 'utf8');
  const num = (name, dflt) => { const m = t.match(new RegExp(`export const ${name}\\s*=\\s*(\\d+)`)); return m ? Number(m[1]) : dflt; };
  return {
    FPS: num('FPS', 30), COLD: num('COLD_OPEN_FRAMES', 195), CUE: num('STORY_CUE_FRAMES', 75),
    STINGER: num('STORY_STINGER_FRAMES', 0), // brand-arrival window (0 on pre-arrival tokens)
    REVEAL: num('STORY_REVEAL_FRAMES', 90), BEATS: num('STORY_BEATS_FRAMES', 210),
    EXPLAIN: num('STORY_EXPLAINER_FRAMES', 0), // explainer reading layer (0 on pre-Phase-2 tokens)
    TAKE: num('STORY_TAKEAWAY_FRAMES', 120), SIGNOFF: num('SIGN_OFF_FRAMES', 240),
    // audio-driven budget inputs (design bible V2) — absent on older tokens, defaults keep the
    // old fixed behaviour rather than producing a wrong number.
    TAIL: num('STORY_TAIL_FRAMES', 0), MINEX: num('STORY_MIN_EXPLAINER_FRAMES', 0),
    MAXF: num('STORY_MAX_FRAMES', 99999), BPM: num('BPM', 124),
  };
}

function probe(path) {
  const r = spawnSync(resolveFfprobe(), ['-v', 'error', '-print_format', 'json', '-show_entries', 'format=duration:stream=width,height,avg_frame_rate,codec_type', path], { encoding: 'utf8', timeout: 30000 });
  const out = { duration_s: null, width: null, height: null, fps: null };
  try {
    const jj = JSON.parse(r.stdout || '{}');
    if (jj.format?.duration) out.duration_s = Math.round(parseFloat(jj.format.duration) * 100) / 100;
    const v = (jj.streams || []).find((s) => s.codec_type === 'video');
    if (v) { out.width = v.width; out.height = v.height; if (v.avg_frame_rate?.includes('/')) { const [n, dd] = v.avg_frame_rate.split('/').map(Number); if (dd) out.fps = Math.round(n / dd); } }
  } catch { /* keep nulls */ }
  return out;
}

// The live-API fallback lacks the audio paths (bed / intro_vo / signoff_vo / per-story vo) — those
// are written into data.ts by make-ai-top5 --with-audio. Patch them from data.ts so the audio spine
// matches what actually rendered. (When content came from data.json this is already correct.)
function patchAudioFromDataTs(b) {
  const p = join(ROOT, 'src/templates/ai_top5/data.ts');
  if (!existsSync(p)) return;
  const src = readFileSync(p, 'utf8');
  const field = (name) => {
    const m = src.match(new RegExp(`\\b${name}:\\s*("(?:[^"\\\\]|\\\\.)*"|null)`));
    if (!m) return undefined;
    return m[1] === 'null' ? null : JSON.parse(m[1]);
  };
  const bed = field('bed'); if (bed !== undefined) b.bed = bed;
  const iv = field('intro_vo'); if (iv !== undefined) b.intro_vo = iv;
  const sv = field('signoff_vo'); if (sv !== undefined) b.signoff_vo = sv;
  // per-story `vo:` in file order (#5…#1) == bulletin.stories order.
  const vos = [...src.matchAll(/\bvo:\s*("(?:[^"\\]|\\.)*"|null)/g)].map((m) => (m[1] === 'null' ? null : JSON.parse(m[1])));
  b.stories.forEach((s, i) => { if (vos[i] !== undefined) s.vo = vos[i]; });
}

const bulletin = await getBulletin();
if (bulletin._src === 'live API') patchAudioFromDataTs(bulletin);
const T = tokenNums();
const meta = probe(VIDEO);
const fps = meta.fps || T.FPS;
const storyTotal = T.CUE + T.STINGER + T.REVEAL + T.BEATS + T.EXPLAIN + T.TAKE;

// MIRROR tokens.ts storyFramesFor(). Segment lengths follow the MEASURED voiceover clip, so a record
// built from the static budgets does not describe the video that was rendered. On 2026-08-04 it wrote
// total_frames=3285 with 576f per story while the episode was 3030f with 525f stories — a 255f
// overstatement, in the same file that correctly stored duration_s=101.06 read from the mp4 itself.
// A record that disagrees with its own subject is worse than no record.
const FIXED = T.CUE + T.STINGER + T.REVEAL + T.BEATS;
T.BEAT = Math.round((T.FPS * 60) / (T.BPM || 124));   // tokens.ts BEAT, derived the same way
// STORY_MIN_FRAMES is an expression in tokens.ts, so it cannot be read as a literal — derive it the
// same way tokens does. Reading it directly returned 0, which quietly removed the floor and made the
// record SHORTER than the video instead of longer.
T.MINF = FIXED + T.MINEX;
const storyFramesFor = (voFrames) => {
  if (!voFrames || voFrames <= 0) return storyTotal;
  const want = Math.ceil((voFrames + T.TAIL) / T.BEAT) * T.BEAT;
  const framed = Math.min(T.MAXF, Math.max(T.MINF, want));
  return framed % T.BEAT === 0 ? framed : Math.ceil(framed / T.BEAT) * T.BEAT;
};

// Section timeline.
//
// Each section carries a STABLE, role-based `id` as well as its display name. The name contains
// today's headline and therefore changes every day; the id does not. That is what lets the reviewer
// address a part, and what lets one edition be compared against another — "story-3 was too fast
// again" is only a sentence you can write if #3 has the same handle every day.
/**
 * The VIDEO stream's frame count. `format=duration` is the CONTAINER length — the longest of its
 * streams — and AAC never aligns to a video frame, so it reads a frame or two long on every file
 * and would invent a drift that does not exist. Returns null if the probe cannot answer.
 */
function probeVideoFrames(path) {
  const r = spawnSync(resolveFfprobe(),
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=nb_frames', '-of', 'csv=p=0', path],
    { encoding: 'utf8', timeout: 30000 });
  const n = parseInt(String(r.stdout).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const sections = [{ id: 'cold-open', name: 'Cold open', start: 0, frames: T.COLD }];
let cur = T.COLD;
for (const s of bulletin.stories) {
  const segFrames = storyFramesFor(s.voFrames);
  const explainFrames = Math.max(0, segFrames - FIXED);
  sections.push({ id: `story-${s.n}`, name: `#${s.n} ${s.headline}`, start: cur, frames: segFrames, sub: [
    { name: 'cue', frames: T.CUE }, ...(T.STINGER ? [{ name: 'stinger', frames: T.STINGER }] : []),
    { name: 'reveal', frames: T.REVEAL }, { name: 'beats', frames: T.BEATS },
    ...(explainFrames ? [{ name: 'explainer', frames: explainFrames }] : []), { name: 'takeaway', frames: T.TAKE },
  ] });
  cur += segFrames;
}
sections.push({ id: 'sign-off', name: 'Sign-off', start: cur, frames: T.SIGNOFF });
let totalFrames = cur + T.SIGNOFF;
// THE FILE WINS. tokens.ts can move between the render and the record (it did on 2026-08-04), and a
// record that contradicts its own subject is worse than none. If the computed timeline disagrees with
// the probed duration by more than a frame, say so loudly and report what was actually rendered.
let timelineConfidence = 'exact';
let driftNote = null;
if (meta.duration_s) {
  // The VIDEO STREAM's frame count, not the container duration. A container is as long as its
  // longest stream, and AAC never lands on a video frame boundary, so `format=duration` reads a
  // frame or two long on every file and would fake a drift that isn't there.
  const fileFrames = probeVideoFrames(VIDEO) ?? Math.round(meta.duration_s * fps);
  const drift = fileFrames - totalFrames;
  if (drift !== 0) {
    if (Math.abs(drift) <= T.BEAT) {
      // Small drift: absorb it into the LAST section rather than declaring the whole timeline
      // approximate. Story lengths are derived from measured VO and are exact; a couple of frames
      // at the end is rounding, and writing off six accurate boundaries to describe it is worse
      // than useless — it makes the record unusable for rendering parts.
      const last = sections[sections.length - 1];
      last.frames += drift;
      driftNote = `computed ${totalFrames}f, file ${fileFrames}f; the ${drift > 0 ? '+' : ''}${drift}f `
        + `difference was absorbed into "${last.name}". Earlier boundaries are unchanged and exact.`;
      console.error(`[record] NOTE ${driftNote}`);
      totalFrames = fileFrames;
    } else {
      console.error(`[record] WARN computed timeline ${totalFrames}f but the file is ${fileFrames}f ` +
        `(${meta.duration_s}s @ ${fps}fps). That is more than one beat — tokens.ts has changed since ` +
        `this render. Using the FILE; section boundaries below are APPROXIMATE and the parts should ` +
        `not be rendered from them.`);
      timelineConfidence = 'approximate';
      driftNote = `computed ${totalFrames}f vs file ${fileFrames}f — over one beat of drift.`;
      totalFrames = fileFrames;
    }
  }
}

// Derived fields the reviewer and render-sections.mjs need. Recomputed AFTER any drift absorption
// so `end` and the seconds always agree with `start`/`frames`.
{
  let at = 0;
  for (const sec of sections) {
    sec.start = at;
    sec.end = at + sec.frames;
    sec.label = sec.name;
    sec.seconds = { start: +(at / fps).toFixed(3), end: +((at + sec.frames) / fps).toFixed(3), duration: +(sec.frames / fps).toFixed(3) };
    at = sec.end;
  }
}

const nVo = bulletin.stories.filter((s) => s.vo).length;
const record = {
  // v2: stable section ids + derived end/seconds, so `render-sections.mjs` can cut the edition into
  // its parts and the reviewer can open it. v1 records had names only, which change every day.
  schema: 'video_record_v2',
  project: 'ai-top5',
  composition_id: 'AiTop5',
  version: `${bulletin.date}-ed${bulletin.edition}`,
  dimensions: { width: meta.width, height: meta.height },
  duration: { frames: totalFrames, seconds: +(totalFrames / fps).toFixed(3) },
  timeline_confidence: timelineConfidence,
  drift_note: driftNote,
  output: { file: VIDEO, bytes: statSync(VIDEO).size, rendered: new Date().toISOString().slice(0, 10) },
  generated_at: new Date().toISOString(),
  generated_by: 'record-ai-top5.mjs',
  content_source: bulletin._src,
  video: { file: VIDEO, size_bytes: statSync(VIDEO).size, duration_s: meta.duration_s, width: meta.width, height: meta.height, fps },
  composition: 'AiTop5Composition',
  data_feed: { date: bulletin.date, edition: bulletin.edition, brand: bulletin.brand, tagline: bulletin.tagline },
  total_frames: totalFrames,
  stories: bulletin.stories.map((s) => ({ n: s.n, category: s.category, headline: s.headline, beats: s.beats, takeaway: s.takeaway, cue: s.cue })),
  audio: { bed: bulletin.bed, intro_vo: bulletin.intro_vo, signoff_vo: bulletin.signoff_vo, per_story_vo: nVo },
  sections,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'VIDEO_RECORD.json'), JSON.stringify(record, null, 2), 'utf8');

const f2s = (f) => (f / fps).toFixed(1);
const md = [
  `# VIDEO_RECORD — AI Top 5 · ${bulletin.date} · edition ${bulletin.edition}`,
  '',
  `Auto-generated by \`record-ai-top5.mjs\` from the rendered file + ${bulletin._src}. Frames @ ${fps}fps; seconds derived. Kept consistent with THIS render.`,
  '',
  '## 0. Metadata',
  '| Field | Value |', '|---|---|',
  `| Video file | \`${basename(VIDEO)}\` |`,
  `| File size | ${(record.video.size_bytes / 1e6).toFixed(1)} MB |`,
  `| Composition | \`AiTop5Composition\` |`,
  `| Dimensions | ${meta.width} × ${meta.height} |`,
  `| FPS | ${fps} |`,
  `| Duration | ${totalFrames} frames = ${f2s(totalFrames)} s (file: ${meta.duration_s}s) |`,
  `| Data feed | date ${bulletin.date}, edition ${bulletin.edition}, brand "${bulletin.brand}" |`,
  `| Audio | bed=${bulletin.bed ? 'yes' : 'no'} · intro=${bulletin.intro_vo ? 'yes' : 'no'} · sign-off=${bulletin.signoff_vo ? 'yes' : 'no'} · per-story VO ${nVo}/${bulletin.stories.length} |`,
  '',
  "## 1. Content — today's five (countdown order)",
  '| # | Category | Headline | Takeaway |', '|---|---|---|---|',
  ...bulletin.stories.map((s) => `| ${s.n} | ${s.category} | ${s.headline} | ${s.takeaway} |`),
  '',
  '### Beats per story',
  ...bulletin.stories.flatMap((s) => [`- **#${s.n} ${s.headline}**`, ...s.beats.filter(Boolean).map((b) => `  - ${b}`)]),
  '',
  '## 2. Section timeline',
  '| Section | Start (f) | End (f) | Start (s) | Frames |', '|---|---|---|---|---|',
  ...sections.map((sec) => `| ${sec.name} | ${sec.start} | ${sec.start + sec.frames} | ${f2s(sec.start)} | ${sec.frames} |`),
  '',
  '## 3. Audio spine',
  `- bed: \`${bulletin.bed || '(none)'}\``,
  `- intro VO: \`${bulletin.intro_vo || '(none)'}\` · sign-off VO: \`${bulletin.signoff_vo || '(none)'}\``,
  `- per-story VO: ${bulletin.stories.map((s) => `#${s.n}=${s.vo || 'none'}`).join(' · ')}`,
  '',
].join('\n');
writeFileSync(join(OUT_DIR, 'VIDEO_RECORD.md'), md, 'utf8');

console.log(`[record] ✔ VIDEO_RECORD.{md,json} → ${OUT_DIR}`);
console.log(`[record] ${bulletin.date} ed${bulletin.edition} · ${totalFrames}f/${f2s(totalFrames)}s · content from ${bulletin._src}`);
