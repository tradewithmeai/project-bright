# Camera & handoff

How the virtual camera frames a node, flies between nodes, and hands off to product footage — all
frame-based.

## Fraction → transform maths

Given a target region `{cx, cy, w, h}` (fractions, from the node map) and a target framing fraction
`fill` (how much of frame width the node should occupy, ~0.70):

```
scale = fill / w                         // zoom so node width = fill of the frame
tx    = (0.5 - cx) * 1920 * scale        // shift node centre to frame centre X (px)
ty    = (0.5 - cy) * 1080 * scale        // shift node centre to frame centre Y (px)
```

Apply to a wrapper around the diagram layer: `transform: scale(S) translate(tx px, ty px)` with
`transform-origin: center`. The whole `LitDiagram` (PNG + glow overlays) lives inside this wrapper, so
the glows track the camera exactly.

**Sharpness budget:** cap `scale` for the PNG at the point where it begins to soften (depends on the
PNG's native resolution vs 1920 — test with a still). Before exceeding it, hand off to the DOM panel.

## Flight timing & easing

- **Flight (node→node):** ~18–30 frames, `EASE_OUT`. Interpolate `scale`, `tx`, `ty` together from the
  previous framing to the next.
- **Hold (on node):** while the node glow ignites (~12–20f) and the handoff begins.
- **Ignite/settle on arrival:** a touch of `SPRING` on the final scale gives a confident "lock on".
- Keep flights calm — this is a premium launch film, not a fast camera whip.

## Crossfade handoff (diagram → product → diagram)

At full push on the lit node:
1. The node glow is at full; the camera is locked on the node's bounding box.
2. Mount the chapter's product surface (from `make-product-footage`) at the node's on-screen rect, then
   interpolate its `opacity` 0→1 over ~10f while the diagram layer dims under it. The surface visually
   *emerges from* the node.
3. Chapter plays.
4. **Exit:** reverse — product `opacity` 1→0 over ~10f, camera pulls back out (scale toward the wide
   framing), and the **next** node's glow ramps up (`opacity` 0→1) so the cut is motivated.

## DiagramCamera sketch

```tsx
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

type Frame = { at: number; region: { cx: number; cy: number; w: number; h: number }; fill?: number };

export const DiagramCamera: React.FC<{ from: Frame; to: Frame; children: React.ReactNode }> =
({ from, to, children }) => {
  const f = useCurrentFrame();
  const framing = (r: Frame['region'], fill = 0.7) => {
    const scale = fill / r.w;
    return { scale, tx: (0.5 - r.cx) * 1920 * scale, ty: (0.5 - r.cy) * 1080 * scale };
  };
  const a = framing(from.region, from.fill);
  const b = framing(to.region, to.fill);
  const k = (x: number, y: number) =>
    interpolate(f, [from.at, to.at], [x, y], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  const scale = k(a.scale, b.scale), tx = k(a.tx, b.tx), ty = k(a.ty, b.ty);
  return (
    <AbsoluteFill style={{ transform: `scale(${scale}) translate(${tx}px, ${ty}px)`, transformOrigin: 'center' }}>
      {children /* LitDiagram: PNG base + per-node glow overlays */}
    </AbsoluteFill>
  );
};
```

Chain multiple `DiagramCamera` segments via `<Sequence>` (one per flight/hold), or generalise to an
array of keyframes interpolated piecewise. Glow overlays read the same node map so they always sit on the
right node as the camera moves.
