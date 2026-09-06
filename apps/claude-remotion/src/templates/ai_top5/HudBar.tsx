import { useCurrentFrame, interpolate } from "remotion";
import { Story } from "./data";
import { TEXT, MUTED, FONT_BUBBLE, FONT_MONO, EASE, accentFor } from "./tokens";
import type { StoryPhases } from "./grid";

type Props = {
  stories: Story[];
  currentStoryIndex: number; // 0-4 (index into stories array)
  phases: StoryPhases; // this story's own boundaries — see grid.ts
};

export function HudBar({ stories, currentStoryIndex, phases }: Props) {
  const frame = useCurrentFrame();

  // Present on the story's FIRST frame, not fading up from nothing — see the note in ScreenStory
  // about the empty boundary frame. The HUD is furniture; it should already be there.
  const fadeIn = interpolate(frame, [0, 12], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  const story = stories[currentStoryIndex];
  const accent = story ? accentFor(story.n) : "#22d3ee";

  // Story phase label — read from THIS story's boundaries. They were module constants derived from
  // fixed frame budgets, which is only correct while every story is the same length and starts on
  // the same beat phase; neither has been true since section lengths began following the voiceover.
  //
  // The "TAKE" phase is gone with the takeaway it labelled: the explainer now runs to the end of the
  // story, so a label past it was announcing a phase that could not be on screen.
  let phaseLabel = "CUE";
  if (frame >= phases.explainerStart) {
    phaseLabel = "EXPLAIN";
  } else if (frame >= phases.beatsStart) {
    phaseLabel = frame >= phases.beat1 ? "BEAT 2/2" : "BEAT 1/2";
  } else if (frame >= phases.revealStart) {
    phaseLabel = "HEAD";
  } else if (frame >= phases.stingerStart) {
    phaseLabel = "BRAND";
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 64,
        background: `rgba(11,14,26,0.92)`,
        borderBottom: `1px solid ${accent}44`,
        display: "flex",
        alignItems: "center",
        paddingLeft: 48,
        paddingRight: 48,
        opacity: fadeIn,
        zIndex: 200,
      }}
    >
      {/* Left: brand */}
      <div
        style={{
          fontFamily: FONT_BUBBLE,
          fontSize: 24,
          fontWeight: 700,
          color: accent,
          letterSpacing: 2,
          minWidth: 160,
        }}
      >
        AI TOP 5
      </div>

      {/* Center: progress pips */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 16,
        }}
      >
        {stories.map((s, i) => {
          const isDone = i < currentStoryIndex;
          const isCurrent = i === currentStoryIndex;
          const isFuture = i > currentStoryIndex;
          return (
            <div
              key={s.n}
              style={{
                width: isCurrent ? 36 : 10,
                height: 10,
                borderRadius: 5,
                background: isCurrent
                  ? accent
                  : isDone
                  ? `${TEXT}99`
                  : "transparent",
                border: isFuture ? `1px solid ${MUTED}` : "none",
                boxShadow: isCurrent ? `0 0 10px ${accent}` : "none",
              }}
            />
          );
        })}
      </div>

      {/* Right: story context */}
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 14,
          color: MUTED,
          letterSpacing: 2,
          textAlign: "right",
          minWidth: 200,
        }}
      >
        <span style={{ color: accent }}>#{story?.n}</span>
        {" · "}
        {story?.category}
        {" · "}
        <span style={{ color: `${accent}88` }}>{phaseLabel}</span>
      </div>
    </div>
  );
}
