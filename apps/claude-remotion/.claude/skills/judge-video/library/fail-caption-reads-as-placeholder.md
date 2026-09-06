# FAIL · caption-reads-as-placeholder  (CANDIDATE — pending human approval)

- **status:** candidate signature, added 2026-06-05 from the mygov_explainer_001 human review. NOT yet
  human-confirmed as a library detector — flag it, but mark verdicts that rely on it as provisional until
  a human signs off this case file.
- **verdict:** revise
- **surface:** captions (mygov_explainer_001 · VotingHistory slot — a red, all-caps "THE SOURCE LENS" kicker)
- **human's words:** the caption "reads on screen like a dev placeholder/tag, not a message. Delete it."

## Diagnosis
A caption that is a **bare feature name / section label in an accent colour, all-caps** (kicker-style) can
read to a viewer as a developer tag, a debug label, or unfinished placeholder text — not as a line of the
narration. It adds no viewer-facing meaning the surrounding captions don't already carry, and its label-like
styling makes the cut feel like a work-in-progress rather than a finished film.

## Fix
Delete it (the neighbouring real-sentence captions already carry the slot), or rewrite it as an actual
viewer-facing message rather than a label. Do not replace one bare all-caps accent tag with another.
(mygov_explainer_002: removed "THE SOURCE LENS"; the two subtitles "See how they actually voted." / "Their
full record, vote by vote." carry the slot.)

## Signature (what to detect)
- A caption that is a short, all-caps, accent-coloured NOUN PHRASE naming a feature/section ("THE SOURCE
  LENS", "EXPLAIN MODE", "DATA PANEL") rather than a sentence that says something to the viewer.
- It duplicates/labels what adjacent captions already convey, adding no narration.
- Kicker/label style used as a name-tag, not as the quiet framing line the style is meant for.
- Contrast with a legitimate kicker: a quiet framing PHRASE that adds meaning ("A buildability map — not a
  government score."), not a bare component name.

## Why this is a detector, not a target
The judge's Lock-2 scan missed this on mygov_explainer_001. A new cut with a bare all-caps feature-name caption
in an accent colour resembles this fail — flag it for the human. (It does NOT ban kickers or all-caps; it flags
caption text that names a thing instead of saying something.)
