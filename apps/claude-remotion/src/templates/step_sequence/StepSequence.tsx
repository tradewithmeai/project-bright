// StepSequence — a video where the ORDER of the parts is the information.
//
//   context -> numbered steps -> a result -> a close,  with a rail running underneath the lot
//
// The composition is thin by design: plan.ts decides what the video says, steps.tsx decides how a
// part looks, and this file only places parts on the timeline and mounts the rail.
//
// Each part gets its own <Sequence>, so it animates from its own frame 0 and can be re-timed
// without touching any other part. The rail is the deliberate exception — see steps.tsx.

import React from "react";
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from "remotion";
import { DEFAULT_BRAND_THEME, type Brand, type BrandTheme } from "../shared/BrandTokens";
import {
  BRAND,
  CLOSE,
  CONTEXT,
  FPS,
  SEQUENCE,
  STEP_COUNT,
  STEP_SEQUENCE_FRAMES,
} from "./plan";
import { CloseView, ContextView, ResultView, StepRail, StepView } from "./steps";

export { STEP_SEQUENCE_FRAMES };

export type StepSequenceProps = {
  brand?: Brand;
  theme?: BrandTheme;
  /** Hide the progress rail. Off is the unusual choice — the rail is what the template is for. */
  showRail?: boolean;
};

export const StepSequence: React.FC<StepSequenceProps> = ({
  brand = BRAND,
  theme = DEFAULT_BRAND_THEME,
  showRail = true,
}) => {
  const { fps } = useVideoConfig();

  // The plan converts seconds to frames at plan.FPS. A composition registered at another rate would
  // silently change every step's length, so say so rather than render it wrong.
  if (fps !== FPS) {
    throw new Error(
      `StepSequence: the plan is compiled at ${FPS}fps but the composition is ${fps}fps.`
    );
  }
  if (SEQUENCE.problems.length > 0) {
    throw new Error(
      `StepSequence: the plan does not hold together:\n  ${SEQUENCE.problems.join("\n  ")}`
    );
  }

  return (
    <AbsoluteFill style={{ background: theme.background }}>
      {SEQUENCE.parts.map((c) => {
        const common = { brand, theme, durationInFrames: c.durationInFrames };
        const p = c.part;
        const name =
          p.kind === "step" ? `${c.index}. ${p.step.label}` : `${c.index}. ${p.kind}`;

        return (
          <Sequence key={c.index} from={c.from} durationInFrames={c.durationInFrames} name={name}>
            {p.kind === "context" ? (
              <ContextView {...common} title={CONTEXT.title} subtitle={CONTEXT.subtitle} />
            ) : null}

            {p.kind === "step" && p.number == null ? (
              <ResultView {...common} step={p.step} />
            ) : null}

            {p.kind === "step" && p.number != null ? (
              <StepView
                {...common}
                step={
                  // staticFile() is resolved here rather than in the plan, so the plan stays a
                  // plain data file that can be read, diffed and validated outside Remotion.
                  p.step.media
                    ? { ...p.step, media: { ...p.step.media, src: staticFile(p.step.media.src) } }
                    : p.step
                }
                number={p.number}
                total={STEP_COUNT}
              />
            ) : null}

            {p.kind === "close" ? (
              <CloseView {...common} title={CLOSE.title} detail={CLOSE.detail} />
            ) : null}
          </Sequence>
        );
      })}

      {/* Mounted once, at the root, reading the absolute frame. */}
      {showRail ? <StepRail parts={SEQUENCE.parts} total={STEP_COUNT} brand={brand} theme={theme} /> : null}
    </AbsoluteFill>
  );
};
