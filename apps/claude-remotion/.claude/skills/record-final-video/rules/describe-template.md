# Describe a Template — Step-by-Step Procedure

How to turn one multi-layer template (MD spec or generated TSX) into a slot record. Follows the
five phases in `../SKILL.md`; emit per [./layer-record-schema.md](./layer-record-schema.md).
Read-only throughout: read the file, never edit, never run anything.

## Step 1 — Locate & classify (SKILL Phase 0)

1. Read the target file. MD specs live at
   `apps/claude-remotion/remotion_lab/templates/multilayer/*.md`; generated slots at
   `apps/claude-remotion/src/templates/**/<Slot>.tsx`.
2. If the file is not on disk, print `UNCONFIRMED: <name> not found` and stop. Only
   `01-parallax-depth-stack.md` is authored today; the other nine names are not yet written — do
   not fabricate a record for a missing template.
3. From the file, read its slot guidance ("11-slot mapping" line in MD, or the Composition/
   component name in TSX). Pick **one** `slot_id`; put alternates in `also_fits`.
4. Set `category`: `still` (s* slot, no footage), `clip` (v* slot with `OffthreadVideo`), or
   `hybrid` (still slot with looping motion but no real footage).
5. Set `dimensions` (default 1920×1080), `fps` (30), and `duration` — read the stated total
   frames, then `seconds = frames / 30`.

## Step 2 — Parse the layer stack, back → front (SKILL Phase 1)

- **MD:** the "Layer stack (back → front)" table is your layer list; row order = z-order. Each row
  fills one `layers[]` object: `index` (0 = top row = backmost), `name`, `role`, `contents`,
  `opacity`, `blend`.
- **TSX:** list each top-level `<AbsoluteFill>` (or `<Sequence>`-wrapped fill) in the returned tree
  in **source order** = back→front. The first is index 0.
- Confirm index 0 is the **animated background**. If it is static, note that in its motion object
  (`"type": "static"`) — most templates require continuous background motion.

## Step 3 — Extract motion per layer (SKILL Phase 2)

For each layer:
- **MD:** read the "Animation" cell + the "Motion design" section. They give the property, the
  frame window (e.g. "f8–28"), the easing (EASE_OUT), and whether motion is continuous or ranged.
- **TSX:** for each `interpolate(frame, [a, b], [from, to], { easing })`, `[a, b]` is the frame
  window. For `<Sequence from={N} durationInFrames={M}>`, the element is active `N … N+M`; frame
  refs inside are relative (local 0 = parent N) — translate them back to absolute frames.
- Fill the layer's `motion`: `summary`, `type` (continuous / ranged / static), `frames`, `seconds`
  (`[a/30, b/30]`), `property`, `easing`.
- Continuous motion (`Math.sin(frame…)`, never resets) spans the whole clip — set frames to the
  full duration and `type: "continuous"`.

Then roll up `motion_arc`: `entrance_frames`, `hold_frames`, `exit_frames` (from the Motion-design
entrance/hold/exit split), and note camera moves (usually none) and continuous-under-ranged layering.

## Step 4 — Colours, focal element, text (SKILL Phase 3)

- **Palette:** collect every hex literal in the file, dedupe, order bg → fills → accents, tag each
  with a role. Report the **file's** hexes — if the file says `#38bdf8` for accent, record that, not
  the canonical `#7dd3fc`.
- **Per-layer `dominant_colours`:** the 1-3 hexes each layer is built from.
- **Focal:** the sharpest, most central, highest-contrast element (usually the headline+stat). Set
  `focal.element` and `focal.layer_index`.
- **Text:** `headline`, `subtext`, `caption`. Props-driven text → report the prop name (e.g.
  `brandName`) plus any example value. Data figures (e.g. "647 MPs") → verbatim, note the source.

## Step 5 — Reproducibility & violations (SKILL Phase 4)

- Confirm each layer's assets are code/data-derived. Fill `assets[]` with `kind`
  (`css|procedural|data-derived|props|video-footage|image`) and a source note.
- Write `reproducibility`: deterministic & regenerable, or depends on an external asset.
- Scan for CSS `transition` / CSS `animation` / Tailwind `animate-*` — any found go in `violations`
  (they will not render). Static CSS (gradients, `clip-path`, blend, `filter`) is **not** a
  violation. If clean, `violations` is `[]`.

## Step 6 — Emit (SKILL Phase 5)

1. Assemble the JSON object exactly per [./layer-record-schema.md](./layer-record-schema.md). Any
   field the file does not state → `"Unconfirmed"`. Never invent.
2. Write the `summary` paragraph: slot id + brand, duration (frames/seconds) + dimensions/fps,
   layers back→front with their motion, focal element, motion arc, dominant palette, and alternates.
3. Output the JSON first, then the human-readable paragraph.

## Worked walk-through — `01-parallax-depth-stack.md` → record

Reading the real file produces, step by step:
- **Step 1:** still category; "11-slot mapping" line gives primary fit **s2** (with s6/s1/s3 in
  `also_fits`); 90f → 3.0s; 1920×1080 @ 30fps.
- **Step 2:** the 4-row "Layer stack" table → 4 layers: `0 Aurora mesh` (bg, screen, op 1.0),
  `1 Mid card field` (mid-depth, op 0.55, blur 6px), `2 Focal headline` (focal, op 1.0),
  `3 Grain + vignette` (foreground, op 0.18, vignette multiply).
- **Step 3:** L0 + L3 continuous (sin drift / parallax, f0-90); L1 ranged parallax `translateX
  0→-36` f0-90 + staggered fade f0-18; L2 ranged headline `translateY 26→0` + `opacity 0→1` f8-28,
  rule `width 0→180` f20-34. Arc: entrance f8-34, hold f34-76, exit (comp `opacity 1→0`) f78-90.
- **Step 4:** palette `#07090f` bg, `#38bdf8` accent, `#111827` card, `#e8eaf0` text, `#16a34a`
  aye, `#dc2626` no. Focal = centred headline + "647 MPs" on layer 2. Text: headline = `brandName`/
  scene title (prop), subtext = "647 MPs" (data).
- **Step 5:** all assets css/procedural/data-derived/props → deterministic & regenerable; no CSS
  animation (all motion via `interpolate`/`Math.sin`) → `violations: []`.
- **Step 6:** the completed object + paragraph are shown in
  [./layer-record-schema.md](./layer-record-schema.md) under "Worked example". Reproduce that shape
  for any new template, substituting only what its own file states.

## Flexible mode — worked example (`mygov_explainer` `FindMp`)

A bespoke beat from a flat beats cut — recorded in `record_mode: "flexible"` (see `../SKILL.md`
"## Record mode" and the flexible schema in [./layer-record-schema.md](./layer-record-schema.md)).
It is NOT a 3-4 `AbsoluteFill` stack, so it records `sub_components[]` + `caption_track[]`, no
`layers[]`, no `also_fits`. **Every number traces to source — `FindMp.tsx` + `tokens.ts`/`accents.ts`
+ the composition registration in `Root.tsx`; anything the files do not state is `"Unconfirmed"`.**

Source trace:
- `slot_key: "findMp"` — verbatim producer beat key: `tokens.ts` `BEAT_FRAMES.findMp` key /
  `FindMp.tsx` export `FindMp`. Matches the bridge-v2 / editor `slot_key` (no transform).
- `position: 4` — `tokens.ts` `BEAT_ORDER = [hook, problem, solution, findMp, …]`, index 3 → 1-based 4.
- `duration {frames:390, seconds:13.0}` — `tokens.ts` `BEAT_FRAMES.findMp = 390`; `390 / FPS(30) = 13.0`.
- `slot_type: "video"` ⇒ `editor_target_duration_seconds: null` — an animated camera beat (hold-pan-hold
  over a baked capture + a caption track) carries its own 390f duration in the cut, so it is recorded
  as a `video` slot with a null target (per the slot_type duration rule), not a fixed-seconds still.
- camera framings / pan: `FindMp.tsx` `BOX_SEARCH {cx0.15,cy0.19,scale1.7}`, `BOX_MAP
  {cx0.78,cy0.5,scale1.35}`, `PAN_AT=200`, `PAN_DUR=30`, `jitter={8}`, `GuidedZoom src
  "capture-search-typed.png" imgFit cover`.
- beat-edge dissolve: `beatEnvelope(frame, D=390, BEAT_FADE)` with `tokens.ts BEAT_FADE = 9` →
  fade-in `[0,9]`, fade-out `[381,390]`.
- `ClickFlash f={60} x={0.5} y={0.53} accent={ACCENTS.map}` (`FindMp.tsx`); `ACCENTS.map = "#38bdf8"`
  (`accents.ts`).
- caption track: the three literal `CaptionLine` entries in `FindMp.tsx` (frames = `in_s*30`).
- dimensions `1920×1080`, `fps 30` — `Root.tsx` `MyGovExplainer` composition.

```json
{
  "record_mode": "flexible",
  "slot_key": "findMp",
  "position": 4,
  "slot_type": "video",
  "template_name": "mygov_explainer/FindMp",
  "source_file": "/app/src/templates/mygov_explainer/beats/FindMp.tsx",
  "dimensions": { "width": 1920, "height": 1080 },
  "fps": 30,
  "duration": { "frames": 390, "seconds": 13.0 },

  "sub_components": [
    {
      "name": "GuidedZoom",
      "role": "camera",
      "contents": "Virtual camera over the baked capture staticFile('captures/capture-search-typed.png') (imgFit cover): the Public Whip 'Search the Whip' box, then the UK constituency map. Hold-pan-hold.",
      "motion": {
        "summary": "hold on BOX_SEARCH {cx0.15,cy0.19,scale1.7} f0-200, pan to BOX_MAP {cx0.78,cy0.5,scale1.35} f200-230 (jitter 8), hold on the map f230-390",
        "type": "ranged",
        "frames": [0, 390],
        "seconds": [0.0, 13.0],
        "property": "cx / cy / scale (translate + scale)",
        "easing": "EASE_OUT"
      }
    },
    {
      "name": "ClickFlash",
      "role": "overlay",
      "contents": "Focus pulse on the search field while the camera is static on it (screen-space ripple + pulse, no cursor)",
      "motion": {
        "summary": "fires at f60 (2.0s) at screen (0.5,0.53), accent #38bdf8; ~1s ripple+pulse",
        "type": "ranged",
        "frames": [56, 92],
        "seconds": [1.87, 3.07],
        "property": "scale / opacity",
        "easing": "EASE_OUT"
      }
    },
    {
      "name": "Captions",
      "role": "caption-dispatcher",
      "contents": "Renders the 3-line subtitle track (sceneEndS = 13.0); see caption_track",
      "motion": {
        "summary": "per-line fade in/out at each line's window",
        "type": "ranged",
        "frames": [15, 324],
        "seconds": [0.5, 10.8],
        "property": "opacity / translateY",
        "easing": "EASE_OUT"
      }
    }
  ],

  "caption_track": [
    { "text": "Start with your MP.", "style": "subtitle", "accent": "#38bdf8", "in_s": 0.5, "out_s": 3.0, "frames": [15, 90], "chars": 19, "floor_seconds": 1.8, "clips_past_scene_end": false },
    { "text": "Search by name or postcode,", "style": "subtitle", "accent": "#38bdf8", "in_s": 3.2, "out_s": 6.2, "frames": [96, 186], "chars": 27, "floor_seconds": 1.89, "clips_past_scene_end": false },
    { "text": "or pick them on the map.", "style": "subtitle", "accent": "#38bdf8", "in_s": 7.2, "out_s": 10.8, "frames": [216, 324], "chars": 24, "floor_seconds": 1.8, "clips_past_scene_end": false }
  ],

  "focal": { "element": "the search box (f0-200), then the UK constituency map (f230-390) the camera frames", "sub_component": "GuidedZoom" },
  "palette": [
    { "hex": "#38bdf8", "role": "accent" }
  ],
  "motion_arc": {
    "entrance_frames": [0, 9],
    "hold_frames": [9, 381],
    "exit_frames": [381, 390],
    "notes": "Beat-edge dissolve via beatEnvelope(frame, 390, BEAT_FADE=9). Within the hold: ClickFlash pulse ~f60; camera holds on the search box f0-200, pans f200-230, holds on the map f230-390. The continuous animated Background runs at the composition root beneath this beat (not part of this slot)."
  },
  "assets": [
    { "name": "capture-search-typed.png", "kind": "image", "source": "staticFile('captures/capture-search-typed.png') via GuidedZoom — BAKED CAPTURE (real Public Whip + UK-map screenshot)" },
    { "name": "ClickFlash pulse", "kind": "procedural", "source": "deterministic interpolate on frame (no Math.random/clock)" },
    { "name": "Caption track", "kind": "data-derived", "source": "3 literal CaptionLine entries in FindMp.tsx" }
  ],
  "reproducibility": "Depends on a baked external capture — captures/capture-search-typed.png composited via GuidedZoom. Recreate path: repo-ui-to-motion (capture-first). All MOTION is deterministic (frame-based interpolate / Math.sin / Math.exp; no Math.random / Date.now / new Date / performance.now).",
  "violations": [],

  "rich_record_ref": "previews/findMp.record.json",

  "editor_description": "Find your MP: the Public Whip search box, then a glide to the UK constituency map. Search by name or postcode, or pick them on the map.",
  "editor_notes": "Motion arc f0-390 (13.0s): beat-edge dissolve f0-9 / f381-390; camera holds on the search box f0-200, pans f200-230 (jitter 8), holds on the UK map f230-390; ClickFlash focus pulse f60. Determinism: all frame-based interpolate, no Math.random/clock — clean (no violations). Baked-capture risk: captures/capture-search-typed.png (GuidedZoom src) — recreate via repo-ui-to-motion. Caption windows (subtitle, accent #38bdf8): 0.5-3.0s / 3.2-6.2s / 7.2-10.8s, none clip past sceneEnd 13.0s. Rich record sidecar: previews/findMp.record.json.",
  "editor_target_duration_seconds": null
}
```

Only `editor_description`, `editor_notes`, and `editor_target_duration_seconds` cross into the editor
slot (`slot.description` / `slot.notes` / `slot.target_duration_seconds`). `slot_key: "findMp"` is the
join key (matches the producer + bridge-v2 + editor verbatim). Everything else here is the rich
sidecar persisted at `rich_record_ref` and is never projected onto the editor.
