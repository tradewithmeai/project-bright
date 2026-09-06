import React from "react";
import { AbsoluteFill, interpolate, Easing } from "remotion";
import { Story } from "./data";
import { StoryBackground } from "./StoryBackground";
import { resolveLogo, type LogoAsset } from "./logoLookup";
import { brandWord, brandTone } from "./storyBrand";
import { staticFile } from "remotion";
import type { StoryPhases } from "./grid";
import {
  SCREEN_TEXT,
  accentFor,
  BRAND_ACCENT,
  FONT_BUBBLE,
  FONT_MONO,
  SHOW_NAME,
  TEXT,
  hash,
  EASE,
  EASE_SPRING,
} from "./tokens";

// Brand arrival — plays in the STINGER window (after the era-device settles, before the headline).
// `local` = frames since the stinger window started. Pops in, holds, exits before the headline lands.
function arrivalEnvelope(local: number, stingerFrames: number) {
  const inP = interpolate(local, [2, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_SPRING });
  const out = interpolate(local, [stingerFrames - 12, stingerFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  return { inP, op: inP * out };
}

// No-logo → the subject word + a tone tag land big, then clear so the story text can overlay.
const TextStinger: React.FC<{ story: Story; local: number; window: number; sw: number; sh: number }> = ({ story, local, window, sw, sh }) => {
  const { inP, op } = arrivalEnvelope(local, window);
  if (op <= 0.01) return null;
  const accent = accentFor(story.n);
  const word = brandWord(story).toUpperCase();
  const tone = brandTone(story);
  const scale = 0.72 + 0.28 * inP;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: op }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 62% 46% at 50% 50%, ${accent}3a 0%, transparent 66%)` }} />
      <div style={{ transform: `scale(${scale})`, display: "flex", flexDirection: "column", alignItems: "center", gap: sh * 0.028 }}>
        <div
          style={{
            fontFamily: FONT_BUBBLE,
            fontWeight: 800,
            fontSize: sh * (word.length > 10 ? 0.12 : 0.155),
            color: TEXT,
            textAlign: "center",
            lineHeight: 0.98,
            letterSpacing: -1,
            textShadow: `0 0 60px ${accent}99, 0 4px 18px rgba(0,0,0,0.6)`,
            maxWidth: sw * 0.9,
          }}
        >
          {word}
        </div>
        <div
          style={{
            fontFamily: FONT_BUBBLE,
            fontWeight: 900,
            fontSize: sh * 0.072,
            color: accent,
            letterSpacing: 2,
            transform: "rotate(-3.5deg)",
            textShadow: "0 4px 20px rgba(0,0,0,0.55)",
          }}
        >
          {tone.tag}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Logo tier → the real logo lands big + accent-tinted (CSS mask) in the same window, then clears to
// the persistent low-opacity watermark (StoryBackground) as the story text overlays.
const LogoArrival: React.FC<{ logo: LogoAsset; accent: string; local: number; window: number; sw: number; sh: number }> = ({ logo, accent, local, window, sw, sh }) => {
  const { inP, op } = arrivalEnvelope(local, window);
  if (op <= 0.01) return null;
  const url = `url(${staticFile(logo.file)})`;
  const scale = 0.7 + 0.3 * inP;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: op }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 46% at 50% 50%, ${accent}33 0%, transparent 66%)` }} />
      <div
        style={{
          width: sw * 0.44,
          height: sh * 0.44,
          transform: `scale(${scale})`,
          backgroundColor: TEXT,
          WebkitMaskImage: url,
          maskImage: url,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
          filter: `drop-shadow(0 0 40px ${accent}88)`,
        }}
      />
    </AbsoluteFill>
  );
};

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

// ⚠️ The segment-local phase boundaries used to be module constants computed from fixed frame
// budgets. They are now per story — `phases`, threaded down from grid.ts — because each is
// localFrameAtBeat(this story's start, offset) and stories start on different beat phases.
//
// The big arrival effect happens ONCE per story (the headline, after the number announcement).
// The points just TRANSITION on: a spin per element read as confusing. Every entry still lands on
// a beat, so a stab SFX can lock to it.

// Quick clean entry for secondary elements: fade + small rise, no rotation.
const TRANSITION_FRAMES = 8;
function riseIn(frame: number, start: number) {
  const o = interpolate(frame, [start, start + TRANSITION_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const y = interpolate(frame, [start, start + TRANSITION_FRAMES], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  return { opacity: o, transform: `translateY(${y}px)` };
}

// Mini catherine-wheel arrival (the house move): the element spins about its own centre
// while spiralling in across the screen, landing upright EXACTLY on `land`.
function spinPose(frame: number, land: number, spinFrames: number, sw: number, seed: number) {
  const f = frame - (land - spinFrames);
  const q = interpolate(f, [0, spinFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
  const theta0 = ((-100 - hash(seed) * 120) * Math.PI) / 180; // entry direction varies per element
  const r = 0.55 * sw * (1 - q);
  const orbit = theta0 + 0.75 * 2 * Math.PI * q;
  const tx = Math.cos(orbit) * r;
  const ty = Math.sin(orbit) * r;
  const rot = 360 * q; // one full self-turn, ends upright
  const scale = 0.4 + 0.6 * q;
  const opacity = interpolate(f, [0, 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${scale})`, opacity };
}

type Props = {
  story: Story;
  frame: number; // segment-local frame (pass explicitly so a FROZEN face can be rendered)
  sw: number; // screen rect size in px
  sh: number;
  newsImage?: string; // staticFile path — the (future) gen-AI backdrop
  headlineInImage?: boolean; // true once real images carry the BAKED headline — code headline off
  arrival?: "spin" | "land"; // spin = headline spins in on-screen; land = the DVE surface IS the arrival
  phases: StoryPhases; // this story's own boundaries — see grid.ts
};

// ScreenStory — the device screen is the message surface. The (future gen-AI) image is the
// backdrop layer; ALL timed text (cue, headline*, beats, takeaway) renders in code on top.
// (*headline moves INTO the generated image once real images arrive — headlineInImage.)
export const ScreenStory: React.FC<Props> = ({
  story,
  frame,
  sw,
  sh,
  newsImage,
  headlineInImage = false,
  arrival = "spin",
  phases,
}) => {
  const STINGER_START = phases.stingerStart;
  const REVEAL_START = phases.revealStart;
  const STINGER_FRAMES = phases.revealStart - phases.stingerStart;
  const BEATS_START = phases.beatsStart;
  const EXPLAINER_START = phases.explainerStart;
  const accent = accentFor(story.n);
  const pad = sw * 0.05;
  const shadow = "0 2px 14px rgba(0,0,0,0.6)"; // text-bed insurance over image backdrops
  const logo = resolveLogo(story.entities); // brand arrival: logo → LogoArrival, else → TextStinger

  // ── Cue (screen "standby"): dim patter with a broadcast flicker, exits before the headline ──
  // ⚠️ The cue's exit is derived from the CUE WINDOW, not from fixed frames. It used to be
  // interpolate(frame, [6, 16, 52, 58], ...) — keyframes tuned when the cue was 75 frames long.
  // The cue is 7 beats now, so the text faded out at frame 58 and the brand arrival did not open
  // until 102: a 44-frame hole in the middle of every story where the device screen sat EMPTY
  // except its header. Found by looking at #1's cue, not by any check.
  // ⚠️ …and it is on screen from FRAME 0, not from frame 6. Story #5 follows the cold open on a
  // hard cut with no whip-in, so its first frame is the boundary frame — and with the cue starting
  // at 6 and the HUD fading from 0, that frame showed the device plate with a completely EMPTY
  // screen. One frame of nothing on a hard cut reads as a dropped frame. Found by looking at the
  // boundary; no measurement would have flagged it.
  const cueOut = STINGER_START - 4;
  const cueOpacity =
    interpolate(frame, [0, 6, cueOut - 6, cueOut], [0.55, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) *
    (0.8 + 0.2 * hash(Math.floor(frame / 4)));

  // ── Headline: spins in landing ON the sting (or appears at land when the surface carries it) ──
  const headlinePose =
    arrival === "spin"
      ? spinPose(frame, REVEAL_START, phases.spinFrames(10), sw, story.n * 7 + 1)
      : { transform: "none", opacity: frame >= REVEAL_START ? 1 : 0 };
  // At beats, the headline docks to a top strap so the points own the screen.
  const strapP = interpolate(frame, [BEATS_START, BEATS_START + SCREEN_TEXT.STRAP_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const headlineTop = interpolate(strapP, [0, 1], [0.3, 0.145]) * sh; // strap clears the channel chip
  const headlineScale = interpolate(strapP, [0, 1], [1, SCREEN_TEXT.STRAP_SCALE]);

  // ── Beats: spin in sequentially and STACK (chart-rundown style), clear for the explainer ──
  const beatsExit = interpolate(frame, [EXPLAINER_START, EXPLAINER_START + 6], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Explainer: the reading layer — rises in after the points and HOLDS to the end of the story.
  //    The end-of-story "THE DETAIL" takeaway was cut on 2026-07-24. Its exit interpolation survived
  //    as a guard that could never fire, against a boundary that equalled the story end; it has been
  //    removed along with the data field it served, rather than left as machinery for a dead phase.
  const explainerPose = riseIn(frame, EXPLAINER_START);

  return (
    <AbsoluteFill>
      {/* Backdrop layer (Phase 3): real-logo watermark for the story's entities, else plain gradient
          (StoryBackground reproduces the exact prior gradient when there's no logo — zero regression) */}
      <StoryBackground story={story} sw={sw} sh={sh} newsImage={newsImage} />

      {/* Channel chip */}
      <div
        style={{
          position: "absolute",
          top: pad * 0.7,
          left: pad,
          fontFamily: FONT_MONO,
          color: BRAND_ACCENT,
          fontSize: sh * 0.045,
          letterSpacing: 3,
          textShadow: shadow,
        }}
      >
        {SHOW_NAME} · {frame < REVEAL_START ? "LIVE" : `#${story.n}`}
      </div>

      {/* CUE — the DJ patter on the standby screen while the era-device performs its arrival */}
      {frame < STINGER_START && (
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: pad * 1.6 }}>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: sh * SCREEN_TEXT.CUE_H,
              color: `${TEXT}dd`,
              letterSpacing: 2,
              lineHeight: 1.5,
              textAlign: "center",
              opacity: cueOpacity,
              textShadow: shadow,
            }}
          >
            {story.cue.toUpperCase()}
          </div>
        </AbsoluteFill>
      )}

      {/* BRAND ARRIVAL — after the device settles: no logo → the text stinger (word + tone tag);
          with a logo → the real logo lands big. Both clear before the headline overlays. */}
      {frame >= STINGER_START &&
        frame < REVEAL_START &&
        (logo ? (
          <LogoArrival logo={logo} accent={accent} local={frame - STINGER_START} window={STINGER_FRAMES} sw={sw} sh={sh} />
        ) : (
          <TextStinger story={story} local={frame - STINGER_START} window={STINGER_FRAMES} sw={sw} sh={sh} />
        ))}

      {/* HEADLINE — the message (code layer now; baked into the gen image later) */}
      {!headlineInImage && frame >= phases.spinStart(10) && (
        <div
          style={{
            position: "absolute",
            left: pad,
            right: pad,
            top: headlineTop,
            display: "flex",
            justifyContent: "center",
            transform: `scale(${headlineScale})`,
            transformOrigin: "center top",
          }}
        >
          <div
            style={{
              fontFamily: FONT_BUBBLE,
              fontSize: sh * SCREEN_TEXT.HEADLINE_H,
              fontWeight: 700,
              color: TEXT,
              textAlign: "center",
              lineHeight: 1.12,
              textShadow: shadow,
              ...headlinePose,
            }}
          >
            {story.headline}
          </div>
        </div>
      )}

      {/* BEATS — the points spin in and stack */}
      {frame >= BEATS_START && beatsExit > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: beatsExit }}>
          {story.beats.slice(0, 2).map((beat, i) => {
            const start = i === 0 ? BEATS_START : phases.beat1;
            const pose = riseIn(frame, start);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: pad * 1.4,
                  right: pad * 1.4,
                  top: sh * (0.42 + i * 0.24),
                  display: "flex",
                  gap: sw * 0.015,
                  alignItems: "baseline",
                  ...pose,
                }}
              >
                <span style={{ fontFamily: FONT_BUBBLE, color: accent, fontSize: sh * SCREEN_TEXT.BEAT_H, textShadow: shadow }}>
                  ▸
                </span>
                <span
                  style={{
                    fontFamily: FONT_BUBBLE,
                    fontSize: sh * SCREEN_TEXT.BEAT_H,
                    fontWeight: 500,
                    color: TEXT,
                    lineHeight: 1.3,
                    textShadow: shadow,
                  }}
                >
                  {beat}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* EXPLAINER — the reading layer ("the voiceover introduces, the text explains") */}
      {frame >= EXPLAINER_START && Boolean(story.screen || story.explainer) && (
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: pad * 1.6,
            paddingTop: sh * 0.2, // clear the docked headline strap
          }}
        >
          <div style={{ ...explainerPose, maxWidth: sw * 0.86 }}>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: sh * SCREEN_TEXT.LABEL_H,
                fontWeight: 700,
                color: accent,
                letterSpacing: 6,
                border: `1px solid ${accent}55`,
                padding: `${sh * 0.012}px ${sw * 0.02}px`,
                borderRadius: 4,
                marginBottom: sh * 0.035,
                textShadow: shadow,
                display: "inline-block",
              }}
            >
              WHAT HAPPENED
            </div>
            <div
              style={{
                fontFamily: FONT_BUBBLE,
                fontSize: sh * SCREEN_TEXT.EXPLAINER_H,
                fontWeight: 500,
                color: TEXT,
                textAlign: "left",
                lineHeight: 1.45,
                textShadow: shadow,
              }}
            >
              {story.screen || story.explainer}
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* THE DETAIL takeaway block removed 2026-07-24 (owner): the end-of-story kicker was not working. */}

      {/* Brand rule (bottom) */}
      <div
        style={{
          position: "absolute",
          left: pad,
          bottom: pad * 0.9,
          height: Math.max(3, sh * 0.018),
          width: "34%",
          background: BRAND_ACCENT,
          borderRadius: 2,
        }}
      />
    </AbsoluteFill>
  );
};
