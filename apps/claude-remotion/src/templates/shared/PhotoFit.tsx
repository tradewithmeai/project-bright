// PhotoFit — aspect-aware image fitting for photo-driven video.
//
// The problem: a mixed set of stills (portrait and landscape, arbitrary ratios) has to fill a
// fixed-ratio frame. `objectFit: "cover"` fills it but crops, which reliably cuts off whatever
// mattered in the shot. `contain` never crops but leaves dead bars.
//
// Two components, two answers, both frame-pure:
//
//   <FittedPhoto>  blurred-fill backdrop + contained foreground. The same image is drawn twice:
//                  once oversized and heavily blurred to fill the frame, once contained on top at
//                  its true ratio. Nothing is cropped and there are no bars. Optional Ken Burns.
//
//   <PhotoCard>    a bordered card whose HEIGHT is computed from the image's real pixel
//                  dimensions, so the card takes the photo's shape instead of forcing the photo
//                  into the card's. Supply `dims` and the geometry follows.
//
// Both are pure functions of useCurrentFrame(). No CSS transitions or animations, per the
// Remotion rules in CLAUDE.md.

import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from "remotion";

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type FittedPhotoProps = {
  /** Resolved image source — pass staticFile("...") or a URL. */
  src: string;
  /** Length of this photo's own window, in frames. Drives the Ken Burns end point. */
  durationInFrames: number;
  /** Page background, seen only if the image fails to paint. */
  backgroundColor?: string;
  /** Ken Burns scale start/end. Pass [1, 1] to hold still. */
  zoom?: [number, number];
  /** Blur radius and brightness of the backdrop copy. */
  backdrop?: { blur?: number; brightness?: number };
  /** Fraction of frame height the contained image may occupy, 0-1. */
  maxHeightFraction?: number;
  /** Corner radius on the foreground image. */
  radius?: number;
  /** Frames over which the whole element fades up. */
  fadeInFrames?: number;
};

/**
 * Blurred-fill photo: fills the frame without ever cropping the subject.
 */
export const FittedPhoto: React.FC<FittedPhotoProps> = ({
  src,
  durationInFrames,
  backgroundColor = "#000000",
  zoom = [1.04, 1.13],
  backdrop,
  maxHeightFraction = 0.88,
  radius = 14,
  fadeInFrames = 10,
}) => {
  const frame = useCurrentFrame();
  const blur = backdrop?.blur ?? 46;
  const brightness = backdrop?.brightness ?? 0.5;

  const scale = interpolate(frame, [0, durationInFrames], zoom, { ...clamp, easing: EASE });
  const opacity = interpolate(frame, [0, fadeInFrames], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor, opacity }}>
      {/* Backdrop: same image, oversized and blurred, so the frame is filled with the photo's
          own colours rather than letterbox bars. */}
      <AbsoluteFill>
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: `blur(${blur}px) brightness(${brightness})`,
            transform: "scale(1.2)",
          }}
        />
      </AbsoluteFill>

      {/* Foreground: contained at true aspect ratio — nothing is cropped. */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 40 }}>
        <Img
          src={src}
          style={{
            maxWidth: "94%",
            maxHeight: `${Math.round(maxHeightFraction * 100)}%`,
            objectFit: "contain",
            transform: `scale(${scale})`,
            borderRadius: radius,
            boxShadow: "0 24px 90px rgba(0,0,0,0.6)",
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export type PhotoCardProps = {
  src: string;
  /** The image's real pixel size, "WIDTHxHEIGHT" (e.g. "1600x1200") or [w, h]. */
  dims: string | [number, number];
  /** Card position within the parent, in px. */
  x: number;
  y: number;
  /** Card rotation in degrees. */
  rotation?: number;
  /** Card width for landscape and portrait sources respectively. */
  width?: { landscape: number; portrait: number };
  /** White border thickness; the card's height accounts for it. */
  padding?: number;
  /** Amplitude and rate of the idle vertical drift, in px and radians/frame. */
  drift?: { amplitude: number; rate: number };
  /** Phase offset so sibling cards do not drift in lockstep. */
  phase?: number;
  entryFrames?: number;
  cardColor?: string;
  children?: React.ReactNode;
};

/** Parse "1600x1200" or [1600, 1200] into a numeric pair. */
const parseDims = (dims: string | [number, number]): [number, number] => {
  if (Array.isArray(dims)) return dims;
  const [w, h] = dims.split("x").map(Number);
  return [w, h];
};

/**
 * A bordered photo card sized to the image's real aspect ratio.
 *
 * The card's inner image height is DERIVED from `dims`, so a portrait source produces a tall
 * card and a landscape source a wide one. This is what stops a fixed-height card from cropping
 * the top of a portrait shot.
 */
export const PhotoCard: React.FC<PhotoCardProps> = ({
  src,
  dims,
  x,
  y,
  rotation = 0,
  width = { landscape: 440, portrait: 350 },
  padding = 12,
  drift = { amplitude: 20, rate: 0.03 },
  phase = 0,
  entryFrames = 14,
  cardColor = "#ffffff",
  children,
}) => {
  const frame = useCurrentFrame();
  const [pw, ph] = parseDims(dims);
  const isPortrait = ph >= pw;

  const W = isPortrait ? width.portrait : width.landscape;
  // The whole point: height comes from the source ratio, not from a constant.
  const innerW = W - padding * 2;
  const imageHeight = Math.round(innerW * (ph / pw));

  const dy = Math.sin(frame * drift.rate + phase) * drift.amplitude;
  const opacity = interpolate(frame, [0, entryFrames], [0, 1], { ...clamp, easing: EASE });
  const pop = interpolate(frame, [0, entryFrames], [0.8, 1], { ...clamp, easing: EASE });

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + dy,
        width: W,
        transform: `rotate(${rotation}deg) scale(${pop})`,
        opacity,
      }}
    >
      <div
        style={{
          background: cardColor,
          padding,
          borderRadius: 10,
          boxShadow: "0 22px 60px rgba(0,0,0,0.55)",
        }}
      >
        <Img
          src={src}
          style={{
            width: "100%",
            height: imageHeight,
            objectFit: "cover",
            objectPosition: "center top",
            borderRadius: 6,
            display: "block",
          }}
        />
        {children}
      </div>
    </div>
  );
};

/**
 * Scatter positions for a set of cards, as fractions of the frame so it works at any resolution.
 * Deliberately a small fixed cycle rather than random: a render must be deterministic.
 */
export const CARD_SCATTER: { x: number; y: number; rotation: number }[] = [
  { x: 0.08, y: 0.11, rotation: -5 },
  { x: 0.61, y: 0.14, rotation: 5 },
  { x: 0.16, y: 0.46, rotation: 6 },
  { x: 0.58, y: 0.44, rotation: -6 },
];
