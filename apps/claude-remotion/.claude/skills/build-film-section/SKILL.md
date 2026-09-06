---
name: build-film-section
description: End-to-end build loop that turns ONE narrative section of the MyGov campaign film into a built, review-gated Remotion section — composing the sibling skills (capture-first product footage, the diagram device, silent captions, the still-preview gate) under shared frame-based discipline. Each section is assembled into the master via the SECTIONS-array flatten model, not a per-chapter composition fan-out.
metadata:
  tags: remotion, walkthrough, orchestration, mygov, section, diagram, captions, slot, review-gate, capture-first
---

## When to use

Use this skill when you must turn **one narrative section** of the MyGov campaign film into **one
built, review-gated Remotion section** that shows a real product user-flow or proof beat. It is the
**orchestration skill**: it consumes a single section's spec and produces a single section component
(e.g. `RapidFlow`, `S5TechProof`) that is then flattened into the master, composing capture-first
product footage, the diagram device, a silent-caption track, and the still-preview gate.

It is how a **fan-out of agents builds the sections consistently**: each agent takes one section and
runs this same loop, so every section shares the diagram device, the caption language, the locked
palette, and the same review gate. Run the loop **in spec order** — read first (Phase 0), build the
surface and motion (Phases 1–5), gate (Phase 6), then assemble (Phase 7); do not full-render before
the gate. This skill **composes the sibling skills** rather than re-implementing them:

- **`make-product-footage`** — recreate a product surface as animated, data-driven Remotion **only when
  live capture is impossible** (Phase 2 fallback path). The shipped cut went capture-first; treat
  recreation as the exception, and note it where used.
- **`diagram-flythrough`** — open/close on the spider diagram and fly the camera (Phase 3).
- **`silent-caption-system`** — the on-screen narration track (Phase 5).
- **`terminal-recreation`** — the Codex/Claude/GPT agent windows for the build-story sections
  (`CodexSpawnSequence`, `S7BuildStory`).
- **`message-triggered-animation`** — message-driven beats (`MessageTrigger.tsx`).
- **`video-tempo`** — the fast guided-journey pacing (`RapidFlow`); tempo is authored up front.
- **`record-final-video`** — its **Phase 6 — Still-preview review gate** is what this skill calls
  before sign-off (Phase 6). Do not re-invent that gate; invoke it.

All siblings live alongside this skill in `apps/claude-remotion/.claude/skills/` and are all authored
on disk today (`diagram-flythrough`, `message-triggered-animation`, `record-final-video`,
`make-product-footage`, `silent-caption-system`, `terminal-recreation`, `video-tempo`). Reference them
by name.

---

## Domain facts (fixed)

- **The master is a `SECTIONS` array flattened into played order — NOT one composition per chapter.**
  `mygov-campaign-video/src/MyGovFinal.tsx` declares
  `SECTIONS: { C: React.FC; f: number; title?: SectionTitleProps }[]` and flattens it into an `ITEMS`
  list of `[chapter-card, section, chapter-card, section, …, finale, EndCard]`. The finale carries no
  card. `MYGOV_TOTAL_FRAMES` is **derived** from the array (`ITEMS.reduce(...)`), then assembled with
  one `<Series>` of `<Series.Sequence>`s (`MyGovFinal.tsx:23–57`). Individual sections are *also*
  registered as standalone `<Composition>`s in `Root.tsx` so they can be previewed/rendered alone.
- **1920×1080 landscape @ 30fps.** Convert frames↔seconds at 30: `seconds = frames / 30`. The shipped
  master is **6315 frames ≈ 3:30.5** (`VIDEO_RECORD.md`).
- **Frame-based motion ONLY.** `useCurrentFrame()` + `interpolate()` + `<Sequence>`. **No CSS
  `transition`, CSS `animation`, or Tailwind `animate-*`** — they do not render in Remotion. Always
  `clamp` both `extrapolateLeft`/`extrapolateRight`. Static CSS (gradients, `clip-path`, blend
  modes, `filter`) is allowed. (`RapidFlow.tsx` header states this rule verbatim.)
- **Easings (from `tokens.ts`):** exported as bezier control-point **tuples**, consumed via
  `Easing.bezier(...EASE_OUT)` — NOT as pre-built easing functions. `EASE_OUT = [0.16, 1, 0.3, 1]`
  for transit/entrance; `SPRING = [0.34, 1.56, 0.64, 1]` for arrivals/settles (its overshoot is the
  point — do not use it for every move); `EASE_IO = [0.4, 0, 0.2, 1]` (`tokens.ts:29–31`). Most
  sections inline the bezier directly: `const EASE = Easing.bezier(0.16, 1, 0.3, 1)`.
- **Capture-first; reuse-library is mostly orphaned.** Reusable surface components exist in
  `mygov-campaign-video/src/components/*` and in `<external-project>\mygov-ab-video`,
  but the shipped master imports **none** of them — every played section is built from real captures
  (`public/captures/`), procedural surfaces (`src/surfaces/`: `GlobeBuild`, `CivicWebHtml`,
  `BrandMark`), or from-scratch data-driven Remotion (`S5TechProof` count-ups). Do not assume the
  `components/*` library is the starting point; prefer a real capture, then a procedural/from-scratch
  surface, before reaching for that library.
- **The film is built in `mygov-campaign-video/`** (not `mygov-final-video/`, which is an abandoned
  per-chapter scaffold). All section components, `accents.ts`, `tokens.ts`, captures, and the master
  live there.
- **Frame budget is the contract.** Each section exports its own `*_FRAMES` constant
  (`S1_FRAMES=420`, `RAPIDFLOW_FRAMES=360`, `S4_FRAMES=600`, `S5_FRAMES=540`, `S6_FRAMES=720`,
  `CODEX_SPAWN_SEQ_FRAMES=478`, `S7_FRAMES=1260`, `S8_FRAMES=240`, `FIREWORKS_FINALE_FRAMES=510`,
  `ENDCARD_FRAMES=150`, chapter card `TITLE_FRAMES=58`). The master total is computed from the array,
  never hand-typed.
- **Chapter accent palette is locked** (`accents.ts`): `hub #7dd3fc`, `sourceLens #e4407a`,
  `map #38bdf8`, `explain #7c3aed`, `global #02a95b`, `agentParty #a3e635`, `buildSystem #f59e0b`,
  `distribution #f97316`, `mobile #2563eb`. Base palette (`tokens.ts`): BG `#07090f`, CARD `#111827`,
  TEXT `#e8eaf0`.
- **Real figures are locked** (`accents.ts` `STATS`): 647 MPs, 157,542 votes, 11,887 questions. Never
  invent figures.

---

## Phase 0 — Read the section spec (the contract)

1. Open the section's spec (the Production Bible §5/§6 and the current `VIDEO_RECORD.md` timeline).
   Extract: **purpose**, **accent / pillar**, **diagram transition** (if any), **beats** (with
   timecodes), **captions** (title/subtitle/label/kicker, with in/out seconds), **surfaces** (which
   captures or procedural surfaces), **claims/guardrails**, and the **chapter-card** text (number +
   title + "what this proves" subtitle).
2. Confirm the **honesty guardrails for this section**: no external-site click-capture claim, no
   "message sent" (the flow stops before send — see `RapidFlow` beat 5), "the UK is our first working
   adapter", agent features framed as newly built/road-test, AI framed as grounded acceleration.
   These are non-negotiable and must show on screen where the section touches them.
3. Note where the section sits in the master's `SECTIONS` array so its budget and seam are correct.

## Phase 1 — Scaffold the section + register it

1. Create the section component in `mygov-campaign-video/src/sections/` (build-story / agent sections
   live in `src/sections/build/`). Export the component **and** its `*_FRAMES` budget constant.
2. Register **one standalone `<Composition>`** in `src/Root.tsx` at 1920×1080 @ 30fps with the
   section's `*_FRAMES` (so it can be previewed/rendered alone), and add it to the `SECTIONS` array in
   `MyGovFinal.tsx` with its chapter-card `title` props (number, title, subtitle, accent). The master
   total recomputes itself — never hand-type `durationInFrames` for the master.
3. Lay out the beats on the frame timeline as `<Sequence from durationInFrames>` blocks matching the
   timecodes in Phase 0. Frame refs inside a `<Sequence from={N}>` are relative (local 0 = parent N).

## Phase 2 — Build the product surface (capture-first)

1. **Prefer a real capture.** Composite the live product from `public/captures/` (Playwright captures
   such as `capture-sourcelens.png`, `capture-globe.png`, `capture-writetothem.png`) under a
   `GuidedZoom` camera, exactly as `RapidFlow.tsx` does. Register fixed overlays on baked controls by
   their measured fractional coordinates (RapidFlow anchors `SearchReveal` on the live "Search MP" "S"
   at frac `(0.556, 0.774)`, holding the camera static so the overlay stays registered).
2. **Procedural / from-scratch surfaces** where there is no product UI to capture: globe (`GlobeBuild`),
   civic web (`CivicWebHtml`), stat count-ups built directly from `STATS` (`S5TechProof`). These are
   data-driven, frame-based, and built in `src/surfaces/` or inline — not flat screenshots.
3. **Recreating a captured product UI with `make-product-footage` is the fallback**, used only when live
   capture is genuinely impossible — and say so. The shipped master imports none of the
   `components/*` reuse library; do not assume it. (See Hard Rule #3.)

## Phase 3 — Wire the diagram entry/exit (`diagram-flythrough`)

1. Where the section uses the spider diagram, open/close on it (`captures/diagram-platform.png` is the
   accurate spider map; `FireworksFinale` opens on it). Light this section's pillar in its accent while
   others dim, push the camera in, and crossfade into the surface.
2. Use `diagram-flythrough` (and `DiagramCamera`/`LitDiagram` in `src/diagram/`) for the camera math;
   do not re-derive it here. Not every section needs the diagram — the stat/title/build sections do
   not open on it.

## Phase 4 — (Optional) visible cursor — this cut used camera-over-capture instead

The frame-based **`Cursor`** (`src/cursor/Cursor.tsx`, API `path: CursorKey[]` + `clicks?: number[]`)
exists and is built, but the **shipped master uses none of it** — the user-flow sections instead pan a
`GuidedZoom` camera over real captures with `SearchReveal` overlays. Use the cursor only when a beat
genuinely needs an on-screen pointer; otherwise prefer the camera-over-capture device. If you do use
it, follow [./rules/cursor-and-interaction.md](./rules/cursor-and-interaction.md) for the eased path,
ripple, double-click, selection highlight + "copied" chip, and cursor-leads-caption timing.

## Phase 5 — Lay the silent caption track (`silent-caption-system`)

1. Build the section's `track` of `CaptionLine` from the Phase 0 captions:
   `{ in_s, out_s, text, style, accent? }`, styles `title` / `subtitle` / `label` / `kicker`. Render
   it with `<Captions track={...} />` from `src/captions/Caption.tsx` (used by every played section).
2. Apply the reading-pace rule (hold ≥ `max(1.8s, chars × 0.07s)`, ≤ ~9 words on screen, ~6f in /
   6f out) and keep captions above product footage in z-order. **Every narration idea in the spec must
   be captioned** — there is no audio. Big "title" captions may hang a little longer, clamped against
   the next caption and a `sceneEndS` guard so rapid sequences don't overlap (v10).

## Phase 6 — Review gate (call `record-final-video` Phase 6) — before any full render

1. Pick the key frames from the section's motion (entrance-end, a hold frame, exit-start, plus a frame
   just before/after any signature beat). Render them at half scale to `previews/`.
2. **Build a contact sheet** and **write/refresh the slot record** for the section against the target
   record, then get **human sign-off** — exactly the `record-final-video` Phase 6 gate.
3. Treat any mismatch (missing layer, wrong accent, illegible caption, beat off by N frames, ungrounded
   claim) as a build bug to fix. **Only after the still gate passes do you full-render.**

## Phase 7 — Assemble into the master

1. Add the section to the `SECTIONS` array in `MyGovFinal.tsx` with its `*_FRAMES` and chapter-card
   `title` props. The flatten step inserts the `SectionTitle` card before it automatically; the finale
   is added with no `title` (no card) and `EndCard` is appended last. `MYGOV_TOTAL_FRAMES` recomputes.
2. **Verify seam timing:** sections fade from/to the same near-black `#07090f`, so chapter cards sit
   seamlessly between them; the finale fades to black (480–510) and hands off to `EndCard`. Re-preview
   the seam stills.
3. **Update `VIDEO_RECORD.md`** (the visual-stenographer's frame-accurate record) and reconcile the
   timeline total against `MYGOV_TOTAL_FRAMES`.

For the full pre-render check before declaring a section done, use
[./rules/scene-checklist.md](./rules/scene-checklist.md).

---

## Reusable assembly devices (the shipped conventions)

- **Chapter cards (`src/sections/build/SectionTitle.tsx`).** A quick black interstitial before each
  section: `TITLE_FRAMES=58` (snap in 0–8, hold ~8–50, snap out 50–58), number kicker (mono, accent) +
  serif uppercase title + accent rule that grows from centre + mono "what this proves" subtitle. The
  opening card uses `holdExtra: 15` to breathe. `titleCardFrames(holdExtra)` returns the card length.
- **Finale + EndCard.** `FireworksFinale` (510f: diagram backdrop → `FireworksShow` → `SmokeHaze` →
  `FinaleLogo` → fade-to-black handoff) carries **no** chapter card by design, and the run ends on a
  clean `EndCard` (150f: logo + decode-verified QR + live URL). Phase 7 must not wrap the finale in a
  card.

---

## Hard rules (never violate)

1. **The spec is the contract.** Build exactly the section the spec defines — its frame budget,
   accent, beats, captions, guardrails, and target slot record. Do not invent beats or re-time.
2. **Capture / procedural before the reuse library.** Build from a real capture (`public/captures/`)
   or a procedural surface (`src/surfaces/`) first; the `components/*` reuse library is orphaned in the
   shipped cut — only reach for it (or recreate via `make-product-footage`) when nothing else fits.
3. **Prefer REAL captured footage; recreation is the fallback.** (Corrected after a recreated-UI cut
   was rejected for looking fake — the shipped master proves this: every product-UI beat uses real
   captures.) Capture the live product and composite it with the diagram camera + captions. Only
   recreate a surface as data-driven animated Remotion when real capture is genuinely impossible, and
   say so. Never pass a hand-built recreation off as the live product.
4. **Frame-based motion only.** `useCurrentFrame()` + `interpolate()` + `<Sequence>`, clamped. No CSS
   animation, no Tailwind `animate-*`.
5. **Real data + grounded claims.** No overclaim, no faked external click-capture, no "message sent"
   (stop before send), no "all countries supported" (UK is the first working adapter). Use the locked
   `STATS` figures. Show the section's honesty guardrails on screen.
6. **Never full-render before the still-preview gate passes.** Stills + the slot record + human
   sign-off (Phase 6) come first, always.
7. **One section = one standalone `<Composition>`, then a `SECTIONS`-array entry** at 30fps,
   1920×1080, with its own `*_FRAMES` budget. The master `durationInFrames` is **derived** from the
   array, never hand-typed.
8. **Never self-certify subjective visual quality — escalate to a human.** If you catch yourself asking
   "does this look right / good / real / cool / convincing / on-tone?", that is a human-review trigger,
   not a self-judgment. Present the still and ask. You verdict only objective, checkable facts.

## Sub-files

- [./rules/cursor-and-interaction.md](./rules/cursor-and-interaction.md) — the frame-based cursor
  (optional device; unused in the shipped cut): eased path between targets, click ripple, double-click,
  selection highlight + "copied" chip, and the cursor-leads-caption timing, with a `Cursor` + ripple
  tsx sketch whose API matches the real `src/cursor/Cursor.tsx`.
- [./rules/scene-checklist.md](./rules/scene-checklist.md) — the per-section pre-render checklist plus
  the exact still / lint / render commands (use real composition ids — `RapidFlow`, `S5TechProof`,
  `MyGovFinal` — not `C04MapRecolour`).

---

## Self-evaluation (regression checks — each anchored to code)

Run these against the live source before trusting the skill. A FAIL is drift; fix the skill, not the
code (unless the code has a genuine bug the skill correctly warns against).

1. **Assembly model is `SECTIONS`-array flatten, not per-chapter compositions.** → `MyGovFinal.tsx:21–45`
   declares `SECTIONS: {C,f,title?}[]`, flattens to `ITEMS` `[card, section, …, finale, EndCard]`, and
   derives `MYGOV_TOTAL_FRAMES = ITEMS.reduce(...)`. **Test:** grep `MyGovFinal.tsx` for `SECTIONS` and
   `MYGOV_TOTAL_FRAMES`; there must be no `C<NN>` composition-per-chapter in `Root.tsx`.
2. **Build target is `mygov-campaign-video/`, not `mygov-final-video/`.** → all section files, `accents.ts`,
   `tokens.ts`, captures live under `mygov-campaign-video/src`. **Test:** confirm `mygov-final-video` is
   the abandoned per-chapter scaffold (it is not a git repo / not last-committed) and the skill names
   `mygov-campaign-video`.
3. **Every composition id the skill/sub-files name resolves in `Root.tsx`.** → `Root.tsx:40–57` registers
   `MyGovFinal, S1Hook, S2Problem, S3LiveFlow, S4MassAction, S5TechProof, S6GlobalLens, S7Build,
   S7BuildStory, S8Close, RapidFlow, CodexSpawnScene, CodexSpawnSequence, FireworksFinale,
   SectionTitlePreview, EndCard`. **Test:** no command in `scene-checklist.md` may reference an id
   absent from `Root.tsx` (e.g. `C04MapRecolour` must NOT appear).
4. **Capture-first is the primary surface path.** → played product-UI sections import from
   `public/captures/` via `staticFile`/`GuidedZoom` (`RapidFlow.tsx`, `S2Problem.tsx`, `S4MassAction.tsx`,
   `S6GlobalLens.tsx`). **Test:** grep played sections for `capture-` / `staticFile`; Phase 2 + Rule #3
   must lead with capture, recreation as fallback.
5. **The `components/*` reuse library is orphaned in the master.** → `grep "from \"../components"` across
   `src/sections/` returns **zero** matches. **Test:** if any reuse-component is imported by a played
   section, update Phase 2/Rule #2; otherwise the skill must not tell agents to start from that library.
6. **The visible cursor is built but unused in the shipped cut.** → `src/cursor/Cursor.tsx` exists; a
   grep for `<Cursor` / `import ... Cursor` across `src/sections/` returns **zero** matches. **Test:**
   Phase 4 must mark the cursor optional and not present it as the headline device.
7. **Easings are tuples consumed via `Easing.bezier(...EASE_OUT)`.** → `tokens.ts:29–31` exports
   `EASE_IO/EASE_OUT/SPRING` as `[number,number,number,number]` tuples, used as `Easing.bezier(...EASE_OUT)`
   (`ExplainDepthCard.tsx:74`). **Test:** the skill must not claim `tokens.ts` exports
   `EASE_OUT = Easing.bezier(...)`; the control-point values, however, must match.
8. **Locked palette + STATS match.** → `accents.ts` (`sourceLens #e4407a`, `map #38bdf8`,
   `explain #7c3aed`, `STATS` 647/157,542/11,887) and `tokens.ts` (BG `#07090f`, CARD `#111827`,
   TEXT `#e8eaf0`). **Test:** every hex/figure the skill cites must match these files exactly.
9. **Chapter-card + finale/EndCard conventions are documented.** → `SectionTitle.tsx` (`TITLE_FRAMES=58`,
   8f in / hold / 8f out, `holdExtra`), `FireworksFinale` (no card), `EndCard` (last). **Test:** the
   skill's assembly phase must describe the card/finale/EndCard flatten, not a uniform per-chapter loop.
10. **Orchestration routes to all siblings the cut needed.** → `terminal-recreation`,
    `message-triggered-animation`, `video-tempo` are authored on disk and the cut uses them
    (`CodexSpawnSequence`, `MessageTrigger.tsx`, `RapidFlow` tempo). **Test:** the composed-siblings list
    must include them, and must not claim "only record-final-video is authored on disk."

## Changelog (append-only — newest first)

- v2 (2026-06-01): Architecture rewrite against the shipped `mygov-campaign-video` cut (skill-improver
  pass).
  - **architecture-miss:** replaced "one chapter = one `<Composition>`" / C01–C13 fan-out with the real
    `SECTIONS`-array → `ITEMS` flatten model and derived `MYGOV_TOTAL_FRAMES` (`MyGovFinal.tsx:21–45`);
    rewrote Phase 1 + Phase 7; added the chapter-card / finale / EndCard assembly devices
    (`SectionTitle.tsx`, `FireworksFinale`, `EndCard`).
  - **inverted:** resolved the capture-vs-recreate contradiction — Phase 2 + Rule #3 now lead with
    capture-first; recreation via `make-product-footage` is the fallback (`RapidFlow.tsx`, `S2Problem.tsx`,
    `S4MassAction.tsx`, `S6GlobalLens.tsx` all build over `public/captures/`).
  - **stale-pointer:** build target `mygov-final-video/` → `mygov-campaign-video/`; replaced fictional
    budgets (`C04MapRecolour` etc.) and ids with the real `*_FRAMES`/section ids (`Root.tsx:40–57`);
    deleted the "only record-final-video is authored on disk" note (all siblings now authored).
  - **architecture-miss (orchestration-incomplete):** added `terminal-recreation`,
    `message-triggered-animation`, `video-tempo` to the composed-siblings list (`src/sections/build/*`,
    `MessageTrigger.tsx`, `RapidFlow`).
  - **framing-stale:** demoted Phase 4 visible cursor to an optional device (built in `src/cursor/Cursor.tsx`
    but unused in the master — the cut used `GuidedZoom`-over-capture); kept `cursor-and-interaction.md`.
  - **convention-mismatch:** corrected the easing claim — `tokens.ts:29–31` exports control-point tuples
    consumed via `Easing.bezier(...EASE_OUT)`, not pre-built easing functions (values unchanged).
  - **new:** documented that the `components/*` reuse library is orphaned in the shipped master (zero
    imports from played sections) — Rule #2 now puts capture/procedural before the library.
  - Added the `## Self-evaluation` rubric (the regression test that would have caught all of the above).
  - *Confidence:* corrections validated against ONE shipped cut (`mygov-campaign-video` MyGovFinal,
    revisions v8–v10) + its `VIDEO_RECORD.md`. Single-cut evidence → built-but-unused devices (cursor,
    recreate path, reuse library) were **demoted/documented, not deleted**, per the overfit guard.
- v1: Original orchestration spec written from the `mygov-final-video` per-chapter design intent.
