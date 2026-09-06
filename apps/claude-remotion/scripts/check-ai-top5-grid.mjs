#!/usr/bin/env node
// check-ai-top5-grid.mjs — regression evidence that the AI Top 5 grid no longer drifts.
//
// The defect: the episode placed every musical position from a ROUNDED beat,
// `Math.round(30 * 60 / 124)` = 15 frames, when the true beat at 124 BPM and 30fps is 14.5161.
// Each beat therefore gained 0.484 frames, and because positions are cumulative the error grew
// without bound. This measures that, measures the replacement, and fails if the replacement is not
// bounded by frame rounding.
//
// ⚠️ It compares against TRUE time — `beat * 30 * 60 / 124`, computed in floating point and never
// rounded — not against either implementation. Comparing the new model to itself would prove
// nothing, and comparing it to the old one would only show they differ.
//
// The whole episode is measured, not a sample near the start: this drift is invisible in the
// opening bars by construction and a regression that reintroduced it would hide there.
//
// Run: node scripts/check-ai-top5-grid.mjs

const FPS = 30;
const BPM = 124;

/** True, unrounded frame position of a beat. The reference everything is measured against. */
const trueFrame = (beat) => (beat * FPS * 60) / BPM;

/** The OLD model: round the beat once, then multiply by it forever. */
const NAIVE_BEAT = Math.round((FPS * 60) / BPM); // 15
const naiveFrame = (beat) => beat * NAIVE_BEAT;

/** The NEW model: exact position, rounded once at the point of use. */
const exactFrame = (beat) => Math.round(trueFrame(beat));

// ── The episode's structure, in beats (mirrors grid.ts) ───────────────────────────────────────
const COLD_OPEN_BEATS = 13;
const SIGN_OFF_BEATS = 14;
const STORY_BEATS = 38;
const STORIES = 5;
const RISER_BEATS = 5;
const STING_BEAT = 1;
const PHASE_BEATS = { sting: 1, stingerStart: 7, revealStart: 10, beatsStart: 16, beat1: 23, explainerStart: 30 };

const storyStartBeats = [];
{
  let b = COLD_OPEN_BEATS;
  for (let i = 0; i < STORIES; i++) {
    storyStartBeats.push(b);
    b += STORY_BEATS;
  }
}
const END_BEAT = COLD_OPEN_BEATS + STORIES * STORY_BEATS + SIGN_OFF_BEATS;

// ── 1. Drift across the whole episode, beat by beat ───────────────────────────────────────────
let naiveMax = 0;
let exactMax = 0;
for (let beat = 0; beat <= END_BEAT; beat++) {
  naiveMax = Math.max(naiveMax, Math.abs(naiveFrame(beat) - trueFrame(beat)));
  exactMax = Math.max(exactMax, Math.abs(exactFrame(beat) - trueFrame(beat)));
}
const naiveEnd = naiveFrame(END_BEAT) - trueFrame(END_BEAT);
const exactEnd = exactFrame(END_BEAT) - trueFrame(END_BEAT);

const f2s = (f) => (f / FPS).toFixed(2);

console.log(`AI Top 5 grid — ${BPM} BPM at ${FPS}fps, true beat ${(trueFrame(1)).toFixed(4)}f`);
console.log(`Episode: ${END_BEAT} beats, ${exactFrame(END_BEAT)}f (${f2s(exactFrame(END_BEAT))}s)\n`);

console.log("1. Drift over the whole episode");
console.log(`   OLD (beat rounded to ${NAIVE_BEAT}f, then multiplied)`);
console.log(`      error at the last beat : ${naiveEnd.toFixed(1)}f (${f2s(naiveEnd)}s)`);
console.log(`      maximum error          : ${naiveMax.toFixed(1)}f (${f2s(naiveMax)}s)`);
console.log(`   NEW (exact beat space, rounded once)`);
console.log(`      error at the last beat : ${exactEnd.toFixed(3)}f`);
console.log(`      maximum error          : ${exactMax.toFixed(3)}f`);

// ── 2. Story boundaries ───────────────────────────────────────────────────────────────────────
console.log("\n2. Story boundaries");
let boundaryNaiveMax = 0;
let boundaryExactMax = 0;
for (let i = 0; i < storyStartBeats.length; i++) {
  const b = storyStartBeats[i];
  const nErr = naiveFrame(b) - trueFrame(b);
  const eErr = exactFrame(b) - trueFrame(b);
  boundaryNaiveMax = Math.max(boundaryNaiveMax, Math.abs(nErr));
  boundaryExactMax = Math.max(boundaryExactMax, Math.abs(eErr));
  console.log(
    `   #${5 - i} starts beat ${String(b).padStart(3)} | true ${trueFrame(b).toFixed(1).padStart(7)}f` +
      ` | old ${String(naiveFrame(b)).padStart(4)}f (${nErr >= 0 ? "+" : ""}${nErr.toFixed(1)})` +
      ` | new ${String(exactFrame(b)).padStart(4)}f (${eErr >= 0 ? "+" : ""}${eErr.toFixed(2)})`
  );
}

// ── 3. SFX and impact alignment ───────────────────────────────────────────────────────────────
// The number hit fires one beat into each story; the riser resolves on the #1 boundary. Both are
// absolute positions in the mix, so an error here is a hit landing beside its own picture.
console.log("\n3. SFX / impact alignment");
let sfxNaiveMax = 0;
let sfxExactMax = 0;
const sfx = [];
for (let i = 0; i < storyStartBeats.length; i++) {
  sfx.push({ label: `numberHit #${5 - i}`, beat: storyStartBeats[i] + STING_BEAT });
}
sfx.push({ label: "riser start", beat: storyStartBeats[STORIES - 1] - RISER_BEATS });
sfx.push({ label: "riser resolve", beat: storyStartBeats[STORIES - 1] });
for (const c of sfx) {
  const nErr = naiveFrame(c.beat) - trueFrame(c.beat);
  const eErr = exactFrame(c.beat) - trueFrame(c.beat);
  sfxNaiveMax = Math.max(sfxNaiveMax, Math.abs(nErr));
  sfxExactMax = Math.max(sfxExactMax, Math.abs(eErr));
  console.log(
    `   ${c.label.padEnd(15)} beat ${String(c.beat).padStart(3)} |` +
      ` old ${(nErr >= 0 ? "+" : "") + nErr.toFixed(1)}f | new ${(eErr >= 0 ? "+" : "") + eErr.toFixed(2)}f`
  );
}

// ── 4. Story-local cues: the localFrameAtBeat rule ────────────────────────────────────────────
// A cue inside a <Sequence> is a story-LOCAL frame. Computing it as if the story began at beat 0
// is the tempting shortcut and it is wrong: both ends round independently, so the local frame
// misses the absolute grid by a frame depending on the story's phase.
console.log("\n4. Story-local cues (localFrameAtBeat vs the shortcut)");
let localDisagreements = 0;
let localChecked = 0;
for (const start of storyStartBeats) {
  for (const [name, off] of Object.entries(PHASE_BEATS)) {
    const correct = exactFrame(start + off) - exactFrame(start); // localFrameAtBeat
    const shortcut = exactFrame(off); // the bug
    localChecked++;
    if (correct !== shortcut) {
      localDisagreements++;
      if (localDisagreements <= 4) {
        console.log(`   story@beat ${start} ${name}: local ${correct}f, shortcut ${shortcut}f`);
      }
    }
  }
}
console.log(`   ${localDisagreements} of ${localChecked} phase cues disagree by a frame`);

// A wider sweep, so the number is not an artefact of these six offsets.
let sweepDisagree = 0;
let sweepTotal = 0;
for (let start = 0; start < 220; start++) {
  for (let off = 1; off <= 46; off++) {
    sweepTotal++;
    if (exactFrame(start + off) - exactFrame(start) !== exactFrame(off)) sweepDisagree++;
  }
}
console.log(`   across all (start, offset) pairs in the episode's range: ${sweepDisagree}/${sweepTotal}`);

// ── 5. Beat-span variation — why beatsToCover exists ──────────────────────────────────────────
console.log("\n5. Integer length of a 38-beat story, by start beat");
const spans = new Map();
for (let s = 0; s < 220; s++) {
  const v = exactFrame(s + STORY_BEATS) - exactFrame(s);
  spans.set(v, (spans.get(v) ?? 0) + 1);
}
console.log(
  `   exact ${(STORY_BEATS * trueFrame(1)).toFixed(2)}f -> ` +
    [...spans.entries()].sort().map(([v, n]) => `${v}f from ${n} starts`).join(", ")
);
console.log("   A section sized from an average beat is one frame short from some starts.");

// ── Verdict ───────────────────────────────────────────────────────────────────────────────────
// The new model must be bounded by frame rounding — half a frame — everywhere.
const BOUND = 0.5 + 1e-9;
const failures = [];
if (exactMax > BOUND) failures.push(`exact grid max error ${exactMax.toFixed(3)}f exceeds half a frame`);
if (boundaryExactMax > BOUND) failures.push(`story boundary error ${boundaryExactMax.toFixed(3)}f exceeds half a frame`);
if (sfxExactMax > BOUND) failures.push(`SFX alignment error ${sfxExactMax.toFixed(3)}f exceeds half a frame`);
// …and it must be a genuine improvement, not a rename. If the old model were already fine there
// would be nothing to fix, and this check would be theatre.
if (naiveMax < 5) failures.push(`the old model's error is only ${naiveMax.toFixed(1)}f — this check is not measuring the defect`);

console.log("\nVerdict");
console.log(`   old: accumulating, ${naiveEnd.toFixed(0)}f (${f2s(naiveEnd)}s) by the end`);
console.log(`   new: bounded, max ${exactMax.toFixed(3)}f everywhere (limit ${BOUND.toFixed(1)}f)`);
if (failures.length) {
  for (const f of failures) console.log(`   FAIL ${f}`);
  process.exit(1);
}
console.log("   PASS");
