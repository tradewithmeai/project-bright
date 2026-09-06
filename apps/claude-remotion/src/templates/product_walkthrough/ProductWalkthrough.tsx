// ProductWalkthrough — a caption-led tour of a product interface, driven by a virtual camera.
//
// Five layers, back to front. The separation between them is the technique:
//
//   1. AmbientBackground   the room. Outside the camera, so it never zooms.
//   2. VirtualCamera       pans and zooms across the capture.
//   3. Capture + states    the interface itself, which can change state on a trigger.
//   4. Glued marks         ride the camera, locked to a feature.
//   5. Captions and pulse  screen space, fixed size, over everything.
//
// Because the capture never moves and the captions never zoom, a re-capture at a new resolution
// does not invalidate the script, and a caption rewrite does not require re-aiming the camera.
//
// Stages come from stages.ts, which is the file to edit. Each stage is one <Sequence>, so its
// captions and camera moves are timed from its own frame 0.

import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { AmbientBackground, AmbientSheen, stageEnvelope } from "../shared/AmbientBackground";
import {
  CaptionTrack,
  DEFAULT_CAPTION_THEME,
  FocusPulse,
  type CaptionTheme,
} from "../shared/CaptionTrack";
import { CaptureStateSwitch, type CaptureStateTrigger } from "../shared/CaptureState";
import {
  Capture,
  VirtualCamera,
  clampRegion,
  regionAtFrame,
  sourcePointToScreen,
} from "../shared/VirtualCamera";
import { CAPTURE_SIZE, SampleCapture, type CaptureStateKey } from "./SampleCapture";
import {
  DEFAULT_ACCENT,
  FPS,
  PRODUCT_WALKTHROUGH_FRAMES,
  STAGES,
  STAGE_FADE,
  STAGE_FRAMES,
  STAGE_START,
  stagePath,
} from "./stages";

export { PRODUCT_WALKTHROUGH_FRAMES };

export type ProductWalkthroughProps = {
  backgroundColor?: string;
  theme?: CaptionTheme;
};


/**
 * A highlight drawn in CAPTURE coordinates, so it rides the camera and zooms with the interface.
 *
 * Compare with FocusPulse, which is screen-space and stays a constant size however far the camera
 * pushes in. A glued mark says "this region of the product"; a screen-space mark says "look here,
 * now".
 */
const GluedHighlight: React.FC<{
  rect: { x: number; y: number; w: number; h: number; fromSeconds: number };
  color: string;
}> = ({ rect, color }) => {
  const frame = useCurrentFrame();
  const at = rect.fromSeconds * FPS;
  const op = interpolate(frame, [at, at + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (op <= 0.001) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.w * 100}%`,
        height: `${rect.h * 100}%`,
        border: `3px solid ${color}`,
        borderRadius: 8,
        opacity: op * 0.9,
        background: `${color}12`,
      }}
    />
  );
};

const StageView: React.FC<{ index: number; theme: CaptionTheme }> = ({ index, theme }) => {
  const frame = useCurrentFrame();
  const stage = STAGES[index];
  const durF = STAGE_FRAMES[index];
  const path = stagePath(stage);
  const accent = stage.accent ?? theme.accent;

  // Crossfade, not a dip. This stage's Sequence runs STAGE_FADE frames past its nominal end and
  // fades out over them, while the next stage fades in over the same frames. The first stage
  // opens at full opacity so frame 0 is the establishing shot rather than an empty room.
  const isFirst = index === 0;
  const isLast = index === STAGES.length - 1;
  const envelope = stageEnvelope(
    frame,
    durF + (isLast ? 0 : STAGE_FADE),
    isFirst ? 0 : STAGE_FADE,
    isLast ? 0 : STAGE_FADE
  );

  // A pulse is authored against the CAPTURE but drawn in screen space, so it stays crisp at any
  // zoom. Convert through the camera's own region at the pulse frame — the same functions the
  // camera uses, so the two cannot drift apart.
  let pulse: { at: number; x: number; y: number } | null = null;
  if (stage.pulse) {
    const at = Math.round(stage.pulse.atSeconds * FPS);
    const region = clampRegion(
      regionAtFrame(path, at),
      CAPTURE_SIZE,
      { width: 1920, height: 1080 },
      "cover"
    );
    const screen = sourcePointToScreen(stage.pulse.point, region);
    pulse = { at, x: screen.x, y: screen.y };
  }

  // Interface-state triggers, in this stage's own frames.
  const triggers: CaptureStateTrigger<CaptureStateKey>[] = stage.stateChange
    ? [
        {
          at: Math.round(stage.stateChange.atSeconds * FPS),
          to: stage.stateChange.to,
          dur: Math.round((stage.stateChange.crossfadeSeconds ?? 0.4) * FPS),
        },
      ]
    : [];

  return (
    <AbsoluteFill style={{ opacity: envelope }}>
      <VirtualCamera path={path} source={CAPTURE_SIZE} fit="cover" backgroundColor="transparent">
        {/* Inside the camera: the interface and anything glued to it. */}
        <Capture source={CAPTURE_SIZE} fit="cover">
          <CaptureStateSwitch<CaptureStateKey>
            states={[
              { key: "default", node: <SampleCapture state="default" /> },
              { key: "flagged", node: <SampleCapture state="flagged" /> },
            ]}
            triggers={triggers}
            initial="default"
          />
          {stage.highlight ? <GluedHighlight rect={stage.highlight} color={accent} /> : null}
        </Capture>
      </VirtualCamera>

      {/* Keeps a zoomed hold from being pixel-for-pixel static. Deliberately near-invisible. */}
      <AmbientSheen accent={accent} strength={0.05} />

      {/* Screen space, above the camera: these do not zoom. */}
      {pulse ? <FocusPulse at={pulse.at} x={pulse.x} y={pulse.y} color={accent} /> : null}
      <CaptionTrack track={stage.captions} stageEndS={durF / FPS} theme={{ ...theme, accent }} />
    </AbsoluteFill>
  );
};

/** The stage on screen at a given frame, so the ambient can follow its accent. */
function stageIndexAtFrame(frame: number): number {
  let idx = 0;
  for (let i = 0; i < STAGE_START.length; i++) {
    if (frame >= STAGE_START[i]) idx = i;
  }
  return idx;
}

const AmbientRoom: React.FC<{ theme: CaptionTheme; backgroundColor: string }> = ({
  theme,
  backgroundColor,
}) => {
  const frame = useCurrentFrame();
  const stage = STAGES[stageIndexAtFrame(frame)];
  return (
    <AmbientBackground
      backgroundColor={backgroundColor}
      accent={stage?.accent ?? theme.accent}
      intensity={0.9}
      motes={22}
    />
  );
};

export const ProductWalkthrough: React.FC<ProductWalkthroughProps> = ({
  backgroundColor = "#080d16",
  theme = { ...DEFAULT_CAPTION_THEME, accent: DEFAULT_ACCENT },
}) => (
  <AbsoluteFill style={{ backgroundColor }}>
    {/* One continuous room behind every stage — it does not restart at a stage boundary. */}
    <AmbientRoom theme={theme} backgroundColor={backgroundColor} />

    {STAGES.map((stage, i) => (
      <Sequence
        key={stage.id}
        from={STAGE_START[i]}
        // Overlaps the next stage by STAGE_FADE so the handover is a crossfade. The final stage
        // is not extended, so the composition still ends exactly on its derived length.
        durationInFrames={STAGE_FRAMES[i] + (i === STAGES.length - 1 ? 0 : STAGE_FADE)}
        name={stage.id}
      >
        <StageView index={i} theme={theme} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
