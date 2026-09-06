// grid.ts — the episode's musical timeline. Everything with a frame number comes from here.
//
// ── What this replaces, and why it was wrong ──────────────────────────────────────────────────
//
// The previous model opened with:
//
//     export const BEAT = Math.round((FPS * 60) / BPM);  // 15 at 124 BPM / 30fps
//     export const BAR  = BEAT * 4;                      // 60
//
// and derived everything from that 15 — bar lines, story lengths (`Math.ceil(x / BEAT) * BEAT`),
// the sting frame, the spin-in duration, and the background's beat pulse (`f % BEAT`).
//
// The true beat at 124 BPM and 30fps is 14.5161 frames. Rounding it to 15 adds 0.484 frames to every
// beat, and because starts are cumulative it ACCUMULATES: by the end of a 105-second episode the
// visual grid sits about a hundred frames — three and a half seconds — ahead of the bed it claims to
// be locked to. The opening looks fine, which is exactly why it survived: the drift is invisible
// until it is large, and by then it reads as "the edit feels loose" rather than as an arithmetic bug.
//
// This module never multiplies a rounded beat. Musical positions live in BEAT SPACE and are rounded
// exactly once, when converted to an absolute frame, by `frameAtBeat` in shared/MusicalTime.ts. The
// error against true time is bounded at half a frame however long the episode runs.
//
// ── The rule for anything placed inside a <Sequence> ──────────────────────────────────────────
//
// A story's components see a STORY-LOCAL clock. A musical cue inside one must be converted with
// `localFrameAtBeat(M, storyStartBeat, offsetBeat)`, never `frameAtBeat(M, offsetBeat)` — both
// boundaries round independently, so the naive form lands a frame off the absolute grid depending
// on where the story happens to start. Every local cue below goes through `localBeat()`, and the
// results are PER STORY rather than module constants, because that is what the rule means.

import {
  beatFrames,
  beatSpan,
  beatsToCover,
  frameAtBeat,
  localFrameAtBeat,
  meter,
} from "../shared/MusicalTime";
import { TODAY, type Story } from "./data";

export const FPS = 30;

/**
 * BPM is a SYSTEM CONTRACT, not a per-episode value: the bed must be produced at this tempo or
 * "lands on the beat" is a claim rather than a fact. public/audio/bed.mp3 is synthesized at 124 by
 * scripts/make-audio-assets.mjs.
 */
export const BPM = 124;

export const M = meter(BPM, FPS, 4);

/** Exact frames per beat — 14.5161 at 124 BPM / 30fps. For maths, never for placing anything. */
export const BEAT_FRAMES = beatFrames(M);

// ── Section lengths, in beats ─────────────────────────────────────────────────────────────────
//
// Every one of these was a frame count. They are beats now, chosen to sit within a few frames of
// the budgets they replace, so the show's pacing is preserved rather than re-cut by arithmetic.

/** Cold open — the title slam. 13 beats = 189f (6.30s); was 195f. */
export const COLD_OPEN_BEATS = 13;

/** Sign-off — round-up card and the QR, which needs scan time. 14 beats = 203f (6.77s); was 210f. */
export const SIGN_OFF_BEATS = 14;

/** The DJ cue and the era-device arrival. 7 beats = 102f (3.40s); was 105f. */
export const CUE_BEATS = 7;

/** Brand arrival after the device settles. 3 beats = 44f (1.45s); was 36f. */
export const STINGER_BEATS = 3;

/** Headline station beat. 6 beats = 87f (2.90s); was 90f. Clears the 2.8s floor for 40 characters. */
export const REVEAL_BEATS = 6;

/** Two points. 14 beats = 203f (6.77s); was 210f. Each gets 3.38s against a 2.94s floor. */
export const BEATS_BEATS = 14;

/** The fixed phases every story gets, whatever its length. */
export const STORY_FIXED_BEATS = CUE_BEATS + STINGER_BEATS + REVEAL_BEATS + BEATS_BEATS; // 30

/**
 * The explainer's floor.
 *
 * ⚠️ This is a design decision, not a reading floor, and calling it one would be dishonest. The
 * explainer paragraph runs 300-400 characters, whose reading floor is over twenty seconds. It is a
 * SKIM surface — the eye takes its shape and a phrase or two — and no plausible budget makes it a
 * read. The right fix is a shorter line from the feed, which is why `screen` (one sentence) is
 * preferred over `explainer` when the data carries it.
 */
export const EXPLAINER_MIN_BEATS = 8; // 116f, 3.87s

/** A story is never shorter than this. 38 beats ≈ 552f (18.4s); was 555f. */
export const STORY_MIN_BEATS = STORY_FIXED_BEATS + EXPLAINER_MIN_BEATS; // 38

/** …nor longer. A runaway read is clipped rather than silently stretching the episode. */
export const STORY_MAX_BEATS = 46; // ≈668f, 22.3s

/** A deliberate musical beat after the last word, so a voiced story does not cut on the syllable. */
export const STORY_TAIL_BEATS = 3; // ≈44f, 1.45s

/** The riser resolves exactly ON the #1 boundary. 5 beats ≈ 73f; was a flat 70f. */
export const RISER_BEATS = 5;

/** The number slams one beat into the story — where the spoken "…at five" would land. */
export const STING_BEAT = 1;

/** Screen text spins in over one beat and lands ON a beat boundary. */
export const SPIN_BEATS = 1;

/** A story-local frame for an offset expressed in beats from the story's start. */
const localBeat = (startBeat: number, offsetBeat: number): number =>
  localFrameAtBeat(M, startBeat, offsetBeat);

// ── Phase boundaries, in beats from the story's start ─────────────────────────────────────────
//
// Every one is an INTEGER beat offset, which is the point: each is a moment the bed hits, so a stab
// or a spin landing there lands with the music rather than near it.

export const PHASE_BEATS = {
  /** The number slams. */
  sting: STING_BEAT,
  /** Cue ends; the brand arrival opens once the device has settled. */
  stingerStart: CUE_BEATS,
  /** The headline lands. */
  revealStart: CUE_BEATS + STINGER_BEATS,
  /** The headline docks to the strap and the first point arrives. */
  beatsStart: CUE_BEATS + STINGER_BEATS + REVEAL_BEATS,
  /** The second point arrives, halfway through the points phase. */
  beat1: CUE_BEATS + STINGER_BEATS + REVEAL_BEATS + BEATS_BEATS / 2,
  /** The reading layer arrives and holds to the end of the story. */
  explainerStart: STORY_FIXED_BEATS,
} as const;

/**
 * Every phase boundary inside one story, as STORY-LOCAL frames on the absolute grid.
 *
 * ⚠️ These used to be module constants shared by all five stories, which is only correct if every
 * story starts on the same beat phase — and they do not. Two stories whose starts differ in phase
 * have local boundaries a frame apart, so the constant was right for at most one of them. They are
 * per-story values now, threaded down from here, because that is what `localFrameAtBeat` means.
 */
export type StoryPhases = {
  /**
   * This story's absolute start frame.
   *
   * ⚠️ Carried here because Remotion gives a component inside a <Sequence> only its LOCAL clock,
   * and anything locked to the music needs the absolute one — a beat pulse driven by the local
   * frame re-phases against the bed at every story boundary. `absoluteFrom + useCurrentFrame()`
   * is the absolute frame.
   */
  absoluteFrom: number;
  sting: number;
  stingerStart: number;
  revealStart: number;
  beatsStart: number;
  beat1: number;
  explainerStart: number;
  /** Total length of the story, so a phase can size itself against the end. */
  storyFrames: number;
  /** The explainer window — whatever the section has left after its fixed phases. */
  explainerFrames: number;
  /** The frame a one-beat spin must START at to land exactly on `landBeat`. */
  spinStart: (landBeat: number) => number;
  /** Length of that spin. Varies by a frame with the beat phase — as it must. */
  spinFrames: (landBeat: number) => number;
};

export function phasesFor(startBeat: number, storyFrames: number): StoryPhases {
  const at = (offsetBeat: number) => localBeat(startBeat, offsetBeat);
  const spinStart = (landBeat: number) => at(landBeat - SPIN_BEATS);
  const explainerStart = at(PHASE_BEATS.explainerStart);
  return {
    absoluteFrom: frameAtBeat(M, startBeat),
    sting: at(PHASE_BEATS.sting),
    stingerStart: at(PHASE_BEATS.stingerStart),
    revealStart: at(PHASE_BEATS.revealStart),
    beatsStart: at(PHASE_BEATS.beatsStart),
    beat1: at(PHASE_BEATS.beat1),
    explainerStart,
    storyFrames,
    explainerFrames: storyFrames - explainerStart,
    spinStart,
    spinFrames: (landBeat: number) => at(landBeat) - spinStart(landBeat),
  };
}

// ── The episode layout ────────────────────────────────────────────────────────────────────────

export type StoryTiming = {
  story: Story;
  /** Absolute beat this story starts on. */
  startBeat: number;
  /** Length in whole beats. */
  beats: number;
  /** Absolute start frame. */
  from: number;
  /** Length in frames — the ACTUAL span, not beats × an average. */
  durationInFrames: number;
  /** Story-local phase boundaries, all on the absolute grid. */
  phases: StoryPhases;
  /** Why this story is the length it is, for the record and the layout report. */
  reason: "minimum" | "voice" | "clipped";
};

/**
 * How many beats a story needs.
 *
 * The dynamic-duration capability is preserved exactly: a MEASURED voiceover length (`voFrames`)
 * plus a musical tail sets the requirement, rounded UP to whole beats. What changed is that the
 * requirement is checked against the span this story will ACTUALLY occupy — `beatsToCover` — rather
 * than against an average beat length, because an N-beat span is one frame shorter from some start
 * beats than from others, and the short case clips the last frame of the line.
 *
 * With no measurement — the shipped silent edition, or a partial data.ts — the structural minimum
 * applies. That is a real fallback rather than a placeholder: the fixed phases are sized from the
 * reading floors of the copy they carry, so a silent story is readable on its own terms.
 */
export function storyBeatsFor(
  story: Story,
  startBeat: number
): { beats: number; reason: StoryTiming["reason"] } {
  const voFrames = story.voFrames ?? 0;
  if (voFrames <= 0) return { beats: STORY_MIN_BEATS, reason: "minimum" };

  const tailFrames = beatSpan(M, startBeat, STORY_TAIL_BEATS);
  const wanted = beatsToCover(M, startBeat, voFrames + tailFrames, STORY_MIN_BEATS);
  if (wanted > STORY_MAX_BEATS) return { beats: STORY_MAX_BEATS, reason: "clipped" };
  return { beats: wanted, reason: wanted > STORY_MIN_BEATS ? "voice" : "minimum" };
}

function buildTimings(stories: Story[]): StoryTiming[] {
  const out: StoryTiming[] = [];
  let beat = COLD_OPEN_BEATS;
  for (const story of stories) {
    const { beats, reason } = storyBeatsFor(story, beat);
    const durationInFrames = beatSpan(M, beat, beats);
    out.push({
      story,
      startBeat: beat,
      beats,
      from: frameAtBeat(M, beat),
      durationInFrames,
      phases: phasesFor(beat, durationInFrames),
      reason,
    });
    beat += beats;
  }
  return out;
}

export const STORY_TIMINGS: StoryTiming[] = buildTimings(TODAY.stories);
export const STORY_COUNT = STORY_TIMINGS.length;

export const COLD_OPEN_FRAMES = frameAtBeat(M, COLD_OPEN_BEATS);

export const STORIES_END_BEAT = STORY_COUNT
  ? STORY_TIMINGS[STORY_COUNT - 1].startBeat + STORY_TIMINGS[STORY_COUNT - 1].beats
  : COLD_OPEN_BEATS;

export const SIGN_OFF_START = frameAtBeat(M, STORIES_END_BEAT);
export const SIGN_OFF_FRAMES = beatSpan(M, STORIES_END_BEAT, SIGN_OFF_BEATS);

/** The episode's duration, derived from its musical structure rather than typed in. */
export const TOTAL_FRAMES = frameAtBeat(M, STORIES_END_BEAT + SIGN_OFF_BEATS);

/** #1 is the last section — the riser resolves on its boundary. */
export const TOP_STORY_START_BEAT = STORY_COUNT
  ? STORY_TIMINGS[STORY_COUNT - 1].startBeat
  : COLD_OPEN_BEATS;
export const RISER_START = frameAtBeat(M, TOP_STORY_START_BEAT - RISER_BEATS);
export const RISER_LENGTH = beatSpan(M, TOP_STORY_START_BEAT - RISER_BEATS, RISER_BEATS);

// ── Rhythmic motion ───────────────────────────────────────────────────────────────────────────

/**
 * 1.0 exactly on a beat, decaying to 0 over `decayFrames`.
 *
 * ⚠️ Takes the ABSOLUTE frame. The old version took whatever clock the caller happened to have and
 * did `f % BEAT` against a rounded beat, so inside a story the pulse re-phased at the section
 * boundary and across the episode it walked off the bed. Here the phase comes from exact beat
 * space, so a pulse in the last story is as locked to the music as one in the first.
 */
export function beatPulse(absoluteFrame: number, decayFrames: number = BEAT_FRAMES): number {
  const phase = absoluteFrame / BEAT_FRAMES;
  const sinceBeat = (phase - Math.floor(phase)) * BEAT_FRAMES;
  return Math.max(0, 1 - sinceBeat / decayFrames);
}

/** One line describing the layout. Printed by tooling and the record — never by the render. */
export const describeLayout = (): string =>
  `${BPM} BPM | ` +
  STORY_TIMINGS.map((t) => `#${t.story.n}:${t.beats}b/${t.durationInFrames}f(${t.reason})`).join(" ") +
  ` | total ${TOTAL_FRAMES}f (${(TOTAL_FRAMES / FPS).toFixed(2)}s, ${STORIES_END_BEAT + SIGN_OFF_BEATS} beats)`;
