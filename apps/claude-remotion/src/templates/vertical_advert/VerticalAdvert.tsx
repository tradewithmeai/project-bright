// VerticalAdvert — a short-form social advert, laid out for a screen with an interface over it.
//
//   hook -> content beats -> captions inside the safe area -> CTA close
//
// Two layers, and the separation is the whole point:
//
//   the VISUAL layer    footage, reframed to fill the frame. Uses the whole canvas.
//   the READABLE layer  headlines, captions and the CTA. Confined to the safe rectangle.
//
// A viewer never sees the visual layer cropped by the player — the player draws OVER it. What the
// player does cover is text, which is why the readable layer is smaller than the frame.

import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from "remotion";
import { BrandMark, DEFAULT_BRAND_THEME } from "../shared/BrandTokens";
import { ImpactFlash } from "../shared/FootageClip";
import { BeatHit } from "../shared/FootageLayout";
import { ReframedMedia } from "../shared/ReframedMedia";
import { SafeAreaGuides, SafeLayer, useSafeRect } from "../shared/SafeArea";
import {
  ADVERT,
  BRAND,
  CLIPS,
  FORMAT_POLICY,
  FORMAT_SIZE,
  FPS,
  VERTICAL_ADVERT_FRAMES,
  type Format,
} from "./plan";

export { VERTICAL_ADVERT_FRAMES };

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * The composition's SHAPE is derived from the format prop.
 *
 * ⚠️ There is one registration, not two. The earlier arrangement registered `VerticalAdvert` at
 * 1080x1920 and `VerticalAdvertLandscape` at 1920x1080 — the same component with the same beat
 * sheet, listed twice, with the dimensions typed out by hand in Root.tsx. Two hand-written sizes
 * are two things that can disagree with `FORMAT_SIZE`, and a reader could not tell whether the
 * multi-format claim was real or whether the second entry had simply been configured to match.
 *
 * Deriving the size here makes the claim structural: ask for "16x9" and the composition IS
 * 1920x1080, from the same table the layout policy is keyed on. Render the other format with
 *
 *   npx remotion render VerticalAdvert out/advert-16x9.mp4 --props='{"format":"16x9"}'
 */
export const calculateMetadata: CalculateMetadataFunction<VerticalAdvertProps> = ({ props }) => {
  const size = FORMAT_SIZE[props.format ?? "9x16"];
  return {
    width: size.width,
    height: size.height,
    fps: FPS,
    durationInFrames: VERTICAL_ADVERT_FRAMES,
  };
};

export type VerticalAdvertProps = {
  /** Which layout policy to apply. The beat sheet is the same for both. */
  format?: Format;
  /** Draw the reserved zones. A development aid — never ship it enabled. */
  showSafeGuides?: boolean;
};

/**
 * Entry and exit for a beat's text.
 *
 * ⚠️ The HOOK does not fade out. Fading the opening headline means it is at its least readable on
 * the frames just before the cut — over footage the author does not control, that reads as a hook
 * that never quite landed. It holds at full strength and the cut takes it away, which is what a
 * hook is for. Later beats fade so nothing vanishes on a hard frame.
 */
function textPhase(frame: number, durationInFrames: number, holdToEnd = false): number {
  const inT = interpolate(frame, [0, 7], [0, 1], { easing: EASE, ...CLAMP });
  if (holdToEnd) return inT;
  const outT = interpolate(frame, [durationInFrames - 5, durationInFrames], [1, 0], { ...CLAMP });
  return Math.min(inT, outT);
}

const BeatView: React.FC<{
  compiled: (typeof ADVERT.beats)[number];
  format: Format;
}> = ({ compiled, format }) => {
  const { beat, durationInFrames, hitAt, impactAt } = compiled;
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const policy = FORMAT_POLICY[format];
  const safe = useSafeRect(policy.safe);
  const theme = DEFAULT_BRAND_THEME;
  // The hook is index 0; it holds to the cut rather than fading.
  const t = textPhase(frame, durationInFrames, compiled.index === 0);

  return (
    <AbsoluteFill style={{ background: theme.background }}>
      {/* ── VISUAL: the whole canvas ─────────────────────────────────────────────────────── */}
      {beat.clip ? (
        <ReframedMedia
          src={staticFile(CLIPS[beat.clip.id].src)}
          source={CLIPS[beat.clip.id].size}
          mode={policy.reframe}
          focalX={beat.clip.focalX}
          trimBefore={beat.clip.trimBefore}
        />
      ) : (
        // The CTA beat has no footage: a clean ground so the action is the only thing on screen.
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 70% 50% at 50% 40%, ${BRAND.accent}22 0%, transparent 70%)`,
          }}
        />
      )}

      {/* ⚠️ A scrim under the readable layer. Footage brightness is not under the author's
          control — the same caption sits over a bright frame and a near-black one within a
          second — so contrast has to be guaranteed rather than hoped for. Graded top and bottom
          because that is where the text lives, and left clear through the middle so the picture
          is not dulled. */}
      {beat.headline || beat.caption ? (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(180deg, rgba(5,7,12,0.66) 0%, rgba(5,7,12,0.18) 32%," +
              " rgba(5,7,12,0.18) 62%, rgba(5,7,12,0.72) 100%)",
          }}
        />
      ) : null}

      {impactAt != null ? <ImpactFlash at={impactAt} peak={0.7} /> : null}

      {/* ── READABLE: inside the safe rectangle only ─────────────────────────────────────── */}
      {beat.headline ? (
        <SafeLayer spec={policy.safe} align={beat.cta ? "center" : "top"}>
          <div
            style={{
              fontFamily: theme.font,
              fontWeight: 800,
              fontSize: Math.round(height * 0.062 * policy.headlineScale),
              lineHeight: 1.08,
              color: theme.text,
              textAlign: "center",
              letterSpacing: -1,
              opacity: t,
              transform: `translateY(${((1 - t) * height * 0.015).toFixed(2)}px)`,
              textShadow: "0 4px 30px rgba(0,0,0,0.75)",
              maxWidth: safe.width,
            }}
          >
            {beat.headline}
          </div>
          {beat.cta ? (
            <div
              style={{
                marginTop: Math.round(height * 0.03),
                padding: `${Math.round(height * 0.016)}px ${Math.round(height * 0.03)}px`,
                borderRadius: 999,
                background: BRAND.accent,
                color: theme.background,
                fontFamily: theme.mono,
                fontWeight: 700,
                fontSize: Math.round(height * 0.028 * policy.headlineScale),
                opacity: interpolate(frame, [8, 20], [0, 1], { easing: EASE, ...CLAMP }),
              }}
            >
              {beat.cta.destination}
            </div>
          ) : null}
        </SafeLayer>
      ) : null}

      {beat.caption ? (
        <SafeLayer spec={policy.safe} align={policy.captionAlign}>
          <div
            style={{
              padding: `${Math.round(height * 0.014)}px ${Math.round(height * 0.022)}px`,
              background: theme.panel,
              borderLeft: `4px solid ${BRAND.accent}`,
              borderRadius: 8,
              fontFamily: theme.font,
              fontSize: Math.round(height * 0.028 * policy.headlineScale),
              lineHeight: 1.35,
              color: theme.text,
              textAlign: "center",
              opacity: t,
              maxWidth: safe.width,
            }}
          >
            {beat.caption}
          </div>
        </SafeLayer>
      ) : null}

      {/* A slam for a pattern break. Screen-space, so it stays crisp. */}
      {hitAt != null && beat.hit ? (
        <BeatHit
          cues={[{ text: beat.hit.text, at: hitAt }]}
          accent={BRAND.accent}
          size={0.075 * policy.headlineScale}
        />
      ) : null}
    </AbsoluteFill>
  );
};

export const VerticalAdvert: React.FC<VerticalAdvertProps> = ({
  format = "9x16",
  showSafeGuides = false,
}) => {
  const { fps, width, height } = useVideoConfig();
  const policy = FORMAT_POLICY[format];

  if (fps !== FPS) {
    throw new Error(`VerticalAdvert: the plan is compiled at ${FPS}fps but the composition is ${fps}fps.`);
  }
  if (ADVERT.problems.length > 0) {
    throw new Error(`VerticalAdvert: the plan does not hold together:\n  ${ADVERT.problems.join("\n  ")}`);
  }

  return (
    <AbsoluteFill style={{ background: DEFAULT_BRAND_THEME.background }}>
      {ADVERT.beats.map((c) => (
        <Sequence
          key={c.beat.id}
          from={c.from}
          durationInFrames={c.durationInFrames}
          name={`${c.index + 1}. ${c.beat.id}`}
        >
          <BeatView compiled={c} format={format} />
        </Sequence>
      ))}

      {/* A persistent corner mark, inside the safe area so the player cannot cover it.
          ⚠️ Placing this took two attempts, both caught by looking at frames. Top-left put it
          under a top-aligned headline; bottom-left put it behind a bottom-aligned caption. The
          readable rectangle is contested at BOTH ends, so the mark sits just inside the reserved
          top band — above the readable area entirely, where nothing else is laid out. */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            left: Math.round(width * policy.safe.side),
            top: Math.round(height * policy.safe.top * 0.42),
            opacity: 0.8,
          }}
        >
          <BrandMark brand={BRAND} size={0.03} align="left" />
        </div>
      </AbsoluteFill>

      {showSafeGuides ? <SafeAreaGuides spec={policy.safe} /> : null}
    </AbsoluteFill>
  );
};
