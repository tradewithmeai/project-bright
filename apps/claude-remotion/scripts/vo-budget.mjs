/**
 * vo-budget.mjs — ONE source of truth for how much speech fits in a story.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * There were three budgets and they disagreed:
 *
 *   write-script.mjs  "about 48 words (max 55) ... spoken in ~20 seconds"
 *   generate-vo.mjs   NEWS_CAP_FRAMES = 540f = 18.0 s
 *   the presenter     actually delivered 603-674f = 20.1-22.5 s
 *
 * So the script was authored for a 20 s window, the window was 18 s, and the voice took 21 s.
 * Every read overran, and a "fit-to-window" guard then re-voiced it (double credits) and
 * amputated a sentence to make it fit. On 2026-07-28 that fired on 5 of 5 stories — story #3
 * lost the actual news, the Kimi K3 capability comparison, before it ever reached air.
 *
 * The gaps are the same bug seen from the other side: trimming shortens the audio but the story
 * slot stays 681f, so whatever the trim removed becomes silence.
 *
 * The guard was not the problem. The problem was asking the writer for more words than the
 * window holds and then destroying the difference. Two numbers in conflict, and code in the
 * middle papering over it every single day at a cost.
 *
 * HOW THE WINDOW WAS LOST
 * -----------------------
 * The story budget was cut 801 -> 681 frames when the takeaway section was removed
 * (2026-07-24). NEWS_CAP fell 660 -> 540 with it. Nobody told the script writer, and
 * generate-vo.mjs's own comments still say "660" to this day. Every first-pass read on
 * 2026-07-28 was UNDER the old 660 cap: 603, 613, 621, 649, 674. The copy was never too long
 * for the show it was written for — the show got shorter underneath it.
 *
 * THE RULE
 * --------
 * The window is the authority. The word target is DERIVED from it at the measured speaking
 * rate, and the prompt string is built from that number rather than restating it in prose.
 * If the window changes, the ask changes automatically. There is nothing left to keep in sync.
 */

// ── the window (must match generate-vo.mjs, which imports these) ────────────
export const FPS = 30;
export const STORY_TOTAL_FRAMES = 615;   // = tokens.ts STORY_TOTAL_FRAMES (576 -> 615, 2026-08-04 cue widening)
export const STORY_TAIL_FRAMES = 30;     // speech-free tail so the whip-pan never cuts a word
export const NEWS_START_FRAME = 141;     // news begins at the REVEAL boundary (CUE 105 + STINGER 36)
// 3.5 s hook, raised from 2.5 s on 2026-08-04.
//
// 75f could not hold a rank announcement AND a flourish. Measured first-pass hooks: 113f, 110f, 120f,
// 122f, 99f, 101f, 97f — every one over. The ladder then dropped to the bare rank, so "Which brings us
// to number one..." became "Number 1!" on SIX consecutive days, and on 08-04 four of five hooks were
// stripped to bare ranks. The hook-shape rotation added the day before never reached the screen either,
// because the shapes were amputated with the words.
//
// This was not the guard misbehaving. It was a budget that could not fit what the writer was asked for,
// and code quietly resolving the contradiction every day at the presenter's expense. 105f fits the
// observed range; the cue window in tokens.ts widened by the same 30f so the news read still starts on
// its own boundary.
export const HOOK_CAP_FRAMES = 105;

export const VO_MAX_END_FRAME = STORY_TOTAL_FRAMES - STORY_TAIL_FRAMES;   // 651
export const NEWS_CAP_FRAMES = VO_MAX_END_FRAME - NEWS_START_FRAME;       // 540 = 18.0 s

// ── the measured speaking rate ──────────────────────────────────────────────
// NOT a guess and not a generic "anchor pace". Measured from the 2026-07-28 edition, where the
// writer was asked for ~50 words and the five first-pass reads came in at 674/649/621/613/603
// frames — a mean of 632f = 21.07 s, i.e. 2.37 words/second for THIS presenter voice.
// Re-measure whenever the voice changes; a new voice is exactly what invalidates this.
export const WORDS_PER_SECOND = 2.37;
export const RATE_MEASURED_ON = '2026-07-28 edition, 5 reads, mean 632f for ~50 words';

// Aim to land comfortably inside the window rather than exactly on it. At 100% of the cap the
// guard fires on any read that runs even slightly long, and re-voicing is what we are removing.
export const SAFETY = 0.90;

export const newsWordTarget = () =>
  Math.floor((NEWS_CAP_FRAMES / FPS) * WORDS_PER_SECOND * SAFETY);        // 38
export const newsWordMax = () =>
  Math.floor((NEWS_CAP_FRAMES / FPS) * WORDS_PER_SECOND);                 // 42
export const newsSeconds = () => (NEWS_CAP_FRAMES / FPS) * SAFETY;        // 16.2

/** The NEWS budget sentence for the script prompt, built from the numbers above. */
export const newsBudgetLine = () =>
  `about ${newsWordTarget()} words (max ${newsWordMax()}), ONE flowing paragraph spoken in ` +
  `~${newsSeconds().toFixed(0)} seconds at a steady anchor pace`;

export const describe = () =>
  `story ${STORY_TOTAL_FRAMES}f | news window ${NEWS_CAP_FRAMES}f (${(NEWS_CAP_FRAMES / FPS).toFixed(1)}s) ` +
  `| rate ${WORDS_PER_SECOND} w/s | target ${newsWordTarget()}w max ${newsWordMax()}w`;

// ── the last drift path, closed ─────────────────────────────────────────────
// STORY_TOTAL_FRAMES above still duplicates tokens.ts, because a .mjs cannot import a .ts.
// That duplication is exactly what caused this whole mess: tokens.ts went 801 -> 681 and this
// side never followed. So instead of trusting a comment to keep them equal, READ the real value
// out of tokens.ts and refuse to run if they disagree. A wrong number now stops the pipeline
// instead of quietly amputating a sentence from every story for four days.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function assertMatchesTokens() {
  const tokensPath = join(dirname(fileURLToPath(import.meta.url)),
                          '..', 'src', 'templates', 'ai_top5', 'tokens.ts');
  if (!existsSync(tokensPath)) return { ok: true, skipped: 'tokens.ts not found' };
  const src = readFileSync(tokensPath, 'utf8');
  const val = (name) => {
    const m = src.match(new RegExp(`export const ${name}\\s*=\\s*(\\d+)`));
    return m ? Number(m[1]) : null;
  };
  const parts = ['STORY_CUE_FRAMES', 'STORY_STINGER_FRAMES', 'STORY_REVEAL_FRAMES',
                 'STORY_BEATS_FRAMES', 'STORY_EXPLAINER_FRAMES', 'STORY_TAKEAWAY_FRAMES'];
  const nums = parts.map(val);
  if (nums.some((n) => n === null)) return { ok: true, skipped: 'could not parse tokens.ts' };
  const total = nums.reduce((a, b) => a + b, 0);
  const ok = total === STORY_TOTAL_FRAMES;
  if (!ok) {
    throw new Error(
      `vo-budget.mjs STORY_TOTAL_FRAMES=${STORY_TOTAL_FRAMES} but tokens.ts sums to ${total} ` +
      `(${parts.map((p, i) => `${p}=${nums[i]}`).join(' + ')}). The video window and the VO ` +
      `budget have drifted apart — this is the bug that amputated a sentence from every story. ` +
      `Update vo-budget.mjs to ${total} and re-check newsWordTarget().`);
  }
  return { ok, total };
}
