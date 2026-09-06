# Scene checklist — before any full render

Run this per chapter. Every box must be ticked **before** the still-preview gate, and the gate must
pass **before** a full render. A failed box is a build bug, not a judgement call — fix it.

## Build & fidelity

- [ ] **Frame budget correct.** The `<Composition>` `durationInFrames` matches the Bible §6.2 table
      for this chapter (e.g. `C04MapRecolour` 1650, `C05GenderInnerDivision` 1800), 1920×1080 @ 30fps.
- [ ] **Diagram enter present.** Scene opens on the diagram, this chapter's pillar lights in its
      accent (others dim), camera pushes into the node, node glow crossfades to the product surface.
- [ ] **Diagram exit present.** Surface collapses back into the node, camera pulls out, next pillar
      pre-glows; the seam into the next chapter is timed.
- [ ] **Product surface is recreated + animated, not a screenshot.** Built from reused
      `mygov-ab-video` components and real data, driven frame-based. (Only allowed image: the public
      WriteToThem snapshot, captioned as a recreated action path.)
- [ ] **Engineered gaps honoured.** Any §9 workaround for this chapter is real (e.g. C04 two-layer
      `UKMap` crossfade), not faked.

## Interaction & captions

- [ ] **Cursor reads as a real user.** Eased path between targets, `SPRING` on arrival, ripple on
      click, two ripples on double-click, selection highlight + "Copied" chip where the spec selects.
- [ ] **Cursor leads each caption by a beat.** Action fires ~6–12f before the label/subtitle naming it.
- [ ] **Every narration idea captioned.** All §5 captions for this chapter are on the track (silent
      movie — no audio); reading-pace rule met (hold ≥ `max(1.8s, chars × 0.07s)`, ≤ ~9 words, 6f
      in / out); captions sit above product footage.

## Palette, claims, sign-off

- [ ] **Palette matches chapter accent.** On-screen accent equals the locked §2.1 hex; base
      BG `#07090f` / CARD `#111827` / TEXT `#e8eaf0`.
- [ ] **Claims grounded.** No overclaim, no faked external click-capture, no "message sent" (stop
      before send), no "all countries supported"; the chapter's §4 honesty guardrails show on screen.
- [ ] **Stills approved.** Key frames rendered, contact sheet reviewed, human sign-off recorded
      (`record-final-video` Phase 6).
- [ ] **Slot record refreshed.** The chapter's slot record is written/updated and matches the Bible's
      target record (layers back→front, motion arc, focal, palette, `violations: none`).

## Exact commands (state order; run lint, then stills, gate, then render)

```bash
# 1. Type-check + lint (must pass before any render)
npm run lint

# 2. Key-frame stills for the gate (entrance-end, a hold frame, exit-start, + signature beat ±N)
npx remotion still C04MapRecolour --frame=40  --scale=0.5 -o previews/C04-recolour-40.png
npx remotion still C04MapRecolour --frame=150 --scale=0.5 -o previews/C04-recolour-150.png
npx remotion still C04MapRecolour --frame=164 --scale=0.5 -o previews/C04-recolour-164.png
npx remotion still C04MapRecolour --frame=300 --scale=0.5 -o previews/C04-recolour-300.png

# 3. >>> Still-preview review gate + slot record + human sign-off must PASS here <<<

# 4. Full render — only after the gate passes
npx remotion render C04MapRecolour
# ...repeat per chapter, then assemble + render the master:
npx remotion render MyGovFinal
```

Frame reference at 30fps: `--frame=30` = 1s, `--frame=300` = 10s. Replace the composition id and
frames with the chapter under build (ids and budgets in Bible §6.2).
