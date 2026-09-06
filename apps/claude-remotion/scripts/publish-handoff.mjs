#!/usr/bin/env node
// publish-handoff.mjs — the OUTGOING publish bridge: project-bright → socials-studio.
//
// Takes a finished render and drops a self-contained handoff package
// (video.mp4 + thumb.jpg + publish.json, schema `finished_video_publish_v1`) into
// <socials-studio>/handoffs/incoming/<id>/. socials-studio's `ingest_handoffs.py` picks it up
// into its post queue for HUMAN SIGN-OFF. This never publishes — it delivers.
//
// Contract: studio/contracts/finished_video_publish_v1.md
//
// Usage (from apps/claude-remotion):
//   node scripts/publish-handoff.mjs                         # newest out/ai-top5*.mp4 → handoff
//   node scripts/publish-handoff.mjs --video out/x.mp4       # explicit render
//   node scripts/publish-handoff.mjs --dry-run               # build publish.json, print, write nothing
//   node scripts/publish-handoff.mjs --dest "/path/to/socials-studio"   # destination root
//
// Destination root: --dest, else $SOCIALS_STUDIO_DIR. There is no default — the handoff target
// is a separate repo whose location is per-machine, so one of the two must be given.

import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync,
  statSync, copyFileSync, linkSync, rmSync,
} from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFfmpeg, resolveFfprobe } from './ffmpeg-bin.mjs';
import { scoreFrames, pickFrame, spread } from './frame-score.mjs';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOCIALS = process.env.SOCIALS_STUDIO_DIR || '';

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);
const DRY = has('--dry-run');
const PIPELINE = arg('--pipeline', 'ai-top5');
// audience = WHOSE channels this publishes to. "own" → solvX's accounts (the socials-studio bridge
// posts it). "client" → a client's video; it must NEVER be posted to solvX — the ingest segregates
// it as a deliverable. A build-in-public showcase of client work is still "own" (posts to solvX),
// with `--client <name>` naming the subject.
const AUDIENCE = arg('--audience', 'own');
const CLIENT = arg('--client', '');
// If this video was commissioned by a socials-studio production request, carry its id so the
// delivery maps back to the campaign (video_production_request_v1 loop closure).
const REQUEST_ID = arg('--request-id', '');
// Distinguish format/variant deliverables of the SAME edition (e.g. a 9:16 Reel vs the 16:9 cut) so
// they don't collide on one handoff id. Appended to the derived id: ai-top5-20260706-ed1-vertical.
const ID_SUFFIX = arg('--id-suffix', '').replace(/[^A-Za-z0-9._-]/g, '-');
// video_production_request_v1 (v2) grouping keys — which requested output this file fulfils, its role
// in the hub-and-spoke set, and (for a spoke) the hero output_id it promotes. Let socials-studio group
// a request's deliverables and route each to the right platforms + campaign-folder output.
const OUTPUT_ID = arg('--output-id', '');
const ROLE = arg('--role', '');
const PROMOTES = arg('--promotes', '');
const DEST_RAW = arg('--dest', DEFAULT_SOCIALS);
// Guard before resolve(): resolve('') silently returns the CURRENT directory, so an unset
// destination would write the handoff into the repo instead of failing.
if (!DEST_RAW) {
  console.error('error: no handoff destination. Pass --dest <path>, or set SOCIALS_STUDIO_DIR.');
  console.error('       This is the root of the separate repo that receives publish handoffs;');
  console.error('       its location is per-machine, so there is deliberately no default.');
  process.exit(2);
}
const DEST_ROOT = resolve(DEST_RAW);
if (!['own', 'client'].includes(AUDIENCE)) {
  console.error(`error: --audience must be "own" or "client" (got "${AUDIENCE}").`);
  process.exit(2);
}
if (ROLE && !['hero', 'spoke', 'equal'].includes(ROLE)) {
  console.error(`error: --role must be "hero", "spoke", or "equal" (got "${ROLE}").`);
  process.exit(2);
}

// ── locate the render ───────────────────────────────────────────────────────────
function newestRender() {
  const outDir = join(APP_ROOT, 'out');
  if (!existsSync(outDir)) return null;
  const mp4s = readdirSync(outDir)
    .filter((f) => f.startsWith(PIPELINE) && f.endsWith('.mp4'))
    .map((f) => join(outDir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return mp4s[0] || null;
}
const videoPath = resolve(arg('--video', '') || newestRender() || '');
if (!videoPath || !existsSync(videoPath)) {
  console.error(`error: no render found. Pass --video <path> or render an ai-top5 mp4 into out/ first.`);
  process.exit(2);
}

// ── read the bulletin (best-effort) so we can seed title/description/rundown ──────
// data.ts is regenerated from an external news API, so its strings are UNTRUSTED — we must not
// eval it. Instead pull only the fields we need with targeted regex, and unescape each captured
// value with JSON.parse (which parses a string literal only, never executes code).
function readBulletin() {
  // Prefer data.json — the exact rendered bulletin, plain JSON (safe to parse), and richer than data.ts:
  // it carries per-story `source` (outlet) + `url` (article link) for the description credits.
  const dataJson = join(APP_ROOT, 'src', 'templates', 'ai_top5', 'data.json');
  if (existsSync(dataJson)) {
    try {
      const d = JSON.parse(readFileSync(dataJson, 'utf8'));
      const stories = (d.stories || []).map((s) => ({ n: s.n, category: s.category, headline: s.headline, source: s.source || '', url: s.url || '' }));
      if (d.date || stories.length) return { date: d.date || null, tagline: d.tagline || null, edition: typeof d.edition === 'number' ? d.edition : null, stories };
    } catch (e) { console.warn(`warn: data.json unreadable (${e.message}); falling back to data.ts`); }
  }
  const dataTs = join(APP_ROOT, 'src', 'templates', 'ai_top5', 'data.ts');
  if (!existsSync(dataTs)) return null;
  try {
    const src = readFileSync(dataTs, 'utf8');
    const QUOTED = '("(?:[^"\\\\]|\\\\.)*")'; // a JSON string literal, quotes included
    const strLit = (re) => { const m = src.match(re); return m ? JSON.parse(m[1]) : null; };
    const date = strLit(new RegExp(`\\bdate:\\s*${QUOTED}`));
    const tagline = strLit(new RegExp(`\\btagline:\\s*${QUOTED}`));
    const em = src.match(/\bedition:\s*(\d+)/);
    const edition = em ? Number(em[1]) : null;
    const stories = [];
    const sre = new RegExp(`\\bn:\\s*(\\d+),[\\s\\S]*?category:\\s*${QUOTED}[\\s\\S]*?headline:\\s*${QUOTED}`, 'g');
    let mm;
    while ((mm = sre.exec(src)) !== null) {
      stories.push({ n: Number(mm[1]), category: JSON.parse(mm[2]), headline: JSON.parse(mm[3]) });
    }
    if (!date && !stories.length) return null;
    return { date, tagline, edition, stories };
  } catch (e) {
    console.warn(`warn: could not parse data.ts bulletin (${e.message}); using generic metadata.`);
    return null;
  }
}
const bulletin = readBulletin();

// ── probe the video ──────────────────────────────────────────────────────────────
function probe(path) {
  const r = spawnSync(resolveFfprobe(), [
    '-v', 'error', '-print_format', 'json',
    '-show_entries', 'format=duration:stream=width,height,avg_frame_rate,codec_type',
    path,
  ], { encoding: 'utf8', timeout: 30000 });
  const out = { duration_s: null, width: 1920, height: 1080, fps: 30 };
  try {
    const j = JSON.parse(r.stdout || '{}');
    if (j.format?.duration) out.duration_s = Math.round(parseFloat(j.format.duration) * 10) / 10;
    const v = (j.streams || []).find((s) => s.codec_type === 'video');
    if (v) {
      out.width = v.width || out.width;
      out.height = v.height || out.height;
      if (v.avg_frame_rate && v.avg_frame_rate.includes('/')) {
        const [n, d] = v.avg_frame_rate.split('/').map(Number);
        if (d) out.fps = Math.round(n / d);
      }
    }
  } catch { /* keep defaults */ }
  return out;
}
const meta = probe(videoPath);

// ── metadata seeds ────────────────────────────────────────────────────────────────
function humanDate(iso) {
  // "2026-07-03" -> "3 July 2026" (deterministic, no locale surprises)
  const M = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return iso || 'today';
  return `${Number(m[3])} ${M[Number(m[2]) - 1]} ${m[1]}`;
}
// Optional generic-video inputs (for ANY non-ai-top5 pipeline): a brand.json + explicit title/desc.
const BRAND = (() => {
  const p = arg('--brand', '');
  if (!p || !existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
})();
const TITLE_ARG = arg('--title', '');
const DESC_ARG = arg('--desc', '');

let id, title, description, tags, rundown, hubUrl, platforms;
if (PIPELINE === 'ai-top5' && bulletin) {
  const date = bulletin.date || (basename(videoPath).match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? '');
  const edition = bulletin.edition ?? null;
  id = `${PIPELINE}-${(date || 'nodate').replace(/-/g, '')}${edition ? `-ed${edition}` : ''}`;
  rundown = (bulletin.stories || []).map((s) => ({ n: s.n, headline: s.headline, category: s.category, source: s.source || null, url: s.url || null }));
  title = `AI Top 5 — ${humanDate(date)}${edition ? ` (Edition ${edition})` : ''}`;
  const byRank = rundown.slice().sort((a, b) => b.n - a.n);
  const rundownLines = byRank.length ? byRank.map((s) => `#${s.n} ${s.headline}`).join('\n') : '';
  // Source credits for the YouTube description — link each story back to its outlet (only when a url exists).
  const sourceLines = byRank.filter((s) => s.url).map((s) => `#${s.n} ${s.headline} — ${s.source || 'source'}: ${s.url}`).join('\n');
  description = [
    bulletin.tagline || "The day's biggest AI news — counted down.",
    rundownLines,
    sourceLines ? `Sources:\n${sourceLines}` : null,
    '▶ solvx.uk — build-in-public. Tell us what you think in the comments: which story surprised you?',
    '#AI #buildinpublic',
  ].filter(Boolean).join('\n\n');
  tags = [...new Set(['AI', 'AInews', 'buildinpublic', 'artificialintelligence', 'tech',
    ...rundown.map((s) => (s.category || '').toLowerCase()).filter(Boolean)])];
  hubUrl = 'https://solvx.uk';
  const topStory = rundown.find((s) => s.n === 1);
  const hook = topStory ? `Today's #1: ${topStory.headline}.` : title;
  platforms = [
    { platform: 'youtube',   enabled: true,  suggested_caption: `${title}\n\n${description}` },
    { platform: 'twitter',   enabled: true,  suggested_caption: `${hook} Today's AI top 5, counted down. ▶ solvx.uk #buildinpublic`.slice(0, 280) },
    { platform: 'bluesky',   enabled: true,  suggested_caption: `${hook} Today's AI top 5, counted down. ▶ solvx.uk #buildinpublic`.slice(0, 300) },
    { platform: 'instagram', enabled: true,  suggested_caption: `AI Top 5 — the day's biggest AI news, counted down. ${hook} ▶ link in bio` },
    { platform: 'linkedin',  enabled: false, suggested_caption: `${title}. ${hook} A daily, auto-produced AI news countdown — built in public at solvx.uk.` },
  ];
} else {
  // Generic finished-video handoff (any pipeline). Metadata from --title / --desc + optional --brand.json.
  const stem = basename(videoPath).replace(/\.[^.]+$/, '');
  id = (stem.startsWith(PIPELINE) ? stem : `${PIPELINE}-${stem}`).replace(/[^A-Za-z0-9._-]/g, '-');
  const brandName = BRAND?.brand || '';
  title = TITLE_ARG || brandName || stem;
  const website = BRAND?.contact?.website || '';
  const ig = BRAND?.contact?.instagram || '';
  const cta = [website, ig].filter(Boolean).join('  ·  ');
  description = DESC_ARG || [BRAND?.description, cta].filter(Boolean).join('\n\n') || title;
  tags = [...new Set([...(brandName ? [brandName.toLowerCase()] : []), 'promo', 'video'])];
  rundown = [];
  hubUrl = website ? (website.startsWith('http') ? website : `https://${website}`) : 'https://solvx.uk';
  const hook = title;
  platforms = [
    { platform: 'youtube',   enabled: true,  suggested_caption: `${title}\n\n${description}` },
    { platform: 'twitter',   enabled: true,  suggested_caption: `${hook}${cta ? `  ${cta}` : ''}`.slice(0, 280) },
    { platform: 'bluesky',   enabled: true,  suggested_caption: `${hook}${cta ? `  ${cta}` : ''}`.slice(0, 300) },
    { platform: 'instagram', enabled: true,  suggested_caption: `${title}${BRAND?.description ? ` — ${BRAND.description}` : ''}${ig ? `  ${ig}` : ''}` },
    { platform: 'linkedin',  enabled: false, suggested_caption: `${title}. ${BRAND?.description || ''}`.trim() },
  ];
}

if (ID_SUFFIX) id = `${id}-${ID_SUFFIX}`;

const publish = {
  schema: 'finished_video_publish_v1',
  version: 1,
  id,
  produced_at: new Date().toISOString(),
  status: 'pending_review',
  audience: AUDIENCE,          // own = post to solvX | client = deliver to client, never post to solvX
  client: CLIENT || null,      // subject/client name (for a showcase or a client deliverable)
  request_id: REQUEST_ID || null, // the video_production_request_v1 id this delivers (loop closure), or null
  output_id: OUTPUT_ID || null,   // which requested output[] this file fulfils (e.g. "ig-spoke"), or null
  role: ROLE || null,             // hero | spoke | equal — its place in the hub-and-spoke set, or null
  promotes: PROMOTES || null,     // for a spoke: the hero output_id it promotes, or null
  source: { app: 'project-bright', pipeline: PIPELINE, render_path: videoPath },
  video: { file: 'video.mp4', duration_s: meta.duration_s, width: meta.width, height: meta.height, fps: meta.fps },
  thumbnail: null, // set below if produced
  title,
  description,
  tags,
  hub_url: hubUrl,
  rundown,
  platforms,
};

if (DRY) {
  console.log('── DRY RUN — publish.json that WOULD be written ──');
  console.log(JSON.stringify(publish, null, 2));
  console.log(`\n(destination would be: ${join(DEST_ROOT, 'handoffs', 'incoming', id)})`);
  process.exit(0);
}

// ── write the handoff package ─────────────────────────────────────────────────────
if (!existsSync(DEST_ROOT)) {
  console.error(`error: socials-studio not found at ${DEST_ROOT}. Set --dest or $SOCIALS_STUDIO_DIR.`);
  process.exit(2);
}
const pkgDir = join(DEST_ROOT, 'handoffs', 'incoming', id);
mkdirSync(pkgDir, { recursive: true });

// video: hardlink if same volume (no extra space, self-contained), else copy.
const destVideo = join(pkgDir, 'video.mp4');
if (existsSync(destVideo)) rmSync(destVideo);
try {
  linkSync(videoPath, destVideo);
} catch {
  copyFileSync(videoPath, destVideo);
}

// ── thumbnail ────────────────────────────────────────────────────────────────
// PICK THE FRAME ON CONTENT, NOT ON A PERCENTAGE.
//
// This used to grab a poster frame at a fixed 40% of duration. On the AI Top 5 hero that landed
// three frames inside story #3's CUE — the blank "AI TOP 5 · LIVE" television with nothing on its
// screen. 3900 frames × 0.4 = 1560, and story #3 began at 1557. Pure arithmetic coincidence, and it
// held for 19 consecutive deliveries (2026-07-16 → 08-03); two days even shipped byte-identical
// thumbnails. socials-studio discarded every one of them and re-extracted downstream. Reported by
// them 2026-08-03 — the giveaway was "#3 · <CATEGORY> · CUE" printed in the corner of every thumb.
//
// A fixed fraction cannot know where the interstitials are, and it silently re-aims itself whenever
// the runtime changes — the same 40% now lands somewhere else entirely on the 3075-frame cut. So
// sample several candidates and keep the one with the most going on: brightness rejects fades,
// black frames and the dark interstitials, and stddev rejects flat holds. Ties break LATE, because
// on a countdown the later frames carry the higher-ranked stories.
//
// --thumb-at <seconds> forces an exact frame when a pipeline knows better than this heuristic.
const destThumb = join(pkgDir, 'thumb.jpg');
const thumbAtArg = (() => { const i = process.argv.indexOf('--thumb-at'); return i >= 0 ? Number(process.argv[i + 1]) : null; })();
const dur = meta.duration_s || 0;

// Candidate scoring lives in ./frame-score.mjs so this and export-section-stills.mjs ask the
// question the same way. See that file for why it round-trips through tiny JPEGs and PIL.

let seek;
if (Number.isFinite(thumbAtArg)) {
  seek = Math.max(0, thumbAtArg);
  console.log(`  thumb: forced to t=${seek.toFixed(1)}s (--thumb-at)`);
} else if (dur > 6) {
  // Candidates across the middle of the video: never the opening (fade-in / titles) and never the
  // tail (sign-off / end card), both of which are exactly what a percentage tends to find.
  // hi 0.88, not 0.92. On 2026-08-04 the pick landed at 93.0s of a 101.1s episode — inside story #1,
  // but only 30 frames before the sign-off began. The frame was good; the margin was not. Every story
  // clamping to the floor shortens the episode without moving the sign-off, so 0.92 drifts toward it.
  const lo = dur * 0.25, hi = dur * 0.88;
  const N = 9;
  const cands = scoreFrames(videoPath, spread(lo, hi, N), join(pkgDir, '.thumbcand'));
  const best = pickFrame(cands);
  if (best) {
    seek = best.t;
    console.log(`  thumb: picked t=${seek.toFixed(1)}s (mean ${best.avg.toFixed(1)}, sd ${best.std.toFixed(1)}) ` +
                `from ${(cands || []).length} candidates`);
  } else {
    // 0.70, not 0.40. The old 0.40 is what put 19 consecutive thumbnails on an interstitial; on a
    // countdown the back half carries the higher-ranked stories, and 0.70 sits inside them while
    // staying clear of the sign-off.
    seek = dur * 0.70;
    console.warn(`  thumb: WARN could not measure candidates (python/PIL?) — falling back to t=${seek.toFixed(1)}s`);
  }
} else {
  seek = Math.max(0, dur * 0.5);
}

const tr = spawnSync(resolveFfmpeg(), [
  '-y', '-ss', String(seek), '-i', videoPath, '-frames:v', '1',
  '-vf', 'scale=1280:-2', '-q:v', '3', destThumb,
], { encoding: 'utf8', timeout: 60000 });
if (tr.status === 0 && existsSync(destThumb)) {
  publish.thumbnail = { file: 'thumb.jpg', at_s: Number(seek.toFixed(2)) };
} else {
  console.warn('warn: thumbnail extraction failed; handoff will have no thumb.jpg.');
}

writeFileSync(join(pkgDir, 'publish.json'), JSON.stringify(publish, null, 2));

const kb = (statSync(destVideo).size / 1024 / 1024).toFixed(1);
console.log(`✔ handoff written: ${pkgDir}`);
console.log(`  id:        ${id}`);
console.log(`  video:     video.mp4 (${kb} MB, ${meta.duration_s ?? '?'}s, ${meta.width}x${meta.height}@${meta.fps})`);
console.log(`  thumbnail: ${publish.thumbnail ? 'thumb.jpg' : '(none)'}`);
console.log(`  rundown:   ${rundown.length} stories`);
console.log(`\nNext: in socials-studio, run  py ingest_handoffs.py  to queue it for sign-off.`);
