---
description: Predict whether a rendered cut would clear the human approval gate — run the deterministic checks, scan for resemblance to known failures, stage a verdict for human review. Pre-warns; never auto-approves.
---

# /judge-video

Run the **judge-video** skill (`.claude/skills/judge-video/SKILL.md`) on a cut, to predict the human's verdict *before* they watch — so they review fewer, better candidates and iteration-rounds-to-approval falls.

## What it does

1. **Lock 1 — deterministic checks (objective, authoritative).** Run the check suite:
   `node scripts/video-checks.cjs` (in the video project). It reports PASS/FAIL for determinism, CSS-animation, caption reading-floor, and same-slot caption overlap, with file:line evidence. Any FAIL is a real defect — it caps the predicted verdict at `revise`/`block`.
2. **Gather the cut's evidence.** Read its `VIDEO_RECORD.md` (timeline, captions, assets, changelog) and render a small set of **key stills** of the hero beats (`npx remotion still <Composition> --frame=<N>`), including any beat the library warns about (e.g. a finale's hero frame, to catch `fail-opaque-layer-hides-content`).
3. **Lock 2 — resemblance scan (the taste-proxy).** For each FAIL signature in `.claude/skills/judge-video/library/INDEX.md`, judge whether *this* cut exhibits that failure mode, citing concrete evidence in the cut. Flag resemblances; do NOT score quality on a scale or pick a "winner". Subjective look ("is the finale cinematic") is passed up as human-only.
4. **Predict + stage.** Write `VERDICT.md` (predicted `pass`/`revise`/`block`, framed as a prediction, with the check table + resemblance scan + human-only questions + a confidence note). Append a row to `.claude/skills/judge-video/library/AGREEMENT.md` (predicted; actual pending).

## The human gate (required) + Lock 3

The judge **never auto-approves or ships**. It pre-filters/pre-warns; the human watches and records the real verdict. When they do, complete the `AGREEMENT.md` row (actual + agree?) and recompute the agreement rate. Until that rate is high over enough **held-out** rows, the human reviews every cut. As it climbs: spot-check, then exception-only.

## Growing the library

When a human verdict reveals a failure mode the library doesn't cover, add a case file (verdict, the human's words, diagnosis, fix, signature). Library entries are **human-labelled ground truth only** — never created from the judge's own opinion.

## Notes

- Reuses the improve-skills pattern: read artifact + evidence + rubric → staged verdict → human approves → calibrate. Same staging + human-gate + overfit guard.
- Run after a render, before asking a human to watch. Track the agreement rate over runs — a rising rate is the signal the judge can start pre-filtering for real.
