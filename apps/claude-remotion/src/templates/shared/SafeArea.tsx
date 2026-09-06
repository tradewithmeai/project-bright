// SafeArea — where it is safe to put words in a vertical video.
//
// A 9:16 short is not watched on a clean canvas. The player draws its own interface over the top:
// a status bar and back arrow near the top, and near the bottom a caption, a handle, a row of
// action buttons and a progress bar. Anything you place there is either covered or fighting for
// attention with a follow button.
//
// So a vertical composition has TWO canvases, and confusing them is the classic mistake:
//
//   the VISUAL canvas    the whole frame. Footage, colour and motion fill it. Nothing is lost —
//                        the platform draws over it, it does not crop it.
//   the READABLE canvas  the sub-rectangle where text can be trusted to be seen. Every caption,
//                        title and call to action belongs inside it.
//
// ── Why fractions, not pixels ─────────────────────────────────────────────────────────────────
//
// The obstruction zones are expressed as fractions of the composition, never as pixel constants
// for 1080x1920. Platforms ship 1080x1920 today and something else tomorrow, and the same advert
// is often rendered at 720x1280 for a smaller upload. A fraction survives both.
//
// ── Why these numbers ─────────────────────────────────────────────────────────────────────────
//
// They are deliberately generous, and they are not any one platform's current measurements. Each
// vendor moves its interface without notice, so a layout tuned to one app's exact chrome is
// correct for one release. These reserve roughly the top eighth and the bottom quarter, which is
// where every major short-form player puts its controls. Override them if you have measured the
// specific surface you are publishing to.

import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";

export type SafeAreaSpec = {
  /** Fraction of height reserved at the top for status bars and back controls. */
  top: number;
  /** Fraction of height reserved at the bottom for captions, handles and action buttons. */
  bottom: number;
  /** Fraction of width kept clear at each side. */
  side: number;
};

/** Reserves the top eighth and bottom quarter. Generous on purpose. */
export const DEFAULT_SAFE: SafeAreaSpec = { top: 0.12, bottom: 0.24, side: 0.06 };

/** For a landscape or square composition, where platform chrome is not the constraint. */
export const LANDSCAPE_SAFE: SafeAreaSpec = { top: 0.06, bottom: 0.08, side: 0.05 };

export type SafeRect = {
  /** Pixel bounds of the readable region. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The same bounds as CSS insets, for positioning a child directly. */
  insets: { top: number; right: number; bottom: number; left: number };
};

/**
 * The readable rectangle in pixels, for a composition of the given size.
 *
 * Exported as a plain function so a test can assert a caption's bounds without rendering, and so
 * a layout can compute a position from the same numbers the guides draw.
 */
export function safeRect(
  width: number,
  height: number,
  spec: SafeAreaSpec = DEFAULT_SAFE
): SafeRect {
  const top = Math.round(height * spec.top);
  const bottom = Math.round(height * spec.bottom);
  const side = Math.round(width * spec.side);
  return {
    x: side,
    y: top,
    width: width - side * 2,
    height: height - top - bottom,
    insets: { top, right: side, bottom, left: side },
  };
}

/** The readable rectangle for the current composition. */
export function useSafeRect(spec: SafeAreaSpec = DEFAULT_SAFE): SafeRect {
  const { width, height } = useVideoConfig();
  return safeRect(width, height, spec);
}

/**
 * Lays its children out inside the readable rectangle.
 *
 * Use it for anything that must be READ. Footage and colour should sit outside it, filling the
 * whole frame — a video letterboxed into the safe area wastes the screen.
 */
export const SafeLayer: React.FC<{
  spec?: SafeAreaSpec;
  /** Where children sit within the readable region. */
  align?: "top" | "center" | "bottom";
  children?: React.ReactNode;
}> = ({ spec = DEFAULT_SAFE, align = "center", children }) => {
  const r = useSafeRect(spec);
  return (
    <AbsoluteFill
      style={{
        left: r.insets.left,
        right: r.insets.right,
        top: r.insets.top,
        bottom: r.insets.bottom,
        width: undefined,
        height: undefined,
        display: "flex",
        flexDirection: "column",
        justifyContent:
          align === "top" ? "flex-start" : align === "bottom" ? "flex-end" : "center",
        alignItems: "center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/**
 * Draws the reserved zones, for checking a layout.
 *
 * ⚠️ A development aid. It is never enabled by default and must not ship enabled — pass
 * `--props='{"showSafeGuides":true}'` to see it. Its whole value is that a title creeping into the
 * bottom quarter is obvious on screen instead of being discovered after publishing.
 */
export const SafeAreaGuides: React.FC<{ spec?: SafeAreaSpec; color?: string }> = ({
  spec = DEFAULT_SAFE,
  color = "#ff2d55",
}) => {
  const { width, height } = useVideoConfig();
  const r = safeRect(width, height, spec);
  const label = (text: string, top: number) => (
    <div
      style={{
        position: "absolute",
        left: 8,
        top,
        color,
        fontFamily: "'Cascadia Mono', Consolas, monospace",
        fontSize: Math.round(height * 0.016),
        opacity: 0.9,
      }}
    >
      {text}
    </div>
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: r.insets.top, background: `${color}22` }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: r.insets.bottom, background: `${color}22` }} />
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: r.insets.left, background: `${color}18` }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: r.insets.right, background: `${color}18` }} />
      <div
        style={{
          position: "absolute",
          left: r.x,
          top: r.y,
          width: r.width,
          height: r.height,
          border: `2px dashed ${color}`,
        }}
      />
      {label(`reserved top ${Math.round(spec.top * 100)}%`, 6)}
      {label(`readable ${r.width}x${r.height}`, r.y + 6)}
      {label(`reserved bottom ${Math.round(spec.bottom * 100)}%`, height - r.insets.bottom + 6)}
    </AbsoluteFill>
  );
};
