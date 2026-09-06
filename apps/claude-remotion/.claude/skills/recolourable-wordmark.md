---
name: recolourable-wordmark
description: Build a brand wordmark ONCE as a font-based vector component with colour as props — so every colourway is a preset and any new colour is a one-line change, vector-crisp at any size (no raster blockiness). Use when you have a logo/wordmark that is the same text in one font across many colour variants, or a stack of raster logo PNGs that look blocky when scaled. Realizes the studio rule "brand marks = flat SVG/code, never AI-gen". Reference impl: src/templates/solvx_logo/.
---

## When to use

- You have a wordmark logo that is the **same text in one font/size** across many colourways
  (solid, outline, gradient, neon glow, two-tone), or a stack of raster logo PNGs that go **blocky**
  when used at size in a video.
- You want to **recolour it at will** — change the letters and an accent (e.g. a dot) independently,
  try new colourways, animate the colour — instead of shipping fixed rasters.
- Realizes the standing studio lesson (project-bright-studio-pivot.md): recurring brand marks are
  **flat SVG/code + CSS glow, NEVER AI-generated** (AI logos are unrepeatable and can't recolour/scale).

## The principle — design once, recolour at will

N logo variants that share a wordmark are not N logos; they are **one wordmark × N colourways**. Rebuild
the wordmark once from the actual **font** (vector → razor-sharp at any size), make **colour a prop**, and
every historical variant becomes a preset. Do NOT trace a blocky raster — a trace just reproduces the
blockiness; the font is the sharp source of truth.

## Build steps

1. **Identify the font.** Check what `@remotion/google-fonts` the project already loads (solvx = **Fredoka**,
   loaded in `ai_top5/AiTop5Composition.tsx` + `BubbleText.tsx`). Confirm by rendering a still and comparing
   to the source raster. Font-based = crisp; if truly no font matches, that is the only time to trace.
2. **Isolate colours from the rasters → presets.** A small PIL/numpy script per PNG: take opaque pixels
   (alpha ≥ ~180), quantize, cluster → the dominant colours; count partial-alpha pixels → detect a glow.
   Output per-logo `{regions, palette, glow}` → tells you body/dot/gradient/glow per variant. Dedupe
   identical variants by md5 first.
3. **Build the recolourable component** (`SolvxWordmark.tsx` pattern). Split the wordmark into
   independently-coloured spans (`solvx` | `.` | `uk`) so the **dot recolours separately from the body**.
   Style props:
   - `body` / `dot` — solid colours on separate spans.
   - `gradient` — `background-image: linear-gradient(...)` + `WebkitBackgroundClip: "text"` +
     `WebkitTextFillColor: "transparent"` (override the dot span's fill to keep a solid dot).
   - `outline` — `WebkitTextStroke`, width as a **ratio of font size** (resolution-independent);
     `fill:false` → transparent fill, outline only.
   - `glow` — `textShadow` multi-blur in the glow colour.
   - `weight` — Fredoka 300–700.
4. **Presets file** (`presets.ts`) — each historical variant = one `{ id, label, bg, ...style }`.
5. **Showcase composition** (optional, `LogoShowcase.tsx`): intro hero → grid of all presets → recolour
   demo (body + dot hue-cycle **independently**) → a **wild-rush** montage (accelerating cuts through
   vivid solids / gradients / neon / outline / radial + duo-split backgrounds, with pop/tilt/strobe) →
   land on the primary. Frame-based per the Remotion rules (useCurrentFrame + interpolate, clamp, no CSS
   transitions).
6. **Verify:** `npx remotion still <Comp> out/x.png --frame=N` first (font match + sharpness + legibility),
   then `npx remotion render`.

## Reference implementation (solvx)

`src/templates/solvx_logo/` — `SolvxWordmark.tsx` (the master), `presets.ts` (21 presets from the isolated
palettes; two byte-identical variants deduped), `LogoShowcase.tsx` (grid + demo + wild rush). Composition
id `LogoShowcase`, registered in `Root.tsx`. Renders vector-crisp; colours are props.

## Gotchas

- **Split-card straddle:** a wide single-colour mark centred on a split light/dark tile loses the half on
  the wrong side. Use **single-tone cards** chosen per the mark's natural background (dark-ink marks on
  light cards; glow/pale/gold on dark cards).
- **Determinism:** derive per-cut variety in the wild rush from the **cut index**, never `Math.random`
  (Remotion needs deterministic frames or it flickers).
- **Gradient + solid dot:** with a gradient body (`WebkitTextFillColor: transparent`), the dot span must set
  `WebkitTextFillColor: <dot>` explicitly or it inherits the transparent fill and vanishes.

## Related

- **project-bright-studio-pivot.md** — the "brand marks = flat SVG/code, not AI-gen" lesson this realizes.
- **BubbleText.tsx** — the Fredoka colour/glow/stroke text pattern this builds on.
- **record-final-video** — the completion-report shape after rendering (post-render report).
