import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { SCREEN_TARGETS } from "./screenTargets";
import {
  APPROACH_FRAMES,
  LandingSurface,
  landingPose,
  screenBox,
  type LandingEffect,
} from "../shared/ScreenLanding";
import { Story } from "./data";
import { beatPulse, type StoryPhases } from "./grid";
import {
  energyFor,
  PROP,
  BRAND_ACCENT,
  FONT_BUBBLE,
  SHOW_NAME,
} from "./tokens";
import { FinaleColourSplash } from "./FinaleColourSplash";
import { ScreenStory } from "./ScreenStory";

// The landing arithmetic lives in shared/ScreenLanding.tsx. It used to be duplicated verbatim here
// and in a set of standalone test compositions, with nothing keeping the two copies equal.

type Effect = "static" | "catherine" | "cardflip" | "finale";
// Props pivot about their BASE (feet stay glued to the floor) so the baked shadow and any
// background shading never travel with the motion. base = the pivot point in 1920×1080 px,
// derived from each cutout's measured bbox (bbox centre-x, bbox bottom, plate→stage scaled).
type Prop = { kind: "chair" | "speaker"; baseX: number; baseY: number;
               // true when a matching <kind>_shadow.png exists — drawn static, beneath the prop
               shadow?: boolean };

// Per-RANK treatment (keyed by story.n, mirroring RANK_ACCENT) — the countdown counts 5 → 1.
const RANK_VISUAL: Record<number, { device: keyof typeof SCREEN_TARGETS; effect: Effect; prop?: Prop }> = {
  5: { device: "50s", effect: "static", prop: { kind: "chair", baseX: 221, baseY: 948 } },
  4: { device: "80s", effect: "static", prop: { kind: "speaker", baseX: 347, baseY: 1049, shadow: true } },
  3: { device: "90s", effect: "catherine" },
  2: { device: "00s", effect: "cardflip" },
  1: { device: "20s", effect: "finale" },
};

// The card-flip's branded back face.
const BrandFace: React.FC<{ sh: number }> = ({ sh }) => (
  <>
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${BRAND_ACCENT}, #0b6f86 58%, #063846 100%)` }} />
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: FONT_BUBBLE, color: "#03121a", fontSize: sh * 0.22, fontWeight: 800, letterSpacing: 2, textAlign: "center", lineHeight: 0.95 }}>
        {SHOW_NAME}
      </div>
    </AbsoluteFill>
  </>
);

export const StoryVisual: React.FC<{ story: Story; phases: StoryPhases; newsImage?: string }> = ({
  story,
  phases,
  newsImage,
}) => {
  // The device arrival settles exactly when the brand-arrival window opens — the end of the cue,
  // which is a beat boundary on the absolute grid.
  const stingFrame = phases.stingerStart;
  const frame = useCurrentFrame();
  // ⚠️ The beat pulse needs the ABSOLUTE frame. This component lives inside the story's
  // <Sequence>, so its own clock restarts at each boundary; pulsing off that would re-phase the
  // speaker's bass-bin squash against the bed five times an episode.
  const absoluteFrame = phases.absoluteFrom + frame;
  const { width, height } = useVideoConfig();

  const rank = story.n;
  const cfg = RANK_VISUAL[rank] ?? RANK_VISUAL[3];

  // #1 finale is a self-contained set-piece; its tablet screen carries the same ScreenStory.
  if (cfg.effect === "finale") {
    return <FinaleColourSplash story={story} phases={phases} newsImage={newsImage} />;
  }

  const target = SCREEN_TARGETS[cfg.device];
  const box = screenBox(target.rect, width, height);
  const sx = box.x;
  const sy = box.y;
  const sw = box.w;
  const sh = box.h;
  const radius = Math.round(sh * target.radiusFrac); // each device's screen has its own corner shape

  const isFlip = cfg.effect === "cardflip";
  const isDVE = cfg.effect === "catherine" || cfg.effect === "cardflip";
  // The DVE settles to identity EXACTLY on the sting frame, which the grid puts on a beat.
  const pose = isDVE
    ? landingPose({
        landFrame: stingFrame,
        approachFrames: APPROACH_FRAMES[cfg.effect as LandingEffect],
        effect: cfg.effect as LandingEffect,
        width,
        height,
        frame,
      })
    : null;
  const flying = pose?.flying ?? false;

  // The face the flying surface shows: the story FROZEN at its landed (reveal) state —
  // so the moment it lands, the live ScreenStory underneath continues it seamlessly.
  const frozenFace = (
    <ScreenStory story={story} phases={phases} frame={stingFrame} sw={sw} sh={sh} newsImage={newsImage} arrival="land" />
  );

  // Prop motion — BASE-PIVOT: rock about the base on the sting (chair + speaker), and a
  // beat-locked bass-bin SQUASH for the speaker. The base never leaves the floor, so the
  // baked shadow / wall shading cannot travel (the old translate dragged them visibly).
  let propTransform = "";
  let propOrigin = "center center";
  if (cfg.prop) {
    const e = energyFor(rank);
    const t = frame - stingFrame;
    const env = t < 0 ? 0 : interpolate(t, [0, PROP.SHAKE_DECAY_FRAMES], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const rock = PROP.ROCK_DEG * e * env * Math.sin(t * PROP.SHAKE_FREQ);
    const squash = cfg.prop.kind === "speaker" ? PROP.SQUASH * e * beatPulse(absoluteFrame, PROP.THUMP_DECAY) : 0;
    propTransform = `rotate(${rock}deg) scaleY(${1 - squash}) scaleX(${1 + 0.5 * squash})`;
    propOrigin = `${cfg.prop.baseX}px ${cfg.prop.baseY}px`;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Device plate (background). */}
      {/* Device plate. Absent only for the 20s tablet, whose rank renders the finale instead —
          this branch never runs in the shipped edition and exists so a target without a plate
          renders its screen rather than throwing. */}
      {target.plate && (
        <Img src={staticFile(target.plate)} style={{ position: "absolute", width, height, objectFit: "fill" }} />
      )}

      {/* The live screen — cue patter on standby, then the story (headline/beats/takeaway).
          For DVE stories the headline "arrival" is the surface landing itself. */}
      <div
        style={{
          position: "absolute",
          left: sx,
          top: sy,
          width: sw,
          height: sh,
          overflow: "hidden",
          borderRadius: radius,
          background: "#0a0f1e",
        }}
      >
        <ScreenStory
          story={story}
          phases={phases}
          frame={frame}
          sw={sw}
          sh={sh}
          newsImage={newsImage}
          arrival={isDVE ? "land" : "spin"}
        />
      </div>

      {/* DVE flying surface (catherine / card-flip) — carries the frozen reveal face in, so the
          moment it lands the live screen underneath continues it with no seam. */}
      {flying && pose && (
        <LandingSurface
          box={box}
          pose={pose}
          radius={radius}
          front={frozenFace}
          back={isFlip ? <BrandFace sh={sh} /> : undefined}
        />
      )}

      {/* Contact shadow — STATIC, under the prop. It belongs to the floor, not to the object, so it
          must not inherit the rock or the squash. It used to live inside the cutout's alpha and rode
          every bass-bin thump, which is what made the floor and the skirting line look like they
          were moving. Guarded: a prop with no shadow asset simply renders without one. */}
      {cfg.prop?.shadow && (
        <Img
          src={staticFile(`era-devices/${cfg.prop.kind}_shadow.png`)}
          style={{ position: "absolute", width, height, objectFit: "fill" }}
        />
      )}

      {/* Prop layer (chair / speaker) — on top; rocks/squashes about its base on the sting. */}
      {cfg.prop && (
        <Img
          src={staticFile(`era-devices/${cfg.prop.kind}_cutout.png`)}
          style={{
            position: "absolute",
            width,
            height,
            objectFit: "fill",
            transform: propTransform,
            transformOrigin: propOrigin,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
