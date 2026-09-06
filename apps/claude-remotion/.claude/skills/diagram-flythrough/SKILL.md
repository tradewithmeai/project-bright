---
name: diagram-flythrough
description: Turn a static high-res system diagram (or a DOM/SVG rebuild of one) into a visual node map a virtual camera flies across — lighting one node at a time and (optionally) handing off into product footage, then collapsing back. The frame-based node-map + camera + push technique; reusable across diagrams.
metadata:
  tags: remotion, diagram, camera, node-map, flythrough, hybrid, mygov, frame-based
---

## When to use

Use this skill to make a **diagram the spine of a film** (or a recurring connective surface): a system
map becomes a *node map*, and a virtual camera flies across it — igniting one node, pushing in, optionally
handing off to real product footage for that chapter, then collapsing back and moving to the next node.

```
DIAGRAM (one node lights in its colour) → [PUSH IN] → [PRODUCT FOOTAGE] → [PULL BACK] → next node
```

### Status in the shipped MyGov cut (read before you build)

The film's **structural spine is NOT a diagram flythrough** — `MyGovFinal.tsx` is a `<Series>` over a
flattened `ITEMS` list (`[chapter-card, section, chapter-card, section, …, FireworksFinale, EndCard]`),
i.e. a **chapter-card SECTIONS cut** (`src/sections/build/SectionTitle.tsx` + the `SECTIONS` array in
`src/MyGovFinal.tsx:23`). This skill's technique still ships, but you need to know **where**:

- **LIVE — the technique ships in `src/surfaces/web/CivicWebHtml.tsx`** (and its PNG-era predecessor
  `src/surfaces/CivicWeb.tsx`). It applies this skill's node-map + camera-push method to the **"That is
  the web." civic-journey diagram** — an 8-node ring (Enter → Find → Verify → Visualise → Understand →
  Act → Escalate → Scale) with a `MyGov` centre. Each node owns its `cx/cy` fraction in
  `src/surfaces/web/webData.ts`; the diagram is a **DOM/SVG rebuild** (not a PNG), exactly the
  "rebuilt panel for sharp text" half of the hybrid rule. It is used in **S3LiveFlow** (corner inset),
  **S4MassAction** (full-frame, active node lit), and **S8Close** (looped highlight). This is the
  diagram-camera capability actually in service.
- **BUILT BUT UNWIRED — the `src/diagram/` spider-diagram variant.** `DiagramCamera.tsx`, `LitDiagram.tsx`,
  and `nodes.ts` (the 8-pillar **platform** spider-map: Source Lens, Map, Explain, Global, Agent Party,
  Build System, Distribution, Mobile) are coherent and correct, **but nothing imports them** — a grep
  across `src/` finds zero importers and `Root.tsx` registers no composition that uses them. Keep this
  path; it is the PNG-base flythrough for a future film. Just do not assume it is on screen.
- **STATIC BACKDROP ONLY — the spider-diagram PNG.** The spider map appears in the cut only as a static
  image: `FireworksFinale.tsx:49` fades up `captures/diagram-platform.png` under the fireworks, and
  `S7Build.tsx:198` shows the same image as a 280px bottom-left thumbnail. No node-by-node camera flight
  of the spider map ships anywhere.

So: **the camera/node-map/push technique is real and shipping (on the web-journey diagram); the
spider-map flythrough is built but not wired; the spider PNG is a static backdrop.** Before building on
the `src/diagram/` module, confirm it is actually imported by a registered composition (see Hard rule 7).

This skill owns the diagram layer, the camera, and the handoff. The product footage itself comes from
[make-product-footage](../make-product-footage/SKILL.md); chapters are assembled by
[build-film-section](../build-film-section/SKILL.md), whose Phase 3 defers to this
skill for the camera math. (Note: that sibling describes pushing into the *spider* pillars, the unwired
variant — if the web-journey diagram is now canonical, that cross-reference needs the same re-point.)

---

## Domain facts (fixed)

- **Frame-based motion only:** `useCurrentFrame()` + `interpolate()` + `<Sequence>`. No CSS
  `transition`/`animation`. `EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1)` (used as `EASE` in
  `LitDiagram.tsx`, `DiagramCamera.tsx`, and `CivicWebHtml.tsx`); `SPRING = Easing.bezier(0.34, 1.56, 0.64, 1)`.
  1920×1080 @ 30fps.
- **HYBRID fidelity (the core rule):** use a real high-res **PNG** for wide shots, camera flights, the
  ignite, and the pull-back close; hand off to a **crisp rebuilt DOM/SVG panel** for node close-ups so
  text is sharp and footage sits cleanly inside. Never zoom a PNG so far it goes soft — cap the PNG zoom
  and switch to the DOM panel before softness shows. (In the shipped cut the web-journey diagram is built
  DOM-first for exactly this reason — see `CivicWebHtml.tsx:14-20`: a DOM rebuild where "each node OWNS
  its position" so the ring, connectors, and camera-push land on real coordinates.)
- **The MyGov SPIDER (platform) diagram:** `public/spider-diagram.png` — byte-identical to the
  authored master held outside this repo, and **also** copied to
  `public/captures/diagram-platform.png` (same MD5). A central **hub** ("MyGov — OPEN. CIVIC.
  INTELLIGENT."), **8 numbered pillar nodes** around it, a green **"Local to Global" arc**, **4 stat
  chips**, and a footer tagline. `LitDiagram` reads `staticFile("spider-diagram.png")`; the finale reads
  `staticFile("captures/diagram-platform.png")` — different names, **same image**.
- **The MyGov WEB-JOURNEY diagram (the one that ships):** `public/captures/diagram-web-journey.png` (a
  *different* image from the spider map), rebuilt DOM-first in `src/surfaces/web/` driven by
  `webData.ts`. 8 ring nodes (Enter…Scale) + a `MyGov` crown centre + directed connectors.
- **Per-node accent colours (SPIDER pillars, from `src/accents.ts`):** Source Lens pink `#e4407a` · Map
  cyan `#38bdf8` · Explain purple `#7c3aed` · Global green `#02a95b` · Agent Party lime `#a3e635` ·
  Build System yellow `#f59e0b` · Distribution orange `#f97316` · Mobile blue `#2563eb`. Hub `#7dd3fc`.
  Base BG `#07090f`. (The web-journey nodes carry their **own** accents in `webData.ts`, e.g. Enter
  `#5eb3ff`, Verify `#3b82f6` — do not assume the spider palette applies to the web diagram.)

---

## Phase 0 — Inventory the diagram

Confirm the high-res asset exists (or decide to rebuild DOM-first). Identify and locate the hub/centre,
each node (by number + label + colour), any arc, stat chips, and footer. This is the read-only survey
that the node map is built from. **If you are extending the shipped cut, the diagram in service is the
web-journey ring in `src/surfaces/web/` — survey that, not the unwired spider module.**

## Phase 1 — Build the node map

For each region record `key`, `label`, `accent`, centre `(cx, cy)`, size `(w, h)` (or radius `r`) as
**fractions of the frame** (0..1), and the camera **visit order**. Coords are **measured from the actual
image**, never guessed. Two real node maps exist in code to copy from:
`src/diagram/nodes.ts` (spider pillars, `w/h` boxes) and `src/surfaces/web/webData.ts` (web-journey ring,
`r` radius). Full schema + a worked example: [./rules/node-map.md](./rules/node-map.md).

## Phase 2 — Lit-diagram layer

Render the lit diagram: a base (PNG for the spider variant, DOM `WebScene` for the web variant), plus
per-node **glow overlays** that ignite/dim independently (frame-driven opacity, positioned from the node
map). For the spider PNG that is `LitDiagram` + `NodeGlow` (boxShadow ring per node); for the web ring it
is `WebScene`'s per-node `litById` highlight. During a chapter, exactly **one node is lit**; the rest sit
dim. (Spider extras: the arc as a draw-on stroke and stat chips that count up — built into the master PNG
in the current asset, not as separate overlays.)

## Phase 3 — Camera system

The camera frames a target node by interpolating **scale + translate** from `useCurrentFrame()` so the
node fills ~70% of frame width, centred. Flights ease (`EASE_OUT`) between nodes; the camera holds on a
node while its glow ignites. The fraction→transform maths and a tsx sketch are in
[./rules/camera-and-handoff.md](./rules/camera-and-handoff.md). **The translate term carries NO factor of
`scale`** — see the maths note below; this is the form the shipping component uses.

## Phase 4 — Handoff to product and back (built; not currently exercised on screen)

At full push on a lit node, **crossfade** the node's glow into the chapter's rebuilt product surface
(interpolate the surface opacity 0→1 while the diagram fades under it), matched on the node's bounding
box so it feels like entering the node. On chapter exit, reverse: collapse the surface back into the
node, pull the camera out, and **pre-glow the next node** in its colour. The push itself is implemented
(`CivicWebHtml`/`CivicWeb` accept `pushTo`/`pushAt`/`pushEnd`), but **no shipped scene currently passes
`pushTo`** — the diagram→product→diagram handoff is available, not exercised in the current cut. Technique
detail in [./rules/camera-and-handoff.md](./rules/camera-and-handoff.md).

## Phase 5 — Ignite-open & pull-back close

- **Ignite (film open):** from black, the hub/centre lights first, then the nodes spark around the ring
  in sequence (staggered glow), any arc draws on, and stat chips count up. Frame-based throughout.
  `LitDiagram.useStaggeredGlows(startF, perNode)` is the spider helper; `CivicWebHtml`'s `appear` +
  `connectorProgress` + `loop` mode is the web equivalent.
- **Pull-back (film close):** pull all the way out to the **finished, fully-lit** diagram, let chips
  settle, resolve the footer tagline, and hold the URL card. (In the shipped cut S8Close uses the looped
  web ring, then `FireworksFinale` fades up the static spider backdrop — that is the close that ships.)

---

## Camera maths note (corrected — read before copying the formula)

For `transform: scale(s) translate(tx, ty)` with `transform-origin: center`, CSS applies the translate
**first**, so a point maps `v → s·(v + t)`. To land a node centre on the frame centre you need
`t = −v = (0.5 − cx)·1920`, gated by push progress `p` — with **no factor of `s`**. The shipping
component is explicit about this:

```
// CivicWebHtml.tsx:218-222
scale = 1 + p * 1.2;            // 1 → 2.2
tx = (0.5 - n.cx) * W * p;      // NO * scale — the * scale double-counted and over-pushed ~2.2x
ty = (0.5 - n.cy) * H * p;
```

The `scale = fill / w` zoom term is correct. Only the translate factor matters: **drop the `* scale`.**
The unwired `src/diagram/DiagramCamera.tsx:13-14` and the older `src/surfaces/CivicWeb.tsx:62` still carry
the buggy `* scale` form; they survived unnoticed because neither is exercised on screen at a node-locked
push. Use the `CivicWebHtml` form.

---

## Hard rules (never violate)

1. **Frame-based motion only.** Camera, glows, arc, chips, handoffs — all `useCurrentFrame()` +
   `interpolate()`. No CSS animation.
2. **PNG for wide / DOM for close-ups.** Never zoom a PNG past its sharpness budget; switch to the
   rebuilt DOM panel before it softens. (The shipped web diagram is DOM-first for this reason.)
3. **The node map is authoritative.** Coords are measured from the real image; all camera moves read from
   the node map (`nodes.ts` or `webData.ts`) — never hard-code ad-hoc positions per shot.
4. **One lit node at a time** during chapters; others dim. The whole diagram is only fully lit at the
   ignite peak and the final pull-back.
5. **Cause → effect on handoff.** The push completes, *then* the product surface appears — the camera
   move motivates the cut.
6. **Honour the accent map.** Each node lights in its own locked colour; the chapter inherits that accent.
   Note the spider palette (`accents.ts`) and the web palette (`webData.ts`) are **different** maps — use
   the one for the diagram you are animating.
7. **Verify it's wired before you build on it.** Confirm the diagram module you intend to use is imported
   by a registered composition in `Root.tsx`. The `src/diagram/` spider module is **not** wired today; the
   live diagram-camera is `src/surfaces/web/CivicWebHtml.tsx`. Building against the unwired module produces
   code that renders nowhere.
8. **The translate term carries no `* scale`.** Use `t = (0.5 − cx)·W·p`, per the maths note. The
   `* scale` form over-pushes ~2.2× at full zoom.

## Sub-files

- [./rules/node-map.md](./rules/node-map.md) — the node-map schema + worked examples (the spider 8-pillar
  map and the web-journey ring) with fractional coords and visit order.
- [./rules/camera-and-handoff.md](./rules/camera-and-handoff.md) — fraction→transform maths (translate
  carries no `* scale`), flight timing/easing, the crossfade handoff, and a `DiagramCamera` tsx sketch.

## Self-evaluation (run this rubric against the code; PASS needs the cited file:line)

Each check is `claim → code location that confirms it → how to test`. A FAIL is drift.

1. **Wired-vs-orphaned status is stated correctly.** → `src/diagram/{DiagramCamera,LitDiagram,nodes}` has
   zero importers; the live camera is `src/surfaces/web/CivicWebHtml.tsx`. → `grep -rn "DiagramCamera\|LitDiagram" src` shows only the definitions; `grep -rn "CivicWebHtml" src` shows S3/S4/S8 importers. If the
   skill still calls the spider flythrough "the structural device," FAIL.
2. **Structural spine is named correctly.** → `src/MyGovFinal.tsx:23,47-57` assembles a `<Series>` over
   `SECTIONS` (chapter-card + section), not a diagram flythrough. → Open the file; confirm no diagram
   import. If the skill claims the diagram is the spine of the shipped cut, FAIL.
3. **Camera translate formula has no `* scale`.** → `src/surfaces/web/CivicWebHtml.tsx:218-222`:
   `tx = (0.5 - n.cx) * W * p`. → Compare the skill's formula char-for-char with this; if the skill (or
   `camera-and-handoff.md`) multiplies translate by `scale`, FAIL.
4. **`scale = fill / w` (zoom term) is correct.** → `DiagramCamera.tsx:10` and `CivicWebHtml.tsx:221`
   (`scale = 1 + p*1.2`, equivalent framing). → If the skill drops or inverts the zoom term, FAIL.
5. **Spider asset identity is correct.** → `LitDiagram.tsx:47` reads `spider-diagram.png`;
   `FireworksFinale.tsx:49` reads `captures/diagram-platform.png`; both files are byte-identical
   (same MD5). → `Get-FileHash` both. If the skill claims they are different images, FAIL.
6. **Web-journey diagram is a separate image + module.** → `captures/diagram-web-journey.png` (different
   hash from the spider PNG); `src/surfaces/web/webData.ts` holds its 8-node ring. → If the skill conflates
   the two diagrams, FAIL.
7. **Accent maps are kept distinct.** → spider accents in `src/accents.ts`; web-journey accents inline in
   `webData.ts` (e.g. Enter `#5eb3ff`). → If the skill says one palette governs both, FAIL.
8. **Handoff (`pushTo`) status honest.** → `pushTo` is declared in `CivicWebHtml.tsx:110` /
   `CivicWeb.tsx:48` but no shipped scene passes it (`grep -rn "pushTo" src` → only definitions). → If the
   skill claims the diagram→product handoff is on screen in the current cut, FAIL.
9. **Frame-based rule holds.** → no `transition`/`animation` CSS in the diagram modules; all motion via
   `useCurrentFrame()` + `interpolate()` (`DiagramCamera.tsx`, `LitDiagram.tsx`, `CivicWebHtml.tsx`). →
   grep for `transition:`/`animation:`; if present in motion, FAIL.
10. **Node-map coords are fractions.** → `nodes.ts` and `webData.ts` use `cx/cy` ∈ 0..1. → If the skill's
    worked example uses pixels where code uses fractions, FAIL.

## Changelog (append-only — newest first)

- **2026-06-01 — re-point from a dead module to the live one + camera-maths bug fix.**
  *Architecture-miss / framing-stale:* the skill claimed the spider flythrough "is the structural device
  of the MyGov video," but the shipped spine is the chapter-card SECTIONS cut (`MyGovFinal.tsx:23,47-57`)
  and the diagram-camera technique actually ships on the **web-journey** diagram in
  `src/surfaces/web/CivicWebHtml.tsx` (S3/S4/S8), built DOM-first — not the `src/diagram/` spider module,
  which has **zero importers**. Reframed "When to use" with a three-state status (live web-journey / built
  unwired spider / static backdrop) and added the live `surfaces/web/` path the prior audit missed.
  *Convention-mismatch (inverted maths):* the documented camera formula multiplied the translate by
  `scale` (`DiagramCamera.tsx:13-14`, `camera-and-handoff.md`), which over-pushes ~2.2× — the live
  `CivicWebHtml.tsx:218-222` explicitly **dropped** the `* scale`. Corrected the formula and added a maths
  note + Hard rule 8. *Stale-pointer/asset:* clarified `spider-diagram.png` and `captures/diagram-platform.png`
  are byte-identical (same image, two names) and that the web diagram is a *different* PNG
  (`diagram-web-journey.png`). Added Hard rule 7 ("verify it's wired") and a 10-check Self-evaluation
  rubric that would have caught the orphan and the maths bug. Did **not** retire the spider module: the
  technique is alive (web variant) and the spider path is a valid future capability — kept + corrected +
  flagged unwired. Evidence: one cut (v8–v10) + prior hand-audit — single-job depth, reduced breadth.
