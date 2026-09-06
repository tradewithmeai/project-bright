# Fidelity checklist — does this read as the real product?

Judge a recreated surface against the real source. Pass only if it reads as the **live product in
motion**, not a styled slide. Score each; any FAIL is a rebuild item.

## Parity checks

| # | Check | Pass condition |
|---|-------|----------------|
| 1 | **Layout** | Panes/grid/header match the real template's structure and proportions (left-vs-right, fixed vs scroll). |
| 2 | **Colour** | Background, card, accent, party, and vote hexes match the real source within tolerance (±~4% per channel). Brand/party/vote colours are EXACT, not approximate. |
| 3 | **Typography** | Family, weight, size ratio, and casing match. Headings read at the same hierarchy as the real UI. |
| 4 | **Spacing** | Padding/gaps/row heights feel like the real UI, not generic. |
| 5 | **Data** | Real records on screen — real MP, real division title/date, real party/vote split. No placeholder lorem, no invented figures. |
| 6 | **States** | The surface moves through the UI's REAL states (e.g. empty → typing → dropdown → selected → loaded), not a single frozen state with a pan. |
| 7 | **Cursor realism** | A visible cursor leads each interaction; clicks land on real targets with a ripple; motion eases (no linear robot moves). |
| 8 | **Legibility** | All text readable at 1080p; nothing clipped; contrast holds over the dark theme. |
| 9 | **No CSS animation** | Every motion is `useCurrentFrame()` + `interpolate()` / `<Sequence>`. Zero CSS `transition`/`animation`/Tailwind `animate-*`. |
| 10 | **"Not a screenshot" test** | If a stranger watched 3 seconds, would they believe it's a live screen recording? If it reads as a static image with a Ken-Burns pan, it FAILS. |

## Worked example — "division row click → map recolour"

Recreating flow step 6 (the signature shot):

- **Layout** ✓ — `lens.html` two-pane: left = `UKMap`, right = division rows. Matches the real split.
- **Colour** ✓ — BG `#07090f`, card `#111827`, vote fills Aye `#86efac` / No `#fca5a5` / Unknown `#6b7280` sampled from the real legend.
- **Data** ✓ — a real recent division; constituency fills derived from real per-MP vote data (see
  data-binding).
- **States** ✓ — map draws in (stroke reveal) → cursor clicks a real division row (ripple) → map
  **crossfades** from party fill to vote fill over ~14f → legend + tally appear. Three real states, not one.
- **Cursor** ✓ — eased path to the row, single click ripple, then the recolour responds (cause → effect).
- **No CSS animation** ✓ — recolour is two stacked `UKMap`s with an interpolated `fillOpacity`; reveal is
  stroke-dasharray driven by frame.
- **Not-a-screenshot test** ✓ — the recolour wave + cursor cause/effect read unmistakably as the live app.

Verdict: PASS. Had the recolour been an instant flip (UKMap's native behaviour) it would FAIL check 6/10
— hence the mandatory crossfade.
