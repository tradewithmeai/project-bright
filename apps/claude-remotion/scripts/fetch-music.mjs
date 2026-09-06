#!/usr/bin/env node
// fetch-music.mjs — bring a licensed music track into the repo, with its licence attached.
//
// Deliberately takes a TRACK PAGE URL, never a search query. A `--query` flag would mean the
// script picks the track, and the operator never sees the licence page — which is exactly how a
// mislabelled upload gets committed. public/audio/CREDITS.md already warns that some stock
// uploads are mislabelled by their uploader, so the licence page for the individual file is the
// only thing worth trusting. You visit it, you read it, you pass what it said.
//
// It therefore REFUSES to guess: --license and --license-url have no defaults. That refusal is
// the feature. An asset whose licence nobody recorded is the problem this solves.
//
// Usage (from apps/claude-remotion):
//   node scripts/fetch-music.mjs \
//     --url https://pixabay.com/music/-some-track-12345/ \
//     --audio-url https://cdn.pixabay.com/download/audio/.../track.mp3 \
//     --out public/<project>/audio/music.mp3 \
//     --license "Pixabay Content License" \
//     --license-url https://pixabay.com/service/license-summary/ \
//     [--attribution "Music by X from Pixabay"] [--bpm 124] [--dry-run]
//
// Costs nothing and needs no API key: this is a download, not a generation. For generated music
// see generate-music.mjs, which bills ElevenLabs credits.

import { writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d = '') => { const i = argv.indexOf(k); return i >= 0 ? (argv[i + 1] ?? d) : d; };
const has = (k) => argv.includes(k);

const PAGE_URL = arg('--url');
const AUDIO_URL = arg('--audio-url');
const OUT = arg('--out');
const LICENSE = arg('--license');
const LICENSE_URL = arg('--license-url');
const ATTRIBUTION = arg('--attribution');
const BPM = arg('--bpm');
const DRY = has('--dry-run');

const die = (msg, code = 2) => { console.error(`[music-fetch] ${msg}`); process.exit(code); };

// ── The refusals. Each one exists because the alternative is an unrecorded asset. ──
if (has('--query') || has('--search')) {
  die('there is no --query. Search-and-hope picks a track without anyone reading its licence\n' +
      '                page, which is how a mislabelled upload ends up committed. Find the track in a\n' +
      '                browser, read its licence, then pass --url with that page.');
}
if (!PAGE_URL) die('--url is required: the track page you actually read the licence on.');
if (!OUT) die('--out is required: where the file should land, e.g. public/<project>/audio/music.mp3');
if (!LICENSE) die('--license is required. What did the licence page say? There is no default,\n' +
                  '                because a guessed licence is worse than no file.');
if (!LICENSE_URL) die('--license-url is required: the licence page you read, so the claim is checkable\n' +
                      '                later by someone who was not there.');

const outPath = resolve(APP_ROOT, OUT);
if (!outPath.startsWith(resolve(APP_ROOT))) die(`--out must stay inside the app: ${outPath}`);

// The AI Top 5 bed is tempo-locked to the motion grid — see public/audio/CREDITS.md.
const isTop5Bed = resolve(outPath) === resolve(APP_ROOT, 'public/audio/bed.mp3');
if (isTop5Bed) {
  console.warn('[music-fetch] ⚠ This overwrites the AI Top 5 bed, whose motion grid is tempo-locked');
  console.warn('[music-fetch]   to 124 BPM and trimmed to a bar boundary. Read the bed-swap contract');
  console.warn('[music-fetch]   in public/audio/CREDITS.md before using the result.');
  if (BPM && Number(BPM) !== 124) {
    die(`refusing: the bed must be 124 BPM, and you passed ${BPM}. A different tempo desyncs\n` +
        '                every cut in the composition.');
  }
  if (!BPM) console.warn('[music-fetch]   No --bpm given, so the tempo is UNVERIFIED. Check it before shipping.');
}

const sidecarPath = outPath.replace(/\.[^.]+$/, '') + '.provenance.json';
const record = {
  file: OUT.replace(/\\/g, '/'),
  source: 'third-party',
  source_url: PAGE_URL,
  audio_url: AUDIO_URL || null,
  license_name: LICENSE,
  license_url: LICENSE_URL,
  attribution_required: Boolean(ATTRIBUTION),
  attribution_text: ATTRIBUTION || null,
  bpm: BPM ? Number(BPM) : null,
  // Stamped by the operator's run, not by the script's guess.
  fetched_at: new Date().toISOString(),
  verified_by: 'operator read the licence page named in license_url',
};

if (DRY) {
  console.log('[music-fetch] dry run — nothing downloaded, nothing written.');
  console.log(`[music-fetch] would fetch : ${AUDIO_URL || '(no --audio-url; would need one)'}`);
  console.log(`[music-fetch] would write : ${outPath}`);
  console.log(`[music-fetch] provenance  : ${sidecarPath}`);
  console.log(JSON.stringify(record, null, 2));
  process.exit(0);
}

if (!AUDIO_URL) {
  die('--audio-url is required to download. The track page (--url) is where the licence lives;\n' +
      '                the audio URL is the file itself. This script does not scrape the page for it —\n' +
      '                scraping guesses, and a guess is what the licence check exists to prevent.');
}

console.log(`[music-fetch] downloading ${AUDIO_URL}`);
let buf;
try {
  const res = await fetch(AUDIO_URL, { redirect: 'follow' });
  if (!res.ok) die(`HTTP ${res.status} fetching the audio — ${res.statusText}`, 1);
  const type = res.headers.get('content-type') || '';
  if (!/audio|octet-stream|mpeg/i.test(type)) {
    die(`the response is "${type}", not audio. That usually means the URL is a landing page\n` +
        '                rather than the file, or the download needs a session.', 1);
  }
  buf = Buffer.from(await res.arrayBuffer());
} catch (e) {
  die(`download failed: ${e.message}`, 1);
}

if (buf.length < 10 * 1024) {
  die(`downloaded only ${buf.length} B — too small to be a music track. Not writing it.`, 1);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, buf);
writeFileSync(sidecarPath, JSON.stringify(record, null, 2) + '\n');

console.log(`[music-fetch] ✔ ${outPath}  (${(buf.length / 1024).toFixed(0)} KB)`);
console.log(`[music-fetch] ✔ ${basename(sidecarPath)} — licence: ${LICENSE}`);
if (ATTRIBUTION) {
  console.log(`[music-fetch] ⚠ ATTRIBUTION REQUIRED. This exact line must appear wherever the video`);
  console.log(`[music-fetch]   is published:  ${ATTRIBUTION}`);
}
console.log('[music-fetch] Add the file to public/PROVENANCE.md if it is going to be committed —');
console.log('[music-fetch] ops/check-media-provenance.py fails until it is.');
if (existsSync(outPath)) {
  console.log(`[music-fetch] on disk: ${statSync(outPath).size.toLocaleString()} B`);
}
