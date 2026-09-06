# Cursor and interaction — the frame-based user

The cursor is the silent-movie stand-in for "the user does X." It is **frame-driven** (no CSS
animation): an accent-tinted pointer that eases between targets, ripples on click, and tags its
action with a `Label` chip a beat *after* it acts. Everything below is `useCurrentFrame()` +
`interpolate()`, clamped both ends.

## The path between targets

- Model the move as a list of **targets** `[{f, x, y}]` in 1920×1080 space. Between two targets,
  `interpolate(frame, [fromF, toF], [fromX, toX])` for `x` and the same for `y`.
- **Transit uses `EASE_OUT`** (`Easing.bezier(0.16, 1, 0.3, 1)`). The **arrival/settle uses `SPRING`**
  (`Easing.bezier(0.34, 1.56, 0.64, 1)`) — the slight overshoot reads as a hand landing. Use `SPRING`
  only on the last leg into a target, not on every leg.
- Hold the cursor still during reads (no drift); a still cursor over a populating panel reads as the
  user watching the data load.

## Action beats

- **Click** — at `clickFrame`, fire one ripple (below) and nudge the pointer 1–2px down then back
  over ~4f (a press). The clicked element's own reaction (row highlight, panel open) starts on the
  same frame.
- **Double-click** — two ripples ~6–8f apart at the same point; downstream transition (e.g. open the
  inner division page) triggers on the second.
- **Select / copy** — sweep a **selection highlight** rect across the text (`width` 0→full over
  ~10–14f, `EASE_OUT`), then pop a **"Copied" chip** (`SPRING` scale 0→1, hold, fade) beside the
  cursor. This is the only honest way to show flow-step 9 — no clipboard claim, just the affordance.
- **Hover** — a soft focus ring / lift on the target (opacity + 2–4px translateY) while the cursor
  rests on it; sets up the next click.

## Cursor leads the caption by a beat

The **action happens first, the caption confirms it.** Place each interaction `~6–12f` *before* the
`Label`/`Subtitle` that names it (Bible §2.2 caption track). The eye follows the cursor's motion,
then the chip/subtitle lands to confirm — so a click at `f150` is captioned "click once" at ~`f160`.

## tsx sketch — `Cursor` + click ripple

```tsx
import { useCurrentFrame, interpolate, AbsoluteFill, Easing } from "remotion";
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const SPRING = Easing.bezier(0.34, 1.56, 0.64, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type Pt = { f: number; x: number; y: number };

export const Cursor: React.FC<{ path: Pt[]; clicks: number[]; accent: string }> = ({
  path, clicks, accent,
}) => {
  const frame = useCurrentFrame();
  // last leg eases with SPRING (arrival); earlier legs with EASE_OUT (transit)
  const seg = Math.max(0, path.findIndex((p, i) => path[i + 1] && frame < path[i + 1].f));
  const a = path[seg], b = path[seg + 1] ?? path[seg];
  const last = seg === path.length - 2;
  const ease = last ? SPRING : EASE_OUT;
  const x = interpolate(frame, [a.f, b.f], [a.x, b.x], { easing: ease, ...clamp });
  const y = interpolate(frame, [a.f, b.f], [a.y, b.y], { easing: ease, ...clamp });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {clicks.map((cf) => <Ripple key={cf} clickFrame={cf} x={x} y={y} accent={accent} />)}
      <svg width={28} height={28} style={{ position: "absolute", left: x, top: y }}>
        <path d="M2 2 L2 22 L8 16 L12 24 L15 23 L11 15 L19 15 Z"
              fill="#fff" stroke={accent} strokeWidth={1.5} />
      </svg>
    </AbsoluteFill>
  );
};

const Ripple: React.FC<{ clickFrame: number; x: number; y: number; accent: string }> = ({
  clickFrame, x, y, accent,
}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [clickFrame, clickFrame + 14], [0, 1], { easing: EASE_OUT, ...clamp });
  const opacity = interpolate(frame, [clickFrame, clickFrame + 14], [0.9, 0], clamp);
  if (frame < clickFrame || frame > clickFrame + 14) return null;
  return (
    <div style={{
      position: "absolute", left: x - 18, top: y - 18, width: 36, height: 36, borderRadius: "50%",
      border: `2px solid ${accent}`, transform: `scale(${scale})`, opacity,
    }} />
  );
};
```
