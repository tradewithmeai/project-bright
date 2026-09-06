# FAIL · undemonstrated-feature  (CANDIDATE — pending human approval)

- **status:** candidate signature, added 2026-06-05 from the mygov_explainer_001 human review. NOT yet
  human-confirmed as a library detector — flag it, but mark verdicts that rely on it as provisional until
  a human signs off this case file.
- **verdict:** revise
- **surface:** a demo/explainer slot (mygov_explainer_001 · EXPLAIN/ASK slot)
- **human's words:** "The words promised a demo; the screen never ran one." (draft-1 review: the slot showed
  one static framed still + a single flash while its captions said "click it for a plain-English explainer,
  or just ask" — the feature was named, not shown running.)

## Diagnosis
A slot's captions (or VO intent) PROMISE an interaction or capability — "click it and get an explainer," "ask
and it answers," "watch it recolour" — but the footage is a **single static still + a flash**, not the feature
actually running through its states. The viewer is TOLD the feature works; they never SEE it work. This reads
as a claim without evidence, and undercuts a capture-first cut's whole premise (show the real product doing the
real thing). Distinct from `fail-recreated-not-real` (that's fake pixels); here the pixels can be real but the
slot shows one frozen moment, not the run-through the narration describes.

## Fix
Capture the REAL **state sequence** (e.g. armed → clicked → panel open with its real text → answer) from the
live product and composite them as a timed reveal bound to the caption track, so the on-screen action matches
the words and the feature is seen running. (mygov_explainer_002: 3 real `/source-lens` explainer states under a
multi-stop camera; click bound to the "Click it…" caption.)

## Signature (what to detect)
- A caption/narration promises an action, interaction, or result ("click", "ask", "watch it", "see it
  update", "it answers") within a slot.
- The slot's footage for that span is a SINGLE still (or a still + a flash) with no state change — no
  before/after, no panel opening, no answer rendering.
- The slot record describes the asset as one image where the script implies a sequence.
- Contrast with a passing demo: ≥2 real captured states crossfaded/revealed in time, the change landing on the
  caption that promises it.

## Why this is a detector, not a target
The judge's Lock-2 scan missed mygov_explainer_001 because the library had no signature for "named but not
shown." A new cut whose captions promise a demo a static slot never performs resembles this fail — flag it for
the human. (It does NOT mean every slot must be a multi-state demo — only that a slot whose own captions
promise an interaction should show it.)
