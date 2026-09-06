// The walkthrough script: what the camera looks at, for how long, and what the captions say.
//
// This file is the one to edit. Everything else is machinery.
//
// ── How a focus region is defined ─────────────────────────────────────────────────────────────
//
// cx/cy are fractions of the CAPTURE, not pixels and not fractions of the video frame. To find
// them for your own capture: take the feature's centre in pixels and divide by the capture's
// width and height. A button at (1740, 210) on a 2560x1440 screenshot is
// { cx: 1740/2560, cy: 210/1440 } = { cx: 0.68, cy: 0.15 }.
//
// scale is how far in: 1.0 shows the whole capture, 2.0 shows a quarter of it. Above roughly 3.0
// a 2560px-wide capture starts to look soft on a 1080p frame, because you are magnifying beyond
// the source's real detail.
//
// ── How stage timing works ───────────────────────────────────────────────────────────────────
//
// Each stage declares its own length in seconds. Start frames are DERIVED by accumulation, never
// written down, so changing one stage's length shifts everything after it automatically and no
// hand-maintained frame numbers can drift out of step.
//
// Within a stage, the camera arrives via `pushSeconds` and then holds. The hold is free: the
// camera's interpolation is clamped, so it simply stops at the target and stays there.
//
// Caption times are seconds from the START OF THEIR OWN STAGE, so a stage can be moved or
// re-timed without rewriting its captions.

import type { CameraMove, FocusRegion } from "../shared/VirtualCamera";
import type { CaptionLine } from "../shared/CaptionTrack";
import type { CaptureStateKey } from "./SampleCapture";

/**
 * The composition-level accent. A stage may override it, and the override drives every accented
 * element together: the caption tick, the focus pulse, the glued highlight and the ambient tint.
 */
export const DEFAULT_ACCENT = "#38bdf8";

/** Named framings, so the script below reads as intent rather than arithmetic. */
export const REGIONS = {
  /** The whole interface, establishing shot. */
  whole: { cx: 0.5, cy: 0.5, scale: 1.0 } as FocusRegion,
  /**
   * Search field, top-left of the main column. cy 0.08 sits above what the viewport can reach at
   * this scale, so the camera clamps it to 0.238 — see the edge clamp in VirtualCamera.
   */
  search: { cx: 0.32, cy: 0.08, scale: 2.1 } as FocusRegion,
  /** The three summary tiles. */
  stats: { cx: 0.56, cy: 0.31, scale: 1.75 } as FocusRegion,
  /**
   * The row flagged as slow. Framed to span from the request name across to its duration:
   * a table row is wide, so going in too far shows a pill and a lot of empty rule.
   */
  slowRow: { cx: 0.55, cy: 0.551, scale: 1.6 } as FocusRegion,
  /** Sidebar navigation. cx 0.07 also clamps, to 0.25 — the sidebar hugs the left edge. */
  nav: { cx: 0.07, cy: 0.38, scale: 2.0 } as FocusRegion,
};

export type Stage = {
  id: string;
  /** Length of this stage in seconds. */
  seconds: number;
  /** Where the camera starts this stage. Usually the previous stage's target. */
  from: FocusRegion;
  /** Where it ends up. */
  to: FocusRegion;
  /** Seconds the move takes; the rest of the stage is a hold. */
  pushSeconds: number;
  /** Arrival wobble, in thousandths of scale. 0 is a dead stop. */
  settle?: number;
  captions: CaptionLine[];
  /** Optional interaction pulse: seconds into the stage, at a point on the CAPTURE. */
  pulse?: { atSeconds: number; point: { x: number; y: number } };
  /**
   * Optional highlight GLUED to the capture, in capture fractions. Unlike the pulse, this rides
   * the camera: it zooms with the interface and stays locked to the feature it rings. Use it to
   * mark a region; use `pulse` to mark a moment.
   */
  highlight?: { x: number; y: number; w: number; h: number; fromSeconds: number };
  /**
   * Optional accent for this stage only, overriding DEFAULT_ACCENT. Drives the caption tick, the
   * focus pulse, the glued highlight and the ambient tint together, so a stage reads as one
   * colour rather than a set of unrelated decisions.
   */
  accent?: string;
  /**
   * Optional interface-state change: at `atSeconds`, the capture becomes `to`.
   *
   * Give this the same time as the caption that causes it. The viewer then reads the words as
   * having done it, and re-timing one cannot silently desynchronise the other.
   */
  stateChange?: { atSeconds: number; to: CaptureStateKey; crossfadeSeconds?: number };
};

export const STAGES: Stage[] = [
  {
    id: "establish",
    seconds: 5,
    from: REGIONS.whole,
    to: REGIONS.whole,
    pushSeconds: 0,
    captions: [
      { in_s: 0.4, out_s: 4.4, text: "A guided tour of one screen.", style: "title" },
    ],
  },
  {
    id: "search",
    seconds: 6,
    from: REGIONS.whole,
    to: REGIONS.search,
    pushSeconds: 1.4,
    settle: 8,
    captions: [
      {
        in_s: 1.6,
        out_s: 5.6,
        text: "Start where the user starts —\nthe thing they type into.",
        style: "subtitle",
      },
    ],
    // Fires before the caption lands, so cause reads before effect.
    pulse: { atSeconds: 1.5, point: { x: 0.32, y: 0.08 } },
  },
  {
    id: "stats",
    seconds: 6,
    from: REGIONS.search,
    to: REGIONS.stats,
    pushSeconds: 1.2,
    settle: 8,
    captions: [
      {
        in_s: 1.4,
        out_s: 5.6,
        text: "Pull back a little to show\nwhat the numbers say.",
        style: "subtitle",
      },
    ],
  },
  {
    id: "detail",
    seconds: 7,
    from: REGIONS.stats,
    to: REGIONS.slowRow,
    pushSeconds: 1.3,
    settle: 10,
    captions: [
      {
        in_s: 1.5,
        out_s: 6.6,
        text: "Then all the way in on the one\nrow that needs attention.",
        style: "subtitle",
      },
    ],
    // Amber: this stage is about the thing that needs attention, and the interface already uses
    // amber for that. The pulse, the ring and the caption tick all follow.
    accent: "#f5b455",
    pulse: { atSeconds: 1.4, point: { x: 0.737, y: 0.551 } },
    // Rides the camera, unlike the pulse above — the contrast is the point.
    highlight: { x: 0.25, y: 0.523, w: 0.60, h: 0.057, fromSeconds: 1.6 },
    // The caption below lands at 1.5s and the interface reacts at 1.5s: cause, then effect.
    stateChange: { atSeconds: 1.5, to: "flagged", crossfadeSeconds: 0.5 },
  },
  {
    id: "nav",
    seconds: 6,
    from: REGIONS.slowRow,
    to: REGIONS.nav,
    pushSeconds: 1.5,
    settle: 8,
    // Green: a deliberate change of key from the amber alert stage before it. The ring and the
    // pulse below both take it, so the accent drives real elements rather than only the caption.
    accent: "#3ddc97",
    // The active navigation item, in capture fractions.
    highlight: { x: 0.011, y: 0.136, w: 0.127, h: 0.043, fromSeconds: 2.0 },
    pulse: { atSeconds: 1.9, point: { x: 0.074, y: 0.158 } },
    captions: [
      {
        in_s: 1.7,
        out_s: 5.6,
        text: "A long move across the screen\nreads as one deliberate gesture.",
        style: "subtitle",
      },
    ],
  },
  {
    id: "close",
    seconds: 5,
    from: REGIONS.nav,
    to: REGIONS.whole,
    pushSeconds: 1.6,
    captions: [
      { in_s: 1.9, out_s: 4.6, text: "One capture. One camera.", style: "title" },
    ],
  },
];

/** Frames per second the seconds above are converted at. */
export const FPS = 30;

/**
 * Frames a stage takes to dissolve in and out, overlapping its neighbour.
 *
 * ⚠️ The camera move is delayed by exactly this much (see stagePath). Without the delay the
 * incoming stage has already begun moving while the outgoing one is still held, and because the
 * camera easing is front-loaded the two are visibly far apart mid-dissolve — the frame reads as a
 * double exposure. Holding for the length of the dissolve means both layers show the SAME framing
 * while they cross, so the only thing that changes is what is meant to.
 */
export const STAGE_FADE = 5;

/** Stage lengths in frames, derived — never written down. */
export const STAGE_FRAMES: number[] = STAGES.map((s) => Math.round(s.seconds * FPS));

/** Absolute start frame of each stage, derived by accumulation. */
export const STAGE_START: number[] = STAGE_FRAMES.reduce<number[]>((acc, f, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + STAGE_FRAMES[i - 1]);
  return acc;
}, []);

/** Total composition length. Changing any stage's `seconds` moves this automatically. */
export const PRODUCT_WALKTHROUGH_FRAMES = STAGE_FRAMES.reduce((a, b) => a + b, 0);

/**
 * Turn one stage into the camera path the VirtualCamera consumes.
 *
 * The move starts at STAGE_FADE rather than 0, so the camera holds on the incoming framing for
 * the length of the crossfade before it begins to travel.
 */
export function stagePath(stage: Stage): CameraMove[] {
  return [
    { region: stage.from, at: 0, dur: 0 },
    {
      region: stage.to,
      at: STAGE_FADE,
      dur: Math.max(1, Math.round(stage.pushSeconds * FPS)),
      settle: stage.settle,
    },
  ];
}
