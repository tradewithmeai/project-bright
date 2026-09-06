// ScreenLanding — fly a surface onto a screen inside a device, and land it on an exact frame.
//
// The problem it solves: a still photograph of a television, a tablet or a projector wall makes a
// far better backdrop than a screen recreated in CSS, but the interesting part — what is ON the
// screen — has to be placed inside that device's own screen rectangle, at its aspect and its corner
// rounding, and it has to ARRIVE rather than simply appear.
//
// ── The rectangle is a fraction, never pixels ─────────────────────────────────────────────────
//
// A `ScreenRect` is expressed as fractions of the frame, so one measurement survives a render at
// another size: the same plate works at 1920x1080 and at 1280x720. Measure it once from the plate.
//
// ── Extracted from three registered "landing test" compositions ───────────────────────────────
//
// A show here carried `ScreenLandingTest`, `ScreenLandingCatherine` and `ScreenLandingCardFlip` as
// three separate Studio entries. They were development rigs rather than videos: each flew a card
// reading "PLACEHOLDER NEWS IMAGE" onto a device plate for three seconds.
//
// The arithmetic in them was a VERBATIM COPY of the production code — the same 0.55 entry radius,
// the same -130 degree entry angle, 1.25 orbit turns, 3 self-turns, the same 0.35-to-1 scale ramp —
// living in two files with nothing to keep them equal. That is the duplication worth removing: the
// rig could drift from the very code it was supposed to be testing and neither would complain. Both
// call this now, so a change to the landing is a change to the thing that proves it.
//
// `flyin` existed only in the rig and the show never used it. It is kept because it is the plainest
// of the three and the obvious first thing to reach for.

import React from "react";
import { interpolate, Easing } from "remotion";

/** House decel: smooth settle, no overshoot. */
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
/** Slight overshoot, for an arrival with some snap. */
const EASE_SPRING = Easing.bezier(0.34, 1.56, 0.64, 1);

export type LandingEffect = "flyin" | "catherine" | "cardflip";

/** Where the screen sits within the plate, as fractions of the frame. */
export type ScreenRect = { x: number; y: number; w: number; h: number };

/**
 * The screen's box in composition pixels.
 *
 * `bleedFraction` overscans the measured rectangle by a whisker so no rim of the plate's own screen
 * colour survives along the edge. A measurement is never exact to the pixel, and a one-pixel bright
 * line around a landed image is far more visible than it sounds.
 */
export function screenBox(
  rect: ScreenRect,
  width: number,
  height: number,
  bleedFraction = 0.002
): { x: number; y: number; w: number; h: number; bleed: number } {
  const bleed = Math.round(height * bleedFraction);
  return {
    x: rect.x * width - bleed,
    y: rect.y * height - bleed,
    w: rect.w * width + bleed * 2,
    h: rect.h * height + bleed * 2,
    bleed,
  };
}

export type LandingPose = {
  /** CSS transform for the flying surface. */
  transform: string;
  /** Fade-up of the surface as it enters. */
  opacity: number;
  /** True while the surface is still in flight; false once the live screen should take over. */
  flying: boolean;
  /** For cardflip: perspective belongs on the PARENT, or the rotation reads as a squash. */
  perspective: number | undefined;
};

export type LandingOptions = {
  /** The frame the surface must be fully settled on. Put it on a beat. */
  landFrame: number;
  /** How long the approach takes. */
  approachFrames: number;
  effect: LandingEffect;
  /** Composition size, so throw distances scale with the frame. */
  width: number;
  height: number;
  /** The current frame, in the same clock as `landFrame`. */
  frame: number;
};

/**
 * The pose of a surface arriving at a screen.
 *
 * ⚠️ It settles to identity EXACTLY on `landFrame`. Taking the LAND frame rather than a start frame
 * is the point: the landing is the moment that has to coincide with a beat or a hit, and a landing
 * that finishes a few frames after the hit reads as a mistake while one that finishes before it
 * reads as nothing at all. The approach is placed backwards from the moment that matters.
 */
export function landingPose({
  landFrame,
  approachFrames,
  effect,
  width,
  height,
  frame,
}: LandingOptions): LandingPose {
  const f = frame - (landFrame - approachFrames);
  const flying = frame < landFrame + 3;
  const opacity = interpolate(f, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (effect === "flyin") {
    // Springs in from the upper left, tilts to level, settles onto the screen.
    const p = interpolate(f, [0, approachFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_SPRING,
    });
    const tx = interpolate(p, [0, 1], [-0.3 * width, 0]);
    const ty = interpolate(p, [0, 1], [-0.24 * height, 0]);
    const rot = interpolate(p, [0, 1], [-14, 0]);
    const scale = interpolate(p, [0, 1], [1.4, 1]);
    return {
      transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${scale})`,
      opacity,
      flying,
      perspective: undefined,
    };
  }

  const q = interpolate(f, [0, approachFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });

  if (effect === "catherine") {
    // Catherine wheel: the surface spins about its own centre while that centre spirals inwards,
    // orbiting the screen and growing to full size. A classic 80s/90s DVE.
    const rEntry = 0.55 * width;
    const theta0 = (-130 * Math.PI) / 180; // entry direction: upper left
    const orbitTurns = 1.25;
    const spinTurns = 3; // whole turns, so it ends upright
    const radiusNow = rEntry * (1 - q);
    const angle = theta0 + orbitTurns * 2 * Math.PI * q;
    const tx = Math.cos(angle) * radiusNow;
    const ty = Math.sin(angle) * radiusNow;
    const scale = interpolate(q, [0, 1], [0.35, 1]);
    return {
      transform: `translate(${tx}px, ${ty}px) rotate(${spinTurns * 360 * q}deg) scale(${scale})`,
      opacity,
      flying,
      perspective: undefined,
    };
  }

  // cardflip: arrives showing its back, then flips on Y to land face-on. The back is held for the
  // first ~60% of the approach, which is what makes it on screen long enough to be READ.
  const ty = interpolate(q, [0, 1], [-0.14 * height, 0]);
  const scale = interpolate(q, [0, 1], [0.7, 1]);
  const flip = interpolate(f, [Math.round(approachFrames * 0.6), approachFrames], [180, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
  return {
    transform: `translate(0px, ${ty}px) scale(${scale}) rotateY(${flip}deg)`,
    opacity,
    flying,
    perspective: 1600,
  };
}

/** Default approach length per effect. A flip needs longer, because its back has to be readable. */
export const APPROACH_FRAMES: Record<LandingEffect, number> = {
  flyin: 26,
  catherine: 34,
  cardflip: 46,
};

/**
 * The flying surface: a positioned box carrying `front`, and `back` for a flip.
 *
 * The caller owns what goes inside. In production that is the screen's own content frozen at its
 * landed state, so the instant the surface lands the live screen underneath continues it without a
 * seam — which is why this takes children rather than drawing a card of its own.
 */
export const LandingSurface: React.FC<{
  box: { x: number; y: number; w: number; h: number };
  pose: LandingPose;
  radius: number;
  front: React.ReactNode;
  back?: React.ReactNode;
}> = ({ box, pose, radius, front, back }) => {
  const isFlip = back != null;
  const face: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: radius,
    overflow: "hidden",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  };
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        opacity: pose.opacity,
        perspective: pose.perspective,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transform: pose.transform,
          transformOrigin: "center center",
          transformStyle: "preserve-3d",
          boxShadow: isFlip ? undefined : "0 24px 70px rgba(0,0,0,0.55)",
          borderRadius: isFlip ? undefined : radius,
          overflow: isFlip ? "visible" : "hidden",
        }}
      >
        {isFlip ? (
          <>
            <div style={face}>{front}</div>
            <div style={{ ...face, transform: "rotateY(180deg)" }}>{back}</div>
          </>
        ) : (
          front
        )}
      </div>
    </div>
  );
};
