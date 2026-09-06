// MusicalTime — express cut points in bars and beats instead of magic frame numbers.
//
// Footage-led promos live or die on whether the cuts land with the music. Writing that as raw
// frame numbers works exactly once: change the BPM, the fps, or one section's length, and every
// number downstream is silently wrong.
//
// ── The drift trap ────────────────────────────────────────────────────────────────────────────
//
// The obvious implementation is to round the beat once and multiply:
//
//     const BEAT = Math.round(fps * 60 / bpm);   // 124 BPM @30fps -> 15 (true: 14.516)
//     const bar4 = 4 * BEAT;                     // 60 (true: 58.06)
//
// Every bar then gains half a frame, and it accumulates. At 124 BPM and 30fps that is
// +31 frames — over a second — by bar 16, so the back half of the video is visibly off the beat
// while the arithmetic looks tidy.
//
// This module never multiplies a rounded beat. It computes the exact position in frames and
// rounds ONCE, at the end:
//
//     frameAt(beat) = Math.round(beat * fps * 60 / bpm)
//
// The error against true time is therefore bounded at half a frame forever, no matter how long
// the piece runs. Everything else here is built on that one function.
//
// Rounding is Math.round throughout, stated rather than implied, so two callers computing the
// same musical position always agree — a cut and the SFX marking it cannot land a frame apart.

export type Meter = {
  /** Beats per minute. */
  bpm: number;
  /** Beats in a bar. 4 unless you know otherwise. */
  beatsPerBar: number;
  /** Frames per second. Pass the COMPOSITION's fps — never assume 30. */
  fps: number;
};

export function meter(bpm: number, fps: number, beatsPerBar = 4): Meter {
  if (!(bpm > 0)) throw new Error(`MusicalTime: bpm must be positive, got ${bpm}`);
  if (!(fps > 0)) throw new Error(`MusicalTime: fps must be positive, got ${fps}`);
  if (!(beatsPerBar > 0)) throw new Error(`MusicalTime: beatsPerBar must be positive`);
  return { bpm, beatsPerBar, fps };
}

/** Exact frames per beat, unrounded. Use this for maths, not for placing anything. */
export const beatFrames = (m: Meter): number => (m.fps * 60) / m.bpm;

/** Exact frames per bar, unrounded. */
export const barFrames = (m: Meter): number => beatFrames(m) * m.beatsPerBar;

/**
 * The frame a given beat falls on, counting from beat 0 at the composition start.
 *
 * Fractional beats are allowed and useful: 0.5 is an off-beat, 0.25 a sixteenth.
 */
export const frameAtBeat = (m: Meter, beat: number): number => Math.round(beat * beatFrames(m));

/** The frame a given bar falls on. Bar 0 is the start. */
export const frameAtBar = (m: Meter, bar: number): number =>
  frameAtBeat(m, bar * m.beatsPerBar);

/**
 * The frame at bar + beat offset, which is how a cue is usually described out loud:
 * "bar 6, beat 3" is `frameAt(m, 6, 2)` — beats within the bar are 0-indexed like the bars.
 */
export const frameAt = (m: Meter, bar: number, beatOffset = 0): number =>
  frameAtBeat(m, bar * m.beatsPerBar + beatOffset);

/**
 * The length in frames of a span of `beats`, starting at `fromBeat`.
 *
 * ⚠️ Use this rather than `beats * roundedBeatLength`. Because both ends are rounded from exact
 * positions, consecutive spans tile the timeline with no gaps and no overlaps, and the sum of a
 * run of spans equals the distance between its endpoints exactly.
 */
export const beatSpan = (m: Meter, fromBeat: number, beats: number): number =>
  frameAtBeat(m, fromBeat + beats) - frameAtBeat(m, fromBeat);

/** The length in frames of `bars` bars starting at `fromBar`. */
export const barSpan = (m: Meter, fromBar: number, bars: number): number =>
  frameAtBar(m, fromBar + bars) - frameAtBar(m, fromBar);

/** Which beat a frame falls on, as a real number. The inverse of frameAtBeat. */
export const beatAtFrame = (m: Meter, frame: number): number => frame / beatFrames(m);

/**
 * Lay out consecutive sections given their lengths in BARS, returning exact frame boundaries.
 *
 * The returned starts tile without gaps, every start sits on a bar line, and `total` is the last
 * boundary — so a composition's duration is derived from its musical structure rather than typed
 * in and kept in sync by hand.
 */
export function layoutBars<K extends string>(
  m: Meter,
  sections: { id: K; bars: number }[]
): { starts: Record<K, number>; lengths: Record<K, number>; order: K[]; total: number } {
  const starts = {} as Record<K, number>;
  const lengths = {} as Record<K, number>;
  const order: K[] = [];
  let bar = 0;
  for (const s of sections) {
    starts[s.id] = frameAtBar(m, bar);
    lengths[s.id] = barSpan(m, bar, s.bars);
    order.push(s.id);
    bar += s.bars;
  }
  return { starts, lengths, order, total: frameAtBar(m, bar) };
}

/**
 * Snap an arbitrary frame to the nearest beat. For pulling a hand-picked moment onto the grid
 * without having to work out which beat it was near.
 */
export const snapToBeat = (m: Meter, frame: number): number =>
  frameAtBeat(m, Math.round(beatAtFrame(m, frame)));

/**
 * A cue expressed relative to a section, converted to a frame relative to that section.
 *
 * ⚠️ Use this for anything placed inside a <Sequence> whose position is described musically.
 * The obvious form is wrong at a fractional-frame BPM:
 *
 *     frameAtBeat(m, offsetBeat)                                    // WRONG inside a section
 *     frameAtBeat(m, startBeat + offsetBeat) - frameAtBeat(m, startBeat)   // right
 *
 * Both boundaries are rounded independently, so the naive form drifts a frame off the absolute
 * grid depending on where the section happens to start. At 124 BPM and 30fps, 264 of the first
 * 1105 (startBeat, offsetBeat) pairs disagree by one frame — enough for a hit meant to land with
 * a cut to land next to it instead.
 *
 * A one-frame error is inaudible on its own and obvious when the whole video is on the grid
 * except one accent.
 */
export const localFrameAtBeat = (m: Meter, sectionStartBeat: number, offsetBeat: number): number =>
  frameAtBeat(m, sectionStartBeat + offsetBeat) - frameAtBeat(m, sectionStartBeat);

/**
 * Frames needed to carry a spoken line, rounded UP to the next musical boundary.
 *
 * A speech-led section is as long as the words take, plus room to breathe — never the other way
 * round. Rounding UP is the whole point: trimming a section to fit the grid would clip the line,
 * so the grid gives way and the section takes the next whole beat or bar.
 *
 * Returns the length in BEATS (or bars), because a section is declared musically; convert with
 * beatSpan/barSpan once you know where it starts.
 */
/**
 * The smallest number of whole beats, starting at `fromBeat`, whose ABSOLUTE span is long enough
 * to carry `frames`.
 *
 * ⚠️ This is not `Math.ceil(frames / beatFrames)`, and the difference is a real bug rather than a
 * rounding nicety. Because both ends of a span are rounded from exact positions, the integer length
 * of N beats VARIES BY ONE FRAME depending on where the span starts: at 124 BPM and 30fps a
 * 38-beat span is 551 frames from some start beats and 552 from others. Sizing a section with an
 * average beat length therefore produces a span that is occasionally one frame too short for the
 * media it was sized to carry — which clips the last frame of a voiceover, on some days and not
 * others, depending only on how long the earlier stories happened to be.
 *
 * So the length is checked against the span that will ACTUALLY be used, and grows if it is short.
 *
 * `minBeats` is the structural floor: a section may need a minimum length for reasons that have
 * nothing to do with the media it carries.
 */
export function beatsToCover(
  m: Meter,
  fromBeat: number,
  frames: number,
  minBeats = 1
): number {
  let beats = Math.max(minBeats, Math.ceil(frames / beatFrames(m) - 1e-9));
  // At most one more beat is ever needed: a span is within one frame of beats*beatFrames, and one
  // extra beat adds at least floor(beatFrames) frames. The loop is a guard, not an algorithm.
  while (beatSpan(m, fromBeat, beats) < frames) beats += 1;
  return beats;
}

export function musicalUnitsForDuration(
  m: Meter,
  frames: number,
  opts: { headFrames?: number; tailFrames?: number; snap?: "beat" | "bar" } = {}
): { units: number; unit: "beat" | "bar"; requiredFrames: number } {
  const head = opts.headFrames ?? 0;
  const tail = opts.tailFrames ?? 0;
  const snap = opts.snap ?? "beat";
  const required = frames + head + tail;
  const per = snap === "bar" ? barFrames(m) : beatFrames(m);
  // Strictly greater-than guards the boundary case: a line of exactly one beat needs one beat,
  // not two, but a line one frame longer needs two.
  const units = Math.max(1, Math.ceil(required / per - 1e-9));
  return { units, unit: snap, requiredFrames: required };
}

