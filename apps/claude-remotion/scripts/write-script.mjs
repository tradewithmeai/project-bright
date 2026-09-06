#!/usr/bin/env node
/**
 * write-script.mjs — app-side script writer for the AI Top 5 video (Architecture A).
 *
 * One LLM call reads ALL five stories' FACTS (from the website's facts API) and writes the
 * ENTIRE spoken script in one consistent Top-of-the-Pops presenter voice: show intro, five
 * story-aware countdown openers, five conversational narrations, and a sign-off — with full
 * cross-story context. The website no longer supplies any voiceover; the studio owns the voice.
 *
 * generate-vo.mjs then TTS-voices these strings (LLM script → API voiceover → summary fallback).
 *
 * Env:
 *   OPENAI_API_KEY        (required to write; absent → returns null and fixed-pool fallbacks take over)
 *   AI_TOP5_SCRIPT_MODEL  (default: gpt-4o-mini)
 *
 * Two-lane split (design bible §5.1): per story the model writes a CREATIVE presenter `hook`
 * (states the ranked place + a bounded flourish, NO facts) and an ACCURATE `news` line (the
 * day's facts). generate-vo TTS's each and concats them into one frame-accurate mp3.
 *
 * Exported: writeScript(bulletin, opts) -> { intro, signoff, stories: {[n]:{hook,news}} } | null
 * Standalone: node write-script.mjs <facts.json>
 *   where facts.json = { date, stories:[{ n|rank, headline, beats, takeaway, summary, source, cue }] }
 */
import '../../../scripts/load-env.mjs';   // load repo-root .env before reading OPENAI_API_KEY below
import { newsBudgetLine, describe as voBudgetDescribe } from './vo-budget.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const MODEL = process.env.AI_TOP5_SCRIPT_MODEL || 'gpt-4o-mini';
// gpt-4o-mini list price (estimate for the cost log): $0.15 / 1M input, $0.60 / 1M output.
const RATE_IN = 0.15 / 1e6;
const RATE_OUT = 0.60 / 1e6;

const wc = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;

// ── Hook de-duplication (#67 guard) ───────────────────────────────────────────────
// The five hooks are written in one call, but a tight budget collapses the creative lane into a
// small hype-phrase pool ("this one's hot" on two stories). We reduce each hook to its FLOURISH
// signature (drop the rank announcement + punctuation) and flag a collision so the caller can
// regenerate once with a stricter directive.
export const flourishSig = (hook) => (hook || '')
  .toLowerCase()
  .replace(/\bnumber\s+(one|two|three|four|five|1|2|3|4|5)\b/g, ' ')
  .replace(/\b(at|in at|coming in at|and at)\s+(one|two|three|four|five)\b/g, ' ')
  .replace(/[^a-z\s]/g, ' ')
  .replace(/\b(the|a|an|this|that|is|its|it|one|to|for|of|your|you|we|our)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export function hooksCollide(hooks) {
  const sigs = hooks.map(flourishSig);
  const grams = (s) => { const w = s.split(' ').filter(Boolean); const g = new Set(); for (let i = 0; i + 2 <= w.length; i++) g.add(w.slice(i, i + 2).join(' ')); return g; };
  for (let i = 0; i < sigs.length; i++) {
    for (let j = i + 1; j < sigs.length; j++) {
      const a = sigs[i], b = sigs[j];
      if (!a || !b) continue;
      if (a === b || a.includes(b) || b.includes(a)) return `${hooks[i]} ⟷ ${hooks[j]}`;
      const ga = grams(a); for (const g of grams(b)) if (ga.has(g)) return `${hooks[i]} ⟷ ${hooks[j]}`;
    }
  }
  return null;
}

// ── Sign-off "tomorrow" guard (#64) ───────────────────────────────────────────────
// The model occasionally doubles "tomorrow" ("...tomorrow's surprises, see you tomorrow"). Rare and
// ── the LANE WALL (#87) ──────────────────────────────────────────────────────
// The hook is the CREATIVE lane and must assert no facts; the news line carries them. The prompt
// has said so since v6, and the model mostly complies — but "mostly" is not a wall, and a hook
// that leaks a figure or a company name reads as news delivered in a party voice, which is the
// exact tonal failure the two-lane split exists to prevent.
//
// Digits are the unambiguous half. Entity names are the interesting half: they are taken from the
// DAY'S OWN STORIES rather than a fixed list, so the wall moves with the feed instead of going
// stale. Ranked-place words are exempt — announcing the place is the hook's job.
const RANK_WORDS = new Set(['one', 'two', 'three', 'four', 'five', 'number', 'no', 'at']);

/** Proper nouns and acronyms worth guarding, harvested from the day's headlines. */
export function entityVocab(stories) {
  const out = new Set();
  for (const s of stories || []) {
    const text = `${s.headline || ''} ${s.detail || ''} ${s.so_what || ''}`;
    for (const m of text.match(/\b[A-Z][A-Za-z0-9+.-]{2,}\b/g) || []) {
      const w = m.toLowerCase();
      if (!RANK_WORDS.has(w)) out.add(w);
    }
  }
  return out;
}

/**
 * Why a hook breaches the lane wall, or null. Checks ONE hook.
 * Digits: any numeral that is not part of an ordinal place ("number 5" is the hook's job).
 */
export function hookLeaksFacts(hook, vocab) {
  const h = (hook || '').trim();
  if (!h) return null;
  // strip the ranked-place announcement before looking for numerals
  const body = h.replace(/\b(number|no\.?|at)\s*(one|two|three|four|five|[1-5])\b/gi, ' ')
                .replace(/\bnumber\b/gi, ' ');
  const digit = body.match(/\d/);
  if (digit) return `digit "${digit[0]}" in the hook`;
  for (const w of body.toLowerCase().match(/\b[a-z][a-z0-9+.-]{2,}\b/g) || []) {
    if (vocab.has(w)) return `entity "${w}" in the hook`;
  }
  return null;
}

/** Every breach across the five hooks, as a printable list. */
export function laneWallBreaches(stories, vocab) {
  const bad = [];
  for (const [n, st] of Object.entries(stories || {})) {
    const why = hookLeaksFacts(st && st.hook, vocab);
    if (why) bad.push(`#${n}: ${why} — "${st.hook}"`);
  }
  return bad;
}

// non-deterministic, so we don't burn a regen on it — if the sign-off names tomorrow more than once,
// swap in a clean curated line (each has exactly one "tomorrow"), chosen deterministically by date so
// it still varies day to day. No Date.now() (keeps runs reproducible).
const CLEAN_SIGNOFFS = [
  "That's your top five — see you tomorrow for five more!",
  "That's the countdown — back tomorrow with a fresh five!",
  "That's your A.I. top five — catch us again tomorrow!",
  "That's the lot — same time tomorrow for five more!",
];
export const tomorrowCount = (s) => ((s || '').match(/tomorrow/gi) || []).length;
export function guardSignoff(signoff, date) {
  if (tomorrowCount(signoff) <= 1) return signoff;
  const idx = [...String(date || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % CLEAN_SIGNOFFS.length;
  console.error(`[script] sign-off named tomorrow ${tomorrowCount(signoff)}× — swapped to a clean curated line (#64 guard)`);
  return CLEAN_SIGNOFFS[idx];
}

// ── Hook-shape rotation (design bible §7 V1.5 / §8.3) ─────────────────────────────
// The persona card has always carried a catchphrase pool and the instruction to "vary day to day",
// and the prompt has always said "make every flourish DISTINCT". Neither is a mechanism. The model
// was left to be spontaneous on its own, five times a day, forever — and the daily logs show what
// that produces: hooks collapsing toward the same handful of shapes, and #1 falling back to a bare
// "Number 1!" on five consecutive days (2026-07-30 to 08-03).
//
// So the SHAPE is assigned rather than hoped for. Each story gets a different one, and the starting
// shape advances with the date, so consecutive editions do not open the same way. Assignment is
// deterministic from the date string alone — no clock, no randomness, reproducible on a re-run.
//
// These are FORMS, not stock lines. The catchphrase pool in persona.md stays as flavour the model
// may draw on; this decides the kind of sentence, which is the thing that was actually repeating.
export const HOOK_SHAPES = [
  { key: 'TEASE',       how: 'a withheld promise — hint that this one is worth waiting for, without saying why' },
  { key: 'PROVOCATION', how: 'a cheeky challenge to the viewer — dare them to disagree or to have missed it' },
  { key: 'IMPERATIVE',  how: 'a direct instruction — tell the viewer to do something (listen, sit up, watch this)' },
  { key: 'QUESTION',    how: 'a short rhetorical question that sets up the story without answering it' },
  { key: 'DECLARATION', how: 'a flat confident statement of importance — no hedging, no question' },
];

/** Stable small integer from a date string — same input, same rotation, every run. */
export const dateSeed = (date) =>
  [...String(date || '')].reduce((a, c) => a + c.charCodeAt(0), 0);

/**
 * Shape per story, in reveal order (#5 first). Different shape for every story in an edition, and
 * the whole assignment rotates with the date.
 */
export function assignHookShapes(ranks, date) {
  const off = dateSeed(date) % HOOK_SHAPES.length;
  const out = {};
  ranks.forEach((n, i) => { out[n] = HOOK_SHAPES[(off + i) % HOOK_SHAPES.length]; });
  return out;
}

const SYSTEM = [
  "You are the scriptwriter for \"AI Top 5\", a daily Top-of-the-Pops style countdown video of the day's biggest A.I. news.",
  "Write the ENTIRE spoken script in ONE consistent voice: an energetic, upbeat radio-DJ presenter — playful and warm, credible, never parody-cheesy.",
  "You see all five stories at once: make the countdown flow, vary the phrasing across stories, and never repeat yourself.",
  "Spoken-word conventions: write \"A.I.\" (not \"AI\"), spell out numbers where it reads naturally, plain text only — no markdown, no emojis, no stage directions, no quotation marks around lines.",
  "Stay faithful to the facts given. Do not invent names, numbers, or claims that are not in the story facts.",
  "Each story has TWO lanes: a CREATIVE presenter HOOK (announce the ranked place + set the tone, hyped and playful, but assert NO facts) and an ACCURATE NEWS line (the day's facts). Keep facts OUT of the hook — no numbers, names, or outcomes there; those live only in the news line.",
].join(' ');

// ── Persona seed (design bible §6.4) ───────────────────────────────────────────
// THE COUNTDOWN — the FIXED presenter card, read-only to generation. If persona.md
// exists it is condensed and PREPENDED to SYSTEM; if absent or unreadable, the base
// SYSTEM above is used exactly as-is (non-fatal — the show still ships).
const PERSONA_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..', 'src', 'templates', 'ai_top5', 'persona.md',
);
const PERSONA_MAX_CHARS = 2600; // cap the condensed card so it never bloats the prompt (current card ≈2.3k)

function condensePersona(md) {
  return md
    .split('\n')
    .map((l) => l
      .replace(/^>\s?/, '')          // blockquote markers
      .replace(/^#{1,6}\s+/, '')     // headings
      .replace(/^[-*]\s+/, '')       // bullets
      .replace(/^\d+\.\s+/, ''))     // numbered list markers
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\*\*/g, '')            // bold markers
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PERSONA_MAX_CHARS);
}

let personaBlock = '';
try {
  if (existsSync(PERSONA_PATH)) {
    personaBlock = condensePersona(readFileSync(PERSONA_PATH, 'utf8'));
    if (personaBlock) console.log(`[script] persona card loaded from persona.md (${personaBlock.length} chars condensed)`);
  } else {
    console.log('[script] persona.md not found — using base SYSTEM prompt');
  }
} catch (e) {
  personaBlock = ''; // non-fatal: unreadable card → base SYSTEM only
  console.error(`[script] persona.md unreadable (${e.message}) — using base SYSTEM prompt`);
}

const SYSTEM_PROMPT = personaBlock
  ? `PRESENTER PERSONA CARD — "THE COUNTDOWN" (fixed, read-only; embody it exactly): ${personaBlock}\n\n${SYSTEM}`
  : SYSTEM;

function buildUserPrompt(bulletin) {
  const date = bulletin.date || '';
  const stories = (bulletin.stories || []).slice().sort((a, b) => (b.n ?? b.rank) - (a.n ?? a.rank));
  const shapes = assignHookShapes(stories.map((s) => s.n ?? s.rank), date);
  const factLines = stories.map((s) => {
    const n = s.n ?? s.rank;
    const beats = Array.isArray(s.beats) ? s.beats.filter(Boolean).join(' / ') : '';
    return [
      `#${n} — ${s.headline || s.title || ''}`,
      `   (on-screen cue, for context only — do NOT read verbatim in the hook): ${s.cue || `Number ${n}…`}`,
      `   on-screen beats (do NOT read these verbatim): ${beats}`,
      `   on-screen takeaway (do NOT read verbatim): ${s.takeaway || ''}`,
      `   MATERIAL for the NEWS anchor read (paraphrase into flowing speech — do NOT quote the cards) — what happened: ${s.summary || s.voiceover || ''}`,
      `   why it matters (work this in as the "so what"): ${s.so_what || ''}`,
      s.detail ? `   key number/name (you may say it naturally, don't just read the card): ${s.detail}` : '',
      s.source ? `   source: ${s.source}` : '',
      `   HOOK SHAPE for this story (required, and different for every story today): ${shapes[n].key} — ${shapes[n].how}`,
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  return [
    `Today is ${date}. Here are today's five A.I. stories, revealed #5 first up to #1 (the finale):`,
    '',
    factLines,
    '',
    'For EACH story write TWO separate spoken beats — a presenter HOOK and the NEWS — plus one intro and one signoff. Fit these budgets (hard ceilings tied to the video timeline):',
    '- intro: about 14 words (max 18). An energetic show open that hypes "today\'s top five A.I. stories". Do NOT name any specific story.',
    '- per story HOOK (presenter, CREATIVE lane): about 5 words, HARD MAX 7 — it must be SHORT (spoken in ~2.3 seconds). Briefly announce the ranked place in your OWN few words (e.g. "Number five!" / "At four…") — do NOT read the long on-screen cue verbatim — then ONE snappy creative flourish that fits THIS story\'s vibe. Assert NO fact — no numbers, names, or outcomes (those belong only in the news). Hyped and playful. CRITICAL: each story is ASSIGNED a HOOK SHAPE in its facts block above and its flourish MUST be written in that form — the five shapes are all different, and that is what stops the hooks converging. Within the assigned shape the wording is yours. Never reuse the same catchphrase or opener on more than one story (e.g. do not say "this one\'s hot", "the big one", or "hold on to your headphones" on two stories). Vary the announcement style down the countdown.',
    // The length budget is DERIVED from the video's actual news window (vo-budget.mjs), not
    // restated here in prose. It used to say "about 48 words ... ~20 seconds" against an 18.0 s
    // window at a voice that delivers 2.37 w/s — so every read overran and a guard amputated a
    // sentence and re-voiced it, daily. Two numbers in conflict with code papering over it.
    `- per story NEWS (the ANCHOR READ — the presenter narrates the whole story so the voice runs CONTINUOUSLY): ${newsBudgetLine()}. In your own words cover, in order: WHAT happened, then WHY it matters (the \"so what\" for a builder / founder / product lead), then the bottom line. This is the MAIN voiceover — keep it moving, only short pauses, NO dead air. Keep it TIGHT — the read has a hard time budget and a read that runs long gets cut off, so do not pad. PARAPHRASE the material — do NOT read the on-screen headline, beats, on-screen facts line, or takeaway verbatim; different words, flowing prose. Invent nothing not in the material.`,
    "- per story SCREEN (the on-screen facts line the viewer READS while the voice talks): about 22 words (max 28). State ONLY what happened — the event, the key numbers, the names — as clean plain facts. NO implication, NO \"why it matters\", NO source/outlet names, NO article boilerplate. It MUST NOT overlap the NEWS line: the FACTS live here, the WHY lives in the news.",
    "- signoff: about 10 words (max 13). A warm sign-off that teases tomorrow's edition.",
    '',
    'Respond with JSON only, exactly this shape:',
    '{ "intro": string, "signoff": string, "stories": [ { "rank": number, "hook": string, "news": string, "screen": string }, ... ] }',
  ].join('\n');
}

export async function writeScript(bulletin, opts = {}) {
  if (!OPENAI_KEY) {
    console.log('[script] OPENAI_API_KEY not set — skipping LLM script; presenter falls back to fixed pools + API/summary narration.');
    return null;
  }
  const stories = bulletin.stories || [];
  if (stories.length === 0) { console.error('[script] no stories — skipping'); return null; }
  const nums = stories.map((st) => st.n ?? st.rank);

  // One model call → parsed {intro, signoff, stories:{[n]:{hook,news,screen}}} | null. `extra` appends
  // a stricter directive to the user prompt (used on the anti-repeat regeneration).
  const attempt = async (extra) => {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(bulletin) + (extra ? `\n\n${extra}` : '') },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.8,   // intentional day-to-day variation in the presenter patter
          max_tokens: 1200,
        }),
      });
      if (!res.ok) {
        const e = await res.text().catch(() => '');
        console.error(`[script] HTTP ${res.status} — ${e.slice(0, 200)}`);
        return null;
      }
      const data = await res.json();
      const usage = data.usage || {};
      const est = ((usage.prompt_tokens || 0) * RATE_IN + (usage.completion_tokens || 0) * RATE_OUT).toFixed(5);
      console.log(`[script] ${MODEL}: in=${usage.prompt_tokens ?? '?'} out=${usage.completion_tokens ?? '?'} tokens  est cost ~$${est}`);

      const raw = data.choices?.[0]?.message?.content || '';
      let parsed;
      try { parsed = JSON.parse(raw); } catch { console.error('[script] model did not return valid JSON — falling back'); return null; }
      if (!parsed || typeof parsed.intro !== 'string' || typeof parsed.signoff !== 'string' || !Array.isArray(parsed.stories)) {
        console.error('[script] JSON missing required fields — falling back'); return null;
      }

      const byN = {};
      for (const s of parsed.stories) {
        const n = s.rank ?? s.n;
        if (n == null || typeof s.hook !== 'string' || typeof s.news !== 'string') continue;
        byN[n] = { hook: s.hook.trim(), news: s.news.trim(), screen: typeof s.screen === 'string' ? s.screen.trim() : '' };
      }
      // every story must have BOTH lanes, else fall back wholesale (no half-written runs)
      for (const n of nums) {
        if (!byN[n] || !byN[n].hook || !byN[n].news) {
          console.error(`[script] story #${n} missing hook or news — falling back`); return null;
        }
      }
      return { intro: parsed.intro.trim(), signoff: parsed.signoff.trim(), stories: byN };
    } catch (e) {
      console.error(`[script] ${e.message} — falling back`);
      return null;
    }
  };

  let result = await attempt(null);
  if (!result) return null;

  // #67 guard: if two hooks share a flourish, regenerate ONCE with a stricter directive; take the
  // retry only if it actually resolves the collision, else keep the first draft.
  const collision = hooksCollide(nums.map((n) => result.stories[n].hook));
  if (collision) {
    console.error(`[script] hook flourish collision (${collision}) — regenerating once, stricter anti-repeat`);
    const retry = await attempt('IMPORTANT: your previous draft reused a hook flourish across two stories. Rewrite so all FIVE hooks are completely distinct — different words, different imagery, no shared catchphrase or opener. This is a hard requirement.');
    if (retry && !hooksCollide(nums.map((n) => retry.stories[n].hook))) result = retry;
    else console.error('[script] regeneration did not clear the collision — keeping the first draft');
  }

  // #87 LANE WALL: a hook that asserts a fact gets ONE regeneration. Same discipline as the
  // collision guard — take the retry only if it actually clears the breach, never blindly.
  const VOCAB = entityVocab(bulletin.stories);
  let breaches = laneWallBreaches(result.stories, VOCAB);
  if (breaches.length) {
    console.error(`[script] LANE WALL breached by ${breaches.length} hook(s) — regenerating once:`);
    for (const b of breaches) console.error(`[script]   ${b}`);
    const retry = await attempt(
      'IMPORTANT: your previous draft put FACTS in the hook. The hook is the CREATIVE lane and must '
      + 'assert nothing: no numbers, no company or product names, no outcomes. Announce the ranked '
      + 'place and add one creative flourish, nothing more. All facts belong in the news line. '
      + 'Specifically fix: ' + breaches.join(' | '));
    const after = retry ? laneWallBreaches(retry.stories, VOCAB) : null;
    if (retry && after.length < breaches.length) {
      result = retry;
      breaches = after;
      console.error(`[script] regeneration reduced breaches to ${after.length}`);
    } else {
      console.error('[script] regeneration did not clear the lane wall — keeping the first draft');
    }
  }
  if (breaches.length) {
    // Report, never fail the run: a leaked hook is a quality defect, not a broken edition, and the
    // daily agent must not be blocked by it. It lands in the run log for the reliability history.
    console.error(`[script] LANE WALL: ${breaches.length} hook(s) still assert facts — logged, not blocking`);
  }
  result._laneWallBreaches = breaches;

  // #64 guard: no doubled "tomorrow" in the sign-off.
  result.signoff = guardSignoff(result.signoff, bulletin.date);

  // word-fit log (dry-run readability; soft — never fails the run)
  console.log(`[script] intro (${wc(result.intro)}w): ${result.intro}`);
  for (const n of nums) {
    console.log(`[script] #${n} hook   (${wc(result.stories[n].hook)}w): ${result.stories[n].hook}`);
    console.log(`[script] #${n} news   (${wc(result.stories[n].news)}w): ${result.stories[n].news}`);
    console.log(`[script] #${n} screen (${wc(result.stories[n].screen)}w): ${result.stories[n].screen}`);
  }
  console.log(`[script] signoff (${wc(result.signoff)}w): ${result.signoff}`);
  return result;
}

// standalone (Windows-safe: compare resolved native paths, not file:// strings)
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const arg = process.argv[2];
  if (!arg || !existsSync(arg)) {
    console.error('Usage: node write-script.mjs <facts.json with {date,stories:[{n|rank,headline,beats,takeaway,summary,source}]}>');
    process.exit(2);
  }
  const data = JSON.parse(readFileSync(arg, 'utf8'));
  writeScript({ date: data.date, stories: data.stories || [] }).then((m) => {
    if (!m) { console.error('[script] returned null'); process.exit(1); }
    console.log('\n[script] JSON:\n' + JSON.stringify(m, null, 2));
  });
}
