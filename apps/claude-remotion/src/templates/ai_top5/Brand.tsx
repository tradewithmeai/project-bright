import { useCurrentFrame } from "remotion";
import { FONT_BUBBLE, BRAND_ACCENT, RANK_ACCENT } from "./tokens";

// ── THE LOCKED WORDMARK (design bible §6.1) ────────────────────────────────────
// ONE brand lockup, extracted VERBATIM from ColdOpen's original "AI TOP 5" title
// block, re-imported by ColdOpen AND SignOff so the ident can never drift.
// The "5" is the logo hero: its own span, slightly larger, in the #1 hot accent —
// the countdown's destination baked into the logo itself.
//
// Callers own their card's entrance animation (opacity / scale / glow envelope)
// and pass the glow ENVELOPE (0→1 ramp); the Wordmark owns the continuous sine
// glow-pulse so the breathing is identical everywhere the lockup appears.

// Glow recipe (verbatim from ColdOpen): 0 0 50*glow px accent + 0 0 110*glow px accent55
const GLOW_PRIMARY_RADIUS = 50; // px at glow=1 — hot inner halo
const GLOW_SECONDARY_RADIUS = 110; // px at glow=1 — soft outer bloom (accent @ 55 alpha)

// Sine glow-pulse (verbatim from ColdOpen): pulse = 0.7 + 0.3 * sin(frame / 9)
const GLOW_PULSE_BASE = 0.7; // pulse floor — the glow never fully dies
const GLOW_PULSE_DEPTH = 0.3; // pulse swing above the floor
const GLOW_PULSE_PERIOD_FRAMES = 9; // sine divisor — deterministic, never clock/random

// Lockup metrics (verbatim from ColdOpen)
const WORDMARK_LETTER_SPACING = 8;
const WORDMARK_DEFAULT_SIZE = 168; // ColdOpen hero size; SignOff passes its own
const HERO_FIVE_SCALE = 1.12; // the "5" is the logo hero — always a step bigger
const HERO_FIVE_COLOR = RANK_ACCENT[1]; // hot magenta-pink — the chart-topper colour

type WordmarkProps = {
  /** Glow envelope 0→1 (the card's ramp-in); the sine pulse is applied inside. */
  glow: number;
  /** Ident accent — defaults to the signature BRAND_ACCENT cyan. */
  accent?: string;
  /** Base font size in px; the hero "5" scales from this. */
  fontSize?: number;
};

export function Wordmark({
  glow,
  accent = BRAND_ACCENT,
  fontSize = WORDMARK_DEFAULT_SIZE,
}: WordmarkProps) {
  const frame = useCurrentFrame();

  // Continuous brand breathing — deterministic sine, locked here for every card
  const pulse =
    GLOW_PULSE_BASE + GLOW_PULSE_DEPTH * Math.sin(frame / GLOW_PULSE_PERIOD_FRAMES);
  const g = glow * pulse;

  return (
    <div
      style={{
        fontFamily: FONT_BUBBLE,
        fontSize,
        fontWeight: 700,
        color: accent,
        letterSpacing: WORDMARK_LETTER_SPACING,
        lineHeight: 1,
        textShadow: `0 0 ${GLOW_PRIMARY_RADIUS * g}px ${accent}, 0 0 ${GLOW_SECONDARY_RADIUS * g}px ${accent}55`,
        userSelect: "none",
        display: "flex",
        alignItems: "baseline",
        whiteSpace: "pre",
      }}
    >
      AI TOP{" "}
      <span
        style={{
          display: "inline-block",
          fontSize: fontSize * HERO_FIVE_SCALE,
          color: HERO_FIVE_COLOR,
          textShadow: `0 0 ${GLOW_PRIMARY_RADIUS * g}px ${HERO_FIVE_COLOR}, 0 0 ${GLOW_SECONDARY_RADIUS * g}px ${HERO_FIVE_COLOR}55`,
        }}
      >
        5
      </span>
    </div>
  );
}
