---
name: extract-image-layers
description: Turn a generated cartoon SCENE image into layered video assets — isolate an added prop as a clean transparent layer (the "add then diff" method), and locate the flat-colour SCREEN as a known landing target. For building composited, animatable device/room scenes (e.g. the AI Top 5 era-TVs) where props shake and a news image flies onto the screen. Runs detect_screen.py + extract_by_diff.py.
metadata:
  tags: image-assets, layers, gpt-image, chatgpt, transparent-png, compositing, remotion, ai-top5, studio
---

## When to use

When a video needs a **generated scene split into layers** you can composite and animate in
Remotion — a device (TV/tablet/projector) with a keyable screen, plus props (chair, table, lamp)
that move independently. Built for the AI Top 5 era-device scenes; reusable for any layered-scene
shot. Two jobs: **(a)** get each prop as a clean transparent PNG, **(b)** find the screen rectangle
so a second image can land on it.

## The core principle: hard to remove, easy to add

Image models can't reliably *remove* an object from a busy scene, and a prop generated *alone* on a
plain background comes out with the wrong shadow and perspective. So we go the other way:

1. Make the **base** scene (bare device in an empty perspective room, flat chroma screen).
2. Ask the model to **ADD one prop** to that same scene — it draws the prop *in context*, so the
   floor shadow and room perspective are correct.
3. **Diff** base vs base+prop → keep only what changed → a clean transparent layer that composites
   back onto the base perfectly (shadow and perspective come with it).

## Workflow

**1. Generate in ChatGPT (free — the owner copy-pastes).** ALWAYS attach a **reference image** so the
style stays consistent across the set (block-colour cartoon; the screen a flat solid colour used
nowhere else — cyan `#00E0FF`). Make the **base**, then a **base+prop** by adding ONE prop to the
SAME image (add, don't regenerate). Owner drops both frames in the media-dump input folder.

**2. Screen target** (the news-image landing spot):
```
.venv/Scripts/python.exe studio/tools/detect_screen.py "<base>" --colour cyan \
  --out studio/projects/<job>/image-tests/<name>_screen_marked.png
```
Returns the screen rect (px + fractional centre/size/aspect) and a marked overlay. Eyeball the
overlay — the red box should hug the screen.

**3. Prop layer** (isolate the added prop):
```
.venv/Scripts/python.exe studio/tools/extract_by_diff.py "<base>" "<base+prop>" --name <prop>
```
Writes `<prop>_cutout.png` (transparent), `_mask.png`, `_preview.png` (on magenta) to
`studio/projects/<job>/image-tests/`.

**4. Verify by re-compositing.** Composite the cutout back onto the base (PIL `alpha_composite` at
0,0 — same canvas). If the prop sits back **faithfully on the floor with its shadow**, the layer is
good. Show the owner the file PATH (they can't see Read-tool images in the terminal).

## Gotchas (learned the hard way)

- **Threshold catches background-matching parts.** Default `--thresh 28`. Too high and parts of the
  prop that match the background (brown chair legs on a brown floor) diff too little and get cut off —
  the prop then looks like it floats above the floor / on the skirting. If a low-contrast part is
  missing, lower it; if there's noise, the largest-blob cleanup usually handles it, else raise it.
- **Solid opaque props: add `--fill-holes`.** For a cabinet / TV / table (a solid object with no
  genuine see-through gaps), dark panels whose colour matches the wall behind punch *interior* holes in
  the cutout. Rather than chase the threshold ever lower (which invites edge noise), keep a sane
  threshold and pass `--fill-holes` — it closes every fully-enclosed hole after the largest-blob step,
  giving a perfectly solid silhouette (proven on the 80s speaker cabinet: purple body on purple wall).
  Do NOT use it for props with real see-through gaps (chair legs, speaker grilles) — a fully-enclosed
  gap would be filled in. Open gaps (reaching the frame edge) are always safe.
- **Replace-grade ≠ animate-grade (edge halo + baked shadow) — use `--erode`.** A cutout that composites
  back perfectly onto its OWN plate can still be wrong for animation: a thin ring of background overflows
  the true edge and TRAVELS with the moving prop (confirmed in production: wall chunks thumping with the
  80s speaker). Fix: `--erode N` pulls the matte N px inside the hard cartoon edge. Proven params:
  solid props `--thresh 14 --fill-holes --erode 3` (speaker); thin-legged props `--thresh 14 --erode 1`
  (chair — heavier erosion would eat the legs). **Verify with a SHIFTED composite**: paste the cutout onto
  the plate offset by the motion amplitude (e.g. −12px thump) and zoom the edges — any doubled background
  edge = halo remains. Low thresh also cures leg-parts vanishing where they cross same-coloured features
  (the chair leg over the skirting). The baked contact shadow still rides along — acceptable for small
  thump/shake; a big fly-in needs the shadow dropped + re-cast procedurally in Remotion (still deferred).
- **`--erode` cures a TRANSLATED halo, but ROTATION still swings the baked shadow.** Hard-won on the
  80s speaker: even a clean eroded matte carries baked floor-shadow/skirting pixels near the base. A
  small SQUASH (scaleY from the floor) keeps them pinned, but a ROCK (rotate about the base) rotates
  those baked pixels too, so the floor/skirting visibly swings (~26s in the AI Top 5 cut, still open).
  Rule: for props you intend to ROTATE, you need a genuinely shadow-free plate (mask the motion to the
  body above the plinth, or re-cast the shadow procedurally). Squash/translate-with-erode is safe; rock is not.
- **`strip_bg.py` — key a whole WARM background to transparent (foreground extract, no diff pair).**
  When you have a single cartoon with a solid warm (orange) backdrop and want just the foreground
  (e.g. the tablet+hands for the #1 finale, so the *background* can become a code-driven splash):
  `python studio/tools/strip_bg.py "<img>" --name 20s_tablet` → `<name>_fg.png` + `_fg_preview.png`.
  It keys `r>r_min AND r−b>45 AND r−g>18` as background; `--largest` keeps the biggest FG blob.
- **Each device screen is a different SHAPE — carry `radiusFrac` per plate** (`screenTargets.ts`): a
  50s CRT is soft-cornered, a projector wall is sharp. The landed image / screen `div` must round to
  `sh * radiusFrac` or it either shows square corners on a round screen or leaves keyable colour peeking
  at the corners of a square screen (the open #1-tablet cyan bug). Measure the corner, don't guess.
- **`--no-largest`** disables the largest-connected-region keep in `detect_screen.py` (rare — only if
  the true screen is legitimately split into two regions).
- **Same base, in-place add.** The two frames must share the same base — GPT should ADD to the
  existing image, not redraw it. A full regeneration makes the diff noisy everywhere (the
  largest-connected-blob cleanup mitigates it, but a clean in-place add is far better).
- **Screen colour must be unique (mostly).** Keep the flat screen colour off everything else so
  detection is unambiguous. `detect_screen` now runs at FULL res and keeps only the LARGEST connected
  region, so a *few* stray keyable pixels (an EQ "peak level" meter, a status LED) no longer inflate
  the rect — but a second large block of the same colour still would, so unique is safest. The colour
  is only a measurement placeholder — the news image covers it in the render, so it never shows.
  `--colour cyan|green|magenta`.
- **Run via the venv:** `.venv/Scripts/python.exe` (needs Pillow).
- **Outputs stay in-project:** `studio/projects/<job>/image-tests/` (media is gitignored there).
  NEVER write to the Desktop or other external dirs. Input comes FROM the media-dump folder.

## Related
- The tools: `studio/tools/extract_by_diff.py`, `studio/tools/detect_screen.py`.
- Downstream: composite the base + screen-landed news image + prop layers in Remotion, and animate
  the props (e.g. shake on the news-story impact) tied to the sting frame.
