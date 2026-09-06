// The sequence, as ordered steps. This is the file to edit.
//
//   context -> numbered steps -> derived timeline -> a close
//
// ── What this is for, and what it is not ──────────────────────────────────────────────────────
//
// StepSequence is for a video where ORDER CARRIES MEANING: how something works, a process, a short
// tutorial, a before-action-after progression. Step 3 follows step 2 because it has to, and the
// numbering is information rather than decoration.
//
// SlotShort is the neighbour to be clear about. It assembles heterogeneous PROMOTIONAL content —
// a brand mark, a claim, a picture, a call to action — where the order is editorial rather than
// causal. If you could shuffle the middle without confusing anyone, you want SlotShort. If you
// could not, you want this.
//
// ── What was kept from the implementation this replaces ───────────────────────────────────────
//
// The good idea was that a section declares its own length in seconds and the composition's
// duration is the SUM. That survives, unchanged in spirit.
//
// What did not survive: nine section types (`branded_intro`, `hero_video_clip`, `caption_beat`,
// `progress_card`, `product_still`, `chapter_title`, `lower_third`, `branded_outro`, `cta_card`)
// alongside enumerations for platform, energy, caption style and transition style, plus fields
// carried for an external validator — `intent`, `remotion_hint`, `review_required`,
// `animation_direction`. Those describe a request being fulfilled, not a video being made. A step
// here declares what it SHOWS.

import { readingFloor } from "../shared/CaptionTrack";
import type { Brand } from "../shared/BrandTokens";
import type { FitMode } from "../shared/FootageClip";

export const FPS = 30;

export const BRAND: Brand = {
  name: "Northpoint",
  accent: "#38bdf8",
  accent2: "#3ddc97",
};

/** Shown before step 1: what this sequence is about. */
export const CONTEXT = {
  title: "Timing a caption",
  subtitle: "Three steps, in the order they have to happen.",
  seconds: 4.5,
};

/** Shown after the last step. */
export const CLOSE = {
  title: "That is the whole rule.",
  detail: "1.8s floor, plus 0.07s per character.",
  seconds: 4.5,
};

export type Step = {
  /** A short label. The number is added automatically — do not write "1." here. */
  label: string;
  /** One or two lines saying what happens at this step. */
  body?: string;
  seconds: number;
  /** Optional media. Omit for a typographic step on the brand ground. */
  media?: {
    kind: "image" | "footage";
    src: string;
    fit?: FitMode;
    /** Frames into a footage source. */
    trimBefore?: number;
    /** The source's length in frames, so a trim can be checked. */
    sourceFrames?: number;
  };
  /** Marks this step as the outcome: larger, accented, and the numbering stops. */
  emphasis?: "result";
};

/**
 * The demo sequence: three steps plus a result, about 20 seconds.
 *
 * The subject is deliberately a rule this repo actually uses, so the example teaches something
 * true rather than showing lorem ipsum in a numbered box.
 */
export const STEPS: Step[] = [
  {
    label: "Count the characters",
    body: "Longer lines take longer to read.",
    seconds: 4,
  },
  {
    label: "Multiply by the reading rate",
    body: "0.07 seconds each.",
    seconds: 3.5,
    media: {
      kind: "footage",
      src: "footage-samples/sample-b.mp4",
      trimBefore: 12,
      sourceFrames: 120,
    },
  },
  {
    label: "Apply the floor",
    body: "A two-word line still needs a moment.",
    seconds: 4,
  },
  {
    label: "The caption holds long enough to read",
    seconds: 3.5,
    emphasis: "result",
  },
];

// ── Compilation ───────────────────────────────────────────────────────────────────────────────

export type Part =
  | { kind: "context"; seconds: number }
  | { kind: "step"; step: Step; number: number | null; seconds: number }
  | { kind: "close"; seconds: number };

export type CompiledPart = {
  index: number;
  part: Part;
  from: number;
  durationInFrames: number;
};

export type CompiledSequence = {
  totalFrames: number;
  parts: CompiledPart[];
  problems: string[];
};

function partText(p: Part): string {
  if (p.kind === "context") return `${CONTEXT.title} ${CONTEXT.subtitle}`;
  if (p.kind === "close") return `${CLOSE.title} ${CLOSE.detail}`;
  return [p.step.label, p.step.body].filter(Boolean).join(" ");
}

/**
 * Build the timeline and check it.
 *
 * Steps are numbered here rather than in the plan, so inserting a step in the middle renumbers the
 * rest automatically. A `result` step is NOT numbered: it is the outcome of the sequence, not
 * another instruction, and giving it a number invites the viewer to look for a step after it.
 */
export function compileSequence(steps: Step[] = STEPS): CompiledSequence {
  const problems: string[] = [];
  const parts: Part[] = [{ kind: "context", seconds: CONTEXT.seconds }];

  let n = 0;
  for (const step of steps) {
    const numbered = step.emphasis !== "result";
    if (numbered) n += 1;
    parts.push({ kind: "step", step, number: numbered ? n : null, seconds: step.seconds });
  }
  parts.push({ kind: "close", seconds: CLOSE.seconds });

  const compiled: CompiledPart[] = [];
  let cursor = 0;

  parts.forEach((part, index) => {
    const durationInFrames = Math.round(part.seconds * FPS);
    if (durationInFrames <= 0) problems.push(`part ${index} (${part.kind}): duration must be positive`);

    const text = partText(part);
    if (text.trim().length > 0) {
      const floor = readingFloor(text);
      if (part.seconds + 1e-9 < floor) {
        problems.push(
          `part ${index} (${part.kind}): ${part.seconds}s on screen but its ${text.length} ` +
            `characters need ${floor.toFixed(2)}s to read`
        );
      }
    }

    if (part.kind === "step" && part.step.media?.kind === "footage") {
      const m = part.step.media;
      const trim = m.trimBefore ?? 0;
      if (m.sourceFrames != null && trim + durationInFrames > m.sourceFrames) {
        problems.push(
          `part ${index} ("${part.step.label}"): reads source frames ${trim}..${
            trim + durationInFrames
          } but the file is ${m.sourceFrames} long`
        );
      }
    }

    compiled.push({ index, part, from: cursor, durationInFrames });
    cursor += durationInFrames;
  });

  return { totalFrames: cursor, parts: compiled, problems };
}

export const SEQUENCE = compileSequence();

/** The composition's duration. Root.tsx uses this rather than repeating a number. */
export const STEP_SEQUENCE_FRAMES = SEQUENCE.totalFrames;

/** How many numbered steps there are, for the "n of N" counter. */
export const STEP_COUNT = STEPS.filter((s) => s.emphasis !== "result").length;
