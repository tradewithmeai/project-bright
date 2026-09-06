// The five slot renderers.
//
// Each takes its slot data and the brand, and fills the frame. None of them knows where it sits in
// the timeline: the composition mounts each inside its own <Sequence>, so every slot animates from
// its own frame 0 and can be reordered without touching its code.
//
// ── Entry, hold, exit ─────────────────────────────────────────────────────────────────────────
//
// Every slot follows the same three-phase shape, because that is what makes a sequence of slots
// read as one video rather than a slideshow: content arrives over ENTRY frames, sits still for the
// HOLD, and leaves over EXIT frames. The hold is the part that matters — a slot that is still
// animating when it cuts gives the eye nothing to rest on, and text that never stops moving cannot
// be read.
//
// All motion is a pure function of useCurrentFrame(). No CSS transitions or animations.

import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandMark, DEFAULT_BRAND_THEME, type Brand, type BrandTheme } from "../shared/BrandTokens";
import { FootageClip } from "../shared/FootageClip";
import { FittedPhoto } from "../shared/PhotoFit";
import type { BrandSlot, CtaSlot, FootageSlot, ImageSlot, MessageSlot } from "./plan";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const ENTRY = 12;
export const EXIT = 8;

/** 0 while entering, 1 through the hold, back to 0 on the way out. */
export function phase(frame: number, durationInFrames: number): number {
  const inT = interpolate(frame, [0, ENTRY], [0, 1], { easing: EASE, ...CLAMP });
  const outT = interpolate(frame, [durationInFrames - EXIT, durationInFrames], [1, 0], {
    easing: EASE,
    ...CLAMP,
  });
  return Math.min(inT, outT);
}

type Common = { brand: Brand; theme?: BrandTheme; durationInFrames: number };

/**
 * A quiet ground shared by every slot.
 *
 * One background across all slots is what stops the short reading as a set of unrelated cards.
 * The accent wash drifts slowly so a held slot is never a frozen frame.
 */
const Ground: React.FC<{ brand: Brand; theme: BrandTheme; children?: React.ReactNode }> = ({
  brand,
  theme,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drift = 50 + 8 * Math.sin((frame / (fps * 9)) * Math.PI * 2);
  return (
    <AbsoluteFill style={{ background: theme.background }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 55% at ${drift}% 42%, ${brand.accent}1c 0%, transparent 70%)`,
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

/** A corner mark, so every slot is identifiably the same brand without repeating the full lockup. */
const CornerMark: React.FC<{ brand: Brand; theme: BrandTheme; opacity: number }> = ({
  brand,
  theme,
  opacity,
}) => {
  const { width, height } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: Math.round(Math.min(width, height) * 0.055),
        bottom: Math.round(Math.min(width, height) * 0.055),
        opacity: opacity * 0.75,
      }}
    >
      <BrandMark brand={brand} theme={theme} size={0.045} align="left" />
    </div>
  );
};

// ── brand ─────────────────────────────────────────────────────────────────────────────────────

export const BrandSlotView: React.FC<Common & { slot: BrandSlot }> = ({
  slot,
  brand,
  theme = DEFAULT_BRAND_THEME,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const t = phase(frame, durationInFrames);
  // Intro rises into place; close settles back. The direction carries which end of the video it is.
  const rise = slot.mode === "intro" ? (1 - t) * height * 0.05 : -(1 - t) * height * 0.03;
  const scale = 0.96 + 0.04 * t;

  return (
    <Ground brand={brand} theme={theme}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            opacity: t,
            transform: `translateY(${rise.toFixed(2)}px) scale(${scale.toFixed(4)})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: Math.round(height * 0.035),
          }}
        >
          <BrandMark brand={brand} theme={theme} size={0.13} />
          <div
            style={{
              width: Math.round(height * 0.22 * t),
              height: 3,
              borderRadius: 2,
              background: brand.accent,
            }}
          />
          {slot.tagline ? (
            <div
              style={{
                fontFamily: theme.font,
                fontSize: Math.round(height * 0.032),
                color: theme.muted,
                textAlign: "center",
              }}
            >
              {slot.tagline}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </Ground>
  );
};

// ── message ───────────────────────────────────────────────────────────────────────────────────

export const MessageSlotView: React.FC<Common & { slot: MessageSlot }> = ({
  slot,
  brand,
  theme = DEFAULT_BRAND_THEME,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const t = phase(frame, durationInFrames);
  const isResult = slot.emphasis === "result";

  // The headline arrives slightly before the subtext, so the eye is given an order to read in.
  const headT = interpolate(frame, [0, ENTRY], [0, 1], { easing: EASE, ...CLAMP });
  const subT = interpolate(frame, [ENTRY * 0.6, ENTRY * 1.8], [0, 1], { easing: EASE, ...CLAMP });

  return (
    <Ground brand={brand} theme={theme}>
      <AbsoluteFill
        style={{
          alignItems: "flex-start",
          justifyContent: "center",
          padding: `0 ${Math.round(width * 0.09)}px`,
        }}
      >
        <div style={{ maxWidth: Math.round(width * 0.72), opacity: t }}>
          <div
            style={{
              width: Math.round(width * 0.06 * headT),
              height: 4,
              borderRadius: 2,
              background: brand.accent,
              marginBottom: Math.round(height * 0.03),
            }}
          />
          <div
            style={{
              fontFamily: theme.font,
              fontWeight: isResult ? 800 : 700,
              fontSize: Math.round(height * (isResult ? 0.13 : 0.082)),
              lineHeight: 1.1,
              color: theme.text,
              letterSpacing: -1,
              opacity: headT,
              transform: `translateY(${((1 - headT) * height * 0.02).toFixed(2)}px)`,
              fontVariantNumeric: isResult ? "tabular-nums" : undefined,
            }}
          >
            {slot.headline}
          </div>
          {slot.subtext ? (
            <div
              style={{
                fontFamily: theme.font,
                fontSize: Math.round(height * 0.036),
                lineHeight: 1.4,
                color: theme.muted,
                marginTop: Math.round(height * 0.028),
                opacity: subT,
                transform: `translateY(${((1 - subT) * height * 0.015).toFixed(2)}px)`,
              }}
            >
              {slot.subtext}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
      <CornerMark brand={brand} theme={theme} opacity={t} />
    </Ground>
  );
};

// ── image ─────────────────────────────────────────────────────────────────────────────────────

/**
 * The neutral visual, drawn when a slot supplies no `src`.
 *
 * A still slot should be demonstrable without committing a picture, so the default is generated:
 * concentric accent arcs on the brand ground, moving slowly. It is deliberately abstract — a
 * placeholder that looks like a placeholder is worse than one that looks like a graphic.
 */
const GeneratedVisual: React.FC<{ brand: Brand }> = ({ brand }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const rings = 7;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {Array.from({ length: rings }, (_, i) => {
        const p = i / rings;
        const r = Math.round(Math.min(width, height) * (0.16 + p * 0.42));
        const spin = t * (8 + i * 3) * (i % 2 === 0 ? 1 : -1);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              width: r * 2,
              height: r * 2,
              borderRadius: "50%",
              border: `${Math.max(1, Math.round(height * 0.0035))}px solid ${
                i % 2 === 0 ? brand.accent : (brand.accent2 ?? brand.accent)
              }`,
              opacity: 0.13 + 0.17 * (1 - p),
              transform: `rotate(${spin.toFixed(2)}deg) scaleY(${(0.82 + 0.1 * Math.sin(t + i)).toFixed(3)})`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const ImageSlotView: React.FC<Common & { slot: ImageSlot }> = ({
  slot,
  brand,
  theme = DEFAULT_BRAND_THEME,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const t = phase(frame, durationInFrames);

  return (
    <Ground brand={brand} theme={theme}>
      <AbsoluteFill style={{ opacity: t }}>
        {slot.src ? (
          // FittedPhoto rather than a fourth image-fit implementation: it already handles a source
          // whose aspect does not match the frame, without cropping or letterbox bars.
          <FittedPhoto src={slot.src} durationInFrames={durationInFrames} />
        ) : (
          <GeneratedVisual brand={brand} />
        )}
      </AbsoluteFill>

      {slot.caption ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end" }}>
          <div
            style={{
              // A safe region: the caption never sits closer to the edge than this, so it stays
              // clear of platform chrome and of a crop to a narrower aspect.
              margin: `0 ${Math.round(width * 0.09)}px ${Math.round(height * 0.09)}px`,
              padding: `${Math.round(height * 0.018)}px ${Math.round(width * 0.02)}px`,
              background: theme.panel,
              borderLeft: `4px solid ${brand.accent}`,
              borderRadius: 8,
              fontFamily: theme.font,
              fontSize: Math.round(height * 0.032),
              color: theme.text,
              opacity: t,
              maxWidth: Math.round(width * 0.7),
              textAlign: "center",
            }}
          >
            {slot.caption}
          </div>
        </AbsoluteFill>
      ) : null}
      <CornerMark brand={brand} theme={theme} opacity={t} />
    </Ground>
  );
};

// ── footage ───────────────────────────────────────────────────────────────────────────────────

export const FootageSlotView: React.FC<Common & { slot: FootageSlot }> = ({
  slot,
  brand,
  theme = DEFAULT_BRAND_THEME,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const t = phase(frame, durationInFrames);

  return (
    <AbsoluteFill style={{ background: theme.background }}>
      {/* ⚠️ The footage does NOT fade. Slots do not overlap, so fading a full-frame clip up from
          zero leaves the boundary frame showing bare ground — measured as five near-flat frames
          at this slot's two edges before this was changed. A footage slot CUTS in, which is also
          the right grammar: a dissolve into moving pictures reads as a mistake. Only the caption
          uses the entry/exit phase. */}
      <AbsoluteFill>
        {/* The same FootageClip the promo template uses. A second, weaker video abstraction here
            would be one more place for a fit or determinism bug to live. */}
        <FootageClip src={slot.src} trimBefore={slot.trimBefore} fit={slot.fit ?? "cover"} />
      </AbsoluteFill>

      {slot.caption ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end" }}>
          <div
            style={{
              margin: `0 ${Math.round(width * 0.09)}px ${Math.round(height * 0.09)}px`,
              padding: `${Math.round(height * 0.018)}px ${Math.round(width * 0.02)}px`,
              background: theme.panel,
              borderLeft: `4px solid ${brand.accent}`,
              borderRadius: 8,
              fontFamily: theme.font,
              fontSize: Math.round(height * 0.032),
              color: theme.text,
              opacity: t,
              maxWidth: Math.round(width * 0.7),
              textAlign: "center",
            }}
          >
            {slot.caption}
          </div>
        </AbsoluteFill>
      ) : null}
      <CornerMark brand={brand} theme={theme} opacity={t} />
    </AbsoluteFill>
  );
};

// ── cta ───────────────────────────────────────────────────────────────────────────────────────

export const CtaSlotView: React.FC<Common & { slot: CtaSlot }> = ({
  slot,
  brand,
  theme = DEFAULT_BRAND_THEME,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const t = phase(frame, durationInFrames);
  const pillT = interpolate(frame, [ENTRY * 0.8, ENTRY * 2.2], [0, 1], { easing: EASE, ...CLAMP });

  return (
    <Ground brand={brand} theme={theme}>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          gap: Math.round(height * 0.045),
          opacity: t,
        }}
      >
        <div
          style={{
            fontFamily: theme.font,
            fontWeight: 800,
            fontSize: Math.round(height * 0.075),
            color: theme.text,
            textAlign: "center",
            maxWidth: Math.round(width * 0.74),
            letterSpacing: -0.8,
            lineHeight: 1.12,
          }}
        >
          {slot.headline}
        </div>
        {slot.destination ? (
          <div
            style={{
              opacity: pillT,
              transform: `scale(${(0.94 + 0.06 * pillT).toFixed(4)})`,
              padding: `${Math.round(height * 0.02)}px ${Math.round(width * 0.028)}px`,
              borderRadius: 999,
              background: brand.accent,
              color: theme.background,
              fontFamily: theme.mono,
              fontWeight: 700,
              fontSize: Math.round(height * 0.036),
            }}
          >
            {slot.destination}
          </div>
        ) : null}
      </AbsoluteFill>
    </Ground>
  );
};
