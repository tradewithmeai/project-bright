// AmbientBackground — a slow, deterministic backdrop that keeps a held frame alive.
//
// A walkthrough spends most of its length holding still on a feature. A completely static frame
// reads as a stalled render or a slide deck; a few pixels of very slow movement read as video.
// That is the whole job. It should never draw the eye away from the interface in front of it.
//
// Everything is a pure function of the frame:
//
//   - Two aurora gradients drifting on different periods (11s and 17s), so they never repeat in
//     an obvious cycle.
//   - A "breathe": a slow oscillation of overall strength, on a third period (7s).
//   - Deterministic motes from a seeded hash, each with its OWN constant speed. Constant speed
//     matters: it means a mote is at the same place whichever stage is on screen, so nothing
//     visibly jumps when one stage hands over to the next.
//   - An optional faint grid and a vignette for legibility.
//
// Dimensions come from useVideoConfig(), so this composes at any size — the motes are placed by
// fraction and the grid tiles.
//
// Place it OUTSIDE the virtual camera. It is the room the screen sits in, not part of the capture.

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

const TAU = Math.PI * 2;

/** Deterministic 0..1 from an integer. The same seed always gives the same value. */
export function hash01(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Two hex digits of alpha, for appending to a #rrggbb colour. */
function alphaHex(a: number): string {
  return Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, "0");
}

/**
 * The shared slow oscillation, 0..1. Exported so anything else that wants to breathe in time
 * with the background can use the same clock instead of inventing a second one.
 */
export function breathe(frame: number, fps: number, periodSeconds = 7): number {
  return 0.5 + 0.5 * Math.sin((frame / (fps * periodSeconds)) * TAU);
}

export type AmbientBackgroundProps = {
  /** Base colour of the room. */
  backgroundColor?: string;
  /** Tint for the aurora and motes. Pass a stage accent to have the room follow the stage. */
  accent?: string;
  /** Overall strength, 0..1. Values above ~0.5 start competing with the content. */
  intensity?: number;
  /** Number of drifting motes. 0 disables them. */
  motes?: number;
  /** Faint grid overlay. */
  grid?: boolean | { spacing?: number; color?: string };
  /** Darkened edges, to keep the middle of the frame the brightest thing. */
  vignette?: boolean;
};

export const AmbientBackground: React.FC<AmbientBackgroundProps> = ({
  backgroundColor = "#080d16",
  accent = "#38bdf8",
  intensity = 1,
  motes = 22,
  grid = true,
  vignette = true,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  // Two aurorae on incommensurate periods, so the pair never settles into a visible loop.
  const ax = 50 + 16 * Math.sin((frame / (fps * 11)) * TAU);
  const ay = 44 + 10 * Math.cos((frame / (fps * 17)) * TAU);
  const strength = (0.05 + 0.02 * breathe(frame, fps)) * intensity;

  const gridSpacing = typeof grid === "object" ? (grid.spacing ?? 80) : 80;
  const gridColor = typeof grid === "object" ? (grid.color ?? "#1b2942") : "#1b2942";
  const gridId = `ambient-grid-${gridSpacing}`;

  return (
    <AbsoluteFill style={{ background: backgroundColor }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 60% 44% at ${ax}% ${ay}%, ${accent}${alphaHex(
            strength
          )} 0%, transparent 68%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 42% 30% at ${100 - ax}% ${100 - ay}%, ${accent}${alphaHex(
            strength * 0.5
          )} 0%, transparent 60%)`,
        }}
      />

      {Array.from({ length: motes }, (_, i) => {
        // Constant per-mote speed: position depends only on the absolute frame, so a mote does
        // not jump when one stage hands over to the next.
        const speed = 0.18 + hash01(i * 17) * 0.4;
        const baseX = hash01(i * 7) * width;
        const baseY = hash01(i * 13) * height;
        const y = (((baseY - frame * speed) % height) + height) % height;
        const x = baseX + 10 * Math.sin((frame / (fps * 5 + i * 2)) * TAU);
        const opacity = hash01(i * 19) * 0.22 * intensity;
        const size = 1.5 + hash01(i * 31) * 2;
        if (opacity < 0.02) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: accent,
              opacity,
            }}
          />
        );
      })}

      {grid !== false ? (
        <svg
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0, opacity: 0.5 * intensity }}
        >
          <defs>
            <pattern
              id={gridId}
              width={gridSpacing}
              height={gridSpacing}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${gridSpacing} 0 L 0 0 0 ${gridSpacing}`}
                fill="none"
                stroke={gridColor}
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${gridId})`} />
        </svg>
      ) : null}

      {vignette ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 55%, rgba(0,0,0,0.45) 100%)",
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

/**
 * AmbientSheen — a very faint accent wash ON TOP of the capture.
 *
 * The background above is hidden the moment the camera pushes in, because the capture then fills
 * the frame. This keeps a zoomed hold from being pixel-for-pixel static, using the same breathing
 * clock so the two stay in sync. Keep it near-invisible: if you can see it working, it is too strong.
 */
export const AmbientSheen: React.FC<{ accent?: string; strength?: number }> = ({
  accent = "#38bdf8",
  strength = 0.05,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = strength * (0.7 + 0.3 * breathe(frame, fps, 9));
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background: `radial-gradient(ellipse 90% 75% at 50% 46%, transparent 40%, ${accent}${alphaHex(
          a
        )} 100%)`,
      }}
    />
  );
};

/**
 * stageEnvelope — fade a stage's content in and out against whatever is behind it.
 *
 * The historical explainers used this so each beat dissolved against a continuous background
 * rather than hard-cutting. A plain overlapping <Sequence> does not do that: the later sequence
 * simply paints over the earlier one, which is a cut, not a dissolve.
 *
 * ⚠️ For a CROSSFADE rather than a dip, the outgoing stage must still be on screen while the
 * incoming one fades up. Extend the outgoing Sequence by `fadeOut` frames so the two overlap.
 * Fading out with nothing underneath leaves a one-frame hole showing bare background at every
 * seam — which is exactly what happens if you fade both ends of non-overlapping sequences.
 *
 * Fades are linear, so an overlapping pair sums to 1 across the handover.
 */
export function stageEnvelope(
  frame: number,
  durationInFrames: number,
  fadeIn: number,
  fadeOut: number = fadeIn
): number {
  const up = fadeIn <= 0 ? 1 : Math.min(1, Math.max(0, frame / fadeIn));
  const down =
    fadeOut <= 0 ? 1 : Math.min(1, Math.max(0, (durationInFrames - frame) / fadeOut));
  return Math.min(up, down);
}
