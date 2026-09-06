---
name: explainer-arc
description: Structure an explainer video as a proven narrative arc — Hook → Problem → Solution → Proof/Demo → CTA — and map each beat to a frame budget. The storytelling + scene-budget layer for a 90–180s explainer. Owns the ARC and the scene-type→duration mapping; defers per-caption reading-floor to silent-caption-system, cross-cut rhythm to video-tempo, and product-screen footage to make-product-footage. Reconciled to how videos actually ship here (bespoke Remotion `<Series>`, project tokens), not a generic template.
metadata:
  tags: explainer, narrative, structure, script, scene-budget, arc, hook, cta, remotion
---

## When to use

Use when a brief needs to become a **structured explainer** — a 90–180s piece that teaches/sells one idea through a deliberate arc. It is the *storytelling + scene-budget* layer: it decides what beats exist, in what order, and how many frames each gets. It is NOT the caption-timing engine, the tempo engine, or the footage engine — those are sibling skills it calls (see Division of labour).

**Do not use for:** social clips, trailers, loop animations (different pacing), or a single hero scene with no narrative arc.

> Provenance: distilled from the `remotion-explainer-video` *pipeline* skill (which runs inside the Susan/prompt pipeline and requires a brief). This is the **reusable, reconciled** sibling — same narrative knowledge, verified against the shipping mygov build, brought under the improver + judge loop. The pipeline skill stays intact; this one is testable in our system.

## The arc (the core knowledge)

```
HOOK (4–6s) → PROBLEM (4–8s) → SOLUTION (6–8s) → PROOF/DEMO (per step 7–12s) → CTA (5–6s)
```

- **Hook** — grab attention in the first ~5s: a real stat, a sharp question, a bold claim, a visual surprise. **Do not name the product before the hook lands.**
- **Problem** — one pain point, named clearly; make the viewer feel it. One problem only.
- **Solution** — the product as the direct answer. The core promise, not a feature list. The product name appears **here**, not earlier.
- **Proof/Demo** — show it working: real captured product screens (see make-product-footage — capture-first), stats, step-by-step. This is the body.
- **CTA** — exactly **one** action. Clear, low-friction.

### Script-first discipline (do this before any code)
Write the **shot script** — every on-screen line, in order, tagged by beat — before building. Rules: each line short (aim ≤40 chars/line, ≤4 lines on screen); the product name first appears at Solution; **every stat/claim sourced from the brief, never invented** (placeholder `[STAT: …]` + flag if missing); on-screen text must match the script verbatim downstream.

### Scene-type → frame budget (30fps)
| beat / scene type | frames | seconds |
|---|---|---|
| Hook — bold stat/claim | 120–150 | 4–5 |
| Hook — question/visual surprise | 150–180 | 5–6 |
| Problem — 1 line | 120–150 | 4–5 |
| Problem — 2 lines staged | 180–210 | 6–7 |
| Solution — product intro | 180–240 | 6–8 |
| Demo step — screenshot + label | 210–270 | 7–9 |
| Demo step — animated walkthrough | 270–360 | 9–12 |
| Stat/proof card | 150–210 | 5–7 |
| CTA | 150–180 | 5–6 |

Total target **90–180s (2700–5400f)**. Over 180s → propose cuts; under 90s → propose expansion. Produce a scene table (label · frames · seconds · transition-out) and confirm the sum before coding.

## Division of labour (do NOT duplicate these — call the sibling)
- **Per-caption reading floor** `max(1.8s, chars×0.07s)`, on-screen text legibility, the silent-caption track → **silent-caption-system** (and it's mechanised in `scripts/video-checks.cjs`).
- **Cross-cut rhythm** (quick/slow "train" tempo, hold frames between beats, don't stack two slow stations) → **video-tempo**. The scene budgets above are starting points; video-tempo tunes the rhythm across the whole cut.
- **Product-screen footage** (capture-first vs recreate decision) → **make-product-footage**.
- **Terminal/dev-tool screens** → **terminal-recreation**.

## Reconciled to the shipping build (verified, not assumed)
- **Assembly: bespoke `<Series>` from `remotion`** is what the hero cut (`MyGovFinal.tsx`) ships — `<Series><Series.Sequence durationInFrames={f}>…`. Build the arc this way by default.
- **`@remotion/transitions` (`TransitionSeries`, `fade()`, `slide()`) IS installed** (4.0.467) but was **NOT** used in the shipping cut — that cut handled entrances/exits with frame-based opacity in each scene. Treat TransitionSeries as a **valid alternate path, unverified in our hero cut**: if you use it, verify it composites as expected on stills before relying on it. Do not present it as the house default.
- **Easing matches:** house `EASE_OUT = [0.16, 1, 0.3, 1]` (entrance) and `EASE_IO = [0.4, 0, 0.2, 1]` (state change) are in `src/tokens.ts` — use those, don't redefine.
- **Tokens are project-specific:** colours/fonts live in `src/tokens.ts` (BG `#07090f`, ACCENT `#7dd3fc`, TEXT `#e8eaf0`, …). Any template hexes from the origin skill (`#38bdf8` etc.) are brand-configurable defaults — use the project's tokens, not the template's.

## Hard rules (house rules — non-negotiable)
1. **Frame-based motion only:** `useCurrentFrame()` + `interpolate()` (clamped). **No CSS `transition`/`animation`/Tailwind `animate-*`** — they don't render in Remotion (`scripts/video-checks.cjs` enforces this).
2. **Determinism:** no `Math.random`/`Date`/clock in render — seeded hash only.
3. **Hold frames are mandatory:** never end a scene mid-animation; leave ≥20f settled at each scene end. (video-tempo owns the detail.)
4. **Don't invent stats/claims** — brief-sourced only; placeholder + flag if missing.
5. **On-screen text matches the script verbatim.**
6. **CTA = one action.**
7. Verify scene-duration constants match between the composition and each scene file.

## Self-evaluation (this skill checks itself against current reality)
- **Arc beats present & ordered?** A built explainer has Hook→Problem→Solution→Proof→CTA, product-name-at-Solution, single-action CTA.
- **Assembly matches shipping code?** Default guidance is bespoke `<Series>` (verify against `MyGovFinal.tsx`); TransitionSeries is flagged alternate-not-default, and the install state of `@remotion/transitions` in `package.json` is current.
- **No duplication of sibling-owned knowledge?** Reading-floor / tempo / footage rules are *referenced*, not re-specified here (check silent-caption-system, video-tempo, make-product-footage still own them).
- **Easing/tokens cite `src/tokens.ts`**, not template literals.
- **House rules current?** Frame-based-only, determinism, no-CSS-animation match `scripts/video-checks.cjs` and CLAUDE.md.

## Changelog (append-only — newest first)
- v1 (2026-06-02): Created by reconciled extraction from the `remotion-explainer-video` pipeline skill (entered via the skill-improver reconcile gate, not transcribed). Verified against the shipping mygov build: confirmed bespoke `<Series>` is the house assembly and flagged `@remotion/transitions` as installed-but-unused-in-hero-cut; aligned easing/tokens to `src/tokens.ts`; delegated reading-floor/tempo/footage to the sibling skills instead of duplicating. Added self-eval rubric. Pipeline skill left intact.
