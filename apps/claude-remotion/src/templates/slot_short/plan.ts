// The short, as an ordered list of slots. This is the file to edit.
//
//   brand -> ordered slots -> derived timing -> one finished short
//
// ── What changed from the slot-era implementation this replaces ───────────────────────────────
//
// That version required EXACTLY eleven slots in a fixed order (s1, s2, v1, s3, s4, v2, s5, s6,
// v3, s7, s8) and threw if any were missing. It also carried nine slot TYPE names —
// `branded_content_intro_still`, `reusable_brand_context_still`, `brand_reconnection_still` and
// so on — which turned out to be five rendering behaviours wearing nine marketing labels.
//
// This version takes any number of slots in any order, and names them by what they DO:
//
//   brand     the mark, entering or leaving
//   message   words on a ground: a claim, a result, a reflection
//   image     a picture with an optional caption
//   footage   a video file, trimmed
//   cta       an action and where to take it
//
// The distinctions that were kept are real ones: `brand` shows a mark where `message` shows words;
// `image` carries a picture where `message` is typographic; `footage` decodes video where a still
// does not; `cta` is emphasised differently and carries a destination. Anything the old vocabulary
// distinguished beyond that was copy, not behaviour.
//
// Timing is DERIVED. Each slot declares seconds; frames accumulate; the composition's duration is
// the sum. Nothing is written down twice.

import { readingFloor } from "../shared/CaptionTrack";
import type { Brand } from "../shared/BrandTokens";
import type { FitMode } from "../shared/FootageClip";

export const FPS = 30;

// ── Brand ─────────────────────────────────────────────────────────────────────────────────────
//
// No logo. That is the point: the default renders from a clean clone, and BrandMark draws a
// wordmark from the name. Add `logoSrc: staticFile("brand-logo.png")` when you have one.

export const BRAND: Brand = {
  name: "Northpoint",
  accent: "#38bdf8",
  accent2: "#3ddc97",
  handle: "northpoint.example",
};

// ── Slots ─────────────────────────────────────────────────────────────────────────────────────

export type BrandSlot = {
  kind: "brand";
  /** intro enters and holds; close holds and leaves. */
  mode: "intro" | "close";
  seconds: number;
  /** Optional line under the mark. */
  tagline?: string;
};

export type MessageSlot = {
  kind: "message";
  seconds: number;
  headline: string;
  subtext?: string;
  /** Emphasise this as an outcome rather than a claim: larger figure, accent rule. */
  emphasis?: "normal" | "result";
};

export type ImageSlot = {
  kind: "image";
  seconds: number;
  /** Omit for the generated neutral visual, which needs no asset. */
  src?: string;
  caption?: string;
  fit?: FitMode;
};

export type FootageSlot = {
  kind: "footage";
  seconds: number;
  src: string;
  /** Frames into the source file. */
  trimBefore?: number;
  fit?: FitMode;
  caption?: string;
  /** The source's real pixel size, so a trim can be checked against its length. */
  sourceFrames?: number;
};

export type CtaSlot = {
  kind: "cta";
  seconds: number;
  headline: string;
  /** Where to go. Rendered in the mono face so it reads as an address. */
  destination?: string;
};

export type Slot = BrandSlot | MessageSlot | ImageSlot | FootageSlot | CtaSlot;

/**
 * The demo short: seven slots covering all five primitives.
 *
 * Seven rather than eleven, because eleven only ever demonstrated that eleven was allowed.
 */
export const SLOTS: Slot[] = [
  { kind: "brand", mode: "intro", seconds: 2.5, tagline: "Short-form, from a slot plan." },
  {
    // 5.0s, not the 3.5s first written here: compileShort refused it, because 69 characters need
    // 4.83s to read. Every duration below has been through that check.
    kind: "message",
    seconds: 5,
    headline: "One ordered list of slots.",
    subtext: "Each slot says what it is. Timing follows.",
  },
  { kind: "image", seconds: 3.5, caption: "A still slot, drawn in code — no asset required." },
  {
    kind: "footage",
    seconds: 3.5,
    src: "footage-samples/sample-a.mp4",
    // 12, not 18: at 3.5s this slot reads 105 source frames, and 18 + 105 overruns the 120-frame
    // file by three. compileShort caught that too.
    trimBefore: 12,
    caption: "A footage slot, decoding a real file.",
    sourceFrames: 120,
  },
  {
    kind: "message",
    seconds: 4.2,
    headline: "Derived, not declared",
    // Deliberately does NOT quote the total. A number here would have to be kept in step with the
    // sum by hand, which is the duplication this design exists to remove.
    subtext: "the length comes from the slots",
    emphasis: "result",
  },
  { kind: "cta", seconds: 3, headline: "Copy the plan. Change the slots.", destination: "plan.ts" },
  { kind: "brand", mode: "close", seconds: 2.5 },
];

// ── Compilation ───────────────────────────────────────────────────────────────────────────────

export type CompiledSlot = {
  index: number;
  slot: Slot;
  from: number;
  durationInFrames: number;
};

export type CompiledShort = {
  totalFrames: number;
  slots: CompiledSlot[];
  problems: string[];
};

/** The text a slot puts on screen, for the reading-floor check. */
function slotText(s: Slot): string {
  switch (s.kind) {
    case "message":
      return [s.headline, s.subtext].filter(Boolean).join(" ");
    case "cta":
      return [s.headline, s.destination].filter(Boolean).join(" ");
    case "image":
      return s.caption ?? "";
    case "footage":
      return s.caption ?? "";
    case "brand":
      return s.tagline ?? "";
  }
}

/**
 * Turn the slot list into frames, and check it.
 *
 * The reading floor is the check worth having. A slot carrying two lines of text and a duration
 * someone typed in a hurry produces a video that plays correctly and cannot be read, which is the
 * hardest kind of fault to notice — it looks fine frame by frame. `readingFloor()` is the same
 * helper the caption layer uses, so a slot and a caption agree about how long words take.
 */
export function compileShort(slots: Slot[] = SLOTS): CompiledShort {
  const problems: string[] = [];
  const compiled: CompiledSlot[] = [];
  let cursor = 0;

  slots.forEach((slot, index) => {
    const durationInFrames = Math.round(slot.seconds * FPS);
    if (durationInFrames <= 0) {
      problems.push(`slot ${index} (${slot.kind}): duration must be positive`);
    }

    const text = slotText(slot);
    if (text.trim().length > 0) {
      const floor = readingFloor(text);
      if (slot.seconds + 1e-9 < floor) {
        problems.push(
          `slot ${index} (${slot.kind}): ${slot.seconds}s on screen but its ${text.length} ` +
            `characters need ${floor.toFixed(2)}s to read`
        );
      }
    }

    if (slot.kind === "footage") {
      const trim = slot.trimBefore ?? 0;
      if (slot.sourceFrames != null && trim + durationInFrames > slot.sourceFrames) {
        problems.push(
          `slot ${index} (footage): reads source frames ${trim}..${trim + durationInFrames} ` +
            `but the file is ${slot.sourceFrames} long`
        );
      }
    }

    compiled.push({ index, slot, from: cursor, durationInFrames });
    cursor += durationInFrames;
  });

  const sum = compiled.reduce((a, s) => a + s.durationInFrames, 0);
  if (sum !== cursor) problems.push(`slot frames sum ${sum} but the cursor ended at ${cursor}`);

  return { totalFrames: cursor, slots: compiled, problems };
}

export const SHORT = compileShort();

/** The composition's duration. Root.tsx must use this rather than repeating a number. */
export const SLOT_SHORT_FRAMES = SHORT.totalFrames;
