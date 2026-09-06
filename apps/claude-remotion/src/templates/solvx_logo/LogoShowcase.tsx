import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { SolvxWordmark, SOLVX_FONT, type SolvxStyle } from "./SolvxWordmark";
import { SOLVX_PRESETS, SOLVX_PRIMARY } from "./presets";

export const INTRO = 72;
export const GRID = 204;
export const DEMO = 132;
export const WILD = 252;
export const OUTRO = 70;
export const LOGO_SHOWCASE_FRAMES = INTRO + GRID + DEMO + WILD + OUTRO; // 730 = ~24.3s @30fps

const STAGE = "#0e0f13";
const UI = "#e9ecf1";

const Backdrop: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE }}>
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(120% 90% at 50% 8%, rgba(90,110,150,0.18), rgba(0,0,0,0) 60%)",
      }}
    />
  </AbsoluteFill>
);

const Caption: React.FC<{ children: React.ReactNode; size?: number; opacity?: number; dim?: boolean }> = ({
  children,
  size = 34,
  opacity = 1,
  dim = false,
}) => (
  <div
    style={{
      fontFamily: SOLVX_FONT,
      fontWeight: 500,
      fontSize: size,
      letterSpacing: 0.5,
      color: dim ? "rgba(233,236,241,0.6)" : UI,
      opacity,
      textAlign: "center",
    }}
  >
    {children}
  </div>
);

/** A card in a single tone chosen for the mark it holds — dark-ink marks on a
 *  light card, glow/pale/gold marks on a dark card — so the whole wordmark is
 *  always legible (a split card would cut a wide single-colour mark in half). */
const Card: React.FC<{ w: number; h: number; tone?: "light" | "dark"; radius?: number; children: React.ReactNode }> = ({
  w,
  h,
  tone = "light",
  radius = 18,
  children,
}) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: radius,
      background: tone === "dark" ? "#17181e" : "#f5f6f8",
      border: tone === "dark" ? "1px solid rgba(255,255,255,0.09)" : "1px solid rgba(0,0,0,0.06)",
      boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    }}
  >
    {children}
  </div>
);

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 16, mass: 0.9 } });
  const scale = interpolate(s, [0, 1], [0.7, 1]);
  const sub = interpolate(frame, [22, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const out = interpolate(frame, [INTRO - 12, INTRO], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: out }}>
      <div style={{ transform: `scale(${scale})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
        <Card tone="light" w={760} h={300} radius={26}>
          <SolvxWordmark size={132} style={SOLVX_PRIMARY} />
        </Card>
        <Caption size={40} opacity={sub}>one wordmark — <span style={{ color: "#f2751a" }}>any colour</span></Caption>
      </div>
    </AbsoluteFill>
  );
};

const Grid: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cols = 7;
  const gap = 20;
  const padX = 80;
  const top = 225;
  const tileW = (1920 - padX * 2 - gap * (cols - 1)) / cols;
  const tileH = tileW * 0.62;
  const wmSize = tileW * 0.15;

  const head = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 64, width: "100%", textAlign: "center", opacity: head }}>
        <Caption size={44}>21 colourways, <span style={{ opacity: 0.6 }}>one mark</span></Caption>
      </div>
      <div
        style={{
          position: "absolute",
          top,
          left: padX,
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, ${tileW}px)`,
          gap,
        }}
      >
        {SOLVX_PRESETS.map((p, i) => {
          const s = spring({ frame: frame - 12 - i * 4, fps, config: { damping: 15, mass: 0.7 } });
          const sc = interpolate(s, [0, 1], [0.55, 1]);
          const op = interpolate(frame - 12 - i * 4, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: op, transform: `scale(${sc})` }}>
              <Card tone={p.bg === "dark" ? "dark" : "light"} w={tileW} h={tileH}>
                <SolvxWordmark size={wmSize} style={p} />
              </Card>
              <div style={{ fontFamily: SOLVX_FONT, fontSize: 15, color: "rgba(233,236,241,0.72)", letterSpacing: 0.3 }}>{p.id}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const RecolourDemo: React.FC = () => {
  const frame = useCurrentFrame();
  // body and dot hue-cycle INDEPENDENTLY → proves the two regions are separately controllable.
  const bodyHue = interpolate(frame, [0, DEMO], [210, 210 + 320], { extrapolateRight: "clamp" });
  const dotHue = interpolate(frame, [0, DEMO], [30, 30 + 540], { extrapolateRight: "clamp" });
  const style: SolvxStyle = {
    weight: 500,
    body: `hsl(${bodyHue % 360}, 68%, 52%)`,
    dot: `hsl(${dotHue % 360}, 88%, 55%)`,
  };
  const enter = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const out = interpolate(frame, [DEMO - 12, DEMO], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: Math.min(enter, out) }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 44 }}>
        <Card tone="light" w={1000} h={340} radius={28}>
          <SolvxWordmark size={150} style={style} />
        </Card>
        <Caption size={38} dim>the letters and the dot recolour <span style={{ color: UI }}>independently — at will</span></Caption>
      </div>
    </AbsoluteFill>
  );
};

// ---- WILD RUSH: rapid-fire recolours / effects / backgrounds, accelerating ----
const H = (h: number, s: number, l: number) => `hsl(${((h % 360) + 360) % 360}, ${s}%, ${l}%)`;

function wildLook(idx: number): { bg: string; style: SolvxStyle; rot: number; size: number } {
  const h = (idx * 47) % 360;
  const h2 = (h + 150) % 360;
  const h3 = (h + 300) % 360;
  const rot = ((idx * 37) % 15) - 7; // -7..7 deg
  const size = 168 + ((idx * 53) % 92); // 168..260
  let bg: string;
  let style: SolvxStyle;
  switch (idx % 9) {
    case 0: // ink on vivid + white dot
      bg = H(h, 85, 58);
      style = { weight: 600, body: "#0e0e12", dot: "#ffffff" };
      break;
    case 1: // neon glow on black
      bg = "#07070c";
      style = { weight: 500, body: H(h, 95, 66), dot: H(h2, 95, 66), glow: H(h, 95, 60) };
      break;
    case 2: // gradient text on dark
      bg = `linear-gradient(135deg, ${H(h, 80, 18)}, ${H(h2, 80, 12)})`;
      style = { weight: 600, gradient: [H(h, 92, 62), H(h2, 92, 62)], gradientAngle: 20 };
      break;
    case 3: // white outline on vivid
      bg = H(h, 88, 60);
      style = { weight: 600, fill: false, outline: "#ffffff", outlineWidth: 0.03 };
      break;
    case 4: // ink on vivid + contrasting dot
      bg = H(h, 90, 58);
      style = { weight: 600, body: "#0e0e12", dot: H(h3, 95, 60) };
      break;
    case 5: // white on radial burst
      bg = `radial-gradient(circle at 50% 42%, ${H(h, 92, 60)}, ${H(h2, 85, 28)})`;
      style = { weight: 600, body: "#ffffff", dot: H(h3, 95, 62) };
      break;
    case 6: // tri-stop gradient text, spaced out
      bg = "#0d0d12";
      style = { weight: 500, gradient: [H(h, 90, 60), H(h2, 90, 55), H(h3, 90, 60)], gradientAngle: 90, letterSpacing: 0.02 };
      break;
    case 7: // chrome-ish on tinted dark
      bg = H(h, 25, 15);
      style = { weight: 600, body: "#f4f5f7", dot: H(h, 95, 58) };
      break;
    default: // diagonal duo-split bg, white ink, ink dot
      bg = `linear-gradient(90deg, ${H(h, 90, 58)} 0 50%, ${H(h2, 90, 58)} 50% 100%)`;
      style = { weight: 600, body: "#ffffff", dot: "#0e0e12" };
  }
  return { bg, style, rot, size };
}

// accelerating cadence: 6-frame cuts → 4 → 3
function cutAt(local: number): { idx: number; l: number; len: number } {
  if (local < 84) return { idx: Math.floor(local / 6), l: local % 6, len: 6 };
  if (local < 180) {
    const t = local - 84;
    return { idx: 14 + Math.floor(t / 4), l: t % 4, len: 4 };
  }
  const t = local - 180;
  return { idx: 38 + Math.floor(t / 3), l: t % 3, len: 3 };
}

const WildRush: React.FC = () => {
  const frame = useCurrentFrame();
  const { idx, l, len } = cutAt(frame);
  const look = wildLook(idx);
  const pop = interpolate(l, [0, Math.max(1, len * 0.5)], [0.76, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2.2)),
  });
  const rot = interpolate(l, [0, len], [look.rot * 1.8, look.rot], { extrapolateRight: "clamp" });
  const strobe = interpolate(l, [0, 1.6], [0.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const enter = interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outro = interpolate(frame, [WILD - 8, WILD], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: look.bg, alignItems: "center", justifyContent: "center", opacity: Math.min(enter, outro) }}>
      <div style={{ transform: `rotate(${rot}deg) scale(${pop})` }}>
        <SolvxWordmark size={look.size} style={look.style} />
      </div>
      <AbsoluteFill style={{ background: "#ffffff", opacity: strobe, mixBlendMode: "overlay" }} />
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rise = interpolate(frame, [10, 34], [24, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: enter }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34, transform: `translateY(${rise}px)` }}>
        <div style={{ padding: "56px 90px", borderRadius: 28, background: "#f6f7f9", boxShadow: "0 14px 40px rgba(0,0,0,0.5)" }}>
          <SolvxWordmark size={150} style={SOLVX_PRIMARY} />
        </div>
        <Caption size={30} dim>build in public · youtube.com/@solvXuk</Caption>
      </div>
    </AbsoluteFill>
  );
};

export const LogoShowcase: React.FC = () => {
  return (
    <AbsoluteFill>
      <Backdrop />
      <Sequence durationInFrames={INTRO}>
        <Intro />
      </Sequence>
      <Sequence from={INTRO} durationInFrames={GRID}>
        <Grid />
      </Sequence>
      <Sequence from={INTRO + GRID} durationInFrames={DEMO}>
        <RecolourDemo />
      </Sequence>
      <Sequence from={INTRO + GRID + DEMO} durationInFrames={WILD}>
        <WildRush />
      </Sequence>
      <Sequence from={INTRO + GRID + DEMO + WILD} durationInFrames={OUTRO}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
