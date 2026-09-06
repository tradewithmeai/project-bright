// VirtualCamera — a guided pan/zoom camera over a captured product interface.
//
// The technique: you do not re-implement a product's UI in code, and you do not film a screen
// recording. You take one high-resolution CAPTURE of the real interface and move a virtual camera
// across it — holding on the feature being explained, gliding to the next. The capture is correct
// by construction, because it came from the real product.
//
// ── The model ─────────────────────────────────────────────────────────────────────────────────
//
// A FocusRegion is where the camera looks:
//
//     { cx: 0.22, cy: 0.35, scale: 1.8 }
//
// cx/cy are FRACTIONS (0..1) of the source, naming the point brought to screen centre. scale 1
// means the whole source fills the frame; 1.8 means zoomed in 1.8x. Fractions rather than pixels
// is what lets a region survive a re-capture at a different resolution.
//
// A CameraMove list is the path. The camera starts at the first region, holds until each move's
// `at` frame, glides over `dur` frames, then holds again. Holds are free: the interpolation is
// clamped at both ends, so "hold, pan, hold" needs no extra keyframes.
//
// ── Two things worth knowing ──────────────────────────────────────────────────────────────────
//
// 1. THE EDGE CLAMP. Push the camera near a corner and the viewport runs off the capture,
//    revealing background. The camera clamps its own centre so the viewport stays inside the
//    source; the feature ends up as near centre as geometry allows rather than perfectly centred
//    with a blank wedge beside it. Pass clampToSource={false} to overshoot deliberately.
//
// 2. DIFFERING SOURCE DIMENSIONS. The capture need not match the composition. Give the source's
//    natural size and pick a fit; with "contain" the clamp tightens to the letterboxed content
//    rect, so the camera will not wander into the bars.
//
// Everything is a pure function of useCurrentFrame(). No CSS transitions or animations — they do
// not render correctly in Remotion (see CLAUDE.md).

import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/** Camera easing: a decelerating glide that settles rather than stopping dead. */
export const CAMERA_EASE = Easing.bezier(0.16, 1, 0.3, 1);

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Where the camera looks. cx/cy are fractions (0..1) of the source; scale 1 = whole source. */
export type FocusRegion = {
  cx: number;
  cy: number;
  scale: number;
};

/** One camera move: glide to `region`, starting at frame `at`, taking `dur` frames. */
export type CameraMove = {
  region: FocusRegion;
  at: number;
  dur: number;
  /**
   * Settle on arrival: a small decaying wobble, in thousandths of scale. 0 disables it.
   * Deterministic — a decaying sine of the frame, not a spring carrying hidden state.
   */
  settle?: number;
};

export type SourceSize = { width: number; height: number };

const lerpRegion = (a: FocusRegion, b: FocusRegion, t: number): FocusRegion => ({
  cx: a.cx + (b.cx - a.cx) * t,
  cy: a.cy + (b.cy - a.cy) * t,
  scale: a.scale + (b.scale - a.scale) * t,
});

/**
 * The rectangle the source actually occupies, in stage fractions.
 *
 * "cover" fills the stage, so it is the whole unit square. "contain" letterboxes, so the content
 * is a centred sub-rect and the camera has to be kept inside it.
 */
export function contentRect(
  source: SourceSize,
  stage: SourceSize,
  fit: "cover" | "contain"
): { x0: number; y0: number; x1: number; y1: number } {
  if (fit === "cover") return { x0: 0, y0: 0, x1: 1, y1: 1 };
  const sourceAspect = source.width / source.height;
  const stageAspect = stage.width / stage.height;
  if (sourceAspect > stageAspect) {
    // Source is relatively wider: it fills the width, leaving bars top and bottom.
    const h = stageAspect / sourceAspect;
    return { x0: 0, y0: (1 - h) / 2, x1: 1, y1: (1 + h) / 2 };
  }
  const w = sourceAspect / stageAspect;
  return { x0: (1 - w) / 2, y0: 0, x1: (1 + w) / 2, y1: 1 };
}

/**
 * Keep the viewport inside the source.
 *
 * At scale s the viewport spans 1/s of the stage, so its half-width is 0.5/s. The centre must sit
 * at least that far from each content edge. If the scale is too low for the viewport to fit —
 * zoomed out past the content — the axis is centred, there being nothing better to do.
 */
export function clampRegion(
  region: FocusRegion,
  source: SourceSize,
  stage: SourceSize,
  fit: "cover" | "contain"
): FocusRegion {
  const { x0, y0, x1, y1 } = contentRect(source, stage, fit);
  const half = 0.5 / region.scale;
  const axis = (v: number, lo: number, hi: number) => {
    const min = lo + half;
    const max = hi - half;
    if (min > max) return (lo + hi) / 2;
    return Math.min(max, Math.max(min, v));
  };
  return {
    cx: axis(region.cx, x0, x1),
    cy: axis(region.cy, y0, y1),
    scale: region.scale,
  };
}

/**
 * Resolve the camera's region at a given frame.
 *
 * Exported so a highlight, a caption or a test can ask "where is the camera now?" without
 * duplicating the timing logic.
 */
export function regionAtFrame(path: CameraMove[], frame: number): FocusRegion {
  if (path.length === 0) return { cx: 0.5, cy: 0.5, scale: 1 };
  let current = path[0].region;
  for (const move of path) {
    const t = interpolate(frame, [move.at, move.at + Math.max(1, move.dur)], [0, 1], {
      easing: CAMERA_EASE,
      ...CLAMP,
    });
    current = lerpRegion(current, move.region, t);
  }
  return current;
}

/** The settle wobble for whichever moves have already landed. Deterministic. */
function settleOffset(path: CameraMove[], frame: number): number {
  let offset = 0;
  for (const move of path) {
    const amount = move.settle ?? 0;
    if (amount <= 0) continue;
    const since = frame - (move.at + move.dur);
    if (since < 0) continue;
    offset += (amount / 1000) * Math.exp(-since / 9) * Math.sin(since / 2.4);
  }
  return offset;
}

export type VirtualCameraProps = {
  /** The camera path. The first move's region is also the opening framing. */
  path: CameraMove[];
  /** The capture's natural pixel size. Defaults to the composition's size. */
  source?: SourceSize;
  /** How the source is fitted to the stage before the camera moves over it. */
  fit?: "cover" | "contain";
  /** Keep the viewport inside the source. Leave on unless you want the edge to show. */
  clampToSource?: boolean;
  /** Colour behind the capture — visible only with fit="contain", or if clamping is off. */
  backgroundColor?: string;
  /**
   * The capture itself, plus anything GLUED to it. Children are laid out in the stage's pixel
   * coordinates and ride the camera, so a callout stays locked to the feature it annotates.
   * Captions belong outside this component, in screen space — see CaptionTrack.
   */
  children?: React.ReactNode;
};

export const VirtualCamera: React.FC<VirtualCameraProps> = ({
  path,
  source,
  fit = "cover",
  clampToSource = true,
  backgroundColor = "#000000",
  children,
}) => {
  const frame = useCurrentFrame();
  const { width: stageW, height: stageH } = useVideoConfig();
  const stage: SourceSize = { width: stageW, height: stageH };
  const src: SourceSize = source ?? stage;

  const raw = regionAtFrame(path, frame);
  const region = clampToSource ? clampRegion(raw, src, stage, fit) : raw;
  const scale = region.scale + settleOffset(path, frame);

  // Map the focal point to screen centre. transformOrigin is the stage's top-left corner, so the
  // translation is "where we want the point" minus "where the scale would put it".
  const tx = stageW / 2 - scale * region.cx * stageW;
  const ty = stageH / 2 - scale * region.cy * stageH;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: stageW,
          height: stageH,
          transformOrigin: "0 0",
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Where a point on the capture currently appears on screen, as a fraction of the frame.
 *
 * Use it to place a screen-space flourish over a feature the camera is looking at: the highlight
 * does not ride the camera, so it stays crisp at any zoom, but still lands on the right pixel.
 */
export function sourcePointToScreen(
  point: { x: number; y: number },
  region: FocusRegion
): { x: number; y: number } {
  return {
    x: 0.5 + region.scale * (point.x - region.cx),
    y: 0.5 + region.scale * (point.y - region.cy),
  };
}

/**
 * Capture — lays content out at the capture's NATIVE size, then fits it to the stage.
 *
 * This is what lets a 2560x1440 capture drive a 1920x1080 composition. The children are
 * positioned in the capture's own pixel coordinates, so a focus region worked out against the
 * original screenshot stays correct, and a callout glued at (1840, 320) means the same thing
 * whatever the composition size.
 *
 * Works the same for a raster screenshot and for a UI drawn in DOM: give it the size the content
 * was authored at, and it fits identically either way.
 */
export const Capture: React.FC<{
  source: SourceSize;
  fit?: "cover" | "contain";
  children?: React.ReactNode;
}> = ({ source, fit = "cover", children }) => {
  const { width: stageW, height: stageH } = useVideoConfig();
  const sx = stageW / source.width;
  const sy = stageH / source.height;
  const k = fit === "cover" ? Math.max(sx, sy) : Math.min(sx, sy);
  const w = source.width * k;
  const h = source.height * k;

  return (
    <div
      style={{
        position: "absolute",
        left: (stageW - w) / 2,
        top: (stageH - h) / 2,
        width: source.width,
        height: source.height,
        transformOrigin: "0 0",
        transform: `scale(${k})`,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
};

/**
 * ImageCapture — the common case: a raster screenshot as the capture.
 *
 * Most walkthroughs point the camera at a PNG of a real product. This wraps <Capture> so you do
 * not have to think about fitting:
 *
 *     <VirtualCamera path={path} source={{ width: 2560, height: 1440 }}>
 *       <ImageCapture src={staticFile("captures/my-product.png")}
 *                     source={{ width: 2560, height: 1440 }} />
 *     </VirtualCamera>
 *
 * Pass the screenshot's REAL pixel size as `source` in both places, so the edge clamp and the fit
 * agree about what they are looking at.
 */
export const ImageCapture: React.FC<{
  src: string;
  source: SourceSize;
  fit?: "cover" | "contain";
}> = ({ src, source, fit = "cover" }) => (
  <Capture source={source} fit={fit}>
    <Img
      src={src}
      style={{ width: source.width, height: source.height, display: "block" }}
    />
  </Capture>
);
