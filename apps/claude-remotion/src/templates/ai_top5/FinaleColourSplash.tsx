import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SCREEN_TARGETS } from "./screenTargets";
import { Story } from "./data";
import { ScreenStory } from "./ScreenStory";
import { hash } from "./tokens";
import { beatPulse, type StoryPhases } from "./grid";

// The #1 finale set-piece. The tablet+hands are a stripped foreground (orange keyed out in
// code); the BACKGROUND is the show — a manga "WHAM" sunburst + jagged impact star, whose
// whole palette hue-CYCLES over time (the wow). The cycle lives in code, not the image, so it
// is fully controllable and reusable (the same treatment can wrap any stripped foreground).
// The tablet screen carries the live ScreenStory (cue → headline → points → the reading layer).
//
// This IS the #1 finale — StoryVisual renders it for rank 1. It was ALSO registered as a
// standalone `FinaleColourSplash` composition, which only ever exercised a placeholder branch
// that the show never took. The registration is gone; the effect stays where it does work.
export const FinaleColourSplash: React.FC<{
  story: Story;
  phases: StoryPhases;
  newsImage?: string;
}> = ({ story, phases, newsImage }) => {
  const frame = useCurrentFrame();
  // The splash breathes on the beat, so it needs the ABSOLUTE frame — this renders inside the #1
  // story's <Sequence>, whose clock starts at 0 two-thirds of the way through the episode.
  const absoluteFrame = phases.absoluteFrom + frame;
  const { width, height } = useVideoConfig();
  const target = SCREEN_TARGETS["20s"];
  const r = target.rect;
  const sx = r.x * width;
  const sy = r.y * height;
  const sw = r.w * width;
  const sh = r.h * height;
  const MASK_PAD = Math.round(width * 0.008); // ~15px @1920 — under-mask overscan onto the dark bezel

  const cx = width / 2;
  const cy = height * 0.46; // burst centre sits behind the tablet

  // Colour CYCLE — rotate the hue of the whole splash. One full cycle over ~4s (120f).
  const hue = (frame * 3) % 360;
  // Sunburst rotations (opposing) + beat-synced breathing.
  const burstRot = frame * 0.6;
  const pulse = 1 + 0.05 * beatPulse(absoluteFrame);

  // Splash palette (flat blocks — the hue-rotate cycles them through the spectrum).
  const A = "#ff2e88"; // hot pink rays
  const B = "#ffd23f"; // yellow fine rays
  const STAR = "#22d3ee"; // impact star
  const BG = "#2b0a3d"; // deep base

  // Jagged comic impact star (deterministic spikes via seeded hash — no Math.random).
  const spikes = 18;
  const R = width * 0.44;
  const ri = width * 0.31;
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const ang = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const outer = i % 2 === 0;
    const jitter = 0.92 + hash(i) * 0.18;
    const rad = (outer ? R : ri) * jitter;
    pts.push(`${(cx + Math.cos(ang) * rad).toFixed(1)},${(cy + Math.sin(ang) * rad).toFixed(1)}`);
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* ── Cycling splash background ── */}
      <AbsoluteFill style={{ filter: `hue-rotate(${hue}deg) saturate(1.25)` }}>
        <AbsoluteFill style={{ backgroundColor: BG }} />

        {/* jagged impact star behind the tablet */}
        <AbsoluteFill style={{ transform: `scale(${pulse})`, transformOrigin: `${cx}px ${cy}px` }}>
          <svg width={width} height={height} style={{ position: "absolute" }}>
            <polygon points={pts.join(" ")} fill={STAR} stroke="#03121a" strokeWidth={6} strokeLinejoin="round" />
          </svg>
        </AbsoluteFill>

        {/* primary sunburst rays */}
        <AbsoluteFill
          style={{
            background: `repeating-conic-gradient(from ${burstRot}deg at ${cx}px ${cy}px, ${A} 0deg 9deg, transparent 9deg 18deg)`,
            transform: `scale(${pulse})`,
            transformOrigin: `${cx}px ${cy}px`,
          }}
        />
        {/* finer counter-rotating rays for richness */}
        <AbsoluteFill
          style={{
            background: `repeating-conic-gradient(from ${-burstRot * 0.7}deg at ${cx}px ${cy}px, ${B} 0deg 3deg, transparent 3deg 20deg)`,
            opacity: 0.45,
          }}
        />
      </AbsoluteFill>

      {/* ── Tablet + hands foreground (dark, static, orange keyed out) ── */}
      <Img
        src={staticFile("era-devices/20s_tablet_fg.png")}
        style={{ position: "absolute", width, height, objectFit: "fill" }}
      />

      {/* ── Under-mask: a slightly-larger dark plate behind the screen so the cyan impact star can
             never peek through the sliver between the tablet's screen aperture and the screen rect
             (the residual-cyan bug). Sized from the same rect + a small overscan onto the dark bezel. ── */}
      <div
        style={{
          position: "absolute",
          left: sx - MASK_PAD,
          top: sy - MASK_PAD,
          width: sw + MASK_PAD * 2,
          height: sh + MASK_PAD * 2,
          borderRadius: Math.round(sh * target.radiusFrac) + MASK_PAD,
          background: "#0a0f1e",
        }}
      />

      {/* ── The tablet screen (covers the cyan; #1 reveal) ── */}
      <div
        style={{
          position: "absolute",
          left: sx,
          top: sy,
          width: sw,
          height: sh,
          overflow: "hidden",
          borderRadius: Math.round(sh * target.radiusFrac),
          background: "#0a0f1e",
        }}
      >
        {/* The #1 reveal. The standalone FinaleColourSplash composition used to render a
            "PLACEHOLDER NEWS IMAGE" card here when no story was passed; that branch existed only
            for the test registration and went with it. `story` is required now. */}
        <ScreenStory
          story={story}
          phases={phases}
          frame={frame}
          sw={sw}
          sh={sh}
          newsImage={newsImage}
          arrival="spin"
        />
      </div>
    </AbsoluteFill>
  );
};
