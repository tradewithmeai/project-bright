import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Story } from "./data";
import {
  BG,
  EASE,
  FPS,
  GRID_CLR,
  hash,
  accentFor,
  BRAND_ACCENT,
  energyFor,
} from "./tokens";
import { COLD_OPEN_FRAMES, STORY_TIMINGS, beatPulse } from "./grid";

// Render dimensions (1920×1080 landscape composition)
const W = 1920;
const H = 1080;
const PARTICLE_COUNT = 28;

// ── Rhythm constants (design bible §3.5 — rhythmic, not ambient) ──────────────
// Grid/edge-glow alpha gain per beat pulse, scaled by energyLevel.
const BEAT_GAIN = 0.15;
// Rank strobe: 2 total ON frames flickered inside the story-local 0–3 window.
const RANK_STROBE_WINDOW = 4; // story-local frames [0, 4)
const RANK_STROBE_PERIOD = 2; // ON every other frame → flashes at f0 and f2
const RANK_STROBE_OPACITY = 0.18;
// Particle speed multiplier = 1 + energyLevel * PARTICLE_SPEED_GAIN (per story).
const PARTICLE_SPEED_GAIN = 0.8;
// Cold-open / sign-off breathing level (matches the existing non-story energy).
const IDLE_ENERGY = 0.1;
// Grid base opacity ramp (pre-existing values, named per the tokens principle).
const GRID_BASE_OPACITY = 0.35;
const GRID_ENERGY_GAIN = 0.3;
// Edge-glow base alpha per unit energy.
const EDGE_GLOW_GAIN = 0.08;

type Props = { stories: Story[] };

function toHex(opacity: number): string {
  return Math.round(Math.min(1, Math.max(0, opacity)) * 255)
    .toString(16)
    .padStart(2, "0");
}

// Which story is active (-1 = cold-open, stories.length = sign-off).
//
// ⚠️ This used to be `floor((frame - COLD_OPEN_FRAMES) / STORY_TOTAL_FRAMES)`, which assumes every
// story is the same length. They have not been since section lengths began following the measured
// voiceover: on a voiced edition the background's idea of "which story is on screen" slid out of
// step with the story actually on screen, so the accent, the energy level and the entry strobe all
// belonged to the wrong rank. It reads the real boundaries now.
function activeStoryIndex(frame: number): number {
  if (frame < COLD_OPEN_FRAMES) return -1;
  for (let i = 0; i < STORY_TIMINGS.length; i++) {
    const t = STORY_TIMINGS[i];
    if (frame < t.from + t.durationInFrames) return i;
  }
  return STORY_TIMINGS.length;
}

export function Background({ stories }: Props) {
  const frame = useCurrentFrame();

  const idx = activeStoryIndex(frame);
  const story: Story | null =
    idx >= 0 && idx < stories.length ? stories[idx] : null;

  // Palette single-source: rank ramp for stories, brand accent for cold-open/sign-off.
  const accent = story ? accentFor(story.n) : BRAND_ACCENT;
  // energyLevel: 0.2 (story n=5, calmest) → 1.0 (story n=1, most intense)
  // cold-open / sign-off stay at IDLE_ENERGY so the opening breathes
  const energyLevel = story ? energyFor(story.n) : IDLE_ENERGY;

  // Local frame since this story started (transition flash + rank strobe)
  const storyStart =
    idx >= 0 && idx < STORY_TIMINGS.length ? STORY_TIMINGS[idx].from : 0;
  const localFrame = Math.max(0, frame - storyStart);

  // ── Beat pulse (§3.0/§3.5) — the whole room breathes ON the beat ──────────
  const pulse = beatPulse(frame);
  const beatGain = pulse * BEAT_GAIN * energyLevel;

  // ── Rank strobe (§3.5) — 2-frame accent flicker on story entry, stacking
  //    with transitionFlash below ─────────────────────────────────────────────
  const rankStrobeOn =
    story !== null &&
    localFrame < RANK_STROBE_WINDOW &&
    localFrame % RANK_STROBE_PERIOD === 0;

  // ── Particle speed-up (§3.5) — multiplier constant per story, chosen at the
  //    story boundary. Travel accumulates piecewise so faster stories speed the
  //    motes up WITHOUT a position jump at the boundary. ───────────────────────
  const speedMultAt = (i: number): number =>
    i >= 0 && i < stories.length
      ? 1 + energyFor(stories[i].n) * PARTICLE_SPEED_GAIN
      : 1 + IDLE_ENERGY * PARTICLE_SPEED_GAIN;
  let particleTravel: number;
  if (idx < 0) {
    particleTravel = frame * speedMultAt(-1);
  } else {
    particleTravel = COLD_OPEN_FRAMES * speedMultAt(-1);
    for (let s = 0; s < idx && s < STORY_TIMINGS.length; s++) {
      particleTravel += STORY_TIMINGS[s].durationInFrames * speedMultAt(s);
    }
    particleTravel += localFrame * speedMultAt(idx);
  }

  // ── Transition flash (bright accent bloom on story entry) ─────────────────
  const transitionFlash =
    idx >= 0
      ? interpolate(localFrame, [0, 8, 24], [0.22, 0.05, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE,
        })
      : 0;

  // ── Aurora — slow sinusoidal position drift (Math.sin is deterministic) ───
  const TAU = Math.PI * 2;
  const aX = 50 + 14 * Math.sin((frame / (FPS * 8)) * TAU);
  const aY = 50 + 9 * Math.cos((frame / (FPS * 13)) * TAU);
  const auraIntensity = 0.05 + 0.09 * energyLevel;
  const auraSize = 50 + 18 * energyLevel; // % of viewport

  // ── Grid (base ramp + beat pulse) ──────────────────────────────────────────
  const gridOpacity =
    GRID_BASE_OPACITY + GRID_ENERGY_GAIN * energyLevel + beatGain;

  return (
    <AbsoluteFill style={{ background: BG }}>
      {/* === PRIMARY AURORA (accent-tinted radial, drifts with frame) === */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse ${auraSize}% ${auraSize * 0.65}% at ${aX}% ${aY}%, ${accent}${toHex(auraIntensity)} 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* === SECONDARY AURORA (counter-oscillation, softer) === */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse ${auraSize * 0.55}% ${auraSize * 0.38}% at ${100 - aX}% ${100 - aY}%, ${accent}${toHex(auraIntensity * 0.45)} 0%, transparent 60%)`,
          pointerEvents: "none",
        }}
      />

      {/* === PARTICLE MOTES ===
          Base speed is fixed per particle; the per-story energy multiplier is
          applied via `particleTravel` (piecewise-accumulated) so #1 visibly
          drifts faster than #5 with no position jump at story boundaries.
          Energy also scales opacity / size / glow. */}
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const speed = 0.25 + hash(i * 17) * 0.55; // px/frame — fixed per particle
        const baseX = hash(i * 7) * W;
        const baseY = hash(i * 13) * H;
        // Upward drift with wrap; large H multiplier keeps modulo positive
        const py = ((baseY - particleTravel * speed) % H + H * 9999) % H;
        // Tiny horizontal wobble — deterministic, period varies per particle
        const px =
          baseX + 12 * Math.sin((frame / (FPS * 4 + i * 3)) * TAU);

        const baseOpacity = hash(i * 19) * 0.38;
        const opacity = baseOpacity * energyLevel;
        const size = 1.5 + hash(i * 31) * 2.5 * energyLevel;
        const glow =
          energyLevel > 0.4
            ? `0 0 ${Math.round(3 + 8 * energyLevel)}px ${accent}`
            : "none";

        if (opacity < 0.02) return null;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: size,
              height: size,
              borderRadius: "50%",
              background: accent,
              opacity,
              boxShadow: glow,
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* === GRID (energy-scaled opacity) === */}
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", top: 0, left: 0, opacity: gridOpacity }}
      >
        <defs>
          <pattern
            id="bg-grid"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 80 0 L 0 0 0 80"
              fill="none"
              stroke={GRID_CLR}
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg-grid)" />
      </svg>

      {/* === SCANLINES === */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 1px, transparent 1px, transparent 4px)",
          pointerEvents: "none",
        }}
      />

      {/* === TRANSITION FLASH (bright accent bloom on story entry) === */}
      {transitionFlash > 0.005 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${accent}${toHex(transitionFlash)} 0%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* === RANK STROBE (§3.5 — full-frame accent flicker on story entry,
          stacks with the transition flash bloom above) === */}
      {rankStrobeOn && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: accent,
            opacity: RANK_STROBE_OPACITY,
            pointerEvents: "none",
          }}
        />
      )}

      {/* === EDGE GLOW (top + bottom accent tint, visible at energy > 0.3;
          alpha breathes on the beat) === */}
      {energyLevel > 0.3 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(to bottom, ${accent}${toHex(energyLevel * EDGE_GLOW_GAIN + beatGain)} 0%, transparent 14%, transparent 86%, ${accent}${toHex(energyLevel * EDGE_GLOW_GAIN + beatGain)} 100%)`,
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
}
