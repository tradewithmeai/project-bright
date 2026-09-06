// SlotShort — a short promotional or explainer video assembled from ordered content slots.
//
//   brand -> ordered slots -> derived timing -> one finished short
//
// The composition is thin by design. Everything that decides what the video says lives in plan.ts;
// everything that decides how a slot looks lives in slots.tsx. This file only places them on the
// timeline.
//
// Each slot gets its own <Sequence>, so it animates from its own frame 0 and can be reordered,
// re-timed or removed without touching any other slot's code.

import React from "react";
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from "remotion";
import { DEFAULT_BRAND_THEME, type Brand, type BrandTheme } from "../shared/BrandTokens";
import { BRAND, FPS, SHORT, SLOT_SHORT_FRAMES } from "./plan";
import {
  BrandSlotView,
  CtaSlotView,
  FootageSlotView,
  ImageSlotView,
  MessageSlotView,
} from "./slots";

export { SLOT_SHORT_FRAMES };

export type SlotShortProps = {
  brand?: Brand;
  theme?: BrandTheme;
};

export const SlotShort: React.FC<SlotShortProps> = ({
  brand = BRAND,
  theme = DEFAULT_BRAND_THEME,
}) => {
  const { fps } = useVideoConfig();

  // The plan converts seconds to frames at plan.FPS. A composition registered at another rate
  // would silently change every slot's length, so say so rather than render it wrong.
  if (fps !== FPS) {
    throw new Error(
      `SlotShort: the plan is compiled at ${FPS}fps but the composition is ${fps}fps.`
    );
  }
  if (SHORT.problems.length > 0) {
    throw new Error(`SlotShort: the plan does not hold together:\n  ${SHORT.problems.join("\n  ")}`);
  }

  return (
    <AbsoluteFill style={{ background: theme.background }}>
      {SHORT.slots.map(({ slot, from, durationInFrames, index }) => {
        const common = { brand, theme, durationInFrames };
        return (
          <Sequence
            key={index}
            from={from}
            durationInFrames={durationInFrames}
            name={`${index + 1}. ${slot.kind}`}
          >
            {slot.kind === "brand" ? <BrandSlotView slot={slot} {...common} /> : null}
            {slot.kind === "message" ? <MessageSlotView slot={slot} {...common} /> : null}
            {slot.kind === "image" ? (
              <ImageSlotView
                slot={slot.src ? { ...slot, src: staticFile(slot.src) } : slot}
                {...common}
              />
            ) : null}
            {slot.kind === "footage" ? (
              <FootageSlotView slot={{ ...slot, src: staticFile(slot.src) }} {...common} />
            ) : null}
            {slot.kind === "cta" ? <CtaSlotView slot={slot} {...common} /> : null}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
