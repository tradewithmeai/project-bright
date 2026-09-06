import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile,
  useCurrentFrame, useVideoConfig, interpolate, Easing,
} from "remotion";

// The gold-star EMOTIONAL-ARC structure as a reusable, footage-agnostic template — the recipe from
// studio/projects/ad-teardown/TEARDOWN.md made into an empty structure any story pours into.
// Phases: setup → establish (two worlds) → parallel (intercut) → bridge (the turn) → payoff → brand (last).
// Rules baked in: brand held to the final beat; music/silence contract (silent beats duck the score,
// swell beats push it); shot-scale intent per beat. Beats without a clip render an explanatory
// placeholder so the STRUCTURE is visible before any footage exists.

export type ArcAudio = "silent" | "ambient" | "music" | "swell";
export type ArcScale = "wide" | "medium" | "close" | "insert";
export type ArcBeat = {
  id: string;
  phase: "setup" | "establish" | "parallel" | "bridge" | "payoff" | "brand";
  dur_s: number;
  audio: ArcAudio;
  scale: ArcScale;
  clip?: string | null;     // staticFile path, or null → placeholder card
  pip?: string | null;      // second thread for a "parallel" beat (intercut/inset)
  text?: string | null;     // on-screen line (kept sparse — emotional beats stay wordless)
  note: string;             // what this beat is doing (shown on the placeholder)
};
export type NarrativeArcConfig = {
  brand: { name: string; tagline?: string; colors: { bg: string; primary: string; accent: string; text: string } };
  beats: ArcBeat[];
  music?: string | null;
  fps: number; width: number; height: number; total_frames: number;
};

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const PHASE_LABEL: Record<ArcBeat["phase"], string> = {
  setup: "SETUP · establish the longing", establish: "ESTABLISH · the two worlds",
  parallel: "PARALLEL · intercut, they notice each other", bridge: "BRIDGE · the gesture crosses",
  payoff: "PAYOFF · warmth delivered", brand: "BRAND · held to the last beat",
};

// A beat's footage (or a labelled placeholder describing what belongs here).
const BeatBody: React.FC<{ beat: ArcBeat; config: NarrativeArcConfig }> = ({ beat, config }) => {
  const frame = useCurrentFrame();
  const { bg, primary, accent, text } = config.brand.colors;
  const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  const inO = interpolate(frame, [0, 8], [0, 1], { ...clamp, easing: EASE });

  // shot-scale intent expressed as a slow push (close = punch-in, wide = ease-out)
  const scaleFrom = beat.scale === "close" ? 1.12 : beat.scale === "insert" ? 1.2 : beat.scale === "medium" ? 1.05 : 1.0;
  const s = interpolate(frame, [0, Math.round(beat.dur_s * config.fps)], [scaleFrom, 1.0], { ...clamp, easing: EASE });

  if (beat.phase === "brand") {
    const rise = interpolate(frame, [4, 20], [22, 0], { ...clamp, easing: EASE });
    return (
      <AbsoluteFill style={{ backgroundColor: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, opacity: inO }}>
        <AbsoluteFill style={{ background: `radial-gradient(ellipse 55% 45% at 50% 45%, ${primary}22 0%, transparent 70%)` }} />
        <div style={{ fontFamily: "'Fredoka','Nunito',system-ui,sans-serif", fontSize: 150, fontWeight: 700, color: text, letterSpacing: -2, transform: `translateY(${rise}px)`, textShadow: `0 0 60px ${primary}` }}>
          {config.brand.name}
        </div>
        <div style={{ height: 5, width: "34%", background: `linear-gradient(90deg, ${primary}, ${accent})`, borderRadius: 3 }} />
        {config.brand.tagline ? <div style={{ fontFamily: "'Inter',system-ui,sans-serif", fontSize: 28, color: `${text}cc`, letterSpacing: 3 }}>{config.brand.tagline}</div> : null}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {beat.clip ? (
        <AbsoluteFill style={{ transform: `scale(${s})` }}>
          <OffthreadVideo src={staticFile(beat.clip)} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
        </AbsoluteFill>
      ) : (
        // placeholder — makes the gold-star STRUCTURE visible with no footage yet
        <AbsoluteFill style={{ backgroundColor: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, opacity: inO }}>
          <div style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: 22, color: accent, letterSpacing: 4 }}>{PHASE_LABEL[beat.phase]}</div>
          <div style={{ fontFamily: "'Inter',system-ui,sans-serif", fontSize: 40, color: text, maxWidth: "70%", textAlign: "center", lineHeight: 1.2 }}>{beat.note}</div>
          <div style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: 18, color: `${text}88`, letterSpacing: 3, textTransform: "uppercase" as const }}>
            {beat.scale} shot · audio: {beat.audio}{beat.pip ? " · intercut" : ""}
          </div>
        </AbsoluteFill>
      )}

      {/* parallel-thread inset (the intercut, when a second clip is provided) */}
      {beat.pip && (
        <div style={{ position: "absolute", right: 54, bottom: 54, width: "32%", aspectRatio: "16/9", border: "3px solid rgba(255,255,255,.9)", borderRadius: 8, overflow: "hidden", boxShadow: "0 18px 50px rgba(0,0,0,.55)" }}>
          <OffthreadVideo src={staticFile(beat.pip)} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
        </div>
      )}

      {beat.text ? (
        <AbsoluteFill style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 90 }}>
          <div style={{ fontFamily: "'Fredoka','Nunito',system-ui,sans-serif", fontSize: 52, fontWeight: 600, color: "#fff", textShadow: "0 4px 30px rgba(0,0,0,.9)", opacity: inO }}>{beat.text}</div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

export const NarrativeArc: React.FC<{ config: NarrativeArcConfig }> = ({ config }) => {
  const fps = config.fps || 30;
  const { durationInFrames } = useVideoConfig();

  // the music/silence contract: score ducks on silent/ambient beats, swells on swell beats
  const wins = (() => {
    let c = 0; const out: { a: number; b: number; audio: ArcAudio }[] = [];
    for (const bt of config.beats) { const d = Math.round(bt.dur_s * fps); out.push({ a: c, b: c + d, audio: bt.audio }); c += d; }
    return out;
  })();
  const musicVol = (f: number) => {
    const w = wins.find((x) => f >= x.a && f < x.b);
    let v = w ? ({ silent: 0.06, ambient: 0.15, music: 0.4, swell: 0.62 } as const)[w.audio] : 0.3;
    v *= interpolate(f, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    v *= interpolate(f, [durationInFrames - 24, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return Math.max(0, v);
  };

  let cursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {config.beats.map((beat) => {
        const dur = Math.max(1, Math.round(beat.dur_s * fps));
        const from = cursor; cursor += dur;
        return (
          <Sequence key={beat.id} from={from} durationInFrames={dur}>
            <BeatBody beat={beat} config={config} />
          </Sequence>
        );
      })}
      {config.music ? <Audio src={staticFile(config.music)} volume={musicVol} /> : null}
    </AbsoluteFill>
  );
};
