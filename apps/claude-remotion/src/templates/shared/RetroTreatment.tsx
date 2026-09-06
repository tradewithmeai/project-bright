// RetroTreatment — an optional degradation layer, drawn OVER the picture.
//
// Off by default. Most promos should not look retro, and a treatment that arrives switched on
// becomes a house style nobody chose.
//
// ── What this is, and what it deliberately is not ─────────────────────────────────────────────
//
// The historical implementation this was distilled from wrapped its children and rendered them
// THREE TIMES at small offsets to get a true per-channel RGB split. That works, and it carries a
// hazard its own comments warned about: anything inside the wrapper is duplicated, so a stray
// <Audio> is mounted three times and you hear comb filtering. It also triples the decode cost of
// every clip underneath.
//
// So this does not wrap anything. It is a pure overlay: it cannot duplicate children because it
// has none. The chromatic edge is approximated with blended gradients rather than a real channel
// split — a deliberate trade, and the honest description of it is that it reads as chroma bleed
// rather than being chroma bleed. If you need a true split, do it to one <Img>, not to a subtree
// that might contain audio.
//
// The genuinely reusable part is the DETERMINISTIC EVENT SCHEDULE: glitches on a fixed cadence
// with seeded variation, so a given frame always looks the same. That is what makes a treatment
// safe to render in parallel or re-render months later.

import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { hash01 } from "./AmbientBackground";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Strength (0..1) of a scheduled glitch burst at this frame.
 *
 * Bursts land on a fixed period rather than at random, and their severity comes from a hash of
 * the burst index — so the sequence is varied but identical on every render. Exported because the
 * schedule is useful on its own: a caption, a cut or a sound can be tied to the same burst.
 */
export function glitchStrength(frame: number, fps: number, everySeconds = 3.1): number {
  const period = Math.max(1, Math.round(fps * everySeconds));
  const local = frame % period;
  const burst = Math.floor(frame / period);
  const dur = 4;
  if (local > dur) return 0;
  const severity = hash01(burst * 7 + 3) > 0.45 ? 1 : 0.55;
  const env = interpolate(local, [0, 1, dur], [0.2, 1, 0], CLAMP);
  return Math.max(0, env * severity);
}

export type RetroTreatmentProps = {
  /** Overall strength, 0..1. 0 draws nothing. */
  intensity?: number;
  /** Fine horizontal scanlines. */
  scanlines?: boolean;
  /** Darkened corners. */
  vignette?: boolean;
  /** Approximated chroma bleed at the frame edges, widening during a glitch. */
  chroma?: boolean;
  /** A tape-tracking line sweeping up the frame. */
  tracking?: boolean;
  /** Seconds between glitch bursts. */
  glitchEverySeconds?: number;
  /** Small caption in a corner. No default — an unnamed treatment names nothing. */
  label?: string;
  /** Running timecode, counting from the start of the enclosing Sequence. */
  timecode?: boolean;
};

/**
 * Place it ABOVE the picture and BELOW the captions, and never around the audio.
 */
export const RetroTreatment: React.FC<RetroTreatmentProps> = ({
  intensity = 0,
  scanlines = true,
  vignette = true,
  chroma = true,
  tracking = true,
  glitchEverySeconds = 3.1,
  label,
  timecode = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const k = Math.max(0, Math.min(1, intensity));
  if (k <= 0) return null;

  const glitch = glitchStrength(frame, fps, glitchEverySeconds) * k;

  // A small seeded horizontal drift, amplified during a burst. Seeded per frame, so it is jitter
  // rather than motion — and identical on every render.
  const wobble = (hash01(frame) - 0.5) * 2 * (0.8 + glitch * 6) * k;

  // The tracking line sweeps upward on a period that is not a whole number of seconds, so it
  // never syncs with the music and read as a beat.
  const trackY = height - ((frame * 3.5) % (height + 60));

  const scanlineHeight = Math.max(2, Math.round(height / 360));

  return (
    <AbsoluteFill style={{ pointerEvents: "none", transform: `translateX(${wobble.toFixed(3)}px)` }}>
      {scanlines ? (
        <AbsoluteFill
          style={{
            background: `repeating-linear-gradient(to bottom, rgba(0,0,0,${0.22 * k}) 0px, rgba(0,0,0,${
              0.22 * k
            }) 1px, transparent 1px, transparent ${scanlineHeight}px)`,
          }}
        />
      ) : null}

      {chroma ? (
        <>
          <AbsoluteFill
            style={{
              mixBlendMode: "screen",
              opacity: (0.05 + glitch * 0.16) * k,
              background: `linear-gradient(90deg, rgba(255,0,64,1) 0%, transparent 18%, transparent 82%, rgba(0,160,255,1) 100%)`,
            }}
          />
          {glitch > 0.01 ? (
            <AbsoluteFill
              style={{
                mixBlendMode: "screen",
                opacity: glitch * 0.12 * k,
                background: `linear-gradient(180deg, transparent 0%, rgba(0,255,190,1) 50%, transparent 100%)`,
              }}
            />
          ) : null}
        </>
      ) : null}

      {tracking ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: trackY,
            height: Math.max(2, Math.round(height * 0.004)),
            background: `rgba(255,255,255,${0.1 * k})`,
            boxShadow: `0 0 ${Math.round(height * 0.02)}px rgba(255,255,255,${0.14 * k})`,
          }}
        />
      ) : null}

      {vignette ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 78% 68% at 50% 50%, transparent 52%, rgba(0,0,0,${
              0.5 * k
            }) 100%)`,
          }}
        />
      ) : null}

      {label || timecode ? (
        <div
          style={{
            position: "absolute",
            left: Math.round(width * 0.03),
            bottom: Math.round(height * 0.05),
            display: "flex",
            gap: Math.round(width * 0.012),
            fontFamily: "'Cascadia Mono', Consolas, ui-monospace, monospace",
            fontSize: Math.round(height * 0.028),
            color: `rgba(232,237,245,${0.62 + 0.25 * k})`,
            letterSpacing: 1,
            textShadow: "0 2px 10px rgba(0,0,0,0.8)",
          }}
        >
          {label ? <span>{label}</span> : null}
          {timecode ? (
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {`${String(Math.floor(frame / fps / 60)).padStart(2, "0")}:${String(
                Math.floor(frame / fps) % 60
              ).padStart(2, "0")}:${String(frame % fps).padStart(2, "0")}`}
            </span>
          ) : null}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
