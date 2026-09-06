import { Easing } from "remotion";

// ── Palette ────────────────────────────────────────────────────────────────────
export const BG       = "#05070f";
export const CARD_BG  = "#0b0e1a";
export const TEXT     = "#e8eaf0";
export const MUTED    = "#475569";
export const GRID_CLR = "rgba(100,116,139,0.10)";

// ── Rank→accent heat ramp (SINGLE SOURCE OF TRUTH — design bible §6.2) ──────────
// Monotonic cool→hot; #1 is the hottest/brightest (the chart-topper). The template
// reads this by rank; the daily data feed does NOT carry colour, so a regen can never
// revert the palette (replicable-by-construction).
export const RANK_ACCENT: Record<number, string> = {
  5: "#38bdf8", // cool sky blue  (coolest, lowest energy)
  4: "#22d3ee", // cyan
  3: "#34d399", // green → shifting warm
  2: "#f59e0b", // amber
  1: "#ff2e88", // hot magenta-pink (hottest — the chart-topper)
};
export const BRAND_ACCENT = "#22d3ee"; // signature ident colour (intro/outro) — deliberately ≠ #1
export const FLASH_WHITE  = "#ffffff"; // sting/flash secondary punch
export const SHOW_NAME     = "AI TOP 5";
// Accent for a given rank, with a safe fallback.
export const accentFor = (n: number): string => RANK_ACCENT[n] ?? BRAND_ACCENT;

// ── Typography ─────────────────────────────────────────────────────────────────
// Bubble face (Fredoka — loaded in composition before render)
export const FONT_BUBBLE = "'Fredoka', 'Nunito', system-ui, sans-serif";
// Monospace for HUD/techy elements
export const FONT_MONO   = "ui-monospace, 'SF Mono', Menlo, 'Courier New', monospace";
// Body
export const FONT_BODY   = "'Inter', system-ui, sans-serif";

// ── Standard ease (house) ──────────────────────────────────────────────────────
export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_SPRING = Easing.bezier(0.34, 1.56, 0.64, 1);

// ── Reading-pace floor (silent-caption-system) ─────────────────────────────────
export const FLOOR_MIN      = 1.8;   // seconds
export const FLOOR_PER_CHAR = 0.07;  // seconds per character
export function readingFloor(text: string): number {
  return Math.max(FLOOR_MIN, text.length * FLOOR_PER_CHAR);
}

// ── Frame counts ───────────────────────────────────────────────────────────────
export const FPS = 30;

// ⚠️ THE TIMELINE LIVES IN grid.ts. Every section length, phase boundary, sting frame, spin
// duration and beat pulse moved there when the 124 BPM grid was made exact. What used to be here —
// COLD_OPEN_FRAMES, STORY_CUE_FRAMES, STORY_TOTAL_FRAMES, storyFramesFor(), BEAT, BAR, beatPulse —
// was all derived from `BEAT = Math.round(FPS * 60 / BPM)` = 15 frames against a true beat of
// 14.5161, which drifted the back half of the episode 3.5 seconds off its own music bed.
//
// This file keeps what is NOT time: palette, type, ease, and the shape of each effect.

// ── Number-sting shape ─────────────────────────────────────────────────────────
// The slam is built ENTIRELY from these, all relative to the sting frame (which grid.ts places on a
// beat). Retune the whole impact from here; no raw frame numbers live in the components.
export const STING = {
  PREKICK_FRAMES: 4,   // last N frames before the slam: the whole stage breathes in (scale 1→0.94)
  SLAM_FRAMES: 6,      // number crashes 2.6×→1.0
  FLASH_FRAMES: 3,     // full-frame white flash decays to 0
  RING_FRAMES: 12,     // shockwave ring expands + fades
  SETTLE_START: 6,     // secondary bounce window (1.0→overshoot→1.0) so the slam "rings"
  SETTLE_MID: 10,
  SETTLE_END: 14,
  CHROMA_FRAMES: 5,    // faux-chromatic glyph split visible
  RULE_SNAP_FRAMES: 2, // accent rule snaps to full width
} as const;

// ── Prop motion (StoryVisual) — BASE-PIVOT model ───────────────────────────────
// Translating a cutout drags its baked floor-shadow and wall-shading with it ("the wall moves").
// So props move ABOUT THEIR BASE: feet/plinth stay glued to the floor. The sting shake is a ROCK
// (rotate about the base); the speaker beat-thump is a SQUASH (scaleY from the floor — a classic
// bass-bin pump). Amplitudes are quoted at energy 1.0 and scaled by energyFor(rank).
export const PROP = {
  ROCK_DEG: 2.2,                         // sting-rock amplitude @ energy 1.0
  SHAKE_FREQ: 1.6,                       // rock oscillation (rad/frame) during the decay
  SHAKE_DECAY_FRAMES: STING.RING_FRAMES, // rock decays over the shockwave-ring window
  SQUASH: 0.05,                          // speaker beat-squash (scaleY) @ energy 1.0
  THUMP_DECAY: 6,                        // beatPulse decay for a snappy squash
} as const;

// Countdown energy ramp: #5 = 0.2 (a subtle tick) → #1 = 1.0 (the full broadcast punch).
// Drives sting intensity, background rhythm and SFX gain — ONE escalation curve, so "the show gets
// bigger as it counts down" is a single number rather than five unrelated tweaks.
export const energyFor = (n: number): number => (6 - n) / 5;

// ── Screen-story text (the device SCREEN is the message surface — bible revision 2026-07-03) ──
// All story text lives ON the screen as a code layer over the (future gen-AI) image backdrop.
// Every element ARRIVES via a mini catherine-wheel spin that lands EXACTLY on a beat boundary,
// so a stab SFX can lock to the land frames. The spin LENGTH is one beat, computed per story by
// StoryPhases.spinFrames in grid.ts.
export const SCREEN_TEXT = {
  // Spin-in duration is per story now — see StoryPhases.spinFrames in grid.ts.
  CUE_H: 0.06,           // cue text height (fraction of screen rect height)
  HEADLINE_H: 0.105,     // reveal headline height
  STRAP_SCALE: 0.6,      // headline shrink factor when it docks to the top strap for beats
  STRAP_FRAMES: 10,      // headline centre→strap move duration
  BEAT_H: 0.075,         // beat line height
  EXPLAINER_H: 0.052,    // explainer paragraph height (2-3 sentences — smaller, reading size)
  TAKEAWAY_H: 0.085,     // takeaway height
  LABEL_H: 0.045,        // "THE WIDER POINT" / "WHAT HAPPENED" label height
} as const;

// ── Number sting (owner-tuned 2026-07-03) ─────────────────────────────────────
// The #N is the POSITION ANNOUNCEMENT: it slams HUGE the moment the presenter hook
// announces the position (early in the segment), then docks top-right. The story/headline
// arrival stays at the reveal boundary — number first, story second, exactly like the VO.
export const NUMBER_SIZE = 440;      // slam glyph size
// The slam FRAME is musical and lives in grid.ts (PHASE_BEATS.sting), per story.

// DOCK: after the slam settles, the big #N flies from centre to the top-right corner
// (broadcast dock) and perches there for the REST of the segment.
export const NUMBER_DOCK = {
  // Frames AFTER the sting at which the dock starts (the sting frame itself is musical).
  AFTER_STING: STING.SETTLE_END + 2,
  FRAMES: 12,                                // dock duration
  X: 785,                                    // px translate to the top-right perch (1920×1080)
  Y: -412,
  SCALE: 0.2,                                // 440 → 88px perched
} as const;

// ── Story→story whip-pan (design bible §3.3 — the uniform-crossfade killer) ────
// Exit/enter whip duration on EACH side of the story boundary; the midpoint
// coincides with Background's transitionFlash so the bloom masks the cut.
export const WHIP_FRAMES = 8;
// Horizontal throw distance (px). Direction alternates per story index.
export const WHIP_PX = 160;

// ── Caption fade config ────────────────────────────────────────────────────────
export const FADE_FRAMES = 6;
export const TITLE_HANG_S = 0.4;  // title auto-extends past authored out_s

// ── Deterministic scatter (seeded — no Math.random) ───────────────────────────
// Maps any integer seed to a stable value in [0, 1). Use for particle positions,
// offsets, and per-element variation that must be identical on every render pass.
export function hash(n: number): number {
  const x = Math.sin(n + 1.6180339887) * 43758.5453123;
  return x - Math.floor(x);
}

// ── Audio spine — SFX lane ────────────────────────────────────────────────────
// The riser's PLACEMENT is musical (grid.ts RISER_BEATS); only its gain is here.

// SFX gains. House rule: SFX ride above the ducked bed but NEVER above VO
// (VO stays 1.0). numberHit escalates with energyFor(rank):
// 0.5 + 0.4·energy → 0.58 at #5 … 0.90 at #1 (capped ≤0.9 so it never drowns the hook).
export const SFX_NUMBER_HIT_BASE_GAIN   = 0.5;
export const SFX_NUMBER_HIT_ENERGY_GAIN = 0.4;
export const SFX_WHOOSH_GAIN            = 0.8;
export const SFX_RISER_GAIN             = 0.85;
export const SFX_COLD_OPEN_SLAM_GAIN    = 0.9;
