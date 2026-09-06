// The promo, as a plan. This is the file to edit; everything else is machinery.
//
// The production grammar every footage-led promo in this studio independently arrived at:
//
//   clips  ->  sections  ->  cuts on the musical grid  ->  captions
//                                                       -> music bed
//                                                       -> speech, which ducks the bed
//                                                       -> SFX cues
//                                                       -> one frame-budgeted composition
//
// Two rules make it hold together:
//
//   1. NOTHING IS A MAGIC FRAME NUMBER. Sections are lengths in bars; cuts are lengths in beats.
//      Frames are derived. Change the BPM and every cut moves with the music instead of drifting
//      out of it.
//
//   2. THE STRUCTURE IS CHECKED, NOT TRUSTED. compilePlan() refuses a plan whose cuts do not fill
//      their section, or whose clip ids do not exist. A promo that is one beat short does not
//      announce itself on screen; it just feels slightly wrong.

import type { FitMode } from "../shared/FootageClip";
import type { CaptionLine } from "../shared/CaptionTrack";
import {
  barSpan,
  frameAt,
  frameAtBar,
  frameAtBeat,
  localFrameAtBeat,
  meter,
  musicalUnitsForDuration,
} from "../shared/MusicalTime";

/** The composition's fps. The music bed was written at this rate; see the assertion below. */
export const FPS = 30;

/**
 * 124 BPM, matching the in-house music bed.
 *
 * ⚠️ Deliberately not a round number. At 124 BPM a beat is 14.516 frames, so the naive
 * "round the beat, then multiply" approach drifts about half a frame per beat — over a second by
 * bar 16. If this demo used 120 or 150 BPM (exactly 15 and 12 frames) the timing bug would be
 * invisible and the fix untested.
 */
export const BPM = 124;

export const METER = meter(BPM, FPS, 4);

// ── Clips ─────────────────────────────────────────────────────────────────────────────────────
//
// A registry, so a source path is written once and referenced by name. `size` is the file's real
// pixel size — the two samples are deliberately different shapes, because footage rarely matches
// the composition and a template that only handles 1920x1080 has not been tested.

export type ClipId = "wide" | "detail";

export const CLIPS: Record<ClipId, { src: string; size: { width: number; height: number } }> = {
  wide: { src: "footage-samples/sample-a.mp4", size: { width: 960, height: 540 } },
  detail: { src: "footage-samples/sample-b.mp4", size: { width: 720, height: 720 } },
};

/** Each sample is 4s at 30fps. Trims must leave room for the cut, and compilePlan checks it. */
export const CLIP_SOURCE_FRAMES = 120;

// ── Sections ──────────────────────────────────────────────────────────────────────────────────

export type SectionRole = "cold-open" | "build" | "drop" | "sustain" | "outro";

export type Cut = {
  clip: ClipId;
  /** Length in beats. Use 4 for a bar. Cuts in a section must sum to its length. */
  beats: number;
  /** Frames into the SOURCE to start from — the interesting moment is rarely frame 0. */
  trimBefore?: number;
  /** cover (default) fills and crops; contain letterboxes. */
  fit?: FitMode;
  /** A grade, e.g. "saturate(1.2)". */
  filter?: string;
};

/**
 * How long a section is.
 *
 * `{ bars: n }` for a music-led section: you decide the length and cut to fill it.
 *
 * `{ speech: ... }` for a speech-led one: the length comes from the MEASURED voice file, plus room
 * to breathe, rounded UP to the next whole beat or bar. Speech is never shortened to fit a section
 * that was declared first — that clips the line.
 */
export type SectionLength =
  | { bars: number }
  | {
      speech: { src: string; frames: number };
      headFrames?: number;
      tailFrames?: number;
      snap?: "beat" | "bar";
    };

export type Section = {
  id: string;
  role: SectionRole;
  /** Length in bars, or derived from a speech file. */
  length: SectionLength;
  cuts: Cut[];
  captions?: CaptionLine[];
  /** An impact flash at this beat offset within the section. */
  impactAtBeat?: number;
  /** A word or phrase landing on a beat offset within the section. */
  beatHits?: { text: string; atBeat: number; holdBeats?: number }[];
  /** One shot inset over the section's own footage. */
  pip?: {
    clip: ClipId;
    corner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    width?: number;
    label?: string;
    trimBefore?: number;
  };
  /** Two to four shots at once, INSTEAD of this section's cuts. */
  grid?: { clip: ClipId; trimBefore?: number; fit?: FitMode; label?: string }[];
  /** Optional degradation layer. Off unless a section asks for it. */
  treatment?: { intensity: number; label?: string; timecode?: boolean };
};

export const SECTIONS: Section[] = [
  {
    id: "cold-open",
    role: "cold-open",
    length: { bars: 2 },
    // One long, quiet shot. A cold open earns the drop by making the viewer wait.
    cuts: [{ clip: "wide", beats: 8, trimBefore: 0 }],
    captions: [{ in_s: 0.5, out_s: 3.4, text: "Footage, cut to the music.", style: "title" }],
  },
  {
    id: "build",
    role: "build",
    length: { bars: 3 },
    // Cuts shorten as the section runs: 4 beats, 4, then 2+2. Acceleration reads as tension.
    cuts: [
      { clip: "detail", beats: 4, trimBefore: 12 },
      { clip: "wide", beats: 4, trimBefore: 48 },
      { clip: "detail", beats: 2, trimBefore: 60 },
      { clip: "wide", beats: 2, trimBefore: 84 },
    ],
    // The inset arrives over the section's own footage — a second angle, not a second cut.
    pip: { clip: "detail", corner: "top-right", width: 0.26, label: "ANGLE 2", trimBefore: 30 },
    captions: [
      { in_s: 0.3, out_s: 5.4, text: "Sections are bars.\nCuts are beats.", style: "subtitle" },
    ],
  },
  {
    id: "drop",
    role: "drop",
    length: { bars: 4 },
    // The impact lands on the section's first frame, with the flash and the slam.
    impactAtBeat: 0,
    // Three words, one per bar, each landing on a beat the cuts also land on.
    beatHits: [
      { text: "ON", atBeat: 0, holdBeats: 3 },
      { text: "THE", atBeat: 4, holdBeats: 3 },
      { text: "BEAT", atBeat: 8, holdBeats: 4 },
    ],
    cuts: [
      { clip: "detail", beats: 4, trimBefore: 0, filter: "saturate(1.25) contrast(1.08)" },
      { clip: "wide", beats: 2, trimBefore: 24 },
      { clip: "detail", beats: 2, trimBefore: 36 },
      { clip: "wide", beats: 2, trimBefore: 66 },
      { clip: "detail", beats: 2, trimBefore: 78 },
      { clip: "wide", beats: 4, trimBefore: 60 },
    ],
  },
  {
    id: "wall",
    role: "sustain",
    length: { bars: 2 },
    // A grid beat: four cells at once, INSTEAD of cutting. Two sources reused at different trims,
    // one of them square and contained among covered neighbours.
    grid: [
      { clip: "wide", trimBefore: 6 },
      { clip: "detail", trimBefore: 18, fit: "contain" },
      { clip: "wide", trimBefore: 54 },
      { clip: "detail", trimBefore: 72 },
    ],
    cuts: [{ clip: "wide", beats: 8, trimBefore: 0 }],
    // ⚠️ Beat 5 of a section starting on beat 36 is where the section-local rounding phase
    // matters: the naive frameAtBeat(5) gives 73, the grid-correct answer is 72. Deliberately an
    // odd offset in a later section, so the demo exercises the fix rather than agreeing with the
    // bug by luck — which the drop section's 0/4/8 offsets do.
    beatHits: [{ text: "FOUR ANGLES", atBeat: 5, holdBeats: 3 }],
  },
  {
    id: "read",
    role: "sustain",
    // SPEECH-LED. The length is not declared: it comes from the measured file plus breathing room,
    // rounded up to the next whole bar. Change the file and the section resizes itself.
    length: {
      speech: { src: "footage-samples/voice-tone-b.mp3", frames: 78 },
      headFrames: 12,
      tailFrames: 18,
      snap: "bar",
    },
    cuts: [
      { clip: "detail", beats: 4, trimBefore: 18, fit: "contain" },
      { clip: "wide", beats: 4, trimBefore: 30 },
    ],
    captions: [
      {
        in_s: 0.5,
        out_s: 3.8,
        text: "A speech-led section is\nas long as the words take.",
        style: "subtitle",
      },
    ],
  },
  {
    id: "outro",
    role: "outro",
    length: { bars: 3 },
    // Two long held shots to land on, rather than cutting until the music simply stops.
    // Held, not still: a 4s source cannot fill 12 beats in one cut, and compilePlan says so.
    cuts: [
      { clip: "detail", beats: 6, trimBefore: 24 },
      { clip: "wide", beats: 6, trimBefore: 30 },
    ],
    // The one treated section, to show the option works. Everything else is clean.
    treatment: { intensity: 0.55, label: "REC", timecode: true },
    captions: [{ in_s: 0.6, out_s: 5.4, text: "One plan. One grid.", style: "title" }],
  },
];

// ── Audio ─────────────────────────────────────────────────────────────────────────────────────
//
// The bed is the in-house 124 BPM loop already committed for another composition: eight bars,
// seamless by construction, licence-clean. Reusing it costs no new bytes.

export const MUSIC = {
  src: "audio/bed.mp3",
  gain: 0.62,
  /** The bed is 8 bars; the promo is 16. Loop it rather than commit a longer file. */
  loopBars: 8,
};

/** Bed level under speech, and the shape of the dip. */
export const DUCK = { attack: 7, release: 16, depth: 0.38 };

/**
 * The speech lane. These are voice-band placeholder tones, not speech — see
 * scripts/make-footage-samples.mjs. They exist so the duck has something to duck under.
 * Durations are the real file lengths, rounded to frames.
 */
export const SPEECH: { src: string; atBar: number; atBeat?: number; frames: number }[] = [
  { src: "footage-samples/voice-tone-a.mp3", atBar: 2, atBeat: 0, frames: 60 },
  { src: "footage-samples/voice-tone-b.mp3", atBar: 10, atBeat: 0, frames: 78 },
];

/**
 * SFX, placed musically. All four are in-house synthesized files already in the repo.
 *
 * `escalate` carries a technique from the ranked-countdown work: a repeated hit that rises across
 * a run reads as building energy, where the same hit at a fixed level reads as a metronome. Here
 * the four build ticks climb toward the drop.
 */
export const SFX: { src: string; atBar: number; atBeat?: number; gain?: number }[] = [
  { src: "audio/sfx/whoosh.mp3", atBar: 1, atBeat: 3, gain: 0.5 },
  { src: "audio/sfx/riser.mp3", atBar: 4, atBeat: 2, gain: 0.8 },
  { src: "audio/sfx/coldOpenSlam.mp3", atBar: 5, atBeat: 0, gain: 0.95 }, // the drop
  { src: "audio/sfx/numberHit.mp3", atBar: 7, atBeat: 0 },
  { src: "audio/sfx/numberHit.mp3", atBar: 8, atBeat: 0 },
  { src: "audio/sfx/whoosh.mp3", atBar: 13, atBeat: 0, gain: 0.45 },
];

/** Escalating gain for the repeated hits, as a fraction of the run. */
export const SFX_ESCALATION = { base: 0.45, climb: 0.35 };

// ── Compilation ───────────────────────────────────────────────────────────────────────────────

export type CompiledCut = {
  clip: ClipId;
  src: string;
  size: { width: number; height: number };
  /** Absolute composition frame. */
  from: number;
  durationInFrames: number;
  trimBefore: number;
  fit: FitMode;
  filter?: string;
};

export type CompiledSection = {
  id: string;
  role: SectionRole;
  from: number;
  durationInFrames: number;
  /** Absolute beat this section starts on. Needed to place anything musically inside it. */
  startBeat: number;
  cuts: CompiledCut[];
  captions: CaptionLine[];
  /** Section-local frame of the impact flash. */
  impactAt?: number;
  /** Section-local frames of the beat hits. */
  beatHits: { text: string; at: number; hold?: number }[];
  pip?: {
    src: string;
    source: { width: number; height: number };
    corner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    width?: number;
    label?: string;
    trimBefore?: number;
  };
  grid?: {
    src: string;
    source: { width: number; height: number };
    trimBefore?: number;
    fit?: FitMode;
    label?: string;
  }[];
  treatment?: { intensity: number; label?: string; timecode?: boolean };
};

export type CompiledPlan = {
  totalFrames: number;
  sections: CompiledSection[];
  problems: string[];
};

/**
 * Turn the declarative plan into absolute frames, and check it.
 *
 * Every frame number in the composition comes from here. The checks are the point: a section whose
 * cuts do not fill it, or a trim that runs past the end of its source, produces a video that looks
 * almost right, which is the hardest kind of fault to see.
 */
/**
 * How many BEATS a section occupies.
 *
 * A bar-declared section is simply bars x beatsPerBar. A speech-declared one is sized from the
 * measured file: required frames, rounded UP to the next whole beat or bar, so a line one frame
 * over a boundary takes the next whole unit instead of being clipped.
 */
export function sectionBeats(s: Section): number {
  if ("bars" in s.length) return s.length.bars * METER.beatsPerBar;
  const { units, unit } = musicalUnitsForDuration(METER, s.length.speech.frames, {
    headFrames: s.length.headFrames,
    tailFrames: s.length.tailFrames,
    snap: s.length.snap ?? "beat",
  });
  return unit === "bar" ? units * METER.beatsPerBar : units;
}

export function compilePlan(): CompiledPlan {
  const problems: string[] = [];

  // Every section's position is an exact integer BEAT count, accumulated. Sections may be sized
  // in bars or derived from speech, so bars alone are not enough to lay them out.
  //
  // ⚠️ Do not recover a section's beat by converting its start FRAME back to beats: the frame has
  // already been rounded, so the round trip compounds the error.
  const startBeats: number[] = [];
  const beatCounts: number[] = [];
  let beatCursor = 0;
  for (const s of SECTIONS) {
    startBeats.push(beatCursor);
    const b = sectionBeats(s);
    beatCounts.push(b);
    beatCursor += b;
  }
  const totalFrames = frameAtBeat(METER, beatCursor);

  const sections: CompiledSection[] = SECTIONS.map((s, si) => {
    const sectionStartBeat = startBeats[si];
    const from = frameAtBeat(METER, sectionStartBeat);
    const durationInFrames = frameAtBeat(METER, sectionStartBeat + beatCounts[si]) - from;

    const beatsInSection = beatCounts[si];
    const beatsDeclared = s.cuts.reduce((a, c) => a + c.beats, 0);
    // A grid section replaces its cuts with cells, so its cuts only need to cover the section as
    // a fallback layer; everything else must fill it exactly.
    if (beatsDeclared !== beatsInSection) {
      problems.push(
        `section "${s.id}": cuts total ${beatsDeclared} beats but the section is ${beatsInSection}` +
          ("speech" in s.length
            ? ` (derived from ${s.length.speech.frames}f of speech + head/tail)`
            : "")
      );
    }

    // Cut boundaries are ABSOLUTE beat positions, so every cut in the piece lands on the same
    // grid as every SFX cue and the section boundaries themselves.
    let beatCursor = 0;
    const cuts: CompiledCut[] = s.cuts.map((c) => {
      const clip = CLIPS[c.clip];
      if (!clip) problems.push(`section "${s.id}": unknown clip "${c.clip}"`);
      const cutFrom = frameAtBeat(METER, sectionStartBeat + beatCursor);
      const cutEnd = frameAtBeat(METER, sectionStartBeat + beatCursor + c.beats);
      beatCursor += c.beats;
      const dur = cutEnd - cutFrom;
      const trimBefore = c.trimBefore ?? 0;
      if (trimBefore + dur > CLIP_SOURCE_FRAMES) {
        problems.push(
          `section "${s.id}": cut on "${c.clip}" needs source frames ${trimBefore}..${
            trimBefore + dur
          } but the file is only ${CLIP_SOURCE_FRAMES} long`
        );
      }
      return {
        clip: c.clip,
        src: clip?.src ?? "",
        size: clip?.size ?? { width: 1920, height: 1080 },
        from: cutFrom,
        durationInFrames: dur,
        trimBefore,
        fit: c.fit ?? "cover",
        filter: c.filter,
      };
    });

    const cutFrames = cuts.reduce((a, c) => a + c.durationInFrames, 0);
    if (cutFrames !== durationInFrames) {
      problems.push(
        `section "${s.id}": cut frames total ${cutFrames}, section is ${durationInFrames}`
      );
    }

    return {
      id: s.id,
      role: s.role,
      from,
      durationInFrames,
      cuts,
      captions: s.captions ?? [],
      // ⚠️ SECTION-LOCAL, so it must keep the phase of the absolute grid. frameAtBeat(offset)
      // would be a frame out wherever the section's own start rounds the other way.
      impactAt:
        s.impactAtBeat == null
          ? undefined
          : localFrameAtBeat(METER, sectionStartBeat, s.impactAtBeat),
      beatHits: (s.beatHits ?? []).map((h) => ({
        text: h.text,
        at: localFrameAtBeat(METER, sectionStartBeat, h.atBeat),
        hold:
          h.holdBeats == null
            ? undefined
            : localFrameAtBeat(METER, sectionStartBeat + h.atBeat, h.holdBeats),
      })),
      pip: s.pip
        ? {
            src: CLIPS[s.pip.clip].src,
            source: CLIPS[s.pip.clip].size,
            corner: s.pip.corner,
            width: s.pip.width,
            label: s.pip.label,
            trimBefore: s.pip.trimBefore,
          }
        : undefined,
      grid: s.grid?.map((c) => ({
        src: CLIPS[c.clip].src,
        source: CLIPS[c.clip].size,
        trimBefore: c.trimBefore,
        fit: c.fit,
        label: c.label,
      })),
      treatment: s.treatment,
      startBeat: sectionStartBeat,
    };
  });

  const sumSections = sections.reduce((a, s) => a + s.durationInFrames, 0);
  if (sumSections !== totalFrames) {
    problems.push(`sections total ${sumSections} frames but the grid total is ${totalFrames}`);
  }

  // A speech-led section must actually fit its line, head and tail. Rounding up should guarantee
  // it; the check is here because "should" is how the last three defects got in.
  SECTIONS.forEach((s, i) => {
    if (!("speech" in s.length)) return;
    const need =
      s.length.speech.frames + (s.length.headFrames ?? 0) + (s.length.tailFrames ?? 0);
    if (sections[i].durationInFrames < need) {
      problems.push(
        `section "${s.id}": ${sections[i].durationInFrames} frames but the speech needs ${need}`
      );
    }
  });

  return { totalFrames, sections, problems };
}

export const PLAN = compilePlan();
export const FOOTAGE_PROMO_FRAMES = PLAN.totalFrames;

/** Absolute frame for a bar/beat cue, for the audio tables. */
export const cueFrame = (bar: number, beat = 0): number => frameAt(METER, bar, beat);

/** Bars of music, in frames — used to place the bed loop. */
export const musicLoopFrames = (): number => barSpan(METER, 0, MUSIC.loopBars);

/** Where each section starts, for anything that needs the map without recompiling. */
export const SECTION_START: Record<string, number> = Object.fromEntries(
  PLAN.sections.map((s) => [s.id, s.from])
);

export { frameAtBar };
