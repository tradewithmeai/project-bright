# Wins / Fails Library — Index

Human-labelled verdicts on real cuts. The **FAILS are the judge's detectors** (Lock 2: resemblance-to-known-fails). Each row's **signature** is what to look for in a new cut. Wins record what cleared the gate and *why* — context, never a target to converge on (Lock 2: floor, not ceiling).

> Ground-truth rule: every entry traces to a **real human verdict**, quoted. Never add an entry from the judge's own opinion. Grow only when a real verdict reveals a case not yet covered.

Seeded from the mygov-campaign-video build (v1→v11), 2026-05/06.

## FAILS (detectors)

| id | surface | human's words (verbatim) | signature — what to detect |
|----|---------|--------------------------|----------------------------|
| `fail-recreated-not-real` | whole cut | "overall terrible… feels laboured… no point watching to the end" | Product screens are **recreated/placeholder** (fake boxes, relic maps) instead of real captured footage; the cut reads as a mockup, not the live product. → [case](./fail-recreated-not-real.md) |
| `fail-too-slow-uniform-pacing` | whole cut | "how slow the video was — likely 2× too long" | **Uniform slow pacing**, no tempo variation; sections far longer than their content needs; no quick/slow "train" rhythm; viewer would disengage before the end. |
| `fail-visible-cursor` | demo beats | "cursor is no good, forget the hand/finger" | A **visible cursor/hand/finger** pointer is used to direct attention. (Use a ClickFlash / explosive flash instead.) |
| `fail-caption-overlap` | captions | (audit-found; fix accepted) | **Two captions of the same style share the same on-screen slot** at full opacity, OR a caption window is **below the reading floor** `max(1.8s, chars×0.07s)`. → [case](./fail-caption-overlap.md) |
| `fail-opaque-layer-hides-content` | finale | (build-found; "bravo on fireworks" after fix) | An **opaque full-frame layer rendered last** (or above) silently hides the intended content beneath it; a hero beat renders black/empty. → [case](./fail-opaque-layer-hides-content.md) |
| `fail-loop-drag` | close | "the looping… goes on for too long" | A **looping element repeats past its welcome**; a section drags on a repeated motion with no progression. |
| `fail-highlight-wrong-position` | map highlight | "we get a flash in the ocean, remove that" | A highlight/marker lands at the **wrong coordinates** (off the target, in empty space) instead of on the real element. |
| `fail-text-overlaps-adjacent` | web/diagram | "the text is misaligned with the borders" | Text/bullets **overflow their container** and collide with adjacent elements; columns too wide for their slot. |
| `fail-undemonstrated-feature` _(candidate)_ | demo/explainer slot | "the words promised a demo; the screen never ran one" | Captions **promise an interaction/result** (click, ask, watch it update) but the slot is a **static still (+flash)**, not the feature running through its states. → [case](./fail-undemonstrated-feature.md) |
| `fail-caption-reads-as-placeholder` _(candidate)_ | captions | "reads like a dev placeholder/tag, not a message" | A **bare all-caps feature/section name in an accent colour** (kicker/label style) that names a thing instead of saying something to the viewer. → [case](./fail-caption-reads-as-placeholder.md) |

> _Candidate_ signatures (added 2026-06-05 from the mygov_explainer_001 human `revise`) are awaiting human sign-off on their case files. The judge may flag them, but verdicts that hinge on a candidate are **provisional** until approved.

## WINS (context, not targets)

| id | surface | human's words | what worked |
|----|---------|---------------|-------------|
| `win-real-captures` | demo | "that is a pass… a little blury but that could have been capture" | Real Playwright captures of the live product, composited under a virtual camera (GuidedZoom). → [case](./win-real-captures.md) |
| `win-fireworks-finale` | finale | "bravo on fireworks" | Real diagram backdrop → seeded deterministic particle bursts → smoke haze → logo revealed in smoke → fade to black. |
| `win-chapter-cards` | structure | "very good" / "that is really good" | Quick black chapter cards (number + title + one-line "what this proves") that self-narrate the flow for judges. |
| `win-logo-bubble-text` | brand | "i really like the white logo and the large bubble text" | Big white serif wordmark + crown; corner-pinned brand mark. |

## How the judge uses this

1. Run the deterministic checks first (Lock 1) — `fail-caption-overlap` (the floor/overlap half) and determinism/CSS-animation are now **mechanised** in `scripts/video-checks.cjs`; treat their output as authoritative.
2. Scan each FAIL signature against the cut under judgement (Lock 2). Cite concrete evidence in *this* cut for any hit.
3. Predict the verdict; log it to `AGREEMENT.md`; stage for the human. Never auto-approve.
