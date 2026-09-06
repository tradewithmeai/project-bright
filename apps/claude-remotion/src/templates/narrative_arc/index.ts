import { staticFile } from "remotion";
import { NarrativeArc, NarrativeArcConfig } from "./NarrativeArc";

export { NarrativeArc };
export type { NarrativeArcConfig };

// Default = the gold-star emotional arc as an EMPTY structure (placeholder beats). Swap each beat's
// `clip`/`pip`/`text` for real footage + a `music` bed and it renders on that footage. The beats,
// durations, shot-scale and audio contract encode the recipe from TEARDOWN.md.
export const NARRATIVE_ARC_DEFAULT: NarrativeArcConfig = {
  brand: { name: "BRAND", tagline: "your line here", colors: { bg: "#0a0d10", primary: "#00bfff", accent: "#00ff88", text: "#ffffff" } },
  music: null,
  fps: 30, width: 1920, height: 1080,
  total_frames: 30 * 45, // recomputed in calculateMetadata from the beats
  beats: [
    { id: "b1", phase: "setup",     dur_s: 6, audio: "silent", scale: "close",  clip: null, note: "A character + the object of longing. Hold, contemplative.", text: null },
    { id: "b2", phase: "establish", dur_s: 7, audio: "music",  scale: "wide",   clip: null, note: "Set up the two worlds separately — the sweep opens up.", text: null },
    { id: "b3", phase: "parallel",  dur_s: 10, audio: "music", scale: "medium", clip: null, pip: null, note: "Intercut the two worlds — they notice each other. The edit makes the connection.", text: null },
    { id: "b4", phase: "bridge",    dur_s: 6, audio: "swell",  scale: "insert", clip: null, note: "A small gesture crosses the distance — insert on the meaningful object.", text: null },
    { id: "b5", phase: "payoff",    dur_s: 8, audio: "swell",  scale: "wide",   clip: null, note: "Warmth delivered — the widest, most music-swept beat.", text: null },
    { id: "b6", phase: "brand",     dur_s: 4, audio: "music",  scale: "medium", clip: null, note: "Brand reveal — held to the final beat.", text: null },
  ],
};

export const calculateMetadata = async () => {
  let config = NARRATIVE_ARC_DEFAULT;
  try {
    const res = await fetch(staticFile("narrative-arc/config.json"));
    if (res.ok) config = { ...NARRATIVE_ARC_DEFAULT, ...(await res.json()) };
  } catch { /* use default skeleton */ }
  const fps = config.fps || 30;
  const total = config.beats.reduce((n, b) => n + Math.round((b.dur_s || 0) * fps), 0);
  return { durationInFrames: Math.max(1, total), fps, width: config.width || 1920, height: config.height || 1080, props: { config } };
};
