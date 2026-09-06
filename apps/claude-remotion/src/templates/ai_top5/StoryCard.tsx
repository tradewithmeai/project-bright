import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";
import { Story } from "./data";
import { StoryVisual } from "./StoryVisual";
import {
  MUTED, FONT_BUBBLE, FONT_MONO,
  EASE, EASE_SPRING,
  accentFor,
  STING,
  NUMBER_SIZE,
  NUMBER_DOCK,
  energyFor,
  RANK_ACCENT,
  FLASH_WHITE,
} from "./tokens";
import type { StoryPhases } from "./grid";

// `phases` carries this story's own boundaries. They are NOT module constants: each is
// `localFrameAtBeat(story start, offset)`, so two stories starting on different beat phases have
// boundaries a frame apart and a shared constant would be right for at most one of them.
type Props = { story: Story; phases: StoryPhases };

export function StoryCard({ story, phases }: Props) {
  const accent = accentFor(story.n); // palette single-source (tokens RANK_ACCENT), not data
  return (
    <AbsoluteFill>
      {/* Per-position era-device visual — backmost; the device SCREEN carries the story text */}
      <StoryVisual story={story} phases={phases} />

      {/* CUE phase */}
      <Sequence durationInFrames={phases.stingerStart}>
        <CuePhase story={story} accent={accent} />
      </Sequence>

      {/* REVEAL phase — its stage covers the STINGER arrival window + the headline reveal */}
      <Sequence from={phases.stingerStart} durationInFrames={phases.beatsStart - phases.stingerStart}>
        <RevealPhase story={story} accent={accent} />
      </Sequence>

      {/* BEATS phase */}
      <Sequence
        from={phases.beatsStart}
        durationInFrames={phases.explainerStart - phases.beatsStart}
      >
        <BeatsPhase story={story} accent={accent} />
      </Sequence>

      {/* EXPLAINER phase — the reading layer plays on the device screen (ScreenStory);
          the stage keeps a calm spotlight so the eye stays on the text */}
      <Sequence from={phases.explainerStart} durationInFrames={phases.explainerFrames}>
        <ExplainerPhase story={story} accent={accent} />
      </Sequence>
      {/* TAKEAWAY phase removed 2026-07-24 (owner): the end-of-story "THE DETAIL" kicker was not working. */}

      {/* NUMBER STING — continuous, topmost: slams HUGE when the VO announces the
          position (one beat in), docks top-right, perches for the whole segment. */}
      <NumberSting story={story} accent={accent} phases={phases} />
    </AbsoluteFill>
  );
}

// ─── NUMBER STING (the position announcement) ─────────────────────────────────

function NumberSting({
  story,
  accent,
  phases,
}: {
  story: Story;
  accent: string;
  phases: StoryPhases;
}) {
  const frame = useCurrentFrame(); // segment-local (mounted at card root)
  const energy = energyFor(story.n);
  const f = frame - phases.sting; // sting-local

  if (f < 0) return null;

  // (b) SLAM — the number CRASHES in from 2.6× (it arrives, it doesn't fade).
  const slamScale = interpolate(f, [0, STING.SLAM_FRAMES], [2.6, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  // (d) SETTLE — secondary bounce so the slam rings.
  const settleScale = interpolate(
    f,
    [STING.SETTLE_START, STING.SETTLE_MID, STING.SETTLE_END],
    [1, 1 + 0.06 * energy, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_SPRING },
  );
  const numOpacity = interpolate(f, [0, 2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // (b) WHITE FLASH — peaks on the slam frame. Amplitude escalates 5→1.
  const flash = interpolate(f, [0, STING.FLASH_FRAMES], [0.35 + 0.55 * energy, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // (c) RING SHOCKWAVE — sized to the big glyph, escalates with energy.
  const ringMax = (320 + 240 * energy) * (NUMBER_SIZE / 180);
  const ringSize = interpolate(f, [0, STING.RING_FRAMES], [0, ringMax], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const ringOpacity = interpolate(f, [0, STING.RING_FRAMES], [0.9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // (e) FAUX-CHROMATIC — offset glyph ghosts on the first frames.
  const chromaOpacity = interpolate(f, [0, STING.CHROMA_FRAMES], [0.35, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const chromaOffset = 1 + 3 * energy;

  // DOCK — from centre-stage to the top-right perch, where it stays all segment.
  const dockStart = phases.sting + NUMBER_DOCK.AFTER_STING;
  const dockP = interpolate(
    frame,
    [dockStart, dockStart + NUMBER_DOCK.FRAMES],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE },
  );
  const dockScale = 1 - (1 - NUMBER_DOCK.SCALE) * dockP;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 64,
        }}
      >
        <div
          style={{
            position: "relative",
            transform: `translate(${dockP * NUMBER_DOCK.X}px, ${dockP * NUMBER_DOCK.Y}px) scale(${dockScale})`,
          }}
        >
          {/* (c) ring shockwave — expands from the glyph centre */}
          {f <= STING.RING_FRAMES && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: ringSize,
                height: ringSize,
                marginLeft: -ringSize / 2,
                marginTop: -ringSize / 2,
                borderRadius: "50%",
                border: `6px solid ${accent}`,
                opacity: ringOpacity,
              }}
            />
          )}
          <div
            style={{
              fontFamily: FONT_BUBBLE,
              fontSize: NUMBER_SIZE,
              fontWeight: 700,
              color: accent,
              lineHeight: 0.9,
              letterSpacing: -8,
              textShadow: `0 0 120px ${accent}66`,
              position: "relative",
              opacity: numOpacity,
              transform: `scale(${slamScale * settleScale})`,
            }}
          >
            {/* (e) chromatic ghosts */}
            {f <= STING.CHROMA_FRAMES && (
              <>
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    color: RANK_ACCENT[1],
                    textShadow: "none",
                    opacity: chromaOpacity,
                    transform: `translateX(${-chromaOffset}px)`,
                    mixBlendMode: "screen",
                  }}
                >
                  #{story.n}
                </span>
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    color: RANK_ACCENT[4],
                    textShadow: "none",
                    opacity: chromaOpacity,
                    transform: `translateX(${chromaOffset}px)`,
                    mixBlendMode: "screen",
                  }}
                >
                  #{story.n}
                </span>
              </>
            )}
            <span style={{ position: "relative" }}>#{story.n}</span>
          </div>
        </div>
      </div>

      {/* (b) WHITE FLASH — full-frame, on top, gone in 3 frames */}
      {f <= STING.FLASH_FRAMES && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: FLASH_WHITE,
            opacity: flash,
          }}
        />
      )}
    </AbsoluteFill>
  );
}

// ─── CUE ─────────────────────────────────────────────────────────────────────

function CuePhase({ story, accent }: { story: Story; accent: string }) {
  const frame = useCurrentFrame();

  const glow = interpolate(frame, [0, 10, 30, 119], [0, 0.6, 0.3, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      {/* Accent glow bloom behind the center */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 60% 40% at 50% 50%, ${accent}${Math.round(glow * 255).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Cue text plays ON the device screen (ScreenStory); the number sting is the
          continuous top layer — nothing else centred here. */}

      {/* Bottom category tag */}
      <CategoryTag category={story.category} accent={accent} frame={frame} delay={20} />
    </AbsoluteFill>
  );
}

// ─── REVEAL ───────────────────────────────────────────────────────────────────

// The headline lands ON the device screen at this boundary; the stage keeps the
// spotlight + tag (the number is already perched top-right by now).
function RevealPhase({ story, accent }: { story: Story; accent: string }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {/* Accent spotlight */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 50% 50% at 50% 45%, ${accent}18 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      <CategoryTag category={story.category} accent={accent} frame={frame} delay={0} />
    </AbsoluteFill>
  );
}

// ─── BEATS ────────────────────────────────────────────────────────────────────

// The beat points transition in ON the device screen (ScreenStory).
function BeatsPhase({ story }: { story: Story; accent: string }) {
  return (
    <AbsoluteFill>
      {/* Story number watermark */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          right: 60,
          fontFamily: FONT_MONO,
          fontSize: 14,
          color: `${MUTED}66`,
          letterSpacing: 3,
        }}
      >
        #{story.n} · {story.category}
      </div>
    </AbsoluteFill>
  );
}

// ─── EXPLAINER ────────────────────────────────────────────────────────────────

// The explainer paragraph transitions in ON the device screen (ScreenStory); the stage
// holds a calm, slightly dimmer spotlight — this is the READING beat of the segment.
function ExplainerPhase({ story, accent }: { story: Story; accent: string }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 55% 50% at 50% 45%, ${accent}10 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      <CategoryTag category={story.category} accent={accent} frame={frame} delay={0} />
    </AbsoluteFill>
  );
}

// ─── SHARED ───────────────────────────────────────────────────────────────────

function CategoryTag({
  category,
  accent,
  frame,
  delay,
}: {
  category: string;
  accent: string;
  frame: number;
  delay: number;
}) {
  const opacity = interpolate(frame, [delay, delay + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 52,
        left: 60,
        fontFamily: FONT_MONO,
        fontSize: 15,
        fontWeight: 700,
        color: accent,
        letterSpacing: 4,
        textTransform: "uppercase" as const,
        background: `${accent}18`,
        border: `1px solid ${accent}44`,
        borderRadius: 4,
        padding: "6px 16px",
        opacity,
      }}
    >
      {category}
    </div>
  );
}
