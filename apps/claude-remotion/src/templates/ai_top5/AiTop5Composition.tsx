import type { ReactNode } from "react";
import {
  AbsoluteFill,
  Sequence,
  Audio,
  staticFile,
  interpolate,
  useCurrentFrame,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Fredoka";
import { TODAY } from "./data";
import { Background } from "./Background";
import { ColdOpen } from "./ColdOpen";
import { StoryCard } from "./StoryCard";
import { SignOff } from "./SignOff";
import { HudBar } from "./HudBar";
import {
  COLD_OPEN_FRAMES,
  RISER_LENGTH,
  RISER_START,
  SIGN_OFF_FRAMES,
  SIGN_OFF_START,
  STORY_COUNT,
  STORY_TIMINGS,
  TOTAL_FRAMES,
} from "./grid";
import {
  FPS,
  WHIP_FRAMES,
  WHIP_PX,
  SFX_NUMBER_HIT_BASE_GAIN,
  SFX_NUMBER_HIT_ENERGY_GAIN,
  SFX_WHOOSH_GAIN,
  SFX_RISER_GAIN,
  SFX_COLD_OPEN_SLAM_GAIN,
  energyFor,
} from "./tokens";

// Load Fredoka at module level — available before first render
loadFont();


// ── Breathing music-bed envelope (design bible §4.1) ───────────────────────────
// Replaces the flat 0.35/0.12 duck. Per-section keyframe arrays are built ONCE at
// module scope in a loop over the stories — every boundary is a fixed frame derived
// from budget tokens, so the envelope is deterministic (no clock, no random):
//   • full under cold-open and sign-off
//   • ducked under each story VO band
//   • a short swell inside each 75f CUE window (the DJ patter breathes up)
//   • the HARDEST swell under #1's takeaway
//   • an EXTRA duck under the riser window into #1
const BED_FULL           = 0.34; // cold open + sign off
const BED_DUCK           = 0.11; // under story VO bands
const BED_CUE_SWELL      = 0.18; // short lift inside each cue window
const BED_TAKEAWAY_SWELL = 0.26; // hardest swell — under #1's takeaway
const BED_RISER_DUCK     = 0.07; // extra duck so the riser reads clean

const BED_RAMP_FRAMES     = Math.round(FPS / 2);              // 15f volume ramps
const BED_TAIL_FRAMES     = Math.round(FPS * 1.2);            // 36f fade at the very end
// The cue swell peaks 40% of the way through the cue window. Per story, because cue windows are
// per story now — an N-beat span is not always the same integer number of frames.
const bedCuePeak = (cueFrames: number) => Math.round(cueFrames * 0.4);


const BED_KEY_FRAMES: number[] = [];
const BED_KEY_LEVELS: number[] = [];
const bedKey = (frame: number, level: number) => {
  BED_KEY_FRAMES.push(frame);
  BED_KEY_LEVELS.push(level);
};

bedKey(COLD_OPEN_FRAMES - BED_RAMP_FRAMES, BED_FULL); // full through the cold open
for (let i = 0; i < STORY_COUNT; i++) {
  const t = STORY_TIMINGS[i];
  const storyStart = t.from;
  const cueEnd = storyStart + t.phases.stingerStart;
  const isTopStory = i === STORY_COUNT - 1;
  if (isTopStory) {
    // Extra duck under the riser (which runs across the previous story's tail).
    bedKey(RISER_START, BED_DUCK);
    bedKey(RISER_START + BED_RAMP_FRAMES, BED_RISER_DUCK);
    bedKey(storyStart, BED_RISER_DUCK);
  } else if (i > 0) {
    bedKey(storyStart, BED_DUCK); // hold the VO duck up to the cue boundary
  }
  bedKey(storyStart + bedCuePeak(t.phases.stingerStart), BED_CUE_SWELL); // cue swell peak
  bedKey(cueEnd, BED_DUCK); // ducked again by the reveal slam / VO band
  if (isTopStory) {
    // Takeaway beat removed 2026-07-24 — hold the VO duck through #1, then swell hard into the finale
    // in the final frames before sign-off (the SIGN_OFF_START key below is the swell target).
    bedKey(SIGN_OFF_START - BED_RAMP_FRAMES, BED_DUCK);
  }
}
bedKey(SIGN_OFF_START, BED_TAKEAWAY_SWELL); // hold the finale swell to the boundary…
bedKey(SIGN_OFF_START + BED_RAMP_FRAMES, BED_FULL); // …then breathe up full for sign-off

// ⚠️ …and then actually END. Without these two keys the envelope's last instruction was BED_FULL,
// `extrapolateRight: "clamp"` held it there, and the bed was at full level on the final frame and
// simply stopped — a hard cut of a music loop mid-phrase. Objective mix analysis found it; the
// programme's last half-second measured louder than its own body. A visual fade to black was
// already happening underneath, so the picture ended and the music did not.
bedKey(TOTAL_FRAMES - BED_TAIL_FRAMES, BED_FULL);
bedKey(TOTAL_FRAMES, 0);

function bedVolume(f: number): number {
  return interpolate(f, BED_KEY_FRAMES, BED_KEY_LEVELS, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// ── SFX placement (design bible §4.2) — all frames derived from budget tokens ──
const WHOOSH_LEAD_FRAMES = 7; // whoosh lands 7f early so it clears before the hook word
const COLD_OPEN_SLAM_LEAD_FRAMES = Math.round(1.5 * FPS); // 45f — the logo lockup
const COLD_OPEN_SLAM_FRAME = COLD_OPEN_FRAMES - COLD_OPEN_SLAM_LEAD_FRAMES;

// ── Story→story whip-pan (design bible §3.3 — the uniform-crossfade killer) ────
// Wraps each StoryCard inside its <Sequence>, so useCurrentFrame() here is the
// STORY-LOCAL clock (frame 0 = story entry). During the story's last WHIP_FRAMES
// the whole card whips out (translateX toward ±WHIP_PX, scaleX 1→1.08, fade out);
// the next story's first WHIP_FRAMES whip in from the opposite edge moving the
// SAME screen direction, so the pan reads continuous. The midpoint (boundary
// frame 0) coincides with Background's transitionFlash — the bloom masks the cut.
// Direction alternates per story index: even → right, odd → left.
const WHIP_SCALE_X = 0.08; // horizontal stretch at full whip (1.0 → 1.08)
const WHIP_EASE = Easing.out(Easing.quad);

function StoryWhip({
  index,
  storyCount,
  frames,
  children,
}: {
  index: number;
  storyCount: number;
  frames: number;
  children: ReactNode;
}) {
  // Per-story now: segment lengths differ, so the exit window cannot be a module constant.
  const whipExitStart = frames - WHIP_FRAMES;
  const frame = useCurrentFrame(); // story-local (inside the story <Sequence>)
  const dir = index % 2 === 0 ? 1 : -1; // even → right, odd → left
  const hasEnter = index > 0; // story 0 follows the cold open — no whip-in
  const hasExit = index < storyCount - 1; // last story hands to sign-off — no whip-out

  const enterT = hasEnter
    ? interpolate(frame, [0, WHIP_FRAMES], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: WHIP_EASE,
      })
    : 1;
  const exitT = hasExit
    ? interpolate(frame, [whipExitStart, frames], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: WHIP_EASE,
      })
    : 0;

  // Enter and exit windows never overlap (the shortest segment is >> 2×WHIP_FRAMES),
  // so the two offsets sum cleanly: enter from dir·WHIP_PX → 0, exit 0 → dir·WHIP_PX.
  const translateX = dir * WHIP_PX * (1 - enterT) + dir * WHIP_PX * exitT;
  const scaleX = 1 + WHIP_SCALE_X * exitT;
  const opacity = Math.min(enterT, 1 - exitT);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        transform: `translateX(${translateX}px) scaleX(${scaleX})`,
        opacity,
      }}
    >
      {children}
    </div>
  );
}

export function AiTop5Composition() {
  return (
    <AbsoluteFill>
      <Background stories={TODAY.stories} />

      {/* Optional music bed — only when make-ai-top5 --with-audio found public/audio/bed.mp3.
          loopVolumeCurveBehavior="extend": bedVolume(f) gets the GLOBAL frame across loop
          iterations (default "repeat" restarts f at 0 each loop — would break the envelope). */}
      {TODAY.bed ? (
        <Audio
          src={staticFile(TODAY.bed)}
          loop
          loopVolumeCurveBehavior="extend"
          volume={bedVolume}
        />
      ) : null}

      {/* Cold open: Top-of-the-Pops intro slam (+ spoken intro VO if generated) */}
      <Sequence  durationInFrames={COLD_OPEN_FRAMES}>
        <ColdOpen />
      </Sequence>
      {TODAY.intro_vo ? (
        <Sequence  durationInFrames={COLD_OPEN_FRAMES} layout="none">
          <Audio src={staticFile(TODAY.intro_vo)} />
        </Sequence>
      ) : null}

      {/* Story sections — 5→4→3→2→1, each wrapped in the whip-pan transition */}
      {TODAY.stories.map((story, i) => (
        <Sequence
          key={story.n}
          from={STORY_TIMINGS[i].from}
          durationInFrames={STORY_TIMINGS[i].durationInFrames}
        >
          <StoryWhip
            index={i}
            storyCount={TODAY.stories.length}
            frames={STORY_TIMINGS[i].durationInFrames}
          >
            <StoryCard story={story} phases={STORY_TIMINGS[i].phases} />
          </StoryWhip>
        </Sequence>
      ))}

      {/* Per-story VOICEOVER — ONE continuous line (presenter announce + story, merged) over the
          whole story section: starts as the chart number slams, talks across reveal/beats/takeaway.
          One clip per story → no opener/narration seam, no overlap. */}
      {TODAY.stories.map((story, i) =>
        story.vo ? (
          <Sequence
            key={`vo-${story.n}`}
            from={STORY_TIMINGS[i].from}
            durationInFrames={STORY_TIMINGS[i].durationInFrames}
            layout="none"
          >
            <Audio src={staticFile(story.vo)} />
          </Sequence>
        ) : null,
      )}

      {/* ── SFX lane (design bible §4.2) — template assets, referenced unconditionally.
          Gains ride above the ducked bed but never above VO (VO stays 1.0). ── */}

      {/* Cold-open slam — the logo lockup hit */}
      <Sequence from={COLD_OPEN_SLAM_FRAME} layout="none">
        <Audio
          src={staticFile("audio/sfx/coldOpenSlam.mp3")}
          volume={SFX_COLD_OPEN_SLAM_GAIN}
        />
      </Sequence>

      {/* Whoosh just before each story boundary — clears before the hook word */}
      {TODAY.stories.map((story, i) => (
        <Sequence
          key={`whoosh-${story.n}`}
          from={Math.max(0, STORY_TIMINGS[i].from - WHOOSH_LEAD_FRAMES)}
          layout="none"
        >
          <Audio src={staticFile("audio/sfx/whoosh.mp3")} volume={SFX_WHOOSH_GAIN} />
        </Sequence>
      ))}

      {/* Number hit on every position slam — one beat into the story, on the exact grid.
          Gain escalates 5→1 with energyFor(rank). */}
      {TODAY.stories.map((story, i) => (
        <Sequence
          key={`hit-${story.n}`}
          from={STORY_TIMINGS[i].from + STORY_TIMINGS[i].phases.sting}
          layout="none"
        >
          <Audio
            src={staticFile("audio/sfx/numberHit.mp3")}
            volume={() => SFX_NUMBER_HIT_BASE_GAIN + SFX_NUMBER_HIT_ENERGY_GAIN * energyFor(story.n)}
          />
        </Sequence>
      ))}

      {/* Riser INTO #1 — five beats, resolving EXACTLY on the #1 story boundary (the whoosh and
          cue slam mask the cut); the bed runs its extra duck underneath. Both ends come from the
          absolute grid, so the resolve lands with the bed rather than 2.7s past it as it did when
          the boundary was placed from a rounded beat. */}
      <Sequence from={RISER_START} durationInFrames={RISER_LENGTH} layout="none">
        <Audio src={staticFile("audio/sfx/riser.mp3")} volume={SFX_RISER_GAIN} />
      </Sequence>

      {/* Sign off (+ presenter sign-off voiceover) */}
      <Sequence from={SIGN_OFF_START} durationInFrames={SIGN_OFF_FRAMES}>
        <SignOff bulletin={TODAY} />
      </Sequence>
      {TODAY.signoff_vo ? (
        <Sequence from={SIGN_OFF_START} durationInFrames={SIGN_OFF_FRAMES} layout="none">
          <Audio src={staticFile(TODAY.signoff_vo)} />
        </Sequence>
      ) : null}

      {/* HUD bar — one per story, layered on top */}
      {TODAY.stories.map((story, i) => (
        <Sequence
          key={`hud-${story.n}`}
          from={STORY_TIMINGS[i].from}
          durationInFrames={STORY_TIMINGS[i].durationInFrames}
          layout="none"
        >
          <HudBar
            stories={TODAY.stories}
            currentStoryIndex={i}
            phases={STORY_TIMINGS[i].phases}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
