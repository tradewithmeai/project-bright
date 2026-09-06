// FootageLayout — putting more than one shot on screen, and putting a word on a beat.
//
// Three small primitives, each extracted from a technique that several historical promos reached
// for independently. Kept deliberately small: these are devices, not a layout framework.
//
//   FootagePiP        one shot inset over another
//   FootageGrid       2-4 shots at once
//   BeatHit           a word or phrase landing on a musical cue
//
// All three are composition-size aware and take their geometry as FRACTIONS, so nothing assumes
// 1920x1080. All three are pure functions of the frame.

import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FootageClip, type FitMode } from "./FootageClip";

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ── Picture-in-picture ────────────────────────────────────────────────────────────────────────

export type PiPCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type FootagePiPProps = {
  src: string;
  /** The inset's natural pixel size, so its aspect is preserved rather than guessed. */
  source: { width: number; height: number };
  /** Inset width as a fraction of the composition width. */
  width?: number;
  corner?: PiPCorner;
  /** Distance from the frame edges, as a fraction of the SHORTER composition side. */
  margin?: number;
  fit?: FitMode;
  trimBefore?: number;
  radius?: number;
  borderColor?: string;
  /** A short label on the inset, e.g. a source name. Nothing is drawn if omitted. */
  label?: string;
  labelColor?: string;
  /** Frames over which it slides in. 0 for an instant appearance. */
  enterFrames?: number;
  /** Frames before the end of its Sequence over which it slides out. */
  exitFrames?: number;
  /** Length of this PiP's window, needed only if exitFrames > 0. */
  durationInFrames?: number;
};

/**
 * One shot inset over another.
 *
 * The inset's HEIGHT is derived from its source aspect, so a square or vertical source produces a
 * square or vertical inset instead of being squeezed into a 16:9 box. Margins are a fraction of
 * the shorter side, so the inset sits the same visual distance from the edge in a landscape or a
 * vertical composition.
 *
 * The entrance slides from the nearest edge rather than the same direction every time, which is
 * what makes a corner inset read as arriving from off-screen.
 */
export const FootagePiP: React.FC<FootagePiPProps> = ({
  src,
  source,
  width = 0.28,
  corner = "top-right",
  margin = 0.04,
  fit = "cover",
  trimBefore,
  radius = 10,
  borderColor = "#ffffff33",
  label,
  labelColor = "#e8edf5",
  enterFrames = 12,
  exitFrames = 0,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { width: cw, height: ch } = useVideoConfig();

  const w = Math.round(cw * width);
  // Height from the source's own aspect — the point of taking `source`.
  const h = Math.round(w * (source.height / source.width));
  const m = Math.round(Math.min(cw, ch) * margin);

  const right = corner.endsWith("right");
  const bottom = corner.startsWith("bottom");

  const enter = enterFrames > 0 ? interpolate(frame, [0, enterFrames], [0, 1], { easing: EASE_OUT, ...CLAMP }) : 1;
  const exit =
    exitFrames > 0 && durationInFrames
      ? interpolate(frame, [durationInFrames - exitFrames, durationInFrames], [1, 0], { easing: EASE_OUT, ...CLAMP })
      : 1;
  const t = Math.min(enter, exit);

  // Slide in from whichever edge the inset is nearest: at t=0 it sits fully outside the frame
  // (distance -w from its edge), at t=1 it rests at the margin.
  const edgeDistance = Math.round(m - (1 - t) * (w + m));

  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          [right ? "right" : "left"]: edgeDistance,
          [bottom ? "bottom" : "top"]: m,
          width: w,
          height: h,
          borderRadius: radius,
          overflow: "hidden",
          border: `1px solid ${borderColor}`,
          opacity: t,
          boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
        }}
      >
        <FootageClip src={src} fit={fit} trimBefore={trimBefore} />
        {label ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "6px 10px",
              background: "linear-gradient(transparent, rgba(5,9,16,0.85))",
              color: labelColor,
              fontFamily: "'Segoe UI', system-ui, sans-serif",
              fontSize: Math.max(12, Math.round(h * 0.11)),
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          >
            {label}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// ── Multi-source grid ─────────────────────────────────────────────────────────────────────────

export type GridCell = {
  src: string;
  source: { width: number; height: number };
  fit?: FitMode;
  trimBefore?: number;
  label?: string;
};

/**
 * Two to four shots at once, in a deterministic layout.
 *
 * Two cells go side by side, three or four become a 2x2 (three leaves the last slot empty rather
 * than stretching one cell to fill it, because an odd stretched cell reads as a mistake).
 *
 * Each cell fits independently, so a square source among 16:9 ones can `contain` while its
 * neighbours `cover`. Cells clip their overflow, so no cell can show an undefined edge.
 *
 * Cells stagger in by a few frames each: simultaneous arrival reads as a static graphic, while a
 * short stagger reads as a wall assembling.
 *
 * ⚠️ The stagger is a SCALE, not a fade. Fading cells up from nothing means the grid's first frame
 * is the bare background, and if the section before it hard-cuts into the grid that frame reads as
 * a dropped frame. Every cell is fully opaque from frame 0 and settles into place instead.
 */
export const FootageGrid: React.FC<{
  cells: GridCell[];
  /** Gap and outer padding, as a fraction of the shorter composition side. */
  gap?: number;
  background?: string;
  borderColor?: string;
  radius?: number;
  /** Frames between one cell arriving and the next. 0 for all at once. */
  stagger?: number;
  enterFrames?: number;
}> = ({
  cells,
  gap = 0.008,
  background = "#05070c",
  borderColor = "#ffffff22",
  radius = 6,
  stagger = 3,
  enterFrames = 8,
}) => {
  const frame = useCurrentFrame();
  const { width: cw, height: ch } = useVideoConfig();
  const g = Math.round(Math.min(cw, ch) * gap);

  const n = Math.max(1, Math.min(4, cells.length));
  const cols = n === 1 ? 1 : n === 2 ? 2 : 2;
  const rows = n <= 2 ? 1 : 2;
  const cellW = Math.floor((cw - g * (cols + 1)) / cols);
  const cellH = Math.floor((ch - g * (rows + 1)) / rows);

  return (
    <AbsoluteFill style={{ background }}>
      {cells.slice(0, 4).map((cell, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        // 0..1 settle progress for this cell. Drives SCALE, never opacity.
        const t =
          enterFrames > 0
            ? interpolate(frame, [i * stagger, i * stagger + enterFrames], [0, 1], {
                easing: EASE_OUT,
                ...CLAMP,
              })
            : 1;
        const scale = 0.9 + 0.1 * t;
        return (
          <div
            key={`${cell.src}-${i}`}
            style={{
              position: "absolute",
              left: g + col * (cellW + g),
              top: g + row * (cellH + g),
              width: cellW,
              height: cellH,
              borderRadius: radius,
              overflow: "hidden",
              border: `1px solid ${borderColor}`,
              transform: `scale(${scale.toFixed(4)})`,
            }}
          >
            <FootageClip src={cell.src} fit={cell.fit ?? "cover"} trimBefore={cell.trimBefore} />
            {cell.label ? (
              <div
                style={{
                  position: "absolute",
                  left: 8,
                  bottom: 6,
                  padding: "3px 8px",
                  borderRadius: 4,
                  background: "rgba(5,9,16,0.72)",
                  color: "#e8edf5",
                  fontFamily: "'Segoe UI', system-ui, sans-serif",
                  fontSize: Math.max(12, Math.round(cellH * 0.055)),
                  fontWeight: 600,
                }}
              >
                {cell.label}
              </div>
            ) : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── Beat-locked type ──────────────────────────────────────────────────────────────────────────

export type BeatHitCue = {
  text: string;
  /** Frame this hit lands, relative to the enclosing Sequence. */
  at: number;
  /** Frames it stays up. Defaults to running until the next cue. */
  hold?: number;
};

/**
 * A word or short phrase landing ON a musical cue.
 *
 * Cue frames are explicit rather than derived from an index times a bar length. That matters at a
 * fractional-frame BPM: multiplying an index by a rounded bar walks off the grid, whereas passing
 * frames computed by MusicalTime keeps every hit on the same grid as the cuts and the SFX.
 *
 * The movement is a scale-down onto the beat — the text arrives slightly too large and settles —
 * because arriving large reads as an impact where fading in reads as a caption.
 *
 * ⚠️ Fully opaque on the landing frame. Ramping opacity from 0 makes the hit invisible on exactly
 * the frame it is supposed to land, which defeats the point: the eye sees it a few frames late and
 * the accent reads as loose. The scale carries the impact; opacity only handles the exit.
 */
export const BeatHit: React.FC<{
  cues: BeatHitCue[];
  color?: string;
  accent?: string;
  /** Font size as a fraction of composition height. */
  size?: number;
  /** Frames the settle takes. Short: this is a hit, not a transition. */
  settleFrames?: number;
  /** How much larger the text arrives. 1 disables the overshoot. */
  overshoot?: number;
  fontFamily?: string;
}> = ({
  cues,
  color = "#ffffff",
  accent,
  size = 0.13,
  settleFrames = 7,
  overshoot = 1.45,
  fontFamily = "'Segoe UI', system-ui, -apple-system, sans-serif",
}) => {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();

  // The active cue is the last one whose frame has passed.
  let active = -1;
  for (let i = 0; i < cues.length; i++) if (frame >= cues[i].at) active = i;
  if (active < 0) return null;

  const cue = cues[active];
  const next = cues[active + 1];
  const end = cue.hold != null ? cue.at + cue.hold : next ? next.at : Infinity;
  if (frame >= end) return null;

  const local = frame - cue.at;
  // The overshoot is applied to FONT SIZE, not to a transform.
  //
  // ⚠️ A transform: scale ignores max-width, so a long phrase at 1.9x simply runs off both edges
  // and is unreadable on the landing frame — the one frame that has to read. Growing the font
  // instead keeps the box inside its max-width at every size, so a word overshoots and a phrase
  // fits.
  const grow = interpolate(local, [0, settleFrames], [overshoot, 1], { easing: EASE_OUT, ...CLAMP });
  const out = end === Infinity ? 1 : interpolate(frame, [end - 5, end], [1, 0], CLAMP);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none" }}>
      <div
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: Math.round(height * size * grow),
          color,
          letterSpacing: Math.round(width * 0.003),
          textAlign: "center",
          // Never wider than the frame, whatever the phrase or the overshoot.
          maxWidth: Math.round(width * 0.88),
          lineHeight: 1.05,
          opacity: out,
          textShadow: accent
            ? `0 0 ${Math.round(height * 0.055)}px ${accent}66, 0 6px 30px rgba(0,0,0,0.7)`
            : "0 6px 30px rgba(0,0,0,0.7)",
        }}
      >
        {cue.text}
      </div>
    </AbsoluteFill>
  );
};
