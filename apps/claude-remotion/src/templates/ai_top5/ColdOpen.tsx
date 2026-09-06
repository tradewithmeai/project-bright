import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { TEXT, FONT_BODY, FONT_MONO, EASE, EASE_SPRING, BRAND_ACCENT } from "./tokens";
import { Wordmark } from "./Brand";

// Top-of-the-Pops style intro (replaces the old 5-4-3-2-1 countdown).
// Sized to the spoken intro line ("Annnnd today we've got the rockin', poppin',
// top 5 AI stories just for you!") — energetic, repeatable, ~6.5s.
// Three staged reveals: ROCKIN'·POPPIN' kicker → big AI TOP 5 spring-slam → tagline.

// ⚠️ FRAME 0 MUST ALREADY BE A FINISHED FRAME.
//
// Every element here used to arrive from nothing — the kicker at opacity 0, the title springing
// from scale 0.6 at opacity 0, the tagline later still — so frame 0 was bare background and
// measured 6/255 luminance. That matters more than it sounds: frame 0 is what YouTube offers as
// the default thumbnail and what most players show while a video is paused at the start, so the
// show opened on a black rectangle. This was documented by a vertical spoke composition that has
// since been retired, having hit exactly the same problem on Instagram; the lesson outlives it.
//
// The slam still happens. It starts from something VISIBLE rather than from nothing: the title is
// already on screen at frame 0 at reduced scale and partial opacity, and springs to full.
const ACCENT = BRAND_ACCENT; // signature ident colour (palette single-source, tokens.ts)
const KICKER_START = 0;
const TITLE_START = 0;
const TAGLINE_START = 26;
/** What the title is already showing on frame 0 — never 0. */
const TITLE_FLOOR_OPACITY = 0.55;
const TITLE_FLOOR_SCALE = 0.78;
const TITLE_FONT_SIZE = 168; // cold-open hero size for the locked Wordmark (Brand.tsx)

export function ColdOpen() {
  const frame = useCurrentFrame();

  // Kicker: "★ ROCKIN' · POPPIN' · AI ★" — slides up + fades in
  const kOpacity = interpolate(frame, [KICKER_START, KICKER_START + 12], [0.7, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE,
  });
  const kY = interpolate(frame, [KICKER_START, KICKER_START + 14], [10, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE,
  });

  // Title: SPRING slam-in (overshoot), then a gentle continuous energy pulse
  const titleOpacity = interpolate(frame, [TITLE_START, TITLE_START + 12], [TITLE_FLOOR_OPACITY, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE,
  });
  const titleScale = interpolate(frame, [TITLE_START, TITLE_START + 20], [TITLE_FLOOR_SCALE, 1.0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_SPRING,
  });
  // Glow envelope — the continuous sine glow-pulse lives inside the Wordmark
  const glow = interpolate(frame, [TITLE_START, TITLE_START + 16], [0.5, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Tagline fade-in
  const tagOpacity = interpolate(frame, [TAGLINE_START, TAGLINE_START + 14], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE,
  });

  return (
    <AbsoluteFill
      style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26 }}
    >
      {/* Kicker */}
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: 6,
          color: ACCENT,
          textTransform: "uppercase" as const,
          opacity: kOpacity,
          transform: `translateY(${kY}px)`,
          textShadow: `0 0 18px ${ACCENT}66`,
        }}
      >
        ★ ROCKIN&apos; · POPPIN&apos; ★
      </div>

      {/* Big chart-topper title — spring slam wrapping the locked Wordmark (Brand.tsx) */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
        }}
      >
        <Wordmark glow={glow} accent={ACCENT} fontSize={TITLE_FONT_SIZE} />
      </div>

      {/* Tagline */}
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 30,
          fontWeight: 500,
          color: `${TEXT}cc`,
          letterSpacing: 4,
          textTransform: "uppercase" as const,
          opacity: tagOpacity,
        }}
      >
        today&apos;s biggest AI stories — counted down
      </div>
    </AbsoluteFill>
  );
}
