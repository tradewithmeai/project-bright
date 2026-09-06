// BrandTokens — the small set of things a template needs to know about a brand.
//
// Deliberately five fields. A branding contract grows without limit if you let it, and every extra
// field is one more thing a new user has to supply before anything renders.
//
// ⚠️ The logo is OPTIONAL, and that is load-bearing. The slot-era implementation this replaces
// took `logoSrc: string` as required, so the default template could not render until someone
// supplied a PNG. `BrandMark` falls back to a wordmark drawn from the brand name — vector, no
// asset, correct at any size — so a clean clone renders on the first try and the logo is an
// upgrade rather than a prerequisite.

import React from "react";
import { Img, useVideoConfig } from "remotion";

export type Brand = {
  name: string;
  /** Primary accent. Used for rules, glows and emphasis. */
  accent: string;
  /** Optional second accent, for a gradient or a secondary mark. */
  accent2?: string;
  /** Optional handle or tagline, e.g. "@example" or "Ships on Fridays". */
  handle?: string;
  /** Optional logo. Pass staticFile("..."). Absent is fine and fully supported. */
  logoSrc?: string;
};

export type BrandTheme = {
  background: string;
  text: string;
  muted: string;
  panel: string;
  /** A system stack, so a clean clone renders without downloading a font. */
  font: string;
  /** For figures and codes, where digits should line up. */
  mono: string;
};

export const DEFAULT_BRAND_THEME: BrandTheme = {
  background: "#080d16",
  text: "#e8edf5",
  muted: "#8ea0b8",
  panel: "rgba(9,17,29,0.78)",
  font: "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
  mono: "'Cascadia Mono', Consolas, ui-monospace, monospace",
};

/**
 * The brand's mark: the supplied logo if there is one, otherwise a wordmark drawn from the name.
 *
 * The fallback is not a placeholder box. It is a real wordmark — the initial in an accent tile
 * beside the name — so a template with no logo still looks deliberate rather than unfinished.
 */
export const BrandMark: React.FC<{
  brand: Brand;
  theme?: BrandTheme;
  /** Mark height as a fraction of the composition's shorter side. */
  size?: number;
  /** Show the name beside the tile. Off for a tight corner mark. */
  showName?: boolean;
  align?: "left" | "center";
}> = ({ brand, theme = DEFAULT_BRAND_THEME, size = 0.12, showName = true, align = "center" }) => {
  const { width, height } = useVideoConfig();
  const h = Math.round(Math.min(width, height) * size);

  if (brand.logoSrc) {
    return (
      <Img
        src={brand.logoSrc}
        style={{ height: h, width: "auto", display: "block", objectFit: "contain" }}
      />
    );
  }

  const initial = brand.name.trim().charAt(0).toUpperCase() || "•";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: align === "center" ? "center" : "flex-start",
        gap: Math.round(h * 0.28),
      }}
    >
      <div
        style={{
          width: h,
          height: h,
          borderRadius: Math.round(h * 0.24),
          background: brand.accent2
            ? `linear-gradient(135deg, ${brand.accent}, ${brand.accent2})`
            : brand.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.background,
          fontFamily: theme.font,
          fontWeight: 800,
          fontSize: Math.round(h * 0.58),
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {initial}
      </div>
      {showName ? (
        <div
          style={{
            fontFamily: theme.font,
            fontWeight: 700,
            fontSize: Math.round(h * 0.5),
            color: theme.text,
            letterSpacing: -0.5,
            whiteSpace: "nowrap",
          }}
        >
          {brand.name}
        </div>
      ) : null}
    </div>
  );
};
