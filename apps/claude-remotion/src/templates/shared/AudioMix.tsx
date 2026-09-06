// AudioMix — a music bed that ducks under speech, plus a declarative SFX cue table.
//
// The mix is the part of a footage promo that most obviously separates "edited" from "assembled",
// and it is also the part most often written as one-off gain numbers scattered through JSX. This
// module holds the three pieces that recur:
//
//   MusicBed    one bed, one gain, ducked automatically, faded at the tail
//   SfxCues     a table of {src, at, gain} rather than <Audio> tags buried in components
//   SpeechCues  the lines that cause the ducking, declared once and reused by both
//
// ── Why the duck is an envelope, not a level change ───────────────────────────────────────────
//
// Stepping the music down for a whole section reads as a mixing mistake: the listener hears the
// level move and there is no cause on screen. Ducking tied to the SPEECH means the dip has a
// reason every time it happens, and nobody notices it — which is the point.
//
// The envelope has four parts, all in frames:
//
//   attack   ramp down, starting BEFORE the line so the bed is already out of the way
//   hold     the length of the line itself
//   release  ramp back up after it
//   depth    how far down, as a multiplier
//
// Depth is per-cue, not global: an opening line over a sparse bed wants a different dip from a
// tag line over a full mix.
//
// Ramps use smoothstep rather than a straight line. Both are continuous in value, but a linear
// ramp has a corner in its derivative at each end, and on a loud bed that corner is audible as a
// small pump. Smoothstep starts and ends with zero slope, so the bed simply leans out of the way.

import React from "react";
import { AbsoluteFill, Audio, Sequence, useVideoConfig } from "remotion";

/** Smoothstep from 0 to 1 over [e0, e1], flat outside. Continuous in value and slope. */
function smoothstep(e0: number, e1: number, x: number): number {
  if (e1 === e0) return x < e0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export type DuckShape = {
  /** Frames of ramp-down before the line starts. */
  attack: number;
  /** Frames of ramp-up after the line ends. */
  release: number;
  /** Default multiplier while a line speaks. A cue may override it. */
  depth: number;
};

export const DEFAULT_DUCK: DuckShape = { attack: 8, release: 14, depth: 0.45 };

export type SpeechCue = {
  src: string;
  /** Frame the line starts, in composition frames. */
  at: number;
  /** Length of the line in frames. Measure it from the file; do not guess. */
  dur: number;
  /** Gain for the line itself. */
  gain?: number;
  /** Overrides DuckShape.depth for this line only. */
  depth?: number;
};

/**
 * The music multiplier at a frame: 1 when nothing is speaking, `depth` while a line is.
 *
 * Exported so a test can assert the envelope reaches its depth and returns, and so anything else
 * that needs to know "is speech happening" uses the same answer as the mix.
 */
export function duckAt(frame: number, cues: SpeechCue[], shape: DuckShape = DEFAULT_DUCK): number {
  let g = 1;
  for (const c of cues) {
    const depth = c.depth ?? shape.depth;
    const start = c.at;
    const end = c.at + c.dur;
    // Down over the attack, hold, then back up over the release.
    const down = 1 - smoothstep(start - shape.attack, start, frame);
    const up = smoothstep(end, end + shape.release, frame);
    const level = depth + (1 - depth) * Math.max(down, up);
    g = Math.min(g, level);
  }
  return g;
}

export type MusicBedProps = {
  src: string;
  /** Bed level before ducking. */
  gain?: number;
  /** Lines that duck it. Pass the same array you render as speech. */
  speech?: SpeechCue[];
  duck?: DuckShape;
  /**
   * Frame the bed should be silent by. Defaults to the composition end.
   *
   * ⚠️ Set this when the music FILE is shorter than the video: fading to the composition end
   * leaves the bed already silent and the fade does nothing, so the track stops dead on its last
   * sample. One of the historical adverts carried a separate music-end frame for exactly this.
   */
  endFrame?: number;
  /** Frames of fade at the tail, so the render cannot end on a click. */
  tailFade?: number;
  /** Frames of fade at the head. */
  headFade?: number;
  /**
   * Repeat the file until the composition ends. Use it when the bed is shorter than the video.
   *
   * ⚠️ This also sets `loopVolumeCurveBehavior="extend"`, and it must. By default a looped
   * Audio restarts the volume callback's frame at 0 on every repeat, so an envelope spanning the
   * whole video would re-run from the beginning each time and the duck would fire at the wrong
   * moments. "extend" keeps the frame counting across iterations.
   */
  loop?: boolean;
};

export const MusicBed: React.FC<MusicBedProps> = ({
  src,
  gain = 0.7,
  speech = [],
  duck = DEFAULT_DUCK,
  endFrame,
  tailFade = 24,
  headFade = 0,
  loop = false,
}) => {
  const { durationInFrames } = useVideoConfig();
  const end = endFrame ?? durationInFrames;
  const volume = (f: number) => {
    const head = headFade > 0 ? smoothstep(0, headFade, f) : 1;
    const tail = tailFade > 0 ? 1 - smoothstep(end - tailFade, end, f) : f < end ? 1 : 0;
    return gain * duckAt(f, speech, duck) * head * tail;
  };
  return (
    <Audio
      src={src}
      volume={volume}
      loop={loop}
      loopVolumeCurveBehavior={loop ? "extend" : "repeat"}
    />
  );
};

export type SfxCue = {
  src: string;
  /** Frame the cue fires. Use the musical helpers to place it rather than typing a number. */
  at: number;
  /**
   * Level. A number, or a function of the cue's index within the table.
   *
   * The function form carries a technique worth keeping: a repeated hit that ESCALATES across a
   * run reads as building energy, where the same hit at a constant level reads as a metronome.
   * The shape is yours; only the ability to express it belongs here.
   */
  gain?: number | ((index: number) => number);
};

export const SfxCues: React.FC<{ cues: SfxCue[] }> = ({ cues }) => (
  <>
    {cues.map((c, i) => {
      const g = typeof c.gain === "function" ? c.gain(i) : (c.gain ?? 0.8);
      return (
        <Sequence key={`${c.src}-${c.at}-${i}`} from={c.at} layout="none">
          {/* A constant-returning callback, which is the signature Remotion wants. */}
          <Audio src={c.src} volume={() => g} />
        </Sequence>
      );
    })}
  </>
);

export const SpeechCues: React.FC<{ cues: SpeechCue[]; gain?: number }> = ({ cues, gain = 1 }) => (
  <>
    {cues.map((c, i) => (
      <Sequence key={`${c.src}-${c.at}-${i}`} from={c.at} layout="none">
        <Audio src={c.src} volume={() => c.gain ?? gain} />
      </Sequence>
    ))}
  </>
);

/**
 * The whole mix in one element: bed, speech and SFX, mounted together.
 *
 * Keep it OUTSIDE any visual treatment that duplicates its children — a chromatic-split or
 * ghosting effect that renders children three times would mount the audio three times with it.
 */
export const AudioMixLanes: React.FC<{
  music?: MusicBedProps;
  speech?: SpeechCue[];
  sfx?: SfxCue[];
  speechGain?: number;
}> = ({ music, speech = [], sfx = [], speechGain = 1 }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {music ? <MusicBed {...music} speech={music.speech ?? speech} /> : null}
    <SpeechCues cues={speech} gain={speechGain} />
    <SfxCues cues={sfx} />
  </AbsoluteFill>
);
