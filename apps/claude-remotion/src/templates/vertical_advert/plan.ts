// The advert, as beats. This is the file to edit.
//
//   hook -> content beats -> captions inside the safe area -> CTA close
//
// ── What makes vertical different ─────────────────────────────────────────────────────────────
//
// This is not FootagePromo rotated. Three things genuinely distinguish a short-form social advert
// from the other templates, and they are the reasons this template exists:
//
//   1. THE SAFE AREA. The player draws its own interface over the frame. Text outside the readable
//      rectangle is covered by a caption, a handle or a row of buttons.
//   2. THE HOOK. A viewer scrolling decides in about a second. The first beat is short and has to
//      land immediately, which is a structural constraint rather than a stylistic one.
//   3. REFRAMING. The source material is usually a landscape master that has to be brought into
//      9:16 without either squashing it or throwing the subject away.
//
// Everything else — beat-locked cutting, musical timing — belongs to FootagePromo. Slot-based
// brand shorts belong to SlotShort. Reach for this one when the output is vertical and the
// platform's chrome is part of the problem.
//
// ── Aspect-neutral beats ──────────────────────────────────────────────────────────────────────
//
// Beats declare CONTENT. The layout policy for a given aspect decides how that content is placed.
// One beat sheet therefore renders both vertical and landscape, which is the technique proved by
// the campaign work this replaces: the beat sheet was identical for both formats and only the
// layout differed.

import { readingFloor } from "../shared/CaptionTrack";
import { DEFAULT_SAFE, LANDSCAPE_SAFE, type SafeAreaSpec } from "../shared/SafeArea";
import type { ReframeMode } from "../shared/ReframedMedia";

export const FPS = 30;

/** The output shape. The beats below do not change; only the layout policy does. */
export type Format = "9x16" | "16x9";

export const FORMAT_SIZE: Record<Format, { width: number; height: number }> = {
  "9x16": { width: 1080, height: 1920 },
  "16x9": { width: 1920, height: 1080 },
};

/** Per-format layout policy. This is the whole of the multi-format machinery. */
export const FORMAT_POLICY: Record<
  Format,
  { safe: SafeAreaSpec; reframe: ReframeMode; headlineScale: number; captionAlign: "bottom" | "center" }
> = {
  // Vertical: reserve the platform's chrome, crop footage to fill, larger type for a small screen.
  "9x16": { safe: DEFAULT_SAFE, reframe: "crop", headlineScale: 1, captionAlign: "bottom" },
  // Landscape: little chrome to avoid, and the source already matches, so nothing is thrown away.
  "16x9": { safe: LANDSCAPE_SAFE, reframe: "fit", headlineScale: 0.62, captionAlign: "bottom" },
};

export const BRAND = {
  name: "Northpoint",
  accent: "#38bdf8",
  accent2: "#3ddc97",
};

// ── Media ─────────────────────────────────────────────────────────────────────────────────────
//
// The in-house sample clips already committed for the promo template. Reusing them costs nothing
// and proves the reframe on a source that genuinely does not match a 9:16 frame.

export const CLIPS = {
  wide: { src: "footage-samples/sample-a.mp4", size: { width: 960, height: 540 }, frames: 120 },
  detail: { src: "footage-samples/sample-b.mp4", size: { width: 720, height: 720 }, frames: 120 },
} as const;

export type ClipId = keyof typeof CLIPS;

// ── Beats ─────────────────────────────────────────────────────────────────────────────────────

export type Beat = {
  id: string;
  seconds: number;
  /** Optional footage behind this beat. Reframed by the format policy. */
  clip?: { id: ClipId; trimBefore?: number; focalX?: number };
  /** Big words. The hook's headline is the one that has to land in the first second. */
  headline?: string;
  /** A supporting line under the headline. */
  caption?: string;
  /** A word that slams onto a frame within this beat, for a pattern break. */
  hit?: { text: string; atSeconds: number };
  /** A flash at this second within the beat. */
  impactAtSeconds?: number;
  /** Renders as the closing call to action: emphasised, with a destination pill. */
  cta?: { destination: string };
};

/**
 * The demo advert. Six beats, about 15 seconds.
 *
 * ⚠️ The hook is 1.6 seconds. That is not an arbitrary choice: a scrolling viewer decides in
 * roughly a second, so the first beat has to state the claim and get out. Every later beat can
 * afford to breathe; this one cannot.
 */
export const BEATS: Beat[] = [
  {
    id: "hook",
    seconds: 1.6,
    clip: { id: "wide", trimBefore: 30, focalX: 0.5 },
    headline: "Built for 9:16.",
    impactAtSeconds: 0,
  },
  {
    id: "problem",
    seconds: 3.2,
    clip: { id: "detail", trimBefore: 12, focalX: 0.5 },
    caption: "The player draws its own UI over your frame.",
  },
  {
    id: "break",
    seconds: 2.2,
    clip: { id: "wide", trimBefore: 48, focalX: 0.35 },
    hit: { text: "SAFE AREA", atSeconds: 0.2 },
    impactAtSeconds: 0.2,
  },
  {
    id: "proof",
    seconds: 3.4,
    clip: { id: "detail", trimBefore: 12, focalX: 0.5 },
    caption: "Text stays inside the readable area.",
  },
  {
    id: "reframe",
    seconds: 2.6,
    clip: { id: "wide", trimBefore: 0, focalX: 0.7 },
    caption: "Landscape source, reframed.",
  },
  {
    id: "cta",
    seconds: 2.4,
    headline: "Start from the plan.",
    cta: { destination: "plan.ts" },
  },
];

// ── Compilation ───────────────────────────────────────────────────────────────────────────────

export type CompiledBeat = {
  index: number;
  beat: Beat;
  from: number;
  durationInFrames: number;
  /** Beat-local frames. */
  hitAt?: number;
  impactAt?: number;
};

export type CompiledAdvert = {
  totalFrames: number;
  beats: CompiledBeat[];
  problems: string[];
};

/** The words a beat puts on screen, for the reading-floor check. */
function beatText(b: Beat): string {
  return [b.headline, b.caption, b.cta?.destination].filter(Boolean).join(" ");
}

/**
 * Turn the beat sheet into frames, and check it.
 *
 * The reading floor uses the same helper as the caption layer, so a beat and a caption agree about
 * how long words take.
 *
 * ⚠️ The HOOK gets a different floor, and it is not a loophole. A caption is read at a
 * conversational pace; a hook is GLANCED at — a few large words the eye takes in whole. Holding a
 * hook to the caption pace forces it to sit on screen long enough that the viewer has already
 * scrolled. The allowance is 0.9s plus 0.035s per character, so a three-word hook clears at about
 * 1.4s while a 45-character sentence still needs 2.5s and fails. The pressure to keep a hook short
 * is preserved; what is removed is the pressure to make it SLOW.
 */
export function compileAdvert(beats: Beat[] = BEATS): CompiledAdvert {
  const problems: string[] = [];
  const compiled: CompiledBeat[] = [];
  let cursor = 0;

  beats.forEach((beat, index) => {
    const durationInFrames = Math.round(beat.seconds * FPS);
    if (durationInFrames <= 0) problems.push(`beat "${beat.id}": duration must be positive`);

    const text = beatText(beat);
    const isHook = index === 0;
    if (text.trim().length > 0) {
      // The hook gets a shorter floor — a glance, not a read — but not an unlimited one.
      const floor = isHook
        ? Math.min(readingFloor(text), 0.9 + text.length * 0.035)
        : readingFloor(text);
      if (beat.seconds + 1e-9 < floor) {
        problems.push(
          `beat "${beat.id}": ${beat.seconds}s on screen but its ${text.length} characters need ` +
            `${floor.toFixed(2)}s${isHook ? " (hook allowance applied)" : ""}`
        );
      }
    }

    if (beat.clip) {
      const clip = CLIPS[beat.clip.id];
      const trim = beat.clip.trimBefore ?? 0;
      if (trim + durationInFrames > clip.frames) {
        problems.push(
          `beat "${beat.id}": reads source frames ${trim}..${trim + durationInFrames} but ` +
            `${beat.clip.id} is ${clip.frames} frames long`
        );
      }
    }

    if (beat.hit && (beat.hit.atSeconds < 0 || beat.hit.atSeconds >= beat.seconds)) {
      problems.push(`beat "${beat.id}": hit at ${beat.hit.atSeconds}s falls outside the beat`);
    }

    compiled.push({
      index,
      beat,
      from: cursor,
      durationInFrames,
      hitAt: beat.hit ? Math.round(beat.hit.atSeconds * FPS) : undefined,
      impactAt: beat.impactAtSeconds != null ? Math.round(beat.impactAtSeconds * FPS) : undefined,
    });
    cursor += durationInFrames;
  });

  return { totalFrames: cursor, beats: compiled, problems };
}

export const ADVERT = compileAdvert();

/** The composition's duration. Root.tsx uses this rather than repeating a number. */
export const VERTICAL_ADVERT_FRAMES = ADVERT.totalFrames;
