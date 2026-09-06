# Layer Record Schema

The canonical JSON shape for **one recorded slot**. A record is a superset of the template's own
`## Render-slot record` section (layers present, focal element, dominant colours, motion summary,
duration, slot id) plus the fields this skill requires: per-layer frame ranges, opacity/blend,
text content, and reproducibility.

Rules:
- One object per slot. A template that fits several slots produces one record each; list the others
  in `also_fits`.
- Frames are authoritative; seconds are derived at 30 fps.
- Any unknown field → the string `"Unconfirmed"`. Never invent a value.
- Report the file's actual hexes, even when they differ from the mygov reference palette.

## Schema

```json
{
  "slot_id": "s1|s2|v1|s3|s4|v2|s5|s6|v3|s7|s8",
  "also_fits": ["<other slot ids this template can occupy>"],
  "template_name": "<kebab template name, e.g. parallax-depth-stack>",
  "source_file": "<absolute path to the .md or .tsx read>",
  "category": "still|clip|hybrid",
  "dimensions": { "width": 1920, "height": 1080 },
  "fps": 30,
  "duration": { "frames": 90, "seconds": 3.0 },
  "layers": [
    {
      "index": 0,
      "name": "<layer name>",
      "role": "background|mid-depth|focal|foreground-overlay",
      "contents": "<what this AbsoluteFill draws>",
      "motion": {
        "summary": "<what moves and how>",
        "type": "continuous|ranged|static",
        "frames": [0, 90],
        "seconds": [0.0, 3.0],
        "property": "<translateX|opacity|width|scale|...>",
        "easing": "EASE_OUT|linear|sine|none"
      },
      "opacity": 1.0,
      "blend": "normal|screen|multiply|...",
      "dominant_colours": ["#rrggbb"]
    }
  ],
  "focal": { "element": "<the sharpest, most central element>", "layer_index": 2 },
  "palette": [
    { "hex": "#rrggbb", "role": "bg|card|accent|vote-aye|vote-no|party|text" }
  ],
  "motion_arc": {
    "entrance_frames": [0, 28],
    "hold_frames": [28, 76],
    "exit_frames": [78, 90],
    "notes": "<camera move? continuous bg under ranged foreground?>"
  },
  "text": { "headline": "<text or prop>", "subtext": "<text/prop or null>", "caption": "<or null>" },
  "assets": [
    { "name": "<asset>", "kind": "css|procedural|data-derived|props|video-footage|image", "source": "<note>" }
  ],
  "reproducibility": "<deterministic & regenerable | depends on external asset X>",
  "violations": ["<CSS animation / non-rendering pattern, or empty>"],
  "summary": "<one-paragraph human-readable description>"
}
```

## Worked example — parallax-depth-stack recorded against slot s2

Built from `remotion_lab/templates/multilayer/01-parallax-depth-stack.md` — every value below is
read from that file (note ACCENT is the file's `#38bdf8`, not the canonical `#7dd3fc`).

```json
{
  "slot_id": "s2",
  "also_fits": ["s6", "s1", "s3"],
  "template_name": "parallax-depth-stack",
  "source_file": "apps/claude-remotion\\remotion_lab\\templates\\multilayer\\01-parallax-depth-stack.md",
  "category": "still",
  "dimensions": { "width": 1920, "height": 1080 },
  "fps": 30,
  "duration": { "frames": 90, "seconds": 3.0 },
  "layers": [
    {
      "index": 0, "name": "Aurora mesh", "role": "background",
      "contents": "3 soft radial blobs (ACCENT cyan / Labour-red / deep-blue) over BG #07090f, blurred + screen-blended",
      "motion": { "summary": "each blob drifts on a slow sine path the whole clip; hue breathe 0.7↔0.9", "type": "continuous", "frames": [0, 90], "seconds": [0.0, 3.0], "property": "translate (sin) + opacity", "easing": "sine" },
      "opacity": 1.0, "blend": "screen", "dominant_colours": ["#07090f", "#38bdf8"]
    },
    {
      "index": 1, "name": "Mid card field", "role": "mid-depth",
      "contents": "5-7 blurred mygov MP cards + Aye/No vote chips, scattered at varied scale",
      "motion": { "summary": "parallax translateX 0→-36px full clip + per-card translateY bob; staggered fade-in", "type": "ranged", "frames": [0, 90], "seconds": [0.0, 3.0], "property": "translateX / translateY / opacity", "easing": "EASE_OUT" },
      "opacity": 0.55, "blend": "normal", "dominant_colours": ["#111827", "#16a34a", "#dc2626"]
    },
    {
      "index": 2, "name": "Focal headline", "role": "focal",
      "contents": "Headline (brandName / scene title) + one key stat (647 MPs) + accent rule",
      "motion": { "summary": "headline translateY 26→0 + opacity 0→1 f8-28; rule width 0→180 f20-34; near-static drift -8px", "type": "ranged", "frames": [8, 34], "seconds": [0.27, 1.13], "property": "translateY / opacity / width", "easing": "EASE_OUT" },
      "opacity": 1.0, "blend": "normal", "dominant_colours": ["#e8eaf0", "#38bdf8"]
    },
    {
      "index": 3, "name": "Grain + vignette", "role": "foreground-overlay",
      "contents": "~30 procedural particle specks + radial vignette darkening edges",
      "motion": { "summary": "fastest parallax translateX 0→-64px; specks twinkle via sin; vignette static", "type": "continuous", "frames": [0, 90], "seconds": [0.0, 3.0], "property": "translateX / opacity", "easing": "sine" },
      "opacity": 0.18, "blend": "multiply (vignette)", "dominant_colours": ["#07090f"]
    }
  ],
  "focal": { "element": "Centred headline (brandName / scene title) + one key stat; sharpest, highest-contrast, near-static", "layer_index": 2 },
  "palette": [
    { "hex": "#07090f", "role": "bg" },
    { "hex": "#38bdf8", "role": "accent" },
    { "hex": "#111827", "role": "card" },
    { "hex": "#e8eaf0", "role": "text" },
    { "hex": "#16a34a", "role": "vote-aye" },
    { "hex": "#dc2626", "role": "vote-no" }
  ],
  "motion_arc": {
    "entrance_frames": [8, 34], "hold_frames": [34, 76], "exit_frames": [78, 90],
    "notes": "Static camera. 4 planes drift left at increasing rates (bg slow → grain fast) implying z-depth under a ranged headline entrance; whole comp fades out f78-90."
  },
  "text": { "headline": "brandName / scene title (prop-driven)", "subtext": "647 MPs (data-derived stat)", "caption": null },
  "assets": [
    { "name": "Aurora blobs", "kind": "css", "source": "radial-gradient divs in palette colours" },
    { "name": "MP cards / vote chips", "kind": "data-derived", "source": "styled divs from mygov scene-data (party/vote palette)" },
    { "name": "Headline / stat", "kind": "props", "source": "brandName + scene title props; 647 MPs from mygov data" },
    { "name": "Grain", "kind": "procedural", "source": "seeded Array.from specks, deterministic" },
    { "name": "Vignette", "kind": "css", "source": "radial-gradient overlay" }
  ],
  "reproducibility": "Deterministic & regenerable — zero external assets; every plane is code- or data-derived.",
  "violations": [],
  "summary": "Establishing context still for slot s2 (mygov), 90f/3.0s at 1920x1080, 30fps. Four AbsoluteFill planes back→front: an always-drifting aurora-mesh background (#07090f base, #38bdf8 + red/blue blobs, screen-blended), a blurred mid-depth field of mygov MP/vote cards parallaxing left, a sharp near-locked focal headline + '647 MPs' stat with a growing accent rule, and a fastest-moving grain+vignette overlay. Static camera; depth comes purely from planes translating at rates that increase toward the viewer. Focal element is the centred headline+stat on layer 2 (sharpest, highest contrast). Dominant palette: BG #07090f, ACCENT #38bdf8, card #111827, text #e8eaf0, vote green/red. Motion arc: headline rises+fades f8-34, holds to f76, whole comp fades out f78-90, with the background and parallax running continuously underneath. Also fits s6/s1/s3."
}
```

## Flexible mode schema (`record_mode: "flexible"`)

For bespoke N-section cuts (mygov_explainer / recipe_v0). Shares every field of the closed "## Schema"
above EXCEPT: `slot_id` + `also_fits` are replaced by `slot_key`; `layers[]` is **optional** (a
non-stack beat uses `sub_components[]` + `caption_track[]`); and the record adds the `editor_*`
projection block + `rich_record_ref`. **The closed "## Schema" above is unchanged and remains
authoritative for `record_mode: "closed_11slot"`.**

Rules (flexible):
- `record_mode` MUST be `"flexible"`.
- `slot_key` is an open string `^[A-Za-z0-9_-]+$`, **no count cap**, copied VERBATIM from the
  producer's beat key / `section_id` (matches bridge-v2 + editor `slot_key` — no transform). One
  record per beat. **No `also_fits`** (a bespoke beat has one fixed position).
- `layers[]` is optional. For a non-stack beat record `sub_components[]` + `caption_track[]` instead.
- `editor_target_duration_seconds`: **integer seconds when `slot_type:"still"`; `null` when
  `slot_type:"video"`** (the clip carries its own duration via trim).
- The three `editor_*` fields are the ONLY fields that cross into the editor PATCH surface; the rich
  body persists as the sidecar at `rich_record_ref` and does NOT cross.
- Frames authoritative; seconds derived at 30 fps. Unknown → `"Unconfirmed"`. Report the file's hexes.

```json
{
  "record_mode": "flexible",
  "slot_key": "<producer beat key / section_id, verbatim, ^[A-Za-z0-9_-]+$>",
  "position": 4,
  "slot_type": "still|video",
  "template_name": "<bespoke cut + beat, e.g. mygov_explainer/FindMp>",
  "source_file": "<absolute path to the beat .tsx read>",
  "dimensions": { "width": 1920, "height": 1080 },
  "fps": 30,
  "duration": { "frames": 390, "seconds": 13.0 },

  "layers": "OPTIONAL — omit for a non-stack beat; use the closed layers[] shape ONLY if the beat IS a 3-4 AbsoluteFill stack",
  "sub_components": [
    {
      "name": "<child component>",
      "role": "camera|overlay|caption-dispatcher|card|background|...",
      "contents": "<what it composes>",
      "motion": {
        "summary": "<what moves and how>",
        "type": "continuous|ranged|static",
        "frames": [0, 390],
        "seconds": [0.0, 13.0],
        "property": "<translateX|opacity|cx/cy/scale|...>",
        "easing": "EASE_OUT|sine|none"
      }
    }
  ],
  "caption_track": [
    {
      "text": "<line>",
      "style": "title|kicker|subtitle|label",
      "accent": "#rrggbb|null",
      "in_s": 0.5,
      "out_s": 3.0,
      "frames": [15, 90],
      "chars": 19,
      "floor_seconds": 1.8,
      "clips_past_scene_end": false
    }
  ],
  "focal": { "element": "<sharpest, most central element>", "sub_component": "<name>" },
  "palette": [ { "hex": "#rrggbb", "role": "bg|card|accent|vote-aye|vote-no|party|text" } ],
  "motion_arc": {
    "entrance_frames": [0, 9],
    "hold_frames": [9, 381],
    "exit_frames": [381, 390],
    "notes": "<beat-edge dissolve / camera move / continuous bg beneath>"
  },
  "assets": [
    { "name": "<asset>", "kind": "css|procedural|data-derived|props|video-footage|image", "source": "<note>" }
  ],
  "reproducibility": "<deterministic & regenerable | depends on baked capture X>",
  "violations": ["<CSS animation / nondeterministic randomness, or empty>"],

  "rich_record_ref": "<path to this rich record sidecar, e.g. previews/<slot_key>.record.json>",

  "editor_description": "<-> slot.description — the viewer-facing first-cut description>",
  "editor_notes": "<-> slot.notes — motion-arc frames, determinism source, baked-capture risk, violations, caption windows, + a pointer to rich_record_ref>",
  "editor_target_duration_seconds": null
}
```

The `editor_*` triple is the entire editor PATCH surface; `rich_record_ref` plus everything above it
is the recorder's sidecar and is never projected onto the editor slot.
