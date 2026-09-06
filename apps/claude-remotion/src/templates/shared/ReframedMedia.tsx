// ReframedMedia — put a landscape source into a vertical frame, or any aspect into any other.
//
// The everyday problem: you have a finished 16:9 render and you need a 9:16 cut of it. There are
// exactly two honest answers, and the choice is editorial rather than technical:
//
//   "fit"    the whole source is kept, spanning the frame's width. Nothing is lost, and the space
//            above and below is filled with a blurred, darkened copy of the source itself, so the
//            frame is never empty and never a flat black bar. That dead space is USEFUL: it is
//            where a title and a call to action go.
//
//   "crop"   the source fills the frame edge to edge and the sides are cut away. Use it when the
//            action is central — a face, a countdown, a single object — and you want the whole
//            screen. A focal point decides which part survives.
//
// ⚠️ In "crop" the source is scaled to COVER, so it cannot show an undefined edge, and the focal
// point is clamped so the visible window stays inside the source. Ask for the far left of a wide
// shot and you get as far left as the geometry allows, rather than the frame running off the
// picture.
//
// Extracted from a 16:9-to-9:16 wrapper that hardcoded 1080x1920. Everything here is derived from
// the composition's own dimensions, so it also reframes vertical into landscape, or either into
// square.

import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, useVideoConfig } from "remotion";

export type ReframeMode = "fit" | "crop";

export type ReframeGeometry = {
  mode: ReframeMode;
  /** Size and position of the foreground copy, in composition pixels. */
  contentWidth: number;
  contentHeight: number;
  offsetX: number;
  offsetY: number;
  /** In "fit", the height of the band above and below. 0 in "crop". */
  bandHeight: number;
  /** The focal point actually used, after clamping. */
  focalX: number;
  focalY: number;
};

/**
 * Work out the geometry without rendering anything.
 *
 * Exported so a test can assert the arithmetic — that "crop" leaves no gap, that "fit" loses no
 * picture, and that a focal point outside the safe range is pulled back into it.
 */
export function reframeGeometry(
  frameW: number,
  frameH: number,
  sourceW: number,
  sourceH: number,
  mode: ReframeMode,
  focalX = 0.5,
  focalY = 0.5
): ReframeGeometry {
  const sourceAspect = sourceW / sourceH;

  if (mode === "fit") {
    // Span the full width; height follows the source's aspect. Never taller than the frame.
    const contentWidth = frameW;
    const contentHeight = Math.round(frameW / sourceAspect);
    const bandHeight = Math.max(0, Math.round((frameH - contentHeight) / 2));
    return {
      mode,
      contentWidth,
      contentHeight,
      offsetX: 0,
      offsetY: bandHeight,
      bandHeight,
      focalX: 0.5,
      focalY: 0.5,
    };
  }

  // crop: scale to cover, then slide by the focal point.
  const scale = Math.max(frameW / sourceW, frameH / sourceH);
  const contentWidth = Math.round(sourceW * scale);
  const contentHeight = Math.round(sourceH * scale);

  // The visible window is frameW wide inside a contentWidth-wide picture. Its left edge can travel
  // between 0 and (contentWidth - frameW); the focal fraction picks a point along that range, and
  // clamping is what stops the frame leaving the picture.
  const slackX = Math.max(0, contentWidth - frameW);
  const slackY = Math.max(0, contentHeight - frameH);
  const clampedX = Math.min(1, Math.max(0, focalX));
  const clampedY = Math.min(1, Math.max(0, focalY));

  return {
    mode,
    contentWidth,
    contentHeight,
    offsetX: -Math.round(slackX * clampedX),
    offsetY: -Math.round(slackY * clampedY),
    bandHeight: 0,
    focalX: clampedX,
    focalY: clampedY,
  };
}

export type ReframedMediaProps = {
  /** Resolved source — staticFile("..."). */
  src: string;
  /** video decodes with OffthreadVideo; image uses Img. */
  kind?: "video" | "image";
  /** The source's real pixel size. Required: the geometry is wrong without it. */
  source: { width: number; height: number };
  mode?: ReframeMode;
  /** 0..1. In "crop", which part of the source survives. */
  focalX?: number;
  focalY?: number;
  /** Frames into the source, for video. */
  trimBefore?: number;
  /** Behind the fitted copy: a blurred self-fill, or a flat colour. */
  backdrop?: "blur" | "color";
  backdropColor?: string;
  /** Blur radius as a fraction of the frame's shorter side. */
  blurAmount?: number;
  /** Darkening applied to the backdrop so the foreground stays dominant. */
  backdropBrightness?: number;
};

export const ReframedMedia: React.FC<ReframedMediaProps> = ({
  src,
  kind = "video",
  source,
  mode = "fit",
  focalX = 0.5,
  focalY = 0.5,
  trimBefore,
  backdrop = "blur",
  backdropColor = "#05070c",
  blurAmount = 0.05,
  backdropBrightness = 0.4,
}) => {
  const { width, height } = useVideoConfig();
  const g = reframeGeometry(width, height, source.width, source.height, mode, focalX, focalY);

  const media = (extra: React.CSSProperties, muted: boolean) =>
    kind === "video" ? (
      <OffthreadVideo
        src={src}
        muted={muted}
        trimBefore={trimBefore && trimBefore > 0 ? trimBefore : undefined}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...extra }}
      />
    ) : (
      <Img
        src={src}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...extra }}
      />
    );

  const blurPx = Math.round(Math.min(width, height) * blurAmount);

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: backdropColor }}>
      {/* Backdrop, only meaningful in "fit" where bands exist. Muted: the foreground copy carries
          the audio, and two copies of the same track comb-filter. */}
      {mode === "fit" && backdrop === "blur" ? (
        <AbsoluteFill>
          {media({ filter: `blur(${blurPx}px) brightness(${backdropBrightness})`, transform: "scale(1.25)" }, true)}
        </AbsoluteFill>
      ) : null}

      {/* Foreground. */}
      <div
        style={{
          position: "absolute",
          left: g.offsetX,
          top: g.offsetY,
          width: g.contentWidth,
          height: g.contentHeight,
          overflow: "hidden",
        }}
      >
        {media({}, false)}
      </div>
    </AbsoluteFill>
  );
};
