// FootageClip — one shot of footage, trimmed and fitted.
//
// Thin on purpose. It exists so that the things every historical promo got right are not
// re-derived per template, and the one thing they all skipped is handled once.
//
// What they all got right, and why:
//
//   OffthreadVideo   decodes each frame independently, so a distributed or re-attempted render
//                    produces the same pixels. <Video> keeps playback state and does not.
//   muted            the clip's own audio is never wanted; the mix owns the soundtrack. An
//                    unmuted clip quietly fights the bed and is hard to spot in a waveform.
//   trimBefore       the interesting second of a shot is rarely its first, so a clip declares
//                    where it starts rather than being pre-cut into a file per use.
//
// What they all skipped: every one of them hardcoded `objectFit: cover` and assumed the clip was
// already 1920x1080. Feed those a square or vertical source and it silently stretches or crops to
// nothing. This takes the fit mode as a parameter, defaults to cover, and — because cover cannot
// letterbox — guarantees no undefined edge during normal operation.

import React from "react";
import { AbsoluteFill, OffthreadVideo, useCurrentFrame } from "remotion";

export type FitMode = "cover" | "contain";

export type FootageClipProps = {
  /** Resolved source — pass staticFile("..."). */
  src: string;
  /**
   * Frames into the SOURCE at which to start. The composition's own clock is authoritative, so a
   * clip whose file is 25fps still advances one composition frame per composition frame; this is
   * an offset into the source's timeline, not a rate change.
   */
  trimBefore?: number;
  /**
   * cover fills the frame and crops the overflow — never letterboxes, so no undefined edge.
   * contain fits the whole frame inside and shows `background` around it.
   */
  fit?: FitMode;
  /** Seen only with fit="contain". */
  background?: string;
  /** Playback rate. 1 is normal; 0.5 is half speed. Leave alone unless the shot needs it. */
  playbackRate?: number;
  /** Opacity, for a caller driving its own transition. */
  opacity?: number;
  /** Extra CSS filter, e.g. a grade. */
  filter?: string;
};

export const FootageClip: React.FC<FootageClipProps> = ({
  src,
  trimBefore = 0,
  fit = "cover",
  background = "#000000",
  playbackRate,
  opacity = 1,
  filter,
}) => (
  <AbsoluteFill style={{ backgroundColor: background, overflow: "hidden", opacity }}>
    <OffthreadVideo
      src={src}
      muted
      trimBefore={trimBefore > 0 ? trimBefore : undefined}
      playbackRate={playbackRate}
      style={{ width: "100%", height: "100%", objectFit: fit, display: "block", filter }}
    />
  </AbsoluteFill>
);

/**
 * ImpactFlash — the frame-or-two of light that sells a hit.
 *
 * Both historical adverts independently reached for the same device on their drop, which is the
 * signal that it is grammar rather than decoration: a cut alone reads as "the next shot", while a
 * cut plus a flash reads as "something landed". Fire it ON the beat, not before.
 */
export const ImpactFlash: React.FC<{
  /** Frame of the impact, relative to the enclosing Sequence. */
  at: number;
  color?: string;
  /** Frames from black to full. Keep it at 1-2: a slow flash reads as a fade. */
  rise?: number;
  /** Frames from full back to nothing. */
  fall?: number;
  peak?: number;
}> = ({ at, color = "#ffffff", rise = 2, fall = 14, peak = 0.85 }) => {
  const frame = useCurrentFrame();
  if (frame < at || frame > at + rise + fall) return null;
  const t = frame - at;
  const op =
    t <= rise ? (t / Math.max(1, rise)) * peak : peak * (1 - (t - rise) / Math.max(1, fall));
  if (op <= 0.001) return null;
  return <AbsoluteFill style={{ background: color, opacity: op, pointerEvents: "none" }} />;
};
