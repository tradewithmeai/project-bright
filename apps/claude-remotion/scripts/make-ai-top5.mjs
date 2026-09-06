#!/usr/bin/env node
/**
 * make-ai-top5.mjs — standalone daily "AI Top 5" video populator (manual, not pipeline).
 *
 * fetch the live API -> map onto the ai_top5 Bulletin contract (filling video-only
 * accent + cue deterministically) -> regenerate src/templates/ai_top5/data.ts.
 * Then render with:  npx remotion render AiTop5 out/ai-top5.mp4
 *
 * Usage: node scripts/make-ai-top5.mjs [--url https://solvx.uk/api/ai-news.json]
 */
import '../../../scripts/load-env.mjs';   // load repo-root .env before key-reading imports
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateVoiceovers, bedIfPresent, probeClipFrames } from './generate-vo.mjs';
import { writeScript } from './write-script.mjs';

// ROOT = the claude-remotion app dir (parent of scripts/). Works locally AND in-container (/app).
const ROOT = process.env.APP_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_TS = `${ROOT}/src/templates/ai_top5/data.ts`;
const argUrl = (() => { const i = process.argv.indexOf('--url'); return i >= 0 ? process.argv[i + 1] : null; })();
const URL = argUrl || 'https://solvx.uk/api/ai-news.json';

// Video-only fields the API deliberately does NOT carry (presentation, owned here).
// NOTE: accent/colour is NOT written here — the template owns the palette via tokens.ts
// RANK_ACCENT (single source), so the daily regen can never revert it (design bible §6.2).
const CUE_BY_RANK = {
  5: 'At number five this week…',
  4: 'In at number four…',
  3: 'Number three on the list…',
  2: 'And at number two…',
  1: 'Which brings us to number one…',
};

const j = (s) => JSON.stringify(s);
// Clamp a paragraph to N words at a word boundary (overflow insurance for the on-screen explainer).
const clampWords = (text, n) => {
  const words = String(text).trim().split(/\s+/);
  return words.length <= n ? words.join(' ') : words.slice(0, n).join(' ') + '…';
};
// Normalise a string array from the API (entities / image_keywords). The Array.isArray guard is
// load-bearing: a malformed API value would otherwise make .map throw in the writer and abort the regen.
const cleanList = (arr, n) => (Array.isArray(arr) ? arr : []).map((x) => String(x).trim()).filter(Boolean).slice(0, n);

function buildStory(s) {
  const rank = s.rank;
  const beats = Array.isArray(s.beats) ? s.beats.slice(0, 2) : [];
  while (beats.length < 2) beats.push('');              // guard: template now expects exactly 2
  return {
    n: rank,
    // WHAT THE VIEWER SEES: story_type first, category only as a fallback.
    //
    // The aggregator added `story_type` on 2026-08-03 as a CLOSED enum (LAUNCH / MONEY / POLICY /
    // RESEARCH / TOOLING / CULTURE / INCIDENT) and applies its selection rules to it — notably the
    // cap of one TOOLING story per edition. It left the old free-text `category` in place, and the
    // video rendered `category` in four places, so the two disagreed on all five stories the day it
    // landed: #1 was story_type MONEY but category RESEARCH, and #3 was capped-away TOOLING under
    // story_type LAUNCH yet still displayed "TOOLING". The cap was being enforced on a field nobody
    // could see.
    //
    // Reading story_type first also pins the on-screen vocabulary. The same feed emitted
    // "OPEN SOURCE", "PRODUCT" and "INFRASTRUCTURE" as categories — values never seen before, one
    // with a space and one 14 characters long, against a chip and HUD laid out for short single
    // words like RESEARCH and MODELS. Every enum value is 8 characters or fewer.
    story_type: String(s.story_type || '').toUpperCase().trim(),
    category: String(s.story_type || s.category || 'AI').toUpperCase().replace(/[-_]/g, ' '),
    cue: CUE_BY_RANK[rank] || `Number ${rank}…`,
    headline: s.headline || s.title || '',
    beats,
    takeaway: s.takeaway || '',
    // v4 "text explains" paragraph; summary is the graceful fallback (clamped so it can't overflow the card)
    explainer: clampWords(s.explainer || s.summary || '', 80),
    voiceover: s.voiceover || s.summary || '',
    summary: s.summary || '',   // raw fact carried in-memory for --ai-script (NOT serialized to data.ts)
    source: s.source || '',     // outlet name — carried to data.json for source attribution
    url: s.url || '',           // source article link — for the YouTube description credits
    entities: cleanList(s.entities, 4),           // v4: named orgs → real-logo lookup (Phase 3 backgrounds)
    image_keywords: cleanList(s.image_keywords, 2), // v4: concrete nouns → gen backdrop (deferred tier)
    bg_word: (s.bg_word || '').trim(),            // v5: short subject word for the no-logo brand stinger
    bg_tone: (s.bg_tone || '').trim().toLowerCase(), // v5: tone enum → effect + tag
    so_what: (s.so_what || '').trim(),            // v6: the implication → the SOLE input to the voice
    detail: (s.detail || '').trim(),              // v6: concrete anchor fact → shown on screen
    vo: null,
    voFrames: null,
  };
}

const res = await fetch(URL);
if (!res.ok) { console.error(`[ai-top5] API ${URL} -> HTTP ${res.status}`); process.exit(1); }
const d = await res.json();
const raw = Array.isArray(d) ? d : (d.stories || d.items || d.data || []);
if (raw.length === 0) { console.error('[ai-top5] no stories in API response'); process.exit(1); }

// Reveal order = array order = #5 first ... #1 last (so rank 1 is the finale).
const stories = raw.map(buildStory).sort((a, b) => b.n - a.n);

// --ai-script: write the WHOLE spoken script app-side (Architecture A) from the story FACTS.
// --with-audio: TTS-voice it (ElevenLabs) + use a music bed if present.
// Neither flag (or missing keys) → silent / fixed-pool / API-narration — identical to before.
let bed = null;
let introVo = null;
let signoffVo = null;
const dateStr = d.date || new Date().toISOString().slice(0, 10);

// Pre-TTS script text (in-memory only — never written to data.ts; only the resulting mp3 paths are).
let scriptIntro = null;
let scriptSignoff = null;
if (process.argv.includes('--ai-script')) {
  const script = await writeScript({ date: dateStr, stories });
  if (script) {
    scriptIntro = script.intro;
    scriptSignoff = script.signoff;
    let wrote = 0;
    for (const st of stories) {
      const line = script.stories[st.n];
      if (line && line.hook && line.news) { st.hookScript = line.hook; st.newsScript = line.news; st.screenScript = line.screen || ''; wrote++; }
    }
    console.log(`[ai-top5] ai-script: intro + signoff + ${wrote}/${stories.length} story hook+news pairs written`);
  } else {
    console.log('[ai-top5] ai-script: no script (OPENAI_API_KEY missing or call failed) — using fixed-pool/summary fallbacks');
  }
}

if (process.argv.includes('--with-audio')) {
  const voMap = await generateVoiceovers(stories, { date: dateStr, introScript: scriptIntro, signoffScript: scriptSignoff });
  for (const st of stories) {
    st.vo = voMap[st.n] || null;                       // one continuous per-story line
    // Measure it. The video sizes this story's section from this number rather than assuming every
    // story is the same length (design bible §7 V2) — a short read no longer leaves the show
    // sitting there. null (unmeasurable / silent) falls back to the fixed budget.
    st.voFrames = st.vo ? probeClipFrames(st.vo) : null;
  }
  console.log('[ai-top5] measured VO: ' +
    stories.map((s) => `#${s.n} ${s.voFrames == null ? '—' : `${s.voFrames}f`}`).join('  '));
  introVo = voMap.intro || null;
  signoffVo = voMap.signoff || null;
  bed = bedIfPresent();
  console.log(`[ai-top5] audio: bed=${bed || '(none)'}  intro=${introVo || '(none)'}  signoff=${signoffVo || '(none)'}  voiceovers=${stories.filter(s => s.vo).length}/${stories.length}`);

  // GATE EVERY LANE, not just the five story reads.
  //
  // On 2026-07-30 one TTS call failed transiently (`[vo] intro: fetch failed`). The line above
  // duly printed `intro=(none)` — and nothing checked it, because the only number the routine
  // asserts is `voiceovers=5/5`, which counts story reads. So `intro_vo: null` was written, the
  // hero rendered, and the edition shipped with a SILENT 6.5-SECOND COLD OPEN, verified only
  // after the fact.
  //
  // A missing lane is not a degradation to be logged, it is a broken edition. Fail here, before
  // anything is rendered or handed off. Recovery no longer means a full re-run: repair the one
  // lane with `node scripts/repair-vo.mjs --lane intro` (~83 chars) and re-render.
  const missing = [];
  if (!introVo) missing.push('intro');
  if (!signoffVo) missing.push('signoff');
  for (const st of stories) if (!st.vo) missing.push(`story ${st.n}`);
  if (missing.length) {
    console.error(`\n[ai-top5] FAILED — missing voiceover lane(s): ${missing.join(', ')}`);
    console.error('[ai-top5] data.ts has NOT been written. Do not render.');

    // Distinguish "no key" from "a lane failed". Every lane missing at once, with no TTS key
    // set, is not a transient failure to repair -- it is a machine that was never able to
    // voice anything. The repair advice below would fail for exactly the same reason, so
    // sending a keyless newcomer to it strands them. Name the key instead.
    const hasTtsKey = Boolean(process.env.OPENAI_API_KEY || process.env.ELEVENLABS_API_KEY);
    if (!hasTtsKey) {
      console.error('\n[ai-top5] No TTS key is set, so no lane could be voiced.');
      console.error('[ai-top5] Set OPENAI_API_KEY in apps/claude-remotion/.env — see .env.example.');
      console.error('[ai-top5] ELEVENLABS_API_KEY works too and takes precedence if both are set.');
      console.error('[ai-top5] Nothing here needs a key until this step: "npm run hello" and');
      console.error('[ai-top5] "npm run dev" both run with no keys at all.');
      process.exit(1);
    }

    if (missing.every((m) => m === 'intro' || m === 'signoff')) {
      console.error(`[ai-top5] repair the cheap way (does NOT re-voice the stories):`);
      for (const m of missing) console.error(`[ai-top5]     node scripts/repair-vo.mjs --lane ${m}`);
      console.error('[ai-top5] then re-run this script WITHOUT --with-audio to write data.ts.');
    } else {
      console.error('[ai-top5] a story read is missing — that needs a full re-run with --with-audio.');
    }
    process.exit(1);
  }
}

const bulletin = {
  brand: 'AI TOP 5',
  tagline: "the day's biggest AI news — counted down",
  date: d.date || new Date().toISOString().slice(0, 10),
  edition: typeof d.edition === 'number' ? d.edition : 1,
  bed,
  intro_vo: introVo,
  signoff_vo: signoffVo,
  stories,
};

// Preserve the existing type block (everything ABOVE `export const TODAY`); replace only TODAY.
const cur = readFileSync(DATA_TS, 'utf8');
const cut = cur.indexOf('export const TODAY');
if (cut < 0) { console.error('[ai-top5] could not find `export const TODAY` in data.ts'); process.exit(1); }
const prefix = cur.slice(0, cut);

const storyLines = stories.map(s =>
`    {
      n: ${s.n},
      category: ${j(s.category)},
      story_type: ${j(s.story_type)},
      cue: ${j(s.cue)},
      headline: ${j(s.headline)},
      beats: [${s.beats.map(j).join(', ')}],
      takeaway: ${j(s.takeaway)},
      explainer: ${j(s.explainer)},
      screen: ${j(s.screenScript || '')},
      entities: [${s.entities.map(j).join(', ')}],
      image_keywords: [${s.image_keywords.map(j).join(', ')}],
      bg_word: ${j(s.bg_word)},
      bg_tone: ${j(s.bg_tone)},
      so_what: ${j(s.so_what)},
      detail: ${j(s.detail)},
      voiceover: ${j(s.voiceover)},
      vo: ${j(s.vo)},
      voFrames: ${s.voFrames == null ? 'null' : s.voFrames},
    },`).join('\n');

const out = `${prefix}export const TODAY: Bulletin = {
  brand: ${j(bulletin.brand)},
  tagline: ${j(bulletin.tagline)},
  date: ${j(bulletin.date)},
  edition: ${bulletin.edition},
  bed: ${j(bulletin.bed)},
  intro_vo: ${j(bulletin.intro_vo)},
  signoff_vo: ${j(bulletin.signoff_vo)},
  stories: [
${storyLines}
  ],
};
`;

writeFileSync(DATA_TS, out, 'utf8');

// Also emit the exact rendered bulletin as JSON so record-ai-top5.mjs can build a record that is
// always consistent with THIS render (the daily was going stale because the record wasn't refreshed).
const DATA_JSON = `${ROOT}/src/templates/ai_top5/data.json`;
writeFileSync(DATA_JSON, JSON.stringify(bulletin, null, 2), 'utf8');

// History-preserving output path: never clobber a prior render. Base = date+edition;
// if that already exists (e.g. re-rendering while tuning), bump -002, -003, …
function nextOutPath() {
  const base = `ai-top5_${bulletin.date}_ed${bulletin.edition}`;
  let cand = `out/${base}.mp4`;
  let i = 2;
  while (existsSync(join(ROOT, cand))) { cand = `out/${base}-${String(i).padStart(3, '0')}.mp4`; i++; }
  return cand;
}
const outPath = nextOutPath();

console.log(`[ai-top5] wrote ${DATA_TS}`);
console.log(`[ai-top5] date=${bulletin.date} edition=${bulletin.edition} stories=${stories.length}`);
for (const s of stories) console.log(`  #${s.n} ${s.category.padEnd(16)} ${s.headline}`);
console.log(`[ai-top5] now render:  npx remotion render AiTop5 ${outPath}`);
console.log(`[ai-top5] then record:  node scripts/record-ai-top5.mjs --video ${outPath}   (refreshes VIDEO_RECORD to match this render)`);
