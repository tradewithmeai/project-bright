// CaptionTrack — a screen-space caption layer, independent of whatever is behind it.
//
// Captions do NOT ride the virtual camera. If they did, they would zoom and drift with the
// capture and become unreadable. They live in screen space at a fixed size, over the top.
//
// Two styles, one font. Weight and position carry the hierarchy:
//   "title"    — a large centred line, for the point of a stage
//   "subtitle" — a lower-third band, for the running narration
//
// Times are in SECONDS relative to the start of the stage the track belongs to, converted with
// the composition's own fps rather than an assumed 30, so a 24 or 60fps render still lands right.
//
// A title hangs on screen slightly past its stated out time, because a title that vanishes on the
// exact frame reads as a glitch. The hang is trimmed so it never collides with the next title
// nor outruns the stage.

import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Frames a caption takes to fade in and out. */
export const CAPTION_FADE_FRAMES = 6;
/** Extra seconds a title lingers past its out time. */
export const TITLE_HANG_S = 0.4;
/** Minimum gap kept between one title leaving and the next arriving. */
export const TITLE_GAP_S = 0.25;

/**
 * Reading pace. A caption has to be on screen long enough to be READ, not merely displayed.
 *
 * Roughly 14 characters a second with a hard floor for very short lines. These are the numbers
 * the silent-caption work settled on: below them a viewer registers that words appeared and
 * misses what they said, which is worse than no caption at all.
 */
export const READING_FLOOR_MIN_S = 1.8;
export const READING_FLOOR_PER_CHAR_S = 0.07;

export function readingFloor(text: string): number {
  return Math.max(READING_FLOOR_MIN_S, text.length * READING_FLOOR_PER_CHAR_S);
}

/** A system stack, so a clean clone renders without downloading a font. */
export const CAPTION_FONT =
  "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";

export type CaptionStyle = "title" | "subtitle";

export type CaptionLine = {
  /** Seconds since the stage start. */
  in_s: number;
  /** Seconds since the stage start. */
  out_s: number;
  /** The words. "\n" splits a subtitle across two lines. */
  text: string;
  style: CaptionStyle;
  /** Overrides the accent tick on a subtitle. */
  accent?: string;
};

export type CaptionTheme = {
  text: string;
  accent: string;
  panel: string;
};

export const DEFAULT_CAPTION_THEME: CaptionTheme = {
  text: "#e8edf5",
  accent: "#38bdf8",
  panel: "rgba(9,17,29,0.80)",
};

/**
 * A title's effective out time, extended by the hang but clamped so it never runs into the next
 * title or past the end of the stage.
 */
function effectiveOut(line: CaptionLine, track: CaptionLine[], stageEndS?: number): number {
  // Hold a caption at least long enough to read, even if the script under-timed it. Clamped to
  // the stage end, so this can never push a caption past the shot it belongs to.
  const floorOut = line.in_s + readingFloor(line.text);
  const readable = Math.max(line.out_s, stageEndS != null ? Math.min(floorOut, stageEndS) : floorOut);

  if (line.style !== "title") return readable;
  let cap = readable + TITLE_HANG_S;
  if (stageEndS != null) cap = Math.min(cap, stageEndS);
  for (const other of track) {
    if (other === line) continue;
    if (other.style === "title" && other.in_s >= line.out_s) {
      cap = Math.min(cap, other.in_s - TITLE_GAP_S);
    }
  }
  return Math.max(readable, cap);
}

function lineOpacity(frame: number, fps: number, inS: number, outS: number): number {
  const inF = inS * fps;
  const outF = outS * fps;
  return interpolate(
    frame,
    [inF, inF + CAPTION_FADE_FRAMES, outF - CAPTION_FADE_FRAMES, outF],
    [0, 1, 1, 0],
    { easing: EASE, ...CLAMP }
  );
}

const TitleBlock: React.FC<{ line: CaptionLine; op: number; rise: number; theme: CaptionTheme }> = ({
  line,
  op,
  rise,
  theme,
}) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
    <div
      style={{
        fontFamily: CAPTION_FONT,
        fontSize: 84,
        fontWeight: 800,
        letterSpacing: -0.5,
        color: theme.text,
        textAlign: "center",
        lineHeight: 1.12,
        maxWidth: 1500,
        padding: "0 80px",
        opacity: op,
        transform: `translateY(${rise}px)`,
        textShadow: "0 4px 28px rgba(0,0,0,0.72)",
        whiteSpace: "pre-line",
      }}
    >
      {line.text}
    </div>
  </AbsoluteFill>
);

const SubtitleBlock: React.FC<{
  line: CaptionLine;
  op: number;
  rise: number;
  theme: CaptionTheme;
}> = ({ line, op, rise, theme }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end" }}>
    <div
      style={{
        position: "relative",
        maxWidth: 1280,
        margin: "0 80px 96px",
        padding: "18px 28px 18px 32px",
        background: theme.panel,
        borderRadius: 10,
        opacity: op,
        transform: `translateY(${rise}px)`,
        boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 12,
          bottom: 12,
          width: 4,
          borderRadius: 4,
          background: line.accent ?? theme.accent,
        }}
      />
      <div
        style={{
          fontFamily: CAPTION_FONT,
          fontSize: 36,
          fontWeight: 500,
          lineHeight: 1.32,
          color: theme.text,
          textAlign: "center",
          whiteSpace: "pre-line",
        }}
      >
        {line.text}
      </div>
    </div>
  </AbsoluteFill>
);

export const CaptionTrack: React.FC<{
  track: CaptionLine[];
  /** Length of the stage in seconds, so a title's hang can be trimmed to fit. */
  stageEndS?: number;
  theme?: CaptionTheme;
}> = ({ track, stageEndS, theme = DEFAULT_CAPTION_THEME }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ zIndex: 100 }}>
      {track.map((line, i) => {
        const op = lineOpacity(frame, fps, line.in_s, effectiveOut(line, track, stageEndS));
        if (op <= 0.001) return null;
        const rise = interpolate(op, [0, 1], [12, 0]);
        return line.style === "title" ? (
          <TitleBlock key={i} line={line} op={op} rise={rise} theme={theme} />
        ) : (
          <SubtitleBlock key={i} line={line} op={op} rise={rise} theme={theme} />
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * FocusPulse — a flash and expanding ring marking an interaction on the capture.
 *
 * Deliberately not a cursor, hand or finger: those read as clip-art and date badly. Fire it a few
 * frames BEFORE the change it is meant to have caused, so the viewer reads cause then effect.
 *
 * Screen-space, like the captions: x/y are fractions of the FRAME, not of the capture. To pulse a
 * feature the camera is looking at, use sourcePointToScreen() to convert.
 */
export const FocusPulse: React.FC<{
  /** Frame the pulse fires, relative to the stage. */
  at: number;
  /** Fractions of the frame. */
  x: number;
  y: number;
  color?: string;
}> = ({ at, x, y, color = DEFAULT_CAPTION_THEME.accent }) => {
  const frame = useCurrentFrame();
  if (frame < at - 1 || frame > at + 24) return null;

  // Centre tap: blooms then settles.
  const dotScale = interpolate(frame, [at, at + 5, at + 14], [0.2, 1.25, 0.9], {
    easing: EASE,
    ...CLAMP,
  });
  const dotOp = interpolate(frame, [at, at + 4, at + 18], [0, 1, 0], CLAMP);

  // Ring: emanates outward over 18 frames, the longer of the two source implementations.
  const ringT = interpolate(frame, [at, at + 18], [0, 1], { easing: EASE, ...CLAMP });
  const ringSize = 40 + ringT * 240;
  const ringOp = interpolate(ringT, [0, 0.15, 1], [0, 0.55, 0], CLAMP);

  return (
    <AbsoluteFill style={{ zIndex: 90, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: ringSize,
          height: ringSize,
          marginLeft: -ringSize / 2,
          marginTop: -ringSize / 2,
          borderRadius: "50%",
          border: `3px solid ${color}`,
          opacity: ringOp,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: 44,
          height: 44,
          marginLeft: -22,
          marginTop: -22,
          borderRadius: "50%",
          background: color,
          opacity: dotOp * 0.85,
          transform: `scale(${dotScale})`,
          boxShadow: `0 0 40px 12px ${color}66`,
        }}
      />
    </AbsoluteFill>
  );
};
