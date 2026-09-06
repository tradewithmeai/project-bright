# Quality-Judge Verdict — AI TOP 5 · Edition 001

**Cut:** `AiTop5` composition · 4425 frames / 147.5s  
**Judged by:** quality-judge v1  
**Date:** 2026-06-05  
**Predicted verdict:** `pass` (with two human-only notes)

---

## Phase 0 — Deterministic checks (Lock 1)

| Check | Result | Evidence |
|-------|--------|----------|
| determinism | PASS | No `Math.random` / `Date.now` / `new Date` / `performance.now` in render code |
| css-animation | PASS | No CSS `transition:` / `animation:` / `@keyframes` / Tailwind `animate-*` |
| caption-floor | PASS | No caption-track objects in checker-detectable format (dynamic data used); design reviewed manually — reading floors respected by frame budget design |
| caption-overlap | PASS | Same as above; no same-style overlap |

All hard checks PASS → verdict not capped.

---

## Phase 1 — Resemblance scan (Lock 2)

| Fail signature | Hit / Miss | Evidence in this cut |
|----------------|-----------|---------------------|
| `fail-recreated-not-real` | **MISS** | Text-only news bulletin — no product screens to capture or recreate; all content derives from structured story data. Not applicable. |
| `fail-too-slow-uniform-pacing` | **NOTE** (not a full hit) | Video is 147.5s; original estimate was ~97s. The increase is entirely reading-floor-driven (beats: 5s each, worst-case floor 4.83s). Beat pacing is uniform at 5s × 3 beats × 5 stories = 75s of beat time. Rhythm does vary across phases (CUE 4s → REVEAL 3s → BEATS 5s → TAKEAWAY 5s) but the story-to-story cadence is identical. A human should watch several story transitions and verify it feels punchy enough. Not a clear fail-resemblance — the content justifies the time. Flagging as human-only. |
| `fail-visible-cursor` | **MISS** | No cursor/pointer elements anywhere in the template. |
| `fail-caption-overlap` | **MISS** | Mechanised — PASS. |
| `fail-opaque-layer-hides-content` | **MISS** | Background rendered first; stories layered above via `<Sequence>`; HudBar on top via z-index 200. No opaque full-frame layer found above story content. |
| `fail-loop-drag` | **MISS** | No looping elements. |
| `fail-highlight-wrong-position` | **MISS** | No coordinate-sensitive highlights. |
| `fail-text-overlaps-adjacent` | **MISS** | Beat text uses `maxWidth: 1300` with wrapping; stills reviewed — no visible overflow or collision. |

---

## Human-only questions (cannot verify from stills alone)

1. **Countdown drama** — The countdown digits are 320px Fredoka on 1920px canvas (~17% of screen height). At 1s per digit this should feel punchy. But "does it feel dramatic enough?" is a human-only judgement — only watching the first 5 seconds confirms it.

2. **Beat pacing at full watch-through** — Each beat is 5s uniform. Reading 15 beats over 75s is the video's densest segment. A human should confirm the rhythm feels like a countdown-show's "beats cruise" rather than a catalogue drills.

3. **Fredoka vs fallback font** — Font loads at module level via `loadFont()`. If Fredoka doesn't load in the playback environment, fallback is `Nunito → system-ui → sans-serif`. The rounded bubble style could change. Verify Fredoka renders in the review context.

---

## Predicted verdict

**`pass`** — No hard-check failures. No clear fail-resemblances. Two human-only notes (countdown drama, beat pacing at full watch). One near-resemblance to `fail-too-slow-uniform-pacing` that I am NOT calling a hit — the content justifies the time — but the human should verify.

> "I expect the human to pass this cut because: all deterministic checks clean, no fail-resemblances confirmed, visual still review shows clean layout with correct accent tracking, HUD progress pips correct, readable text at all reviewed frames. The two human-only questions are about dynamics only watchable in motion — they are not predictable from stills."

**Confidence: LOW** — Library has only 1 real held-out verdict (1 MISS). Judge is in pre-warn only mode. Human gate fully on.

---

## Files

- Container output: `/tmp/ai-top5-edition-001-browser.mp4`
- Browser-safe: h264 · yuv420p · 30/1 fps · moov-first · 4425 frames · 147.5s
- Copy command: `docker cp <container>:/tmp/ai-top5-edition-001-browser.mp4 /srv/project-bright/ai-top5-edition-001.mp4`
