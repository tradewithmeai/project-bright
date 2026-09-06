#!/usr/bin/env node
/**
 * generate-vo.mjs — per-story TTS voiceover for the AI Top 5 video (swappable provider).
 *
 * For each story, TTS the spoken line → public/vo/<n>.mp3. The line is the app-written
 * narration (Architecture A) when present, else the API voiceover, else the summary.
 * Clears public/vo/ first (per-run; kills stale-audio drift). Logs chars + est cost
 * (always-log-API-cost rule). A failed story → vo:null (silent), never fails the run.
 *
 * Provider is one swap-point (the tts dispatch). **ElevenLabs is the default daily engine as of
 * 2026-07-24** — the owner picked an OWNED presenter voice (`ai_top5_presenter`, British male
 * radio-DJ) because OpenAI 'nova' read flat for a Top-5 countdown. Running a ONE-WEEK TRIAL:
 * cost goes ~$0.02 -> ~$0.45/edition (owner accepted). Revert with TTS_PROVIDER=openai.
 * Piper (local, free) drops in at the same swap-point next.
 *
 * The ElevenLabs voice + settings are read from studio/voices/registry.json (the single source of
 * truth) by ROLE, so re-pointing the presenter is a registry edit, not a code change.
 *
 * Env (all optional — registry supplies the defaults):
 *   TTS_PROVIDER            openai | elevenlabs  (default: elevenlabs if ELEVENLABS_API_KEY set, else openai)
 *   OPENAI_API_KEY          (OpenAI TTS — ~$0.02-0.03/video at ~$15/1M chars)
 *   OPENAI_TTS_MODEL        (default: gpt-4o-mini-tts)
 *   OPENAI_TTS_VOICE        (default: nova — energetic; alloy/echo/fable/onyx/shimmer/sage…)
 *   ELEVENLABS_API_KEY      (ElevenLabs TTS — credit-based; ~1700 credits/video on multilingual_v2)
 *   ELEVENLABS_VOICE_ROLE   registry key under `studio` (default: ai_top5_presenter)
 *   ELEVENLABS_VOICE_ID     explicit id; overrides the registry lookup
 *   ELEVENLABS_MODEL_ID     (default: eleven_multilingual_v2)
 *   ELEVENLABS_STABILITY / _SIMILARITY / _STYLE / _SPEED / _SPEAKER_BOOST / _SEED
 *                           per-run overrides of the registry's default_settings
 *                           (_SPEED is the PACE lever; _STYLE up = more theatrical/shrill)
 *
 * Per story it TTS's TWO beats — a presenter `hookScript` (creative) and a `newsScript` (accurate)
 * — measures the hook with ffprobe, and concats [lead-in][hook][gap][news] into ONE frame-accurate
 * mp3 (news starts at clip frame 99) so the two lanes can never overlap. Degrades to news-only on
 * any failure, and WARNS LOUDLY on lane loss. (design bible §5.3)
 *
 * Exported: generateVoiceovers(stories, opts) -> { [n]: "vo/<n>.mp3", intro, signoff }
 *   opts.introScript / opts.signoffScript override the fixed presenter intro/sign-off.
 *   per-story: story.hookScript / story.newsScript (else story.cue / story.voiceover / story.summary).
 * Standalone: node generate-vo.mjs <data-json>  where the json is { stories:[{n,voiceover,cue}] }
 */
import '../../../scripts/load-env.mjs';   // load repo-root .env before reading API keys below
import { existsSync, mkdirSync, writeFileSync, rmSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolveFfmpeg, resolveFfprobe } from './ffmpeg-bin.mjs';
import { trimEdges } from './trim-vo-silence.mjs';
import * as VO_BUDGET from './vo-budget.mjs';

// ROOT = the claude-remotion app dir (parent of scripts/). Works locally AND in-container (/app).
const ROOT = process.env.APP_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const VO_DIR = join(ROOT, 'public', 'vo');

// ── Split-clip frame layout (design bible §2.3, 30fps) ──────────────────────────
const FPS = 30;
const LEAD_IN_FRAMES = 9;    // 0.30s silent lead-in — the number sting lands with no voice on top
const NEWS_START_FRAME = VO_BUDGET.NEWS_START_FRAME; // news begins right after the hook (reveal boundary, story-frame 111); the fuller
                              // ~22s anchor NEWS read then runs CONTINUOUSLY across the whole story section (no dead air).
const HOOK_CAP_FRAMES = VO_BUDGET.HOOK_CAP_FRAMES;  // 2.5s hook speech cap
// The hook is RIGHT-ALIGNED so it lands one beat before the news read, instead of being
// left-aligned at LEAD_IN and dumping all its slack as trailing silence. The news read stays
// locked to NEWS_START_FRAME (the REVEAL boundary) — that sync is deliberate and is preserved.
// Before: a 33f hook ran 9->42 and left 69f (2.3s) of dead air before the news. After: it runs
// 81->96 and leaves exactly HOOK_TAIL_FRAMES. The slack moves to the FRONT of the cue window,
// where the era-device arrival animation is already playing and the number sting lands.
const HOOK_TAIL_FRAMES = 15; // one beat at 124 BPM — the gap between hook landing and news read

// ── Story frame budget — ONE source of truth (scripts/vo-budget.mjs) ────────
// The composition mounts each story's <Audio> inside a <Sequence durationInFrames={STORY_TOTAL_FRAMES}>,
// which HARD-CLIPS the audio at the story boundary, so VO that runs past it is truncated mid-word.
// IMPORTED, not hand-mirrored. These were local constants whose COMMENTS still claimed
// "771" and "660" long after the takeaway section was removed (2026-07-24) and the real values
// became 651 and 540. The script writer was never told, so it kept authoring ~660f of copy into
// a 540f window and the guard below amputated the difference from every story, every day.
// Sharing one module is what stops that recurring — see vo-budget.mjs.
const { STORY_TOTAL_FRAMES, STORY_TAIL_FRAMES, VO_MAX_END_FRAME, NEWS_CAP_FRAMES } = VO_BUDGET;
VO_BUDGET.assertMatchesTokens();   // hard-stop if the video window and this budget have drifted

const CLAUSE_MIN_WORDS = 6;  // clause-trim floor. Lower than the sentence floor on purpose:
                             // once we are trimming clauses we are already in fallback, and a short
                             // COMPLETE sentence beats a long one the composition clips mid-word.
const FIT_TRIES = 3;                                              // max re-TTS attempts to fit a lane under its ceiling

export const wordCount = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;

// Trim units for the fit-to-frames loop. Hooks lose a trailing WORD (keep the rank announcement at
// the front); news loses a trailing SENTENCE (keep whole sentences — a clean shorter read beats a
// truncated one, and the last sentence is the "bottom line" the anchor can drop).
// After dropping a word, also strip any DANGLING function word left at the end ("…with a", "…to the")
// — otherwise TTS reads the orphaned article aloud (the stray "a" heard after #5/#1 on 2026-07-17).
const DANGLING_END = /(?:^|\s)(a|an|the|and|or|but|with|of|to|for|at|so|by|as|into|onto|from|your|our|my|his|her|their|its|this|that|is|are|it's)[\s.!?…,-]*$/i;
const stripDangling = (t) => {
  let cur = t.trim();
  while (DANGLING_END.test(cur)) cur = cur.replace(DANGLING_END, '').trim();
  return cur;
};
export const dropTrailingWord = (t) => {
  const cut = stripDangling(t.trim().replace(/[\s.!?…,-]*\S+$/, ''));
  if (!cut) return '';
  return /[.!?…]$/.test(cut) ? cut : `${cut}!`;   // re-terminate so the read doesn't trail off
};
// First spoken segment of a hook = the rank ANNOUNCEMENT ("Number five!" / "At four…"). Used as the
// fit fallback: when the full hook overruns the cap we drop the FLOURISH entirely rather than trim
// word-by-word — word-trimming degraded "A deep dive on ethics!" into the nonsense "A deep!" that
// shipped on 2026-07-17. The announcement alone is always meaningful.
export const firstSegment = (t) => {
  const m = (t || '').trim().match(/^[^.!?…]*[.!?…]+/);
  return m ? m[0].trim() : (t || '').trim();
};
// Sentence splitting must be ABBREVIATION-AWARE, because this pipeline manufactures its own
// abbreviations: it respells brand names for TTS pronunciation, so "AI" is written "A. I.". A
// naive split on every period turns ONE sentence into THREE — "...about A." / "I." / "safety
// protocols..." — and dropTrailingSentence then removes only the real trailing clause, shipping
// the fragment "...raising significant concerns about A. I.". That is exactly what went to air on
// 2026-07-27 in stories #3 and #1, and it is why those reads ended on a dangling "A. I.".
// Mask single-letter initials and common abbreviations, split, then unmask.
const SENT_DOT = '';
const ABBREV_RE = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|Inc|Ltd|Corp|Co|No|Fig|Approx|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\./gi;
export const splitSentences = (t) => {
  const masked = String(t || '')
    .replace(/\b([A-Za-z])\.(?=\s|$)/g, '$1' + SENT_DOT)   // A. I.  U. K.  initials
    .replace(/\b([a-z])\.([a-z])\./gi, '$1' + SENT_DOT + '$2' + SENT_DOT)  // e.g.  i.e.
    .replace(ABBREV_RE, (m) => m.replace(/\./g, SENT_DOT))
    .replace(/(\d)\.(?=\d)/g, '$1' + SENT_DOT);            // 3.5  decimals
  return (masked.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [masked])
    .map((s) => s.split(SENT_DOT).join('.').trim())
    .filter(Boolean);
};

export const dropTrailingSentence = (t) => { const s = splitSentences(t); s.pop(); return s.join(' ').trim(); };

// When a read is ONE long sentence, sentence-dropping has nothing to remove — and shipping the
// full text lets the composition hard-clip it mid-word at the story boundary. So the ladder falls
// back to CLAUSE level: cut at the last comma / semicolon / dash and close with a full stop, which
// leaves a complete statement instead of a fragment.
//   "...seeking dangerous recipes, raising significant concerns about A. I. safety protocols..."
//     -> "ChatGPT users are increasingly seeking dangerous recipes."
// Never cuts mid-clause, and refuses to return a stub shorter than `minWords`.
// FINAL GUARD — applied to every trim candidate, whatever produced it.
// On 2026-07-28 a trim candidate came back as "...a shift in workplace roles as A." — the old
// dangling-abbreviation failure. It never aired only because that take was STILL over cap, so a
// second pass replaced it; had it come in under the cap it would have been voiced and shipped.
// The masking in splitSentences/dropTrailingClause covers the paths I can reproduce, and I could
// NOT reproduce this one from the delivered text. So rather than assume the instance is gone,
// this closes the CLASS: any candidate ending on a single-letter initial or a common abbreviation
// is rejected outright, no matter which trim produced it. A rejected candidate falls back to the
// next rung of the ladder, and an empty return ships the untrimmed line, which the fit loop
// then re-voices — noisy, but never broken on air.
const ENDS_ON_ABBREV = /(?:^|\s)(?:[A-Za-z]|Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|Inc|Ltd|Corp|Co|No|Fig|Approx|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.$/;
export const endsOnAbbrev = (s) => ENDS_ON_ABBREV.test(String(s || '').trim());

export const dropTrailingClause = (t, minWords = 6) => {
  const src = String(t || '').trim().replace(/[.!?]+$/, '');
  const masked = src.replace(/\b([A-Za-z])\.(?=\s|$)/g, '$1' + SENT_DOT);
  const parts = masked.split(/\s*[,;]\s+|\s+[—–-]\s+/);
  while (parts.length > 1) {
    parts.pop();
    const cand = parts.join(', ').split(SENT_DOT).join('.').trim();
    if (cand.split(/\s+/).filter(Boolean).length >= minWords) {
      return cand.replace(/[,;]$/, '') + '.';
    }
  }
  return '';
};

// ── ElevenLabs config ──
// The presenter voice + its settings come from the STUDIO VOICE REGISTRY, never hard-coded here
// (registry.json is the single source of truth: "videos should read voice_id + settings from HERE").
// Owner picked `ai_top5_presenter` (British male radio-DJ, owned) on 2026-07-24 for pace.
const REGISTRY_PATH = resolve(ROOT, '..', '..', 'studio', 'voices', 'registry.json');
function registryVoice(role) {
  try {
    const reg = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
    const v = reg?.studio?.[role];
    if (v?.voice_id) return v;
  } catch (e) {
    console.warn(`[vo] registry unreadable (${e.message}) — falling back to env/defaults`);
  }
  return null;
}
const EL_ROLE = process.env.ELEVENLABS_VOICE_ROLE || 'ai_top5_presenter';
const EL_REG = registryVoice(EL_ROLE);
const EL_KEY = process.env.ELEVENLABS_API_KEY || '';
const EL_VOICE = process.env.ELEVENLABS_VOICE_ID || EL_REG?.voice_id || '21m00Tcm4TlvDq8ikWAM';
const EL_MODEL = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
// Voice settings: registry default_settings, each overridable per-run by env.
// Lower stability = more expressive/energetic; `speed` > 1 is the PACE lever for a Top-5 countdown.
const EL_SET = EL_REG?.default_settings || {};
const num = (env, fallback) => (process.env[env] !== undefined ? parseFloat(process.env[env]) : fallback);
const EL_STABILITY = num('ELEVENLABS_STABILITY', EL_SET.stability ?? 0.4);
const EL_SIMILARITY = num('ELEVENLABS_SIMILARITY', EL_SET.similarity_boost ?? 0.75);
const EL_STYLE = num('ELEVENLABS_STYLE', EL_SET.style ?? 0);
const EL_SPEED = num('ELEVENLABS_SPEED', EL_SET.speed ?? 1.0);
const EL_SPEAKER_BOOST = process.env.ELEVENLABS_SPEAKER_BOOST
  ? process.env.ELEVENLABS_SPEAKER_BOOST !== 'false'
  : (EL_SET.use_speaker_boost ?? true);
// Fixed seed keeps the presenter consistent across the 7 clips of one edition AND across days.
const EL_SEED = Number.isFinite(num('ELEVENLABS_SEED', NaN)) ? num('ELEVENLABS_SEED', NaN) : 4242;

// ── OpenAI TTS config (default daily engine) ──
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'nova';
const OPENAI_TTS_INSTRUCTIONS = process.env.OPENAI_TTS_INSTRUCTIONS ||
  'Speak like an energetic, upbeat Top-of-the-Pops radio DJ — lively, warm, punchy and clear.';
const OPENAI_RATE_PER_CHAR = 0.000015; // ~$15/1M chars (tts-1 ballpark) — estimate for the cost log

// ── Provider selection ──────────────────────────────────────────────────────────
// DEFAULT = ElevenLabs as of 2026-07-24: the owner picked an OWNED presenter voice for pace
// (OpenAI 'nova' read flat for a Top-5 countdown). Running a one-week trial — cost rises from
// ~$0.02 to ~$0.45/edition, which the owner accepted. To revert for a run (or permanently, if the
// trial fails): TTS_PROVIDER=openai. Explicit TTS_PROVIDER always wins; if the EL key is missing
// we fall back to OpenAI rather than going silent.
const PROVIDER = (process.env.TTS_PROVIDER || (EL_KEY ? 'elevenlabs' : (OPENAI_KEY ? 'openai' : 'none'))).toLowerCase();

// ── Spend ceiling ───────────────────────────────────────────────────────────────
// A runaway guard, not a budget. FIT_TRIES=3 means one run can legitimately re-synthesise a
// lane several times, so ~35 paid calls in a single run is reachable; the worst REAL session
// measured here was ~1,582 credits, so the 3,000 default leaves 47% headroom and only a
// genuine runaway trips it.
//
// Reserved BEFORE the HTTP call, deliberately. Checking after the call is how this file
// already handles its frame ceiling (it logs "OVER ceiling", then returns success) — for
// money that would mean noticing the overspend only once it had happened.
const BUDGET_CREDITS = num('PB_BUDGET_CREDITS', 3000);
const BUDGET_USD = Number.parseFloat(process.env.PB_BUDGET_USD ?? '');
const BUDGET_MARKER = 'PB_BUDGET_EXCEEDED'; // distinct, greppable: assert on this, not on exit code
let spentCredits = 0, spentUsd = 0;

function reserve(text) {
  const chars = text.length;
  // ElevenLabs bills ~1 credit/char on multilingual_v2; OpenAI bills by the character in dollars.
  const addCredits = PROVIDER === 'elevenlabs' ? chars : 0;
  const addUsd = PROVIDER === 'openai' ? chars * OPENAI_RATE_PER_CHAR : 0;

  const overCredits = addCredits > 0 && Number.isFinite(BUDGET_CREDITS)
    && spentCredits + addCredits > BUDGET_CREDITS;
  const overUsd = addUsd > 0 && Number.isFinite(BUDGET_USD)
    && spentUsd + addUsd > BUDGET_USD;

  if (overCredits || overUsd) {
    const [used, want, ceiling, unit, override] = overCredits
      ? [spentCredits, addCredits, BUDGET_CREDITS, 'credits', 'PB_BUDGET_CREDITS']
      : [spentUsd.toFixed(4), addUsd.toFixed(4), BUDGET_USD, 'USD', 'PB_BUDGET_USD'];
    console.error(`\n[vo] ${BUDGET_MARKER} — refusing to spend.`);
    console.error(`[vo] This run has used ${used} ${unit}; this call needs ${want} more, ` +
      `which would pass the ${ceiling} ${unit} ceiling.`);
    console.error(`[vo] Nothing was charged for this call and no audio was written.`);
    // Name the override, or operators set it permanently in .env and the guard becomes decorative.
    console.error(`[vo] Raise it for one run with ${override}=<n>, e.g. ${override}=6000 npm run ...`);
    console.error(`[vo] If you did not expect to be near the ceiling, something is looping — ` +
      `check the fit retries above before raising it.`);
    process.exit(3);
  }

  spentCredits += addCredits;
  spentUsd += addUsd;
}

// One TTS request → mp3 Buffer (throws on failure). The single provider swap-point.
async function ttsElevenLabs(text) {
  reserve(text);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE}`, {
    method: 'POST',
    headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: EL_MODEL,
      // style + speed carry the countdown PACE; seed keeps the presenter consistent clip-to-clip.
      voice_settings: {
        stability: EL_STABILITY,
        similarity_boost: EL_SIMILARITY,
        style: EL_STYLE,
        use_speaker_boost: EL_SPEAKER_BOOST,
        speed: EL_SPEED,
      },
      seed: EL_SEED,
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs HTTP ${res.status} — ${(await res.text().catch(() => '')).slice(0, 140)}`);
  return Buffer.from(await res.arrayBuffer());
}
async function ttsOpenAI(text) {
  reserve(text);
  const body = { model: OPENAI_TTS_MODEL, voice: OPENAI_TTS_VOICE, input: text, response_format: 'mp3' };
  if (/gpt-4o/.test(OPENAI_TTS_MODEL)) body.instructions = OPENAI_TTS_INSTRUCTIONS; // tts-1/tts-1-hd ignore this
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI TTS HTTP ${res.status} — ${(await res.text().catch(() => '')).slice(0, 140)}`);
  return Buffer.from(await res.arrayBuffer());
}
// ── Presenter track FALLBACKS (used when no app-written --ai-script line is supplied) ──
// Fixed, repeatable ToP intro — spoken over the cold-open.
const INTRO_SCRIPT = process.env.AI_TOP5_INTRO ||
  "Annnnd today, we've got the rockin', poppin', top five A.I. stories — just for you!";
// Fixed sign-off — spoken over the sign-off card.
const SIGNOFF_SCRIPT = process.env.AI_TOP5_SIGNOFF ||
  "And that's your A.I. Top Five! We'll be back tomorrow with five more — see you then!";

// Query the live ElevenLabs quota so the cost log reports REAL credits used/remaining this period.
// On the character-based plans, 1 character ≈ 1 credit (eleven_multilingual_v2).
async function reportUsage(charsThisRun) {
  if (!EL_KEY) return;
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': EL_KEY } });
    if (!res.ok) { console.log(`[vo] quota: could not read (HTTP ${res.status})`); return; }
    const s = await res.json();
    const used = s.character_count, limit = s.character_limit;
    if (typeof used !== 'number' || typeof limit !== 'number') return;
    const remaining = Math.max(0, limit - used);
    const perVideo = charsThisRun || 1500;
    const reset = s.next_character_count_reset_unix ? new Date(s.next_character_count_reset_unix * 1000).toISOString().slice(0, 10) : '?';
    console.log(`[vo] quota: ${used.toLocaleString()}/${limit.toLocaleString()} credits used this period — ${remaining.toLocaleString()} left (≈${Math.floor(remaining / perVideo)} more videos at ~${perVideo}/video; resets ${reset}).`);
  } catch (e) { console.log(`[vo] quota: ${e.message}`); }
}

/**
 * Measure a FINISHED clip, given its public-relative path ("vo/3.mp3"). null if unmeasurable.
 *
 * This is what drives the per-story segment length (design bible §7 V2): the video no longer
 * assumes every story is the same length, it asks how long this one's read actually is. Exported
 * rather than folded into generateVoiceovers' return value so the existing {n: path} contract —
 * which repair-vo.mjs also depends on — is left alone.
 */
export function probeClipFrames(publicRelPath) {
  if (!publicRelPath) return null;
  return probeFrames(join(ROOT, 'public', publicRelPath));
}

// Measure an audio file's duration in frames (ffprobe). null on failure.
function probeFrames(path) {
  try {
    const r = spawnSync(resolveFfprobe(), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path], { encoding: 'utf8', timeout: 30000 });
    const sec = parseFloat((r.stdout || '').trim());
    return Number.isFinite(sec) && sec > 0 ? Math.round(sec * FPS) : null;
  } catch { return null; }
}

// Concat [lead-in silence][hook][gap silence][news] into one mp3 (re-encoded filter form —
// safe across sample-rate/channel differences). Returns {ok, err}.
function concatClip(hookPath, gapSec, newsPath, outPath, leadFrames = LEAD_IN_FRAMES) {
  const leadSec = (leadFrames / FPS).toFixed(3);
  const args = [
    '-y',
    '-f', 'lavfi', '-t', leadSec, '-i', 'anullsrc=r=44100:cl=mono',            // 0: lead-in silence
    '-i', hookPath,                                                            // 1: hook
    '-f', 'lavfi', '-t', gapSec.toFixed(3), '-i', 'anullsrc=r=44100:cl=mono',  // 2: gap silence
    '-i', newsPath,                                                            // 3: news
    '-filter_complex', '[0:a][1:a][2:a][3:a]concat=n=4:v=0:a=1[out]',
    '-map', '[out]', '-c:a', 'libmp3lame', '-q:a', '4', outPath,
  ];
  const r = spawnSync(resolveFfmpeg(), args, { encoding: 'utf8', timeout: 60000 });
  return { ok: r.status === 0 && existsSync(outPath), err: (r.stderr || r.error?.message || '').toString() };
}

/**
 * Voice ONE lane and write it, using the same provider/voice/settings the edition used.
 *
 * Exists so a single transient TTS failure can be repaired for the cost of that one line instead
 * of a full re-run. On 2026-07-30 the intro call failed with `fetch failed` and the only recovery
 * path was regenerating the whole edition — ~1,542 credits to fix 44 characters, which in practice
 * means the broken video ships. See scripts/repair-vo.mjs.
 *
 * Retries once on a transient failure, because that is what the original fault was.
 */
export async function ttsOne(text, file, label = 'lane', tries = 2) {
  const t = (text || '').trim();
  if (!t) { console.error(`[vo] ${label}: no text`); return null; }
  for (let a = 1; a <= tries; a++) {
    try {
      const buf = PROVIDER === 'openai' ? await ttsOpenAI(t) : await ttsElevenLabs(t);
      mkdirSync(VO_DIR, { recursive: true });
      writeFileSync(join(VO_DIR, file), buf);
      console.log(`[vo] ${label}: ${t.length} chars → vo/${file} (${buf.length} bytes)`);
      return `vo/${file}`;
    } catch (e) {
      console.error(`[vo] ${label}: attempt ${a}/${tries} failed — ${e.message}`);
      if (a === tries) return null;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return null;
}

export async function generateVoiceovers(stories, opts = {}) {
  if (PROVIDER === 'none' || (PROVIDER === 'openai' && !OPENAI_KEY) || (PROVIDER === 'elevenlabs' && !EL_KEY)) {
    console.log(`[vo] no TTS key for provider "${PROVIDER}" — skipping TTS; video will be silent.`);
    return {};
  }
  if (PROVIDER === 'openai') {
    console.log(`[vo] provider=openai model=${OPENAI_TTS_MODEL} voice=${OPENAI_TTS_VOICE}`);
  } else {
    const src = process.env.ELEVENLABS_VOICE_ID ? 'env' : (EL_REG ? `registry:${EL_ROLE}` : 'built-in default');
    console.log(`[vo] provider=elevenlabs model=${EL_MODEL} voice=${EL_VOICE} (${src})${EL_REG?.label ? ` "${EL_REG.label}"` : ''}`);
    console.log(`[vo] settings stability=${EL_STABILITY} similarity=${EL_SIMILARITY} style=${EL_STYLE} speed=${EL_SPEED} speaker_boost=${EL_SPEAKER_BOOST} seed=${EL_SEED}`);
  }
  // Clear stale VO from prior runs (so audio never lands on the wrong day's stories).
  rmSync(VO_DIR, { recursive: true, force: true });
  mkdirSync(VO_DIR, { recursive: true });

  const result = {};
  let totalChars = 0, ok = 0, fail = 0;

  // One TTS call → one mp3. Returns the public-relative path on success, null on failure.
  // label is for logging; a failure is non-fatal (that clip is just silent).
  const tts = async (text, file, label) => {
    const t = (text || '').trim();
    if (!t) { console.log(`[vo] ${label}: no text — skipped`); return null; }
    try {
      const buf = PROVIDER === 'openai' ? await ttsOpenAI(t) : await ttsElevenLabs(t);
      writeFileSync(join(VO_DIR, file), buf);
      trimEdges(join(VO_DIR, file));   // same TTS padding as the story parts — see ttsPart below
      totalChars += t.length; ok++;
      console.log(`[vo] ${label}: ${t.length} chars → vo/${file} (${buf.length} bytes)`);
      return `vo/${file}`;
    } catch (e) { console.error(`[vo] ${label}: ${e.message}`); fail++; return null; }
  };

  // Presenter intro + sign-off. App-written script (opts) wins; else the fixed lines above.
  result.intro = await tts(opts.introScript || INTRO_SCRIPT, 'intro.mp3', 'intro');
  result.signoff = await tts(opts.signoffScript || SIGNOFF_SCRIPT, 'signoff.mp3', 'signoff');

  // TTS one beat → a temp part file. Returns {path, chars}; path null on failure (non-fatal).
  //
  // The take is EDGE-TRIMMED before it goes anywhere. ElevenLabs pads silence onto both ends, so
  // without this every downstream number is measured on speech-plus-padding: probeFrames() over-reads
  // the hook, the concat's computed gap lands at 1.4-1.9s instead of the intended HOOK_TAIL_FRAMES
  // (0.5s), and the hook cap rejects takes that would have fitted. Trimming here fixes all three at
  // once because everything after this point measures the same file. Failure is non-fatal by
  // contract — trimEdges leaves the file untouched and we carry on.
  const ttsPart = async (text, file, label) => {
    const t = (text || '').trim();
    if (!t) return { path: null, chars: 0 };
    try {
      const buf = PROVIDER === 'openai' ? await ttsOpenAI(t) : await ttsElevenLabs(t);
      const p = join(VO_DIR, file);
      writeFileSync(p, buf);
      const trim = trimEdges(p);
      if (trim.trimmed) {
        console.log(`[vo] ${label}: edge-trimmed ${trim.before.toFixed(2)}s -> ${trim.after.toFixed(2)}s ` +
                    `(-${Math.round((trim.before - trim.after) * FPS)}f of TTS padding)`);
      }
      return { path: p, chars: t.length };
    } catch (e) { console.error(`[vo] ${label}: ${e.message}`); return { path: null, chars: 0 }; }
  };

  // TTS and measure against `capFrames`, walking a ladder of progressively shorter takes. Two modes:
  //  - opts.candidates: an explicit list of texts to try in order (hooks: full → announcement only →
  //    canonical "Number N!"). Every candidate is MEANINGFUL by construction — no word-level trimming
  //    that can degrade into gibberish (the "Number five! A deep!" bug, 2026-07-17).
  //  - opts.unit='sentence': drop a trailing sentence and re-TTS, up to FIT_TRIES (news reads —
  //    sentences stay sensible).
  // Returns {path, chars, frames, text}; chars totals every attempt (honest cost log). The file on
  // disk is always the last take tried. A fit miss ships the shortest take — never a truncated one.
  const ttsFitted = async (text, file, label, capFrames, { unit = 'sentence', minWords = 3, candidates = null } = {}) => {
    const ladder = candidates
      ? [...new Set(candidates.map((c) => (c || '').trim()).filter(Boolean))]
      : null;
    let cur = ladder ? ladder[0] : (text || '').trim();
    let spentChars = 0;
    let last = { path: null, chars: 0, frames: null, text: cur };
    const maxAttempts = ladder ? ladder.length - 1 : FIT_TRIES;
    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      const part = await ttsPart(cur, file, `${label} (fit ${attempt})`);
      spentChars += part.chars;
      if (!part.path) return { path: null, chars: spentChars, frames: null, text: cur };
      const frames = probeFrames(part.path);
      last = { path: part.path, chars: spentChars, frames, text: cur };
      if (frames == null || frames <= capFrames) {
        if (attempt > 0) console.log(`[vo] ${label}: fitted as "${cur}"`);
        return last;      // unmeasurable or fits → done (on disk)
      }
      let next = ladder
        ? ladder[attempt + 1]
        : (dropTrailingSentence(cur) || dropTrailingClause(cur, CLAUSE_MIN_WORDS));
      // Reject a candidate that ends on a dangling abbreviation, whichever rung produced it.
      // Better to ship the untrimmed line and let the next attempt handle length than to voice
      // "...workplace roles as A." — which is what nearly went to air on 2026-07-28.
      if (endsOnAbbrev(next)) {
        console.error(`[vo] ${label}: trim candidate ended on an abbreviation ("${next.slice(-40)}") — rejected`);
        const retry = dropTrailingClause(next, minWords);
        next = endsOnAbbrev(retry) ? '' : retry;
      }
      if (!next || next === cur || (!ladder && wordCount(next) < minWords)) {
        console.error(`[vo] ${label}: could not fit under ${capFrames}f (${frames}f) — shipping "${cur}"`);
        return last;
      }
      console.error(`[vo] ${label}: ${frames}f > ${capFrames}f cap — re-voicing as "${next}"`);
      cur = next;
    }
    return last;
  };

  // Per story: hook (creative) + news (accurate) → measure hook → frame-accurate concat → vo/<n>.mp3.
  const buildStoryClip = async (story) => {
    const n = story.n;
    const hookText = story.hookScript || story.cue || `Number ${n}.`;
    const newsText = story.newsScript || story.voiceover || story.summary || '';
    // Fit each lane to the fixed story window: hook under the CUE cap (keeps the news reveal locked
    // at NEWS_START_FRAME), news under NEWS_CAP_FRAMES (keeps its tail off the whip-pan boundary).
    // Hook ladder: full hook → rank announcement only → canonical. Each rung is meaningful; the
    // flourish is dropped WHOLE when it doesn't fit, never word-trimmed into nonsense.
    const hook = await ttsFitted(hookText, `${n}_hook.mp3`, `#${n} hook`, HOOK_CAP_FRAMES, {
      candidates: [hookText, firstSegment(hookText), `Number ${n}!`],
    });
    // minWords 12 (was 25): the V2 story window (681f -> 540f news cap) means the sentence-drop
    // fallback often lands ~20 words; the old floor refused that and shipped over-ceiling audio,
    // which the story <Sequence> then hard-clips MID-SENTENCE. A short clean sentence beats a cut one.
    const news = await ttsFitted(newsText, `${n}_news.mp3`, `#${n} news`, NEWS_CAP_FRAMES, { unit: 'sentence', minWords: 12 });
    totalChars += hook.chars + news.chars;
    const outRel = `vo/${n}.mp3`, outPath = join(VO_DIR, `${n}.mp3`);
    const cleanup = () => { for (const f of [`${n}_hook.mp3`, `${n}_news.mp3`]) { try { rmSync(join(VO_DIR, f), { force: true }); } catch { /* noop */ } } };
    const shipOnly = (src, why) => { console.error(`[vo] #${n}: ⚠ LANE LOSS — ${why}`); writeFileSync(outPath, readFileSync(src)); cleanup(); ok++; return outRel; };

    if (hook.path && news.path) {
      const hookFrames = hook.frames ?? probeFrames(hook.path);
      if (hookFrames == null) { console.error(`[vo] #${n}: WARN could not measure hook — news-only`); return shipOnly(news.path, 'hook unmeasurable'); }
      if (hookFrames > HOOK_CAP_FRAMES) console.error(`[vo] #${n}: WARN hook ${hookFrames}f still > ${HOOK_CAP_FRAMES}f after fit — reveal timing may slip`);
      // right-align: hook ENDS one beat before the news read, whatever length it fitted to
      const hookEnd = NEWS_START_FRAME - HOOK_TAIL_FRAMES;
      const leadFrames = Math.max(LEAD_IN_FRAMES, hookEnd - hookFrames);
      const gapFrames = Math.max(0, NEWS_START_FRAME - (leadFrames + hookFrames));
      const t0 = Date.now();
      const { ok: cok, err } = concatClip(hook.path, gapFrames / FPS, news.path, outPath);
      const dt = Date.now() - t0;
      if (cok) {
        const newsStart = leadFrames + hookFrames + gapFrames;
        const newsEnd = news.frames != null ? newsStart + news.frames : null;
        const tail = newsEnd != null ? STORY_TOTAL_FRAMES - newsEnd : null;
        const fit = newsEnd == null ? '' : newsEnd <= VO_MAX_END_FRAME
          ? `  ends@${newsEnd}f (tail ${tail}f ✓)`
          : `  ends@${newsEnd}f — OVER ceiling ${VO_MAX_END_FRAME}f by ${newsEnd - VO_MAX_END_FRAME}f`;
        console.log(`[vo] #${n}: lead ${leadFrames}f + hook ${hookFrames}f + gap ${gapFrames}f → news@${newsStart}f  (concat ${dt}ms)${fit} → ${outRel}`);
        cleanup(); ok++; return outRel;
      }
      console.error(`[vo] #${n}: WARN concat failed (${err.slice(-160)}) — news-only`);
      return shipOnly(news.path, 'concat failed');
    }
    if (news.path) return shipOnly(news.path, 'no hook, shipping news-only');
    if (hook.path) return shipOnly(hook.path, 'no news, shipping hook-only');
    console.error(`[vo] #${n}: ⚠ both lanes failed — SILENT story`); cleanup(); fail++; return null;
  };

  for (const story of stories) {
    result[story.n] = await buildStoryClip(story);
  }

  console.log(`[vo] done — ${ok} ok, ${fail} failed. chars=${totalChars}  provider=${PROVIDER}`);
  if (PROVIDER === 'elevenlabs') {
    console.log(`[vo] (≈${totalChars} credits this run; ElevenLabs ${EL_MODEL}, stability ${EL_STABILITY})`);
    await reportUsage(totalChars);
  } else if (PROVIDER === 'openai') {
    const est = (totalChars * OPENAI_RATE_PER_CHAR).toFixed(4);
    console.log(`[vo] est cost ~$${est} (OpenAI ${OPENAI_TTS_MODEL}, voice ${OPENAI_TTS_VOICE}; ~$15/1M chars).`);
  }
  return result;
}

// bed helper: returns "audio/bed.mp3" if the operator has dropped one in, else null.
export function bedIfPresent() {
  const p = join(ROOT, 'public', 'audio', 'bed.mp3');
  try { return existsSync(p) && statSync(p).size > 1000 ? 'audio/bed.mp3' : null; } catch { return null; }
}

// standalone (cross-platform: compare resolved native paths, not file:// strings — Windows-safe)
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const arg = process.argv[2];
  if (!arg || !existsSync(arg)) { console.error('Usage: node generate-vo.mjs <data.json with {stories:[{n,voiceover}]}>'); process.exit(2); }
  const data = JSON.parse(readFileSync(arg, 'utf8'));
  generateVoiceovers(data.stories || []).then((m) => console.log('[vo] map:', JSON.stringify(m)));
}
