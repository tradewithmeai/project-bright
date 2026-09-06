import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";

export type BrandStingConfig = {
  name: string;
  tagline?: string;
  logo?: string | null;
  colors: { bg: string; primary: string; accent: string; text: string };
  palette?: string[];
  fps: number;
  width: number;
  height: number;
  total_frames: number;
};

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const SPRING = Easing.bezier(0.34, 1.56, 0.64, 1);

// A short, repeatable branded reveal built ENTIRELY from a scraped BrandPack (name + colours).
// Feed any brand pack → a on-brand sting. This is the scrape → repeatable-asset payoff.
export const BrandSting: React.FC<{ config: BrandStingConfig }> = ({ config }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { bg, primary, accent, text } = config.colors;

  const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  const nameO = interpolate(frame, [8, 24], [0, 1], { ...clamp, easing: EASE });
  const nameS = interpolate(frame, [8, 28], [0.82, 1], { ...clamp, easing: SPRING });
  const lineW = interpolate(frame, [26, 44], [0, 1], { ...clamp, easing: EASE });
  const tagO = interpolate(frame, [46, 60], [0, 1], { ...clamp, easing: EASE });
  const gridO = interpolate(frame, [0, 30], [0, 0.5], { ...clamp });
  const exitO = interpolate(frame, [durationInFrames - 16, durationInFrames], [1, 0], { ...clamp });
  const glow = interpolate(frame, [8, 28], [0, 1], { ...clamp });

  return (
    <AbsoluteFill style={{ backgroundColor: bg, opacity: exitO }}>
      {/* neon grid floor in brand colours */}
      <AbsoluteFill style={{ opacity: gridO }}>
        <svg width={config.width} height={config.height} style={{ position: "absolute" }}>
          {Array.from({ length: 16 }).map((_, i) => (
            <line key={`v${i}`} x1={(i / 15) * config.width} y1={config.height * 0.62} x2={config.width / 2 + ((i / 15) - 0.5) * config.width * 3} y2={config.height} stroke={i % 2 ? primary : accent} strokeWidth={1} opacity={0.5} />
          ))}
          {Array.from({ length: 7 }).map((_, i) => (
            <line key={`h${i}`} x1={0} y1={config.height * (0.62 + (i / 6) * 0.38)} x2={config.width} y2={config.height * (0.62 + (i / 6) * 0.38)} stroke={primary} strokeWidth={1} opacity={0.3} />
          ))}
        </svg>
      </AbsoluteFill>

      {/* accent glow behind the wordmark */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 50% 40% at 50% 44%, ${primary}${Math.round(glow * 40).toString(16).padStart(2, "0")} 0%, transparent 70%)` }} />

      {/* wordmark + accent underline */}
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26 }}>
        <div style={{ fontFamily: "'Fredoka','Nunito',system-ui,sans-serif", fontSize: 168, fontWeight: 700, color: text, letterSpacing: -2, opacity: nameO, transform: `scale(${nameS})`, textShadow: `0 0 ${60 * glow}px ${primary}` }}>
          {config.name}
        </div>
        <div style={{ height: 6, width: `${lineW * 42}%`, background: `linear-gradient(90deg, ${primary}, ${accent})`, borderRadius: 3, boxShadow: `0 0 24px ${accent}` }} />
        {config.tagline ? (
          <div style={{ fontFamily: "'Inter',system-ui,sans-serif", fontSize: 30, color: `${text}cc`, letterSpacing: 3, opacity: tagO }}>{config.tagline}</div>
        ) : (
          <div style={{ fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 22, color: accent, letterSpacing: 6, opacity: tagO, textTransform: "uppercase" as const }}>build in public</div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
