# Experiment 001 — Triangle Split Promo

> **RETIRED.** The `triangle_split_promo` template and its `TriangleSplitPromo` composition were
> removed during the pre-release consolidation. This record is kept as history — the commands below
> no longer resolve. Nothing was extracted from it: its wedge geometry was hardcoded to 1920x1080
> pixel constants (`APEX_X = 1420`, `UPPER_ORIGIN_Y = 200`) rather than derived from the
> composition, and its default `videoSrc` pointed at a file that is not in `public/`, so it could
> not render from a clean clone. The one transferable idea — animating a `clip-path` polygon from
> `useCurrentFrame()` — is already in the animation rules in `CLAUDE.md`. Recoverable from git
> history.

**Template:** `triangle_split_promo`  
**Date:** 2026-05-06  
**Status:** first render — gradient fallback, no footage

---

## Goal

Prove that a layered Remotion composition can produce a professional-feeling developer promo without requiring polished footage. Test the angular panel layout, side accent slice system, and CTA end card as reusable structural components.

---

## Assets used

| Asset | Status | Notes |
|-------|--------|-------|
| Primary video | ABSENT | Gradient fallback in use — mark in production |
| Logo | ABSENT | Not yet integrated |
| Audio | ABSENT | Silent render |
| Font | System | Should be replaced with loaded display font |

---

## Template used

`src/templates/triangle_split_promo/TriangleSplitPromoComposition`

Components:
- `BackgroundVideoLayer` — animated dark gradient with two ambient orbs and technical grid
- `SideVideoSlices` — 100px accent strips on left/right edges, scan-line texture
- `TriangleTextPanel` — parallelogram-clipped dark panel, staggered text reveal
- `CTAEndCard` — full-screen dark card, text + button with scale animation

---

## Frame budget

| Section | Frames | Duration |
|---------|--------|----------|
| Intro   | 0–90   | 3s       |
| Middle  | 90–510 | 14s      |
| Outro   | 510–600| 3s       |
| Total   | 600    | 20s      |

---

## What looked good

- Angular clip-path on the panel creates a dynamic, non-slideshow feel
- Layered composition approach (background → slices → panel → CTA) is clean and extensible
- Side slices slide in with good timing and add structure without overwhelming
- Staggered text reveal (hook → middle → proof) creates natural pacing
- CTA end card is visually distinct from the main content section
- Gradient fallback is usable as a proof-of-concept — not embarrassing

---

## What looked weak

- No real footage makes the background static despite animation
- System fonts lack the visual weight needed for a strong hook
- Panel text area is generous — could benefit from a sub-animation between middle frames
- Proof line feels disconnected from the hook — needs tighter copywriting
- No audio means the pacing feels slower than it should at 17s middle section

---

## Next improvements

1. Load a display font (e.g. Inter or Outfit) via @remotion/google-fonts
2. Add a `CaptionBlock` component for progressive subtitle reveals
3. Add subtle particle or noise overlay to the background
4. Connect a real video asset to `BackgroundVideoLayer.src`
5. Add a second message beat in the middle section (frames 300–450)
6. Consider reducing total duration to 15s for Shorts — 20s may be too long without audio

---

## Render commands used

```bash
# Single frame checks (did not do full render in this experiment)
npx remotion still TriangleSplitPromo --frame=30 --scale=0.5
npx remotion still TriangleSplitPromo --frame=300 --scale=0.5
npx remotion still TriangleSplitPromo --frame=570 --scale=0.5

# Full render (run when ready)
npx remotion render TriangleSplitPromo out/triangle_split_promo_001.mp4
```
