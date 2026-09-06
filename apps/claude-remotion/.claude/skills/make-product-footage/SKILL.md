---
name: make-product-footage
description: Put a real product screen on screen in motion for a Remotion cut. The dominant path is capture-first — composite REAL Playwright captures of the live product under a virtual camera (GuidedZoom) with frame-based overlays + captions. Recreate the UI as a data-driven Remotion surface ONLY when there is no clean capture, the micro-state is interactive in a way a still can't carry, or the surface is a dev tool. Both paths are fully reproducible; neither is a flat, motionless slide.
metadata:
  tags: remotion, product-footage, capture-compositing, recreate-ui, animation, data-driven, mygov, frame-based
---

## When to use

Use this skill whenever a video beat must show a **real product screen in motion** — a search, a map
recolour, a drawer opening, a list populating. It enforces the project's product-footage rule and routes
you to the right of two techniques.

The rule is **not** "always recreate" and **not** "always screenshot." It is: a product screen must read
as the **live product in motion**, never as a dead, motionless slide. There are two ways to achieve that,
and choosing the right one is the first decision (see the capture-first gate below). The shipping MyGov cut
(`mygov-campaign-video`) uses **both** — captures for the product web pages, recreation for non-captured or
interactive DOM.

This skill produces ONE animated surface for ONE product screen/state-flow. The
[build-film-section](../build-film-section/SKILL.md) skill calls this skill to build
the product layer of a chapter (note: that hand-off must route to the capture-first branch for live product
web pages — see Cross-skill note); [record-final-video](../record-final-video/SKILL.md) records the result.

---

## The capture-first decision gate (decide this FIRST)

The shipping cut proved the dominant product-footage path is **capture-and-composite**, and the project's
own `public/captures/CAPTURES.md` (line 4) instructs it verbatim:

> "These are REAL product pixels captured via Playwright at 1920×1080. Use these as the hero footage.
> Do NOT recreate the UI — composite these with the finger cursor + captions + spider-web transitions."

So pick a branch before building:

- **CAPTURE & COMPOSITE (default for live product web screens).** If you can hit the screen live and
  capture it at 1920×1080 (the lens/map page, the globe, an MP page, WriteToThem), do that: bake a real
  capture, move a virtual camera over it (`GuidedZoom`), and add frame-based overlays + captions. This is
  how `src/sections/RapidFlow.tsx` (the shipping "03 Simple User Flow" chapter) and `S3LiveFlow.tsx` build
  the product spine. Jump to the **Capture-compositing playbook** below.
- **RECREATE as a Remotion surface.** Build a data-driven DOM/SVG surface only when:
  1. there is **no clean capture** of the state you need (e.g. a SEQUENCE of motion a still can't hold), or
  2. the micro-state is **interactive in a way a still can't carry** (a control opening + typing), or
  3. you need a **coordinate-space rebuild** because a static PNG gives guesswork anchor positions for
     rings/connectors/camera, or
  4. the surface is a **dev tool** (terminal, editor, chat) → defer to
     [terminal-recreation](../terminal-recreation/SKILL.md).

  Worked recreations that ship in the current cut: `src/surfaces/web/CivicWebHtml.tsx` (a deliberate
  PNG→recreated-DOM swap — each node OWNS its `cx/cy` fraction so rings/connectors/camera land on real
  coordinates; ships in `S4MassAction` and `S8Close`) and `src/sections/build/SearchReveal.tsx` (the
  "Search MP" control recreated from measured `getBoundingClientRect` geometry, composited onto a capture
  inside `RapidFlow`). When you recreate, recreate faithfully — Phases 1–5 below govern that branch.

The two branches are not in tension: capture is the hero footage; recreation supplies the interactive
overlay or the re-anchorable diagram that a baked pixel can't.

---

## Domain facts (fixed)

- **Motion is frame-based only:** `useCurrentFrame()` + `interpolate()` + `<Sequence>`. **CSS
  `transition` / CSS `animation` / Tailwind `animate-*` do NOT render in Remotion — forbidden.** Static
  CSS (gradients, `clip-path`, `mixBlendMode`, `filter: blur()`, transforms computed per-frame) is fine.
  `EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1)`; `SPRING = Easing.bezier(0.34, 1.56, 0.64, 1)`. 1920×1080 @ 30fps.
- **Source of truth = the shipping cut `<external-project>`.**
  - The film is `src/MyGovFinal.tsx` — a `<Series>` over a flattened `ITEMS` list built from the `SECTIONS`
    array (chapter card → section, repeated; the finale has no card; `EndCard` last). **`SECTIONS` is the
    film.** `src/Root.tsx` registers extra standalone previews (e.g. `S3LiveFlow`, `WebHtmlTest`,
    `CodexPreview`) that are NOT in the cut — don't treat a `Root.tsx` registration as proof a surface ships.
  - **Real captures** live in `public/captures/` (`capture-globe.png`, `capture-sourcelens.png` /
    `-voted` / `-gender`, `capture-writetothem.png`, `capture-search-*`, `capture-explain.png`,
    `diagram-platform.png`, `diagram-web-journey.png`, `qr-mygov.png`). `public/captures/CAPTURES.md` is the
    blessed manifest: what each capture is, the EXACT live figures, and the do-not-recreate instruction.
  - **The shared primitives the cut actually reuses** (this is the real "reuse before rebuild" surface):
    - `src/surfaces/GuidedZoom.tsx` — the virtual-camera primitive. `Box = { cx, cy, scale }` (cx/cy are
      0..1 of the 1920×1080 canvas; the point brought to screen centre); props `src, from, to, at, dur,
      jitter, children`. Children render as a non-zoomed overlay layer over the baked capture.
    - `src/captions/Caption.tsx` — `Captions` (track + optional `sceneEndS`) and the `CaptionLine` type
      (`in_s`, `out_s`, `text`, `style: "title"|"kicker"|"subtitle"|"label"`, `accent`). Caption mechanics
      are owned by [silent-caption-system](../silent-caption-system/SKILL.md) — defer, don't re-describe.
    - `src/surfaces/ClickFlash.tsx` — `ClickFlash` + `Click = { f, x, y }` (x/y fractions of 1920×1080):
      the cursor/click ripple. Fire a click ~7f BEFORE the crossfade it causes (cause→effect).
    - `src/sections/build/SearchReveal.tsx` — reusable recreated "Search MP" control overlay.
  - **Palette/tokens (`src/tokens.ts`, `src/accents.ts`):** `BG #07090f`, `CARD #111827`, `ACCENT #7dd3fc`;
    `EASE_OUT [0.16,1,0.3,1]`, `SPRING [0.34,1.56,0.64,1]`; `accents.ts` `VOTE_FILL` Aye `#86efac` /
    No `#fca5a5`; `accents.ts` `STATS` `{ mps: 647, votes: 157542, questions: 11887 }`. Sample real hexes;
    map to these constants where they match; keep brand/party/vote colours exact.
- **The legacy parts bin `<external-project>\mygov-ab-video`** is the OLD vertical
  (1080×1920) AB-video. Its components (`UKMap`, `SearchBar`, `MPHeader`, `VoteRows`, `ExplainDepthCard`,
  `JargonTranslator`, `StatCounters`, `LensPanelLive`, `VotePill`, `ParticleBurst`, `WordByWord`) were copied
  into `mygov-campaign-video/src/components/` but are **orphaned dead code** there — only `WordByWord` has any
  non-self import (1, in `surfaces/WriteToThemPanel.tsx`). `UKMap.tsx` is authored `const W = 1080, H = 1920`
  (vertical) and will NOT drop into the 1920×1080 landscape cut without a rewrite. Do **not** plan to "reuse"
  these by default — they are not what the film uses.
- **Real headline figures (never invent), from `CAPTURES.md` / `accents.ts`:** 647 MPs · 157,542 votes &
  divisions · 11,887 written questions · live on Vercel. Featured division: **King's Speech 307 Aye / 171 No**
  (live value; supersedes the old 305/165).

---

## Phase 0 — Locate the source of truth

1. Read `src/MyGovFinal.tsx` to see the `SECTIONS` array and which component fills the chapter you're
   building. The film is `SECTIONS`; `Root.tsx` previews are not the cut.
2. Read `public/captures/CAPTURES.md` — does a real capture of this screen already exist? If yes, you are
   almost certainly in the **capture-and-composite** branch (see the gate).
3. Open the section file that fills the chapter (e.g. `src/sections/RapidFlow.tsx`) and read how it composes
   captures + `GuidedZoom` + overlays + captions. Reuse that pattern.
4. Only if you are in the **recreate** branch: identify the exact UI being recreated (a route/template or an
   existing surface like `CivicWebHtml`), read it, and read its CSS/JS to learn the real layout and behaviour
   — do not work from memory or a screenshot. **Reuse before rebuild** applies to the shared primitives above
   (`GuidedZoom`, `Captions`, `ClickFlash`, `SearchReveal`, `CivicWebHtml`), NOT to the orphaned `mygov-ab-video`
   component bin.

---

## Capture-compositing playbook (the default branch)

The pattern the shipping `RapidFlow.tsx` proved:

1. **Capture real pixels with Playwright at 1920×1080** (navigate → wait for WebGL/iframes → dismiss tour →
   interact → screenshot). Register the file in `CAPTURES.md` with what it is and the exact live figures.
2. **Move a camera over the capture with `GuidedZoom`** — `from`/`to` framings as `Box = {cx, cy, scale}`,
   arriving over `[at, at+dur]`, optional `jitter` for a "lands with a judder" arrival. Build a chapter as a
   `<Sequence>` chain of beats, each beat one camera move.
3. **Anchor overlays to MEASURED fractional capture coordinates.** Overlays (a `Chip`, a
   `SearchReveal`, a `ClickFlash`) are positioned in 0..1 fractions of the baked pixels — e.g. the live
   "Search MP" control sits at frac `(0.556, 0.774)`, verified by cropping `capture-sourcelens.png`. Measure;
   do not eyeball.

   **Do NOT add a highlight ring / pulse ring / glowing circle over the thing you want looked at.**
   See Hard rule 8 — it is banned, and it is the overlay this step used to name first.
4. **Hold the camera STATIC during a typing/overlay beat** so a fixed overlay stays registered on the baked
   pixel (GuidedZoom children are a non-zoomed layer; if the camera rides, the overlay drifts off its target).
   Do the push in the NEXT beat.
5. **Crossfade seam discipline.** Beats OVERLAP by `XFADE` frames (each beat starts `XFADE` before the prior
   one ends); a per-beat opacity envelope multiplies an independent fade-in and fade-out, each a strict
   2-point `interpolate` ramp — never a non-monotonic/duplicate input range (the documented black-seam bug).
   Reference: `RapidFlow.tsx` `beatOpacity`; `S3LiveFlow.tsx`'s `Screen` envelope.
6. **Cause → effect.** Fire the click/cursor (`ClickFlash`) ~7f BEFORE the crossfade it triggers so the
   recolour visibly responds to the click (`S3LiveFlow.tsx` comment, lines ~134).
7. **Captions** ride as a single global track at the section root (absolute seconds). Defer mechanics to
   silent-caption-system.

Camera mechanics themselves overlap with [diagram-flythrough](../diagram-flythrough/SKILL.md) (virtual camera
over a static image); use its conventions for the camera, this skill for the product-footage decision and the
overlay/registration discipline.

---

## Phase 1 — Extract the visual contract (recreate branch)

Capture, from the real source (see [./rules/fidelity-checklist.md](./rules/fidelity-checklist.md)):
- **Layout:** panes / grid / header / footer; left-vs-right; fixed vs scrolling regions.
- **Colour:** sample the real hexes; map them to `tokens.ts`/`accents.ts` constants where they match; keep
  brand/party/vote colours exact.
- **Typography:** family, weight, sizes, casing.
- **Key elements & states:** search box, dropdown, vote rows, result bar, drawer, legend — and the states each
  moves through. For an interactive control, capture computed styles + `getBoundingClientRect` (as
  `SearchReveal` does) so the recreation lands on real geometry.
- Take ONE reference screenshot for side-by-side comparison only (not for the video).

## Phase 2 — Extract the data (recreate branch)

- Bind to the **real** data the UI shows. Never fabricate figures, names, or vote outcomes. Use the live
  values in `CAPTURES.md` (647 / 157,542 / 11,887; King's Speech 307/171). See
  [./rules/data-binding.md](./rules/data-binding.md). For a coordinate rebuild, the data includes each node's
  real position (cf. `CivicWebHtml`'s `webData.ts` `cx/cy`).
- If a specific record isn't available, pick a real one that is.

## Phase 3 — Rebuild as a Remotion surface (recreate branch)

- Build (or wrap) a component that renders the recreated DOM/SVG with the real palette and real data.
- Signature: take the data as props plus an animation clock derived from `useCurrentFrame()`. Keep the surface
  **reusable** — the real frame-number convention is **absolute frames at the section root, relative inside a
  `<Sequence from={N}>`** (a `<Sequence>` re-bases frame 0 to N). Don't bury magic absolutes deep inside a
  reusable leaf; drive its timing from props.
- Match the layout to the visual contract within tolerance (fidelity checklist). Use the real fonts/colours/spacing.

## Phase 4 — Animate the interaction (recreate branch)

Drive the UI through its **real** states with frame-based motion, synced to a visible cursor — recreate the
*user's path*, not an abstract montage:
- typing (typewriter via char-count from frame), dropdown reveal (staggered opacity/translateY), row click
  (`ClickFlash` ripple), recolour (opacity crossfade between two states — never an instant flip), drawer slide
  (`translateX`), scroll (`translateY`), selection highlight + "copied" chip.
- Every motion is `interpolate(frame, [a,b], [from,to], { easing: EASE_OUT, ...clamp })` or a `<Sequence>`.
- Hold each state long enough to read; let the cursor lead the action by a beat (~7f before its effect).

## Phase 5 — Fidelity check (both branches)

Run [./rules/fidelity-checklist.md](./rules/fidelity-checklist.md): layout parity, colour parity within
tolerance, typography, spacing, the **right data**, the right **states**, cursor realism, legibility at 1080p.
Confirm: zero CSS-animation; data is real; it reads as the **live product**, not a slide. If it looks like a
motionless screenshot, it has failed — add the camera/overlay (capture branch) or rebuild the interaction
(recreate branch).

---

## Hard rules (never violate)

1. **Live, not dead.** A product screen must read as the live product in motion. For live product web screens
   the default is **capture real pixels and composite** (camera + overlays + captions) per `CAPTURES.md`;
   recreate as a Remotion surface only per the decision gate (no clean capture / interactive micro-state /
   re-anchorable diagram / dev tool). Never drop a flat, motionless screenshot.
2. **Frame-based motion only.** No CSS `transition`/`animation`, no Tailwind `animate-*`. Static CSS is fine.
3. **Real data only.** Bind to the real records and the live figures (647 / 157,542 / 11,887; King's Speech
   307/171); never invent figures, names, or vote outcomes.
4. **Reuse the real shared primitives before rebuilding** — `GuidedZoom`/`Box`, `Captions`/`CaptionLine`,
   `ClickFlash`, `SearchReveal`, `CivicWebHtml`, and the `tokens.ts`/`accents.ts` palette. Do NOT default to
   the orphaned `mygov-ab-video` component bin (all orphaned; `UKMap` is wrong-aspect 1080×1920).
5. **Honour the real palette and layout.** Sample real hexes; match the real structure within tolerance.
6. **Never claim a UI does something it doesn't.** Recreate/composite only real states; if a flow stops short,
   say so (cf. `RapidFlow` beat 5: "Honest: this is the action PATH — it stops before send"). If a feature is a
   placeholder, do not show it working.
7. **Recreate the user's real path** through the screen, not a decorative animation of it. Anchor overlays to
   MEASURED fractional coordinates on the baked capture; hold the camera static while a fixed overlay is on.
8. **NO HIGHLIGHT RINGS.** Never draw a ring, halo, pulsing circle or glowing outline over a control to
   say "look here". It has been tried on video after video and has never once survived review — the
   operator has rejected it every time, most recently twice inside one build (Linel promo, 2026-08-05:
   over the Generate button, then over a feedback slider). It reads as a screen-recording tutorial
   annotation, and it is worst over a control that is already the brightest object in frame.

   **Point with the camera and with timing instead:** arrive on the target, HOLD STILL while it
   matters, and let the copy name it. A held frame is emphasis; a circle is a label saying "we did not
   trust you to look". If a target cannot be found by eye, the framing is wrong — fix the framing.
   `ClickFlash` (a cursor and click ripple, showing a real user action) is a different thing and is
   still fine.

## Cross-skill note

[build-film-section](../build-film-section/SKILL.md) says it "calls make-product-footage to
build the product layer of a chapter." For **live product web pages** that hand-off now resolves to the
**capture-first branch** (captures + `GuidedZoom`), not a from-scratch recreation. Coordinate the wording when
that skill is next revised.

## Sub-files

- [./rules/fidelity-checklist.md](./rules/fidelity-checklist.md) — how to judge "does this read as the real
  product?", with a worked example (now the shipping capture-crossfade).
- [./rules/data-binding.md](./rules/data-binding.md) — binding real MyGov data and deriving vote fills (note:
  the live recolour now ships as a CAPTURE crossfade; the two-stacked-`UKMap` derivation applies only if you
  rebuild the map surface in the recreate branch).

---

## Self-evaluation (this skill's regression test — run it before trusting the skill)

Each check: **claim → code location that confirms it → how to test.** Any FAIL is drift to fix.

1. **Product-footage directive is capture-first, not "always recreate."** → `public/captures/CAPTURES.md:4`
   ("Do NOT recreate the UI — composite these…"). *Test:* grep `CAPTURES.md` for "Do NOT recreate"; the skill's
   hard rule 1 must route live product web screens to capture-and-composite, not forbid screenshots outright.
2. **Source-of-truth repo is `mygov-campaign-video`.** → `mygov-campaign-video/src/MyGovFinal.tsx` exists and
   exports `SECTIONS` + `MYGOV_TOTAL_FRAMES`. *Test:* the path the skill names in Phase 0 must contain
   `MyGovFinal.tsx`; if it points at `mygov-ab-video` or the Flask `mygov` as the render source, FAIL.
3. **The film is `SECTIONS`, not every `Root.tsx` registration.** → `MyGovFinal.tsx:23-34` (`SECTIONS`) vs
   `Root.tsx:43` (`S3LiveFlow` registered standalone, absent from `SECTIONS`). *Test:* a surface the skill calls
   "shipping" must appear in the `SECTIONS` array, not merely in `Root.tsx`.
4. **The shipping product chapter composites real captures via `GuidedZoom`.** → `RapidFlow.tsx:13-14,218-280`
   (imports `GuidedZoom`; `GuidedZoom src="capture-globe.png" / "capture-sourcelens.png" / "capture-writetothem.png"`).
   *Test:* grep `RapidFlow.tsx` for `staticFile`/`capture-`/`GuidedZoom`; if the skill claims this chapter is a
   hand-rebuilt DOM recreation, FAIL.
5. **Every "reuse before rebuild" component the skill names has ≥1 non-self import in the cut.** → grep
   `import .*(UKMap|SearchBar|MPHeader|VoteRows|ExplainDepthCard|JargonTranslator|StatCounters|LensPanelLive|VotePill|ParticleBurst|WordByWord)`
   over `mygov-campaign-video/src` returns only `WordByWord` (1). *Test:* if the skill's reuse list contains a
   component with 0 non-self imports, FAIL (it's orphaned dead code).
6. **No component the skill tells you to drop into the landscape cut is authored vertical.** → `UKMap.tsx:51`
   (`const W = 1080, H = 1920;`). *Test:* grep candidate components for `W = 1080, H = 1920`; a 1080×1920
   component presented as a 1920×1080 pane is a FAIL.
7. **The recreate branch is still alive and cited (don't let the capture fix delete it).** →
   `surfaces/web/CivicWebHtml.tsx:13-23` (deliberate PNG→DOM swap; shipped in `S4MassAction.tsx:82` +
   `S8Close.tsx:54`) and `sections/build/SearchReveal.tsx:4-12` (recreated from measured geometry; used in
   `RapidFlow.tsx:14,237`). *Test:* the skill must keep a recreate branch and cite at least one shipping
   recreation; a skill that says "always capture, never recreate" FAILS this and overfits the latest job.
8. **Worked example matches the shipping recolour (capture crossfade, not two stacked maps).** →
   `S3LiveFlow.tsx:128-130` (`Screen src="capture-sourcelens.png"` → `-voted.png` → `-gender.png`); click fires
   ~7f before its crossfade (`S3LiveFlow.tsx:~134`). *Test:* the fidelity checklist's signature example must be a
   capture crossfade gated by a cursor beat, not "two stacked `UKMap`s, interpolated `fillOpacity`."
9. **Palette/figure constants still hold.** → `tokens.ts:1-3,30-31` (`BG #07090f`, `CARD #111827`,
   `ACCENT #7dd3fc`, EASE/SPRING beziers); `accents.ts:19-29` (`VOTE_FILL` `#86efac`/`#fca5a5`; `STATS`
   647/157542/11887). *Test:* grep those values; any mismatch is drift.

---

## Changelog (append-only — newest first)

- **v3 (2026-08-05) — highlight rings banned; drift class: repeated-rejection.** The Linel promo used
  the playbook's "anchor a `PulseRing`" advice twice and the operator rejected it both times in one
  session ("it looks terrible", "stop using this effect. you always try it and it always looks
  terrible. it is a relic from previous videos and has never worked"). The instruction, not the
  instance, was the cause — step 3 named `PulseRing` first among overlays, so it kept getting reached
  for. Added **Hard rule 8** (no rings/halos/glowing outlines; point with camera and timing; a held
  frame is the emphasis) and struck `PulseRing` from the overlay list. `ClickFlash` is explicitly
  spared: a cursor showing a real user action is not the same device as a decorative highlight.

- **v2 (2026-06-01) — ground-up correction; drift class: inverted + stale-pointer + architecture-miss +
  convention-mismatch.** Code facts (all in `<external-project>`): (1) `CAPTURES.md:4`
  says "Do NOT recreate the UI — composite these…" and the shipping `RapidFlow.tsx` composites real
  `capture-*.png` through `GuidedZoom` — so the old hard rule 1 "Recreate, don't screenshot; screenshots are
  dead" was **inverted** for product web screens. Replaced it with a **capture-first decision gate** while
  KEEPING the recreate branch alive (cited `CivicWebHtml.tsx` PNG→DOM swap shipping in `S4MassAction`/`S8Close`,
  and `SearchReveal.tsx` measured-geometry recreation in `RapidFlow`) so the fix doesn't overfit the latest cut.
  (2) **Repointed every source of truth** from `mygov-hackathon/mygov-ab-video` + the Flask `mygov` to
  `mygov-campaign-video`; documented that the film is `SECTIONS` in `MyGovFinal.tsx`, not every `Root.tsx`
  preview. (3) **Replaced the 11-component "reuse" bin** (all orphaned in the current repo — only `WordByWord`
  has a non-self import; `UKMap` is wrong-aspect 1080×1920) with the real shared primitives `GuidedZoom`/`Box`,
  `Captions`/`CaptionLine`, `ClickFlash`, `SearchReveal`, `CivicWebHtml`. (4) Added the **capture-compositing
  playbook** (Playwright 1920×1080 → camera → measured-fraction overlay anchoring → static-camera-during-typing
  → `XFADE` crossfade-seam discipline). (5) Corrected the "no hard-coded frame numbers" claim to the real
  convention (absolute frames at section root, relative inside a `<Sequence>`). (6) Added a code-anchored
  `## Self-evaluation` rubric that would have caught this drift. Preserved verbatim: the frame-based-motion
  domain facts, EASE_OUT/SPRING, palette tokens, the phase loop, and the fidelity table.
- v1 — Original: "recreate the real UI, never a flat screenshot," pointing at `mygov-ab-video` + the Flask
  `mygov`, with an 11-component reuse list and a two-stacked-`UKMap` recolour worked example.
