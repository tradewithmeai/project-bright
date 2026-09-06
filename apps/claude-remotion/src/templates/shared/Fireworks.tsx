// Fireworks — deterministic, frame-pure pyrotechnics for a finale or celebration beat.
//
// Every star is a closed-form solution of linear drag plus gravity, evaluated at the current
// frame, so the same frame always paints the same pixels. Nothing is stateful, nothing is
// random at runtime: the scatter comes from a seeded hash, which is what makes a distributed
// or re-attempted render identical to the first one.
//
// Shapes are callable by name from the FX table:  <Firework name="willow" ... />
//   peony / chrysanthemum / willow / ring / strobe / crossette, plus the two pistil shells.
//
// Coordinates are in PIXELS of the composition you place it in. Use FireworkFinale for a
// ready-made escalating sequence sized to the frame it is given.

import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const FPS = 30;
const fract = (x: number) => x - Math.floor(x);
const hash = (n: number) => fract(Math.sin(n * 12.9898 + 78.233) * 43758.5453);
const h2 = (n: number, salt: number) => hash(n * 1.61803 + salt * 97.13);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function lerpColour(a: string, b: string, t: number) { const pa = hex(a), pb = hex(b); const c = pa.map((v, i) => Math.round(lerp(v, pb[i], t))); return `rgb(${c[0]},${c[1]},${c[2]})`; }

type Dist = "sphere" | "ring";
type Cfg = { N: number; v0: number; k: number; gravity: number; life: number; trail: number; size: number; core: string; tip: string; dist: Dist; tilt?: number; strobe?: boolean; downBias?: boolean };

// name → shape config (the "callable by name" table). core/tip are default colours (a `colour` prop overrides).
export const FX: Record<string, Cfg> = {
  peony:        { N: 150, v0: 640, k: 0.7, gravity: 560, life: 1.4, trail: 0, size: 3.4, core: "#ff2d55", tip: "#ff2d55", dist: "sphere" },
  chrysanthemum:{ N: 140, v0: 560, k: 0.9, gravity: 560, life: 1.6, trail: 6, size: 3.2, core: "#ffd27a", tip: "#ff7a3c", dist: "sphere" },
  willow:       { N: 120, v0: 520, k: 2.4, gravity: 850, life: 2.4, trail: 10, size: 4.2, core: "#ffd27a", tip: "#ff9a3c", dist: "sphere", downBias: true },
  ring:         { N: 84, v0: 520, k: 0.7, gravity: 420, life: 1.3, trail: 2, size: 3.6, core: "#39ff14", tip: "#39ff14", dist: "ring", tilt: 1.1 },
  strobe:       { N: 170, v0: 350, k: 2.5, gravity: 500, life: 2.0, trail: 0, size: 2.6, core: "#e8f0ff", tip: "#e8f0ff", dist: "sphere", strobe: true },
  pistilOuter:  { N: 120, v0: 620, k: 0.9, gravity: 560, life: 1.6, trail: 5, size: 3.2, core: "#2d7dff", tip: "#2d7dff", dist: "sphere" },
  pistilInner:  { N: 60, v0: 300, k: 0.9, gravity: 560, life: 1.1, trail: 3, size: 3.0, core: "#ffd27a", tip: "#ffd27a", dist: "sphere" },
  crossette:    { N: 12, v0: 470, k: 1.0, gravity: 560, life: 1.6, trail: 3, size: 5.0, core: "#ff45c8", tip: "#ff45c8", dist: "sphere" },
};

export type FireworkProps = {
  /** Shape name from the FX table. */
  name: keyof typeof FX;
  /** Any integer. Fixes the star scatter — same seed, same shell, every time. */
  seed: number;
  /** Frame (relative to this component's Sequence) at which the shell launches. */
  launchFrame: number;
  /** Horizontal position of the shell, in px. */
  x: number;
  /** Height at which the shell bursts, in px from the top. */
  apexY: number;
  /** Overrides the shape's default colours. */
  colour?: string;
  /** Frames spent climbing. 0 bursts immediately at apexY. */
  launchDur?: number;
  /** Y the comet climbs from. Defaults to the bottom of the composition. */
  launchY?: number;
};

export const Firework: React.FC<FireworkProps> = ({ name, seed, launchFrame, x, apexY, colour, launchDur = 20, launchY }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const floorY = launchY ?? height;
  const cfg = FX[name];
  const burstFrame = launchFrame + launchDur;
  const core = colour ?? cfg.core;
  const tip = colour ?? cfg.tip;

  if (frame < launchFrame) return null;

  // LAUNCH comet
  if (frame < burstFrame) {
    const y = interpolate(frame, [launchFrame, burstFrame], [floorY, apexY], { easing: Easing.out(Easing.quad) });
    return <div style={{ position: "absolute", left: x - 2, top: y - 2, width: 4, height: 14, background: "#fff", borderRadius: 2, boxShadow: `0 0 12px 4px ${core}` }} />;
  }

  const t = (frame - burstFrame) / FPS;
  if (t > cfg.life + 0.4) return null;
  const vTermY = -cfg.gravity / cfg.k; // y-up terminal (down)

  const posOf = (v0x: number, v0y: number, tt: number) => {
    const e = Math.exp(-cfg.k * tt);
    const dispX = (v0x) * (1 - e) / cfg.k;
    const dispY = vTermY * tt + (v0y - vTermY) * (1 - e) / cfg.k;
    return { sx: x + dispX, sy: apexY - dispY };
  };

  const dots: React.ReactNode[] = [];
  for (let i = 0; i < cfg.N; i++) {
    let dirx: number, diry: number, dirz: number;
    if (cfg.dist === "ring") {
      const a = (i / cfg.N) * 2 * Math.PI + (h2(seed + i, 4) - 0.5) * 0.05;
      const tilt = cfg.tilt ?? 1.1;
      dirx = Math.cos(tilt) * Math.cos(a); diry = Math.sin(a); dirz = Math.sin(tilt) * Math.cos(a);
    } else {
      const u = h2(seed + i, 1) * 2 - 1;
      const phi = h2(seed + i, 2) * 2 * Math.PI;
      const r = Math.sqrt(1 - u * u);
      dirx = r * Math.cos(phi); diry = r * Math.sin(phi); dirz = u;
    }
    const speed = cfg.v0 * (1 + 0.12 * (h2(seed + i, 3) - 0.5) * 2) * (cfg.downBias ? 0.7 + 0.3 * (diry * 0.5 + 0.5) : 1);
    const v0x = dirx * speed, v0y = diry * speed;

    const L = Math.min(1, t / cfg.life);
    const ignite = Math.min(1, t / 0.06);
    const decay = 1 - smooth(0.72, 1.0, L);
    const baseAlpha = ignite * decay;
    const col = lerpColour(core, tip, L);
    const depth = 0.75 + 0.35 * (dirz * 0.5 + 0.5);

    for (let s = 0; s <= cfg.trail; s++) {
      const tt = t - s / FPS;
      if (tt <= 0) break;
      const p = posOf(v0x, v0y, tt);
      const tf = 1 - s / (cfg.trail + 1);
      const size = cfg.size * (1 - 0.45 * L) * depth * (0.5 + 0.5 * tf);
      let alpha = baseAlpha * tf;
      if (cfg.strobe) alpha *= fract(t * 22 + h2(seed + i, 7)) > 0.5 ? 1 : 0;
      if (alpha <= 0.03) continue;
      dots.push(<div key={`${i}-${s}`} style={{ position: "absolute", left: p.sx - size / 2, top: p.sy - size / 2, width: size, height: size, borderRadius: "50%", background: col, opacity: alpha, boxShadow: `0 0 ${size * 3}px ${size}px ${col}` }} />);
    }
  }

  const flash = interpolate((frame - burstFrame), [0, 3, 8], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      {flash > 0 && <div style={{ position: "absolute", left: x - 130, top: apexY - 130, width: 260, height: 260, borderRadius: "50%", opacity: flash * 0.85, background: "radial-gradient(circle, #fff 0%, transparent 70%)" }} />}
      {dots}
    </>
  );
};


// ── Composed shells ────────────────────────────────────────────────────────────────────────────

/** Two concentric shells — a coloured outer break with a bright core inside it. */
export const Pistil: React.FC<Omit<FireworkProps, "name">> = (p) => (
  <>
    <Firework {...p} name="pistilOuter" colour={undefined} />
    <Firework {...p} name="pistilInner" colour={undefined} />
  </>
);

/** Several peonies in quick succession, spread and colour-varied from one seed. */
export const MultiBreak: React.FC<
  Omit<FireworkProps, "name"> & { breaks?: number; palette?: string[] }
> = ({ breaks = 4, palette = ["#ff2d55", "#00e5ff", "#ffd200", "#39ff14", "#ff45c8"], ...p }) => (
  <>
    {Array.from({ length: breaks }, (_, m) => (
      <Firework
        key={m}
        name="peony"
        seed={p.seed * 7 + m}
        launchFrame={p.launchFrame + m * 5}
        launchDur={0}
        x={p.x + (h2(m, 10) - 0.5) * 260}
        apexY={p.apexY + (h2(m, 11) - 0.5) * 140}
        colour={palette[m % palette.length]}
      />
    ))}
  </>
);

// ── The finale ─────────────────────────────────────────────────────────────────────────────────

/** Length of FireworkFinale, in frames at 30fps (~5.8s). */
export const FIREWORK_FINALE_FRAMES = 175;

/**
 * An escalating finale: sparse single shells, then overlapping pairs, then a machine-gun
 * multi-break with strobe glitter over the top.
 *
 * Shell positions are FRACTIONS of the composition, resolved against useVideoConfig(), so the
 * same finale composes correctly at 1920x1080, 1080x1920 or anything else. The escalation is
 * the point: launch frames tighten and shells overlap as it runs.
 */
export const FireworkFinale: React.FC = () => {
  const { width, height } = useVideoConfig();
  const fx = (f: number) => Math.round(width * f);
  const fy = (f: number) => Math.round(height * f);

  return (
    <>
      {/* opening — one at a time, room to read each shape */}
      <Firework name="willow" seed={11} launchFrame={0} x={fx(0.29)} apexY={fy(0.33)} />
      <Pistil seed={22} launchFrame={8} x={fx(0.71)} apexY={fy(0.28)} />
      <Firework name="ring" seed={33} launchFrame={26} x={fx(0.5)} apexY={fy(0.23)} colour="#ff2d55" />

      {/* build — pairs start to overlap */}
      <Firework name="crossette" seed={44} launchFrame={40} x={fx(0.38)} apexY={fy(0.37)} />
      <Firework name="willow" seed={55} launchFrame={52} x={fx(0.65)} apexY={fy(0.35)} colour="#ffb24a" />
      <Firework name="ring" seed={88} launchFrame={70} x={fx(0.16)} apexY={fy(0.28)} colour="#39ff14" />
      <Pistil seed={66} launchFrame={78} x={fx(0.24)} apexY={fy(0.3)} />
      <Firework name="chrysanthemum" seed={99} launchFrame={90} x={fx(0.84)} apexY={fy(0.31)} colour="#ffd200" />
      <Firework name="crossette" seed={77} launchFrame={96} x={fx(0.76)} apexY={fy(0.39)} colour="#00e5ff" />

      {/* the button — everything at once */}
      <Firework name="willow" seed={741} launchFrame={118} x={fx(0.5)} apexY={fy(0.33)} colour="#ffd27a" />
      <MultiBreak seed={123} launchFrame={112} x={fx(0.5)} apexY={fy(0.28)} breaks={5} />
      <Firework name="strobe" seed={321} launchFrame={122} x={fx(0.4)} apexY={fy(0.31)} />
      <Firework name="strobe" seed={654} launchFrame={128} x={fx(0.63)} apexY={fy(0.3)} />
    </>
  );
};
