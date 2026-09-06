// The part renderers, plus the one thing that makes this template what it is: the rail.
//
// ── The rail is the template ──────────────────────────────────────────────────────────────────
//
// A SlotShort shows one slot at a time and the viewer has no idea how many are left. That is
// correct there, because the order is editorial. Here the order carries meaning, so the SEQUENCE
// has to be on screen — not just the current step. The rail is a persistent strip of pips, one per
// numbered step, filled as the sequence advances. It answers "where am I and how much is left"
// on every frame, which is the question a process video is actually asked.
//
// ⚠️ The rail is mounted ONCE at the composition root, outside every <Sequence>, and reads the
// ABSOLUTE frame. Mounting it per part would restart its animation on each cut and it would read
// as decoration on each card rather than as one continuous progress through one process.
//
// Everything else follows the house shape: content arrives over ENTRY frames, sits still for the
// hold, and leaves over EXIT frames. All motion is a pure function of useCurrentFrame().

import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandMark, DEFAULT_BRAND_THEME, type Brand, type BrandTheme } from "../shared/BrandTokens";
import { FootageClip } from "../shared/FootageClip";
import { FittedPhoto } from "../shared/PhotoFit";
import type { CompiledPart, Step } from "./plan";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const ENTRY = 12;
export const EXIT = 8;

/**
 * Where a step's text column starts, as a fraction of the frame's width.
 *
 * One constant shared by every step, which is the point — see the note in StepView.
 */
export const COLUMN_LEFT_FRACTION = 0.115;

/** 0 while entering, 1 through the hold, back to 0 on the way out. */
export function phase(frame: number, durationInFrames: number): number {
  const inT = interpolate(frame, [0, ENTRY], [0, 1], { easing: EASE, ...CLAMP });
  const outT = interpolate(frame, [durationInFrames - EXIT, durationInFrames], [1, 0], {
    easing: EASE,
    ...CLAMP,
  });
  return Math.min(inT, outT);
}

export type PartCommon = {
  brand: Brand;
  theme: BrandTheme;
  durationInFrames: number;
};

/**
 * The ground, shared by every part.
 *
 * One background across the whole sequence is what makes the steps read as stages of one process
 * rather than as separate cards. The wash drifts slowly so a held step is never a frozen frame.
 */
export const Ground: React.FC<{
  brand: Brand;
  theme: BrandTheme;
  children?: React.ReactNode;
}> = ({ brand, theme, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drift = 46 + 7 * Math.sin((frame / (fps * 11)) * Math.PI * 2);
  return (
    <AbsoluteFill style={{ background: theme.background }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 74% 58% at ${drift}% 40%, ${brand.accent}1a 0%, transparent 70%)`,
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

// ── Context ───────────────────────────────────────────────────────────────────────────────────

export const ContextView: React.FC<
  PartCommon & { title: string; subtitle?: string }
> = ({ brand, theme, durationInFrames, title, subtitle }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = phase(frame, durationInFrames);
  const unit = Math.min(width, height);

  return (
    <Ground brand={brand} theme={theme}>
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: Math.round(unit * 0.045),
          padding: `0 ${Math.round(width * 0.1)}px`,
          opacity: t,
          transform: `translateY(${((1 - t) * unit * 0.02).toFixed(2)}px)`,
        }}
      >
        <BrandMark brand={brand} theme={theme} size={0.075} />
        <div
          style={{
            fontFamily: theme.font,
            fontWeight: 800,
            fontSize: Math.round(unit * 0.085),
            lineHeight: 1.08,
            letterSpacing: -1.5,
            color: theme.text,
            textAlign: "center",
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              fontFamily: theme.font,
              fontSize: Math.round(unit * 0.032),
              lineHeight: 1.4,
              color: theme.muted,
              textAlign: "center",
              maxWidth: Math.round(width * 0.62),
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </AbsoluteFill>
    </Ground>
  );
};

// ── A numbered step ───────────────────────────────────────────────────────────────────────────

/**
 * The media pane, when a step has one.
 *
 * ⚠️ Footage CUTS in — it is not faded up with the text. A full-frame-ish moving picture rising
 * from the ground reads as a dropped frame on the boundary; the surrounding pane is what carries
 * the entry instead. Stills may fade, because a still at 20% opacity still reads as a picture.
 */
const MediaPane: React.FC<{
  media: NonNullable<Step["media"]>;
  durationInFrames: number;
  accent: string;
  t: number;
}> = ({ media, durationInFrames, accent, t }) => {
  const { width, height } = useVideoConfig();
  const unit = Math.min(width, height);
  return (
    <div
      style={{
        position: "relative",
        width: Math.round(width * 0.34),
        height: Math.round(height * 0.52),
        borderRadius: Math.round(unit * 0.02),
        overflow: "hidden",
        border: `2px solid ${accent}44`,
        boxShadow: `0 24px 70px rgba(0,0,0,0.55)`,
        // The PANE scales and fades; the picture inside it does not.
        opacity: Math.min(1, t * 1.6),
        transform: `scale(${(0.965 + 0.035 * t).toFixed(4)})`,
        flexShrink: 0,
        marginLeft: "auto",
      }}
    >
      {media.kind === "footage" ? (
        <FootageClip src={media.src} trimBefore={media.trimBefore} fit={media.fit ?? "cover"} />
      ) : (
        <FittedPhoto src={media.src} durationInFrames={durationInFrames} zoom={[1.02, 1.08]} />
      )}
    </div>
  );
};

export const StepView: React.FC<
  PartCommon & { step: Step; number: number; total: number }
> = ({ brand, theme, durationInFrames, step, number, total }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = phase(frame, durationInFrames);
  const unit = Math.min(width, height);

  // The number counts in slightly ahead of its label, so the eye reads "step three" and then what
  // step three is, rather than meeting both at once.
  const nT = interpolate(frame, [0, 9], [0, 1], { easing: EASE, ...CLAMP });

  return (
    <Ground brand={brand} theme={theme}>
      {/* ⚠️ The text column is PINNED to a fixed left edge, and its width is fixed too — it is not
          centred and it does not shrink to its content. Centring was the first attempt, and on
          screen the label's left edge landed at three different x positions across three
          consecutive steps, because each step's text is a different length. In a sequence whose
          whole point is that the parts are one process, the eye then re-hunts the label on every
          cut. A step with media and a step without now start at the same pixel. */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: Math.round(width * 0.05),
          padding: `0 ${Math.round(width * 0.075)}px ${Math.round(height * 0.09)}px ${Math.round(COLUMN_LEFT_FRACTION * width)}px`,
        }}
      >
        <div style={{ width: Math.round(width * (step.media ? 0.38 : 0.6)), flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: Math.round(unit * 0.022),
              opacity: nT,
              transform: `translateX(${((1 - nT) * -unit * 0.02).toFixed(2)}px)`,
            }}
          >
            <div
              style={{
                fontFamily: theme.mono,
                fontWeight: 700,
                fontSize: Math.round(unit * 0.11),
                lineHeight: 1,
                color: brand.accent,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {number}
            </div>
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: Math.round(unit * 0.026),
                color: theme.muted,
                letterSpacing: 1,
              }}
            >
              of {total}
            </div>
          </div>

          <div
            style={{
              marginTop: Math.round(unit * 0.02),
              fontFamily: theme.font,
              fontWeight: 800,
              fontSize: Math.round(unit * 0.062),
              lineHeight: 1.1,
              letterSpacing: -1,
              color: theme.text,
              opacity: t,
              transform: `translateY(${((1 - t) * unit * 0.018).toFixed(2)}px)`,
            }}
          >
            {step.label}
          </div>

          {step.body ? (
            <div
              style={{
                marginTop: Math.round(unit * 0.022),
                fontFamily: theme.font,
                fontSize: Math.round(unit * 0.03),
                lineHeight: 1.45,
                color: theme.muted,
                opacity: t,
              }}
            >
              {step.body}
            </div>
          ) : null}
        </div>

        {step.media ? (
          <MediaPane
            media={step.media}
            durationInFrames={durationInFrames}
            accent={brand.accent}
            t={t}
          />
        ) : null}
      </AbsoluteFill>
    </Ground>
  );
};

// ── The result ────────────────────────────────────────────────────────────────────────────────

/**
 * The outcome of the sequence.
 *
 * Deliberately NOT numbered — see plan.ts. It is what the steps produced, and giving it a number
 * invites the viewer to look for a step after it. It gets the accent rule and the larger type so
 * the difference is visible rather than merely stated in a comment.
 */
export const ResultView: React.FC<PartCommon & { step: Step }> = ({
  brand,
  theme,
  durationInFrames,
  step,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = phase(frame, durationInFrames);
  const unit = Math.min(width, height);
  const rule = interpolate(frame, [4, 22], [0, 1], { easing: EASE, ...CLAMP });

  return (
    <Ground brand={brand} theme={theme}>
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: Math.round(unit * 0.03),
          padding: `0 ${Math.round(width * 0.1)}px ${Math.round(height * 0.08)}px`,
        }}
      >
        <div
          style={{
            width: Math.round(width * 0.16 * rule),
            height: Math.max(2, Math.round(unit * 0.005)),
            borderRadius: 999,
            background: brand.accent2
              ? `linear-gradient(90deg, ${brand.accent}, ${brand.accent2})`
              : brand.accent,
          }}
        />
        <div
          style={{
            fontFamily: theme.font,
            fontWeight: 800,
            fontSize: Math.round(unit * 0.078),
            lineHeight: 1.1,
            letterSpacing: -1.5,
            color: theme.text,
            textAlign: "center",
            maxWidth: Math.round(width * 0.72),
            opacity: t,
            transform: `scale(${(0.985 + 0.015 * t).toFixed(4)})`,
          }}
        >
          {step.label}
        </div>
        {step.body ? (
          <div
            style={{
              fontFamily: theme.font,
              fontSize: Math.round(unit * 0.03),
              lineHeight: 1.45,
              color: theme.muted,
              textAlign: "center",
              maxWidth: Math.round(width * 0.58),
              opacity: t,
            }}
          >
            {step.body}
          </div>
        ) : null}
      </AbsoluteFill>
    </Ground>
  );
};

// ── Close ─────────────────────────────────────────────────────────────────────────────────────

export const CloseView: React.FC<
  PartCommon & { title: string; detail?: string }
> = ({ brand, theme, durationInFrames, title, detail }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = phase(frame, durationInFrames);
  const unit = Math.min(width, height);

  return (
    <Ground brand={brand} theme={theme}>
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: Math.round(unit * 0.035),
          padding: `0 ${Math.round(width * 0.1)}px ${Math.round(height * 0.08)}px`,
          opacity: t,
        }}
      >
        <div
          style={{
            fontFamily: theme.font,
            fontWeight: 800,
            fontSize: Math.round(unit * 0.062),
            lineHeight: 1.1,
            letterSpacing: -1,
            color: theme.text,
            textAlign: "center",
          }}
        >
          {title}
        </div>
        {detail ? (
          <div
            style={{
              fontFamily: theme.mono,
              fontSize: Math.round(unit * 0.028),
              color: brand.accent,
              textAlign: "center",
            }}
          >
            {detail}
          </div>
        ) : null}
        <div style={{ marginTop: Math.round(unit * 0.02), opacity: 0.85 }}>
          <BrandMark brand={brand} theme={theme} size={0.05} />
        </div>
      </AbsoluteFill>
    </Ground>
  );
};

// ── The rail ──────────────────────────────────────────────────────────────────────────────────

/**
 * How far through the numbered steps the sequence is, at an ABSOLUTE frame.
 *
 * Returns a continuous position in [0, total]: 0 before step 1 starts, 1.5 halfway through step 2,
 * total once the last step has finished. Continuous rather than an integer index because a pip that
 * jumps on the cut reads as a slideshow counter, while a pip that fills across the step reads as
 * progress through a process.
 *
 * Exported so a check can assert the arithmetic without rendering: it must be monotonic, start at
 * 0 and end at exactly `total`.
 */
export function railPosition(parts: CompiledPart[], frame: number): number {
  let done = 0;
  for (const p of parts) {
    if (p.part.kind !== "step" || p.part.number == null) continue;
    if (frame >= p.from + p.durationInFrames) {
      done += 1;
      continue;
    }
    if (frame < p.from) return done;
    return done + (frame - p.from) / p.durationInFrames;
  }
  return done;
}

/**
 * The persistent progress rail: one pip per numbered step, filled as the sequence advances.
 *
 * ⚠️ Mount this ONCE at the root, outside every <Sequence>. It reads the absolute frame on purpose.
 */
export const StepRail: React.FC<{
  parts: CompiledPart[];
  total: number;
  brand: Brand;
  theme?: BrandTheme;
}> = ({ parts, total, brand, theme = DEFAULT_BRAND_THEME }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const unit = Math.min(width, height);
  const pos = railPosition(parts, frame);

  // The rail exists from frame 0 (an empty rail says "three steps, none done yet"), but the
  // counter must not name a step before that step is on screen.
  const firstStep = parts.find((p) => p.part.kind === "step" && p.part.number != null);
  const started = firstStep != null && frame >= firstStep.from;

  const pipW = Math.round(width * 0.09);
  const pipH = Math.max(3, Math.round(unit * 0.007));
  const gap = Math.round(unit * 0.018);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: Math.round(height * 0.075),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: Math.round(unit * 0.016),
        }}
      >
        <div style={{ display: "flex", gap }}>
          {Array.from({ length: total }, (_, i) => {
            // Each pip owns one unit of the position. Clamped, so a pip is empty, filling, or full.
            const fill = Math.max(0, Math.min(1, pos - i));
            return (
              <div
                key={i}
                style={{
                  width: pipW,
                  height: pipH,
                  borderRadius: 999,
                  background: `${theme.text}22`,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(fill * 100).toFixed(2)}%`,
                    height: "100%",
                    background: brand.accent,
                  }}
                />
              </div>
            );
          })}
        </div>
        {/* ⚠️ The counter is HIDDEN until step 1 is actually on screen. The first version read
            "1 / 3" throughout the opening context — a step that had not started yet, announced
            beside three empty pips. A rail that reports a step the viewer cannot see is worse
            than no rail. */}
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: Math.round(unit * 0.02),
            letterSpacing: 2,
            color: theme.muted,
            fontVariantNumeric: "tabular-nums",
            opacity: started ? 1 : 0,
          }}
        >
          {Math.min(total, Math.floor(pos) + 1)} / {total}
        </div>
      </div>
    </AbsoluteFill>
  );
};
