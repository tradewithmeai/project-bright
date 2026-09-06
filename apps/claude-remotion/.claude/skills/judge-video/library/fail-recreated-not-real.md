# FAIL · recreated-not-real

- **verdict:** FAIL (rejected outright — the strongest negative verdict in the project)
- **surface:** the whole first full cut (`mygov-final-video`, superseded)
- **human's words:** "overall terrible… feels laboured… no point watching to the end"
- **date / version:** early build, v1-era

## Diagnosis
The product screens were **recreated** as Remotion components and **placeholder boxes** instead of the real product. It used a relic `UKMap` and fake panels. The cut read as a *mockup of* the product, not the product — and recreation work that "looks roughly right" reads as laboured and fake on screen, killing trust before the payoff.

## Fix
Rebuilt around **real captured footage**: Playwright screenshots of the live site (`mygov-hackathon.vercel.app`) composited under a virtual camera (GuidedZoom), with frame-based overlays. No recreations for product screens; recreation reserved for non-capturable dev tools (terminals). See `win-real-captures`.

## Signature (what to detect)
- Product/UI screens built from styled `<div>`s, fake data, or placeholder rectangles where a real capture should be.
- Relic/known-stale components on screen (e.g. an old `UKMap`).
- The cut's own record describing surfaces as "recreated"/"placeholder"/"mock" for screens that exist live and could be captured.
- Contrast with the live policy: the `repo-ui-to-motion` skill is **capture-first** for product screens.

## Why this is a detector, not a target
This is the single most important failure mode in the project's history. A new cut that recreates a capturable product screen resembles this fail — flag it. (It does NOT mean "never recreate" — terminals, dev tools, and non-capturable micro-states are legitimately recreated.)
