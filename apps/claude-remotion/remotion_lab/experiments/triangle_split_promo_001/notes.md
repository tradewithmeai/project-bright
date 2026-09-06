# Experiment 001 — Manual Review Notes

Template: `triangle_split_promo`  
Date: 2026-05-06  
Status: [ ] reviewed

---

## Frame checks

| Frame | Time | What to check |
|-------|------|---------------|
| 0     | 0s   | Background visible, side slices not yet present |
| 30    | 1s   | Panel slide-up begins |
| 75    | 2.5s | Panel fully in position |
| 100   | 3.3s | Hook text fully visible |
| 160   | 5.3s | Middle text fully visible |
| 240   | 8s   | Proof line visible |
| 510   | 17s  | CTA card begins fade |
| 570   | 19s  | CTA button fully scaled |
| 599   | ~20s | Final frame |

---

## Visual quality notes

Panel:
- [ ] Angular clip-path looks intentional, not broken
- [ ] Text readable at intended font sizes
- [ ] Accent line grows cleanly

Background:
- [ ] Gradient orbs provide sense of depth
- [ ] Grid is subtle, not distracting
- [ ] Overall tone works for developer content

Side slices:
- [ ] Slide-in timing feels punchy, not slow
- [ ] Width and opacity appropriate — accent without distraction

CTA:
- [ ] Card reads cleanly
- [ ] Button stands out against dark background

---

## Pacing notes

[ ] Intro (0–3s): hooks attention  
[ ] Middle (3–17s): readable without being slow  
[ ] Outro (17–20s): CTA has enough time to register

---

## Replace before production

- [ ] Background: replace gradient fallback with real footage via `videoSrc` prop
- [ ] Text: replace with actual campaign copy from scene_spec
- [ ] Font: load proper display typeface via @remotion/google-fonts
- [ ] Audio: add background track or SFX

---

## Open questions

- Does the angular panel read well on mobile screens (YT Shorts)?
- Does the hook text size feel right relative to the 1080x1920 canvas?
- Is 17s of middle content too long without sub-animations?
