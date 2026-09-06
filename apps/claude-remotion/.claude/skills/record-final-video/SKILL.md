---
name: record-final-video
description: Read a multi-layer Remotion template (3-4 AbsoluteFill layers) and emit a precise text + JSON record of every layer, motion, colour, focal element, timing, and 11-slot id — so an agent understands a rendered slot without watching the video. Includes a still-preview review gate for human sign-off and optional scorecard-lens tagging. Also owns the structured post-export video report (source/spec/export-derived) — see post-render-report.md.
metadata:
  tags: remotion, multilayer, slot, recorder, layers, parallax, motion, palette, mygov, slot-reporter
---

> **This skill also owns the post-render video report.** After a FINAL render, in addition to the
> per-slot record below, produce the structured source/spec/export report — see
> [`post-render-report.md`](./post-render-report.md) (absorbed from the former `post-render-video-report` skill).

## When to use

Use this skill when you must describe **one rendered slot/scene** from the **multi-layer slot
template system** as structured data, without watching the video. It is a **slot reporter**: it
reads a template (a `multilayer/*.md` spec or a generated `.tsx`) and produces a per-layer record
— layer stack, motion with frame ranges, colours, focal element, text, and which 11-slot id the
slot occupies.

These templates are **layered AbsoluteFill compositions** of 3-4 layers, each with an animated
background. They live at `apps/claude-remotion/remotion_lab/templates/multilayer/*.md`. The ten
named templates are: `parallax-depth-stack`, `kinetic-data-ribbon`, `spotlight-masked-focus`,
`split-diagonal-compare`, `isometric-layer-cake`, `terminal-telemetry-hud`, `card-deck-cascade`,
`map-pulse-choropleth`, `glass-stat-hud`, `kinetic-typographic-headline`. All ten are authored as
`01-`…`10-*.md` specs in that folder, alongside a `README.md` index. **Do not hard-code how many
are present** — glob the folder at run time and record only what is actually on disk. If a named
template is missing, report it missing rather than fabricating.

### Scope — which architecture this records (read this first)

There are **two coexisting Remotion architectures** in this codebase, and this skill records **one**
of them:

> ⚠️ **The reference implementation named below was removed during the pre-release consolidation.**
> The technique is real and is kept here; the file paths are history, not somewhere to look. The slot pipeline it describes was consolidated into `SlotShort`, whose plan file carries the slot list directly rather than generating a component per slot.

- **Slot-pipeline / multilayer (THIS skill's domain).** The `standard_short_v1` slot pipeline
  (retired; `src/templates/slot_short/` is its successor, with per-brand output formerly under
  `generated/solvx…vaultpay`) and the `multilayer/*.md` templates. Slot components take
  `{ slot, accentColor, brandName }` and map to the 11-slot order. **This is what the layer-stack /
  `also_fits` / parallax-z-order vocabulary below is for.**
- **SECTIONS narrative cut (OUT of scope here — see "Related skills").** The bespoke campaign cuts
  (e.g. `mygov-campaign-video/src/MyGovFinal.tsx`) are a flat `SECTIONS[]` array flattened into a
  single `<Series>` of `[chapter-card → section, … , finale, EndCard]`. Sections are **prop-less
  `React.FC` scenes** (`<C />`), not slotted parallax stacks — e.g. `S5TechProof` is a clean dark
  stage with three count-up `Figure`s + a `Captions` track, and `FireworksFinale` composes a
  `captures/diagram-platform.png` backdrop + `FireworksShow` + `SmokeHaze` + `FinaleLogo`. There is
  **no `SLOT_ORDER`, no 11-slot mapping, no `also_fits`** in those repos. Do **not** force this
  skill's slot/layer schema onto a SECTIONS scene; record those as a scene + sub-components +
  caption track + motion timeline instead (see "Related skills").

**Read-only.** Never edit project code, never run `npm`/`npx`/installs/services, never read `.env`.
You only read template `.md` and `.tsx` files and emit a record.

---

## Record mode — `closed_11slot` (default) vs `flexible`

Every record carries a `record_mode` discriminator. The two modes share Phases 0–6, the
determinism / CSS-animation / caption rules, the reproducibility checks, and the Phase 6
still-preview gate. They differ ONLY in the key space and which fields are mandatory.

- **`record_mode: "closed_11slot"` — the existing behaviour, UNCHANGED (default).** Records against
  the fixed `SLOT_ORDER` 11-slot system: a `slot_id` from the enum, `also_fits` alternates, and a
  mandatory 3-4-layer `layers[]` AbsoluteFill stack. Everything in this SKILL above, and in
  `rules/layer-record-schema.md` "## Schema" + its parallax worked example, is closed-mode and
  remains authoritative. Use it for the multilayer / slot pipeline.
- **`record_mode: "flexible"` — for bespoke N-section cuts.** Records one slot per beat/section of a
  flat `SECTIONS[]` / beats cut (e.g. `mygov_explainer`, `recipe_v0`), where there is no fixed slot
  count and a beat is not necessarily a 3-4 layer stack. This is the SECTIONS architecture the Scope
  section routes away from closed mode — flexible mode is how that scene-record is now shaped.

Flexible mode differs from closed mode in exactly these five ways (everything else is identical):

1. **`slot_key` REPLACES the closed `slot_id` enum.** Open string, regex `^[A-Za-z0-9_-]+$`, with
   **no count cap** (no `<=8`, no fixed 11-slot enum). One record per beat/section. **Drop
   `also_fits`** in flexible mode — a bespoke beat occupies one fixed narrative position, so there
   are no alternate slots to list.
2. **`layers[]` becomes OPTIONAL.** A bespoke beat that is not a 3-4 `AbsoluteFill` parallax stack
   records **`sub_components[]`** (the prop-less child components it composes — virtual camera,
   click/pulse, caption dispatcher, framed cards) and **`caption_track[]`** (the per-line timed
   windows from Phase 3) instead of a layer stack. If the beat *is* a layer stack, `layers[]` may
   still be used.
3. **The `editor_*` PROJECTION block — the ONLY fields that cross into the editor PATCH surface.**
   The recorder body stays rich, but exactly three fields project onto the editor slot:

   | recorder field | → editor slot field |
   |---|---|
   | `editor_description` | `slot.description` |
   | `editor_notes` | `slot.notes` |
   | `editor_target_duration_seconds` | `slot.target_duration_seconds` |

   `editor_notes` carries the motion-arc frames, the determinism source, any baked-capture risk, any
   violations, the caption windows, **and a pointer to the rich sidecar**. The rich body
   (`layers` / `sub_components` / `motion` / `palette` / `violations` / …) does **NOT** cross into
   the editor — it persists as a SIDECAR file referenced by **`rich_record_ref`**. The editor sees
   only the three projected fields; everything else is recorder-internal.
4. **slot_type-aware duration.** `editor_target_duration_seconds` is an **integer number of seconds
   for a `still`** slot, and **`null` for a `video`** slot (a clip carries its own duration via the
   cut's trim, not a target). The rich `duration { frames, seconds }` is always recorded regardless.
5. **The join contract — `slot_key` is copied VERBATIM from the producer.** It is the producer's
   beat key / recipe `section_id` (cc's bespoke beat key), copied with **NO transform**, so it
   byte-matches the bridge-v2 `slot_key` and the editor `slot_key` exactly. This is the same key
   family Increment 3 (the recipe still-exporter + bridge-v2 producer) and Increment 4 (the bridge-v2
   importer + its DB unique index) use — a record whose `slot_key` does not byte-match the producer's
   key breaks the join.

The flexible record JSON shape is in `rules/layer-record-schema.md` "## Flexible mode schema"; a full
worked flexible record (mygov_explainer `FindMp`) is in `rules/describe-template.md` "## Flexible
mode — worked example".

---

## Domain facts (fixed)

- **11-slot system (slot pipeline only).** `SLOT_ORDER = s1, s2, v1, s3, s4, v2, s5, s6, v3, s7,
  s8`. `s*` = stills, `v*` = videos. A template records against a **still** or **video** slot
  accordingly. (SECTIONS scenes have no slot id — they occupy a fixed narrative position.)
- **30 fps. Landscape 1920×1080 default.** Convert frames↔seconds at 30: `seconds = frames / 30`.
- **Motion is frame-based:** `useCurrentFrame()` + `interpolate()` + `<Sequence>`. Standard ease is
  `EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1)` (the multilayer specs name it `EASE_OUT`; some
  section code names the same bezier `EASE` — they are identical). **CSS `transition` / CSS
  `animation` / Tailwind animation classes do not render in Remotion — if a template uses them,
  flag a VIOLATION.** (Static CSS — gradients, `clip-path`, `mixBlendMode`, `filter: blur()`,
  `backdrop-filter` — is fine; it is recomputed per frame, not animated by CSS.)
- **Non-deterministic randomness is a VIOLATION.** A naked `Math.random()`, `Date.now()`,
  `new Date()`, or `performance.now()` evaluated **in render** breaks Remotion's out-of-order
  frame rendering and must be flagged like a CSS animation. Deterministic "randomness" — a seeded
  hash (`Math.sin(a*12.9898 + b*78.233)*43758.5453` fract), Remotion's seeded `random(seed)`, or
  pre-computed position data — is correct; record the seed source under `reproducibility`. (See
  `mygov-campaign-video/src/sections/build/Fireworks.tsx` lines 18-23.)
- **Component prop convention (slot pipeline only):** `{ slot, accentColor, brandName }`. This is
  the multilayer/slot template signature (see `multilayer/README.md` and each spec's tsx sketch).
  SECTIONS scenes are prop-less `React.FC`s, so this convention does **not** apply to them.
- **Demo brand "mygov" palette:** BG `#07090f`, CARD `#111827`, ACCENT `#7dd3fc`; vote colours
  Aye `#16a34a`, No `#dc2626`; party colours exist. This is the *reference* palette — when a
  template file states a different hex (e.g. parallax uses ACCENT `#38bdf8`), **report the file's
  hex**, not the reference. Reading what's there beats matching the canon.

---

## Phase 0 — Locate the template & confirm 11-slot mapping

1. Resolve the target. Either a `multilayer/<name>.md` spec, or a generated `.tsx` slot component.
   - MD specs: `apps/claude-remotion/remotion_lab/templates/multilayer/*.md` (use `Glob`).
   - Generated TSX: `apps/claude-remotion/src/templates/**/<Slot>.tsx`.
2. Confirm the file exists and you can read it. If it does not exist, print
   `UNCONFIRMED: <name> template not found on disk` and stop — do not fabricate a record.
3. Confirm the **slot mapping**. Read the template's slot guidance (in MD: the "11-slot mapping"
   line; in TSX: the component name / Composition registration). Pick **one** `slot_id` from
   `SLOT_ORDER` for this record. If the template fits several (e.g. parallax fits s2 and s6),
   record one slot per record and note the alternates in `also_fits`.
4. Classify **category**: `still` (s* slot, no video layer), `clip` (v* slot, has video footage),
   or `hybrid` (still slot that embeds short looping motion but no real footage).

---

## Phase 1 — Parse the layer stack (back → front)

A multi-layer template is a stack of `AbsoluteFill` layers rendered in source order, so the
**first** is furthest back (z=0) and the **last** is the foreground. Identify each layer:

1. In an MD spec: read the "Layer stack (back → front)" table — columns are `#`, `Name`, `Role`,
   `Contains`, `Animation`, `Opacity / blend`. One table row = one layer record.
2. In a TSX file: list each top-level `<AbsoluteFill>` (and `<Sequence>` that wraps one) inside the
   component's returned tree, **in source order**. Source order = z-order, back to front.
3. For each layer capture: `index` (0 = backmost), `name`, `role` (background / mid-depth /
   focal / foreground-overlay), `contents` (what it draws), `opacity`, `blend` (`mixBlendMode`).
4. The backmost layer is the **mandatory animated background**. Confirm it animates (continuous
   drift / pulse). If it is static, note it — most templates require motion here.

---

## Phase 2 — Extract motion per layer

For each layer, read its animation and convert to frame ranges (and seconds at 30 fps):

1. **From MD:** the "Animation" cell + the "Motion design" section give entrance/hold/exit and the
   `interpolate` ranges in plain language (e.g. "headline `translateY 26→0` over f8–28 EASE_OUT").
2. **From TSX:** read every `interpolate(frame, [a, b], [from, to], …)` — `[a, b]` is the frame
   range; the easing arg (if any) is the curve. Read `<Sequence from={N} durationInFrames={M}>` —
   the layer/element is active for frames `N … N+M`. Remember frame refs **inside** a `<Sequence
   from={N}>` are relative: local frame 0 = parent frame N.
3. Summarise each layer's motion as: what moves, the property, the `[startF, endF]` window, the
   easing, and the seconds equivalent (`startF/30`–`endF/30`s). Note continuous (never-resetting,
   e.g. `Math.sin(frame…)`) vs ranged (entrance/exit) motion separately.
4. Roll up a composition-level **motion arc**: entrance frames / hold frames / exit frames, plus
   total `duration_frames` and `duration_seconds`.
5. If any motion is driven by CSS `transition`/`animation` or a Tailwind animate-* class, record it
   under `violations` — it will not render.

---

## Phase 3 — Extract colours, focal element, and text

1. **Palette:** harvest every `#RRGGBB`/`#RGB` hex literal in the file. Deduplicate. Order by
   visual dominance (background first, then large fills, then accents). Report the **file's** hexes.
   Tag each with role (bg / card / accent / vote-aye / vote-no / party / text) where stated.
2. **Per-layer dominant colours:** for each layer, list the 1-3 hexes it is built from.
3. **Focal element:** the single sharpest / highest-contrast / most-central element the eye lands
   on (usually the headline+stat on the focal layer). State which layer index holds it.
4. **Text & caption track.** Capture `headline`, `subtext`, `caption` where present. Props-driven
   text (`brandName`, scene title) is reported as its prop name plus any example value the file
   gives. Data-derived figures (e.g. "647 MPs") are reported verbatim with their source noted.
   **If the file carries a caption track** (a `CaptionLine[]` with `in_s`/`out_s`/`style`/`accent`
   — styles `title|kicker|subtitle|label`, times in **seconds relative to scene start**), record
   the **whole track** as timed windows: per line, its text, style, and the
   `[in_s, out_s]` → `[in_s*30, out_s*30]` frame window, and flag any line whose window bleeds past
   the scene end. This feeds the Phase 6 caption verdict. (Caption contract:
   `mygov-campaign-video/src/captions/Caption.tsx`; authoring is the `silent-caption-system`
   skill's job — record, don't restate it.)

---

## Phase 4 — Assess reproducibility

Confirm every layer's assets are **code- or data-derived** (CSS gradients, seeded procedural
specks, styled `<div>` cards from scene-data, props text). Specifically:

1. **Determinism check (cardinal).** Scan render code for naked `Math.random()`, `Date.now()`,
   `new Date()`, or `performance.now()` — any found go in `violations` (non-rendering /
   render-breaking, same severity as CSS animation). Where the file uses deterministic randomness
   (seeded hash, Remotion `random(seed)`, pre-computed position data), record **which** under
   `reproducibility`.
2. **External-capture check.** A baked screenshot of real UI/diagram — `staticFile("captures/*.png")`
   (`<Img>` / `OffthreadVideo`) — is the common real reproducibility risk, not just stock footage.
   Flag it explicitly and point to `make-product-footage` / `diagram-flythrough` as the recreate path.
   (Example: `mygov-campaign-video/src/sections/build/FireworksFinale.tsx` loads
   `captures/diagram-platform.png`; captures appear in many sections — S2Problem, S6GlobalLens,
   S7Build, CivicWeb, EndCard.)
3. For a `clip` slot, note the real video asset (`OffthreadVideo` src / `staticFile`).
4. Write a one-line `reproducibility` note: are all assets deterministic and regenerable, or does
   the slot depend on an external asset? Flag any stock footage / hand-drawn art / external
   download / baked capture as a reproducibility risk.
5. **Record the provenance and licence of every asset that ships.** This is not the same question
   as reproducibility: a bed regenerated by a paid API is perfectly reproducible and still needs a
   licence line. For each asset give:

   | field | meaning |
   |---|---|
   | `source` | who made it — `in-house-synth`, `generated:<provider>/<model>`, `captured`, or `third-party` |
   | `source_url` | where it came from, if anywhere. `null` for in-house |
   | `license_name` | e.g. `in-house`, `Pixabay Content License`, `CC BY 4.0`, `provider-terms` |
   | `license_url` | the licence page you actually read |
   | `attribution_required` | `true` / `false` |
   | `attribution_text` | the exact credit line, when required |

   Rules that have already cost this project:
   - **Verify the individual file's licence page, not the search snippet.** Some stock uploads are
     mislabelled by their uploader.
   - **A screen capture of someone else's product is third-party material.** Record what was
     captured and when; do not assume a screenshot is yours because you took it.
   - **Generated audio and images carry the generating provider's terms.** Record the provider and
     model, because those terms change and the record is what dates the claim.
   - Anything you cannot establish is `"Unconfirmed"` — never guessed. An asset that stays
     `"Unconfirmed"` should not ship.

---

## Phase 5 — Emit the record

Produce **both** outputs, per [./rules/layer-record-schema.md](./rules/layer-record-schema.md):

1. The structured **JSON record** — one object per slot, matching the schema exactly. Use
   `"Unconfirmed"` for any field the file does not state. Never invent a colour, frame range, or
   layer that is not in the source.
2. A **one-paragraph human-readable summary** — what the slot looks like, its layers back→front,
   the motion arc, the focal element, the dominant palette, and its slot id. Plain prose, no fluff,
   readable by an agent that will never see the video.

For the exact field-by-field procedure and a fully worked example record built from the real
`01-parallax-depth-stack.md` template, follow
[./rules/describe-template.md](./rules/describe-template.md).

**Optional `scorecard_lenses` tag.** When the video is scored against a rubric (e.g. a hackathon
scorecard), add a `scorecard_lenses` array to the record listing which criteria this slot genuinely
earns — e.g. `["Technical", "Creativity"]`. Be evidence-based: tag only lenses the shot actually
demonstrates on screen, never aspirationally.

---

## Phase 6 — Still-preview review gate (before any full render)

A record describes *intent*; a still proves *reality*. For a human-reviewed production, never sign off
or full-render a scene until frame-accurate stills have been checked against its record.

1. **Pick key frames from `motion_arc`:** the entrance-end, one hold frame, and the exit-start. For a
   clip with a signature beat (e.g. a recolour at f150), also grab one frame just before and just after
   the beat. These are the frames where the record makes falsifiable claims.
2. **Render them (read-only — the recorder itself never renders; this is the build operator's step):**
   `npx remotion still <CompositionId> --frame=<N> --scale=0.5 -o previews/<slot_id>-<N>.png`
   for each chosen frame.
3. **Assemble a contact sheet** (the stills laid in a grid) for human review.
4. **Run the OBJECTIVE checks yourself** (these have a right answer): are the named layers present and
   in back→front order? Do on-screen colours match the `palette` hexes? Is each caption on screen for
   its stated window and not clipped? Did the signature beat happen on the claimed frame? Is there any
   render-breaking `Math.random()`/clock call in the scene's code? Record a verdict: `PASS`, or a
   specific mismatch (`missing layer`, `wrong colour`, `caption clipped`, `beat off by N frames`,
   `nondeterministic randomness`) — fix mismatches before full render, never silently proceed.
5. **ESCALATE the SUBJECTIVE judgement to a human** (see breakout below). Do NOT self-certify whether
   the scene *looks good, looks real, looks cool, reads as the live product, or feels right.* Present
   the stills/contact sheet and ask. The whole point of the gate is human eyes on the look.

The gate is mandatory for a human-reviewed cut: the stills + this record let a person approve a scene
without watching a render. Append both the objective verdicts and the human's call under a `review` field.

### Human-inspection breakout (the "does this look like…" rule)

**If you are asking yourself "does this look like / look right / look good / look real / look cool /
convince / feel right?", STOP — that is a human-review trigger, not a self-judgment.** Models are
unreliable judges of subjective visual quality (this gate exists because self-certified "looks fine"
stills shipped a rejected cut). Escalate any of these to the human, with the still attached:
- realism / fidelity ("does this read as the real product, not a recreation?")
- aesthetic quality ("is this cinematic / premium / cool / on-brand?")
- tone / vibe ("does this feel rebellious-but-considerate / serious / playful enough?")
- "is this good enough to ship?" for any hero or signature shot.
Objective, checkable facts (a hex value, a frame number, a layer's presence, text legibility,
nondeterministic randomness) you verify yourself. Taste, impression, and "feel" you hand to the
human. When unsure which kind a question is, treat it as subjective and escalate.

---

## Hard rules (never violate)

1. **Read-only.** Never write/edit project code, never run `npm`/`npx`/installs/services, never
   read `.env*`. You read template `.md`/`.tsx` and emit a record — nothing else.
2. **Report `Unconfirmed`, never guess.** If the file does not state a colour, frame range, layer,
   or text value, write `Unconfirmed` — do not infer or fill with a plausible default.
3. **Never invent colours or timings not present in the source.** Report the file's actual hexes
   and frame ranges even when they differ from the canonical mygov palette.
4. **One record per slot.** A template that fits multiple slots gets one record per slot id; list
   the others in `also_fits`. Do not merge two slots into one record. (Applies to the slot pipeline;
   SECTIONS scenes occupy a fixed narrative position and have no `also_fits`.)
5. **Flag CSS-animation usage as a VIOLATION.** Any CSS `transition`, CSS `animation`, or Tailwind
   `animate-*` class is non-rendering in Remotion — record it under `violations`. Static CSS
   (gradients, `clip-path`, blend modes, `filter`, `backdrop-filter`) is allowed and is not a
   violation.
6. **Flag non-deterministic randomness as a VIOLATION.** A naked `Math.random()`, `Date.now()`,
   `new Date()`, or `performance.now()` in render breaks Remotion's out-of-order rendering — record
   it under `violations`. Seeded/deterministic randomness (hash, Remotion `random(seed)`,
   pre-computed data) is fine; note the seed source under `reproducibility`.
7. **Layers are recorded back → front**, index 0 = backmost. The backmost layer should be an
   animated background; if it is static, say so.
8. **Frames are authoritative; seconds are derived** at 30 fps (`seconds = frames / 30`). Always
   give both.
9. **Glob the folder; never hard-code the inventory.** Do not assert how many templates are
   authored — list what is on disk at run time. If a named template is not on disk, report it
   missing; never fabricate a record for it.
10. **Never self-certify subjective visual quality.** If the question is "does this look right /
    good / real / cool / convincing / on-tone", escalate to a human with the still attached (see the
    Human-inspection breakout in Phase 6). Only objective, checkable facts are yours to verdict.

## Related skills

- **`remotion-slot-reporter` (top-level installed skill)** — the general "read a Remotion project,
  report it slot-by-slot" reporter. This skill is the **project-specific** recorder for the
  multilayer/slot pipeline with the still-preview review gate (Phase 6); the top-level one is the
  general reporter. Use this when working in `apps/claude-remotion` against the multilayer/slot
  templates; use the general reporter for an arbitrary Remotion project.
- **SECTIONS narrative recording** — this skill does **not** record bespoke `SECTIONS[]` cuts
  (`MyGovFinal.tsx`-style). Those want a *scene record* (section id + chapter card +
  sub-components + caption track + motion timeline + data/capture sources), not a slot/layer
  record. The frame-accurate record for the live MyGov cut is maintained as
  `mygov-campaign-video/VIDEO_RECORD.md`.
- **`silent-caption-system`** — owns the caption-track *contract* (`CaptionLine` styles/timing).
  This skill only *reads and reports* a caption track; reference that skill, don't restate it.

## Sub-files

- [./rules/layer-record-schema.md](./rules/layer-record-schema.md) — the JSON schema for a recorded
  slot, field by field, plus a fully worked example record.
- [./rules/describe-template.md](./rules/describe-template.md) — step-by-step procedure to inspect a
  template MD/TSX and produce the record, worked end-to-end on the real parallax template.

---

## Self-evaluation

Run these before trusting a record (each: claim → code location that confirms it → how to test).
These are the regression checks that *would have caught* the drift this skill carried.

1. **Inventory is globbed, not hard-coded.** Claim: the skill never asserts a fixed count of
   authored templates. → `apps/claude-remotion/remotion_lab/templates/multilayer/` (all ten
   `01-…10-*.md` + `README.md`; README frontmatter `count: 10`). → Test: grep the SKILL + both
   sub-files for any sentence stating how many templates exist / are "not yet authored"; if found,
   FAIL (must be a run-time glob, not a baked number).
2. **Determinism is a VIOLATION.** Claim: naked `Math.random()`/`Date.now()`/`new Date()`/
   `performance.now()` in render is flagged like a CSS animation. → `Fireworks.tsx:18-23`
   ("never use Math.random or the clock"); `MessageTrigger.tsx:16`; `CodexNexus.tsx:31`. → Test:
   the Hard-rules list and Phase 4 both name nondeterministic randomness as a violation, and
   point to the seeded-hash/`random(seed)` correct path.
3. **Scope is explicit (slot pipeline vs SECTIONS).** Claim: the skill states it records the
   multilayer/slot architecture and does *not* record bespoke `SECTIONS[]` cuts. → live evidence
   both sides: the retired `standard_short_v1/generated/` (slot pipeline,
   alive) vs `mygov-campaign-video/src/MyGovFinal.tsx` (`SECTIONS[]` + `<Series>`, prop-less
   `<C />`). → Test: the "Scope" section names both architectures and routes SECTIONS elsewhere;
   grep mygov src for `SLOT_ORDER`/`also_fits`/`11-slot` returns zero — so the slot vocabulary
   must not be claimed universal.
4. **Prop convention is scoped, not universal.** Claim: `{ slot, accentColor, brandName }` is
   labelled slot-pipeline-specific, not a fact that holds for every scene. → `multilayer/README.md:41`
   + `01-parallax-depth-stack.md:55` (slot props) vs `MyGovFinal.tsx:41` (`<C />`, no props). →
   Test: the Domain-facts entry qualifies the prop convention with "slot pipeline only".
5. **EASE_OUT matches the spec's own name.** Claim: the standard ease `Easing.bezier(0.16,1,0.3,1)`
   is named `EASE_OUT` in the multilayer specs (and `EASE` in some section code — same bezier). →
   `multilayer/README.md:40`, `01-parallax-depth-stack.md:71,73` (`EASE_OUT`); section files use
   `const EASE = Easing.bezier(0.16,1,0.3,1)`. → Test: the skill does not "correct" `EASE_OUT` to
   `EASE` (that would be a manufactured convention-mismatch — the values are identical).
6. **Report the file's hex, not the canon.** Claim: when a template states a hex differing from the
   reference palette (e.g. parallax ACCENT `#38bdf8` vs canon `#7dd3fc`), record the file's hex. →
   `01-parallax-depth-stack.md` (`#38bdf8`). → Test: the worked example in
   `rules/layer-record-schema.md` records `#38bdf8`, not `#7dd3fc`.
7. **Caption track recorded as timed windows.** Claim: a `CaptionLine[]` track is recorded as
   per-line `[in_s, out_s]` → frame windows with a clip-past-scene-end check, not a single
   `caption` string. → `captions/Caption.tsx` (`CaptionLine{in_s,out_s,style,accent}`, styles
   `title|kicker|subtitle|label`, seconds relative to scene start). → Test: Phase 3 records the
   whole track and the Phase 6 objective list verifies each line's window.
8. **External captures flagged as a reproducibility risk.** Claim: a baked `staticFile("captures/*.png")`
   is named an explicit reproducibility flag with a recreate-path pointer. → `FireworksFinale.tsx:49`
   (`captures/diagram-platform.png`) and 6 other capture sites. → Test: Phase 4 step 2 names the
   captured-PNG case and points at `make-product-footage`/`diagram-flythrough`.
9. **Frames↔seconds at 30 fps everywhere.** Claim: every duration gives both frames and seconds via
   `seconds = frames / 30`. → `apps/claude-remotion/CLAUDE.md` ("1s = 30 frames"). → Test: pick any
   recorded window; `seconds == frames / 30`.
10. **Read-only honoured.** Claim: the skill never edits code, runs renders, or reads `.env`. →
    n/a (procedural). → Test: a run that wrote a file, ran `npx`, or read `.env*` FAILS.

### Flexible-mode checks (`record_mode: "flexible"`)

11. **Mode discriminator present; closed unchanged.** Claim: every record carries `record_mode`
    (`closed_11slot` default | `flexible`), and closed_11slot behaviour is byte-for-byte the prior
    schema. → "## Record mode" section + `rules/layer-record-schema.md` "## Schema" (closed) vs
    "## Flexible mode schema". → Test: a record with no `record_mode` is incomplete; a closed record
    still uses `slot_id` + `also_fits` + mandatory `layers[]`.
12. **No count cap leaks into the flexible key space.** Claim: flexible `slot_key` is an open
    `^[A-Za-z0-9_-]+$` with no `<=8`, no 11-slot enum, no fixed count. → "## Record mode" point 1. →
    Test: grep the flexible schema/worked example for a slot count cap or `slot_id` enum; if a cap or
    enum constrains `slot_key`, FAIL. (Closed mode keeps its enum — that is correct, not a leak.)
13. **`layers[]` optional in flexible.** Claim: a non-stack beat records `sub_components[]` +
    `caption_track[]` instead of a mandatory 3-4 `layers[]` stack. → "## Record mode" point 2 +
    the FindMp worked example (no `layers[]`; `sub_components[]` = GuidedZoom / ClickFlash /
    Captions). → Test: a flexible record for a non-stack beat that omits `layers[]` is valid.
14. **`editor_*` projection carries EXACTLY three fields.** Claim: only `editor_description` →
    `slot.description`, `editor_notes` → `slot.notes`, `editor_target_duration_seconds` →
    `slot.target_duration_seconds` cross into the editor; the rich body stays in the sidecar at
    `rich_record_ref`. → "## Record mode" point 3. → Test: count the fields that project onto the
    editor slot — exactly three; any layer/palette/motion field that crosses into the editor FAILS.
15. **slot_type duration rule (still ⇒ int / video ⇒ null).** Claim: `editor_target_duration_seconds`
    is integer seconds for a `still` slot and `null` for a `video` slot. → "## Record mode" point 4 +
    the FindMp worked example (`slot_type: "video"` ⇒ `editor_target_duration_seconds: null`). →
    Test: a `video` slot with a non-null target, or a `still` slot with a non-integer target, FAILS.
16. **`slot_key` joins verbatim to the producer.** Claim: `slot_key` is the producer's beat key /
    `section_id`, copied with no transform, matching bridge-v2 + editor. → "## Record mode" point 5;
    FindMp worked example uses `slot_key: "findMp"` = `tokens.ts` `BEAT_FRAMES.findMp` key. → Test:
    the recorded `slot_key` byte-matches the producer beat key / bridge-v2 slot_key; any case-fold or
    slugify transform FAILS the join.

---

## Changelog (append-only — newest first)

- v3 (2026-06-07): **Added FLEXIBLE record mode (Increment 5 / Work Item E) — ADDITIONS ONLY; the
  `closed_11slot` schema (slot_id enum, also_fits, mandatory layers[]) and its parallax worked
  example are unchanged byte-for-byte.** Introduced a `record_mode` discriminator
  (`closed_11slot` default | `flexible`) for bespoke N-section cuts (mygov_explainer / recipe_v0).
  Flexible mode: (1) open `slot_key` `^[A-Za-z0-9_-]+$` with **no count cap** replaces the closed
  `slot_id` enum, one record per beat, `also_fits` dropped; (2) `layers[]` optional — a non-stack
  beat records `sub_components[]` + `caption_track[]`; (3) the `editor_*` projection block
  (`editor_description`→`slot.description`, `editor_notes`→`slot.notes`,
  `editor_target_duration_seconds`→`slot.target_duration_seconds`) is the ONLY surface that crosses
  into the editor PATCH — the rich body persists as a sidecar at `rich_record_ref`; (4) slot_type
  duration rule (still ⇒ integer seconds, video ⇒ null); (5) `slot_key` joins VERBATIM to the
  producer beat key / bridge-v2 slot_key (same key family as Increments 3/4 — no transform). Added a
  flexible JSON schema section + a fully-traced worked example (mygov_explainer `FindMp`: slot_key
  `findMp`, position 4, slot_type video, 390f/13.0s, 3-line caption track, target null) and six
  flexible-mode Self-evaluation checks (#11–16). *Why:* Increments 3/4 produce/import bespoke
  per-slot bridge-v2 records, but the recorder could only describe the fixed 11-slot shape; flexible
  mode gives those cuts a per-slot description record whose `editor_*` projection feeds the editor
  while the rich record stays a sidecar.
- v2 (2026-06-01): Drift-correction pass (skill-improver). **(1) stale-fact:** removed the false
  "nine of ten multilayer templates are not yet authored / only 01 is authored" claim from "When to
  use", Hard rule #8, and `rules/describe-template.md` Step 1.2 — all ten + README exist on disk
  (`multilayer/` listing; README frontmatter `count: 10`); an agent obeying it literally would
  refuse nine real files. Replaced with "glob the folder; never hard-code the inventory" (new Hard
  rule #9). **(2) never-built gap:** added a non-deterministic-randomness VIOLATION rule
  (`Math.random`/`Date.now`/`new Date`/`performance.now` in render) as Hard rule #6 + Phase 4 step 1
  + Phase 6 objective check, citing `Fireworks.tsx:18-23` / `MessageTrigger.tsx:16` /
  `CodexNexus.tsx:31`; recorded the seeded-hash / `random(seed)` correct path. **(3)
  architecture-miss / convention-mismatch:** added a "Scope" section and qualified the
  `{slot,accentColor,brandName}` prop convention as slot-pipeline-only — the live bespoke cut
  (`MyGovFinal.tsx` `SECTIONS[]` + `<Series>`, prop-less `<C />`) is **not** this skill's domain and
  is routed to a scene-record / `VIDEO_RECORD.md`. **(4) gap:** promoted caption-track recording to
  first-class (per-line `[in_s,out_s]`→frame windows + clip check), citing `captions/Caption.tsx`;
  named baked `captures/*.png` as an explicit reproducibility risk citing `FireworksFinale.tsx:49`.
  **(5)** added the `## Self-evaluation` regression rubric. Kept (unchanged, verified accurate):
  the frame-based motion rules, `EASE_OUT` ease (matches `multilayer/README.md:40`; not "corrected"
  to `EASE`), frames↔seconds bridge, "report the file's hex" rule, and the entire Phase 6
  still-preview review gate + human-inspection breakout. Added a "Related skills" cross-link to
  `remotion-slot-reporter` / `silent-caption-system` (cross-link, not merge — <70% overlap and
  Phase 6 is unique). *Why:* code is ground truth; the slot pipeline is live (so keep+correct, do
  not retire), but the inventory fact had inverted into a refuse-real-files bug and the determinism
  rule the recent bespoke work proved necessary was absent.
