# Node map

The authoritative description of where every region of the diagram sits, so the camera knows where to
fly. **Measure coords from the actual image** (open it, read pixel positions, divide by width/height) —
never guess.

## Schema

A node map is an array of regions:

```ts
type DiagramRegion = {
  key: string;        // stable id, e.g. 'source-lens', 'hub', 'arc', 'chips'
  label: string;      // human label, e.g. 'Source Lens'
  accent: string;     // locked accent hex (nodes only)
  cx: number;         // centre X as fraction of image width  (0..1)
  cy: number;         // centre Y as fraction of image height (0..1)
  w: number;          // region width  as fraction (0..1)
  h: number;          // region height as fraction (0..1)
};
// plus a visit order:
const VISIT_ORDER = ['hub', 'global-lens', 'source-lens', 'map', /* ... */ 'full'];
```

Rules:
- `cx,cy,w,h` are **fractions**, resolution-independent (the PNG can be any size; the camera maths uses
  fractions × 1920/1080).
- `accent` is required for pillar nodes (locked colour map); omit for hub/arc/chips.
- `VISIT_ORDER` is the camera's path — it need not match node numbering (the film's chapter order leads).

## Worked MyGov example (approximate — re-measure against the real PNG before use)

The image is ~3:2 landscape; the 8 pillars sit in a 2-column × 4-row grid around a central hub.

| key | label | accent | cx | cy | w | h |
|-----|-------|--------|----|----|---|---|
| `hub` | MyGov hub | — | 0.50 | 0.46 | 0.18 | 0.30 |
| `arc` | Local to Global arc | — | 0.50 | 0.16 | 0.34 | 0.10 |
| `source-lens` | 1 · Source Lens | `#e4407a` | 0.22 | 0.20 | 0.40 | 0.22 |
| `map` | 2 · Map Visualisation | `#38bdf8` | 0.78 | 0.20 | 0.40 | 0.22 |
| `explain` | 3 · Explain Intelligence | `#7c3aed` | 0.22 | 0.44 | 0.40 | 0.20 |
| `global-lens` | 4 · Global Lens | `#02a95b` | 0.78 | 0.44 | 0.40 | 0.20 |
| `agent-party` | 5 · Agent Party Layer | `#a3e635` | 0.22 | 0.66 | 0.40 | 0.20 |
| `build-system` | 6 · Build System | `#f59e0b` | 0.78 | 0.66 | 0.40 | 0.20 |
| `distribution` | 7 · Distribution Loop | `#f97316` | 0.22 | 0.86 | 0.40 | 0.18 |
| `mobile` | 8 · Mobile + Release | `#2563eb` | 0.78 | 0.86 | 0.40 | 0.18 |
| `chips` | stat chips | — | 0.50 | 0.66 | 0.14 | 0.22 |
| `full` | whole diagram | — | 0.50 | 0.50 | 1.00 | 1.00 |

Camera visit order for the film (chapter order, not node number):
`hub` → `global-lens` (globe) → `source-lens` → `map` → `map` (gender/inner) → `explain` → `mobile`
(tech proof) → `build-system` → `build-system` (protocol) → `agent-party` → `global-lens` → `chips`
(scorecard handoff) → `full` (close).

> These fractions are a starting estimate. Before building, open the real PNG and re-measure each node's
> bounding box — small errors here make the camera frame a node off-centre.
