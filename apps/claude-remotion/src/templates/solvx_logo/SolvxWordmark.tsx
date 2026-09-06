import React from "react";
import { loadFont } from "@remotion/google-fonts/Fredoka";

// Fredoka = the rounded geometric face the solvx.uk wordmark is set in.
// Loaded as a webfont → the mark is vector-crisp at ANY size (no blocky raster).
const { fontFamily } = loadFont();
export const SOLVX_FONT = fontFamily;

/**
 * A recolourable style for the ONE solvx.uk wordmark. Every historical logo
 * variant is just a preset of this — colour is a prop, so it changes at will.
 *  - body:      the letters' colour (solid)
 *  - dot:       the "." colour, independent of the body (defaults to body)
 *  - gradient:  2–3 stops → the body becomes a gradient (overrides body)
 *  - fill:false → outline-only wordmark (transparent fill + stroke)
 *  - outline:   stroke colour; outlineWidth is a RATIO of font size (resolution-independent)
 *  - glow:      neon halo colour (text-shadow)
 */
export type SolvxStyle = {
  id?: string;
  label?: string;
  bg?: "light" | "dark" | "both";
  weight?: number; // Fredoka 300–700
  body?: string;
  dot?: string;
  gradient?: string[];
  gradientAngle?: number;
  fill?: boolean;
  outline?: string;
  outlineWidth?: number; // ratio of font size (e.g. 0.05)
  glow?: string;
  letterSpacing?: number; // ratio of font size
};

export const SolvxWordmark: React.FC<{ size: number; style?: SolvxStyle }> = ({
  size,
  style = {},
}) => {
  const {
    weight = 500,
    body = "#141414",
    dot,
    gradient,
    gradientAngle = 20,
    fill = true,
    outline,
    outlineWidth = 0.035,
    glow,
    letterSpacing = -0.01,
  } = style;

  const usesGradient = !!gradient && gradient.length >= 2;
  const strokePx = outline ? Math.max(0.6, outlineWidth * size) : 0;
  const bodyColor = fill === false ? "transparent" : body;

  const container: React.CSSProperties = {
    fontFamily,
    fontWeight: weight,
    fontSize: size,
    lineHeight: 1,
    letterSpacing: letterSpacing * size,
    WebkitTextStroke: strokePx ? `${strokePx}px ${outline}` : undefined,
    textShadow: glow
      ? `0 0 ${size * 0.12}px ${glow}, 0 0 ${size * 0.26}px ${glow}cc, 0 0 ${size * 0.5}px ${glow}77`
      : undefined,
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "baseline",
    // font-smoothing keeps thin strokes crisp
    WebkitFontSmoothing: "antialiased",
  };

  const gradientCss = usesGradient
    ? `linear-gradient(${gradientAngle}deg, ${gradient!.join(", ")})`
    : undefined;

  const bodySpan: React.CSSProperties = usesGradient
    ? {
        backgroundImage: gradientCss,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
      }
    : { color: bodyColor, WebkitTextFillColor: bodyColor };

  const dotSpan: React.CSSProperties = dot
    ? { color: dot, WebkitTextFillColor: dot }
    : bodySpan;

  return (
    <div style={container}>
      <span style={bodySpan}>solvx</span>
      <span style={dotSpan}>.</span>
      <span style={bodySpan}>uk</span>
    </div>
  );
};
