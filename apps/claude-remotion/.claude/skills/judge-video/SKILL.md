---
name: judge-video
description: Predict whether a rendered Remotion video would clear the human approval gate — BEFORE a person watches it — so the human reviews fewer, better candidates and iteration-rounds-to-approval falls. Runs the deterministic check suite (objective pass/fail — lint, not AI) first, then a taste-proxy that flags RESEMBLANCE TO KNOWN FAILURES from the wins/fails library (a floor that catches regressions, not a winner-picker that flattens novelty). Stages a verdict for human approval and records predicted-vs-actual to track its own agreement rate. The judge gets proficient FROM tester verdicts, not before them.
metadata:
  tags: judge, evaluation, quality, taste-proxy, wins-fails, self-learning, remotion, video, regression
---

## Why this exists

The video service's load-bearing metric is **iteration-rounds-to-approval** — how few times a spec/cut bounces before the human says "ship." A judge that *predicts the human's verdict* lets the human review fewer, better candidates, bending that curve. But a model is an **unreliable judge of taste** (this is why `record-final-video` refuses to self-certify "looks good"). So this skill is scoped hard, by three locks.

## The three locks (do not violate)

**Lock 1 — Split it. Most of "quality" is not a judge at all.** Objective, checkable facts have a right answer and must run as a **deterministic check suite** (scripts/lint, free and reliable), NOT as a model opinion: frame-math reconciles, determinism (no `Math.random`/clock in render), no CSS-animation, captions on-screen for their window with no same-slot overlap and reading-floor met, QR round-trips, assets present. These produce authoritative PASS/FAIL. Run them FIRST. The *actual judge* (the model) is only the irreducibly subjective half. Never dress a lint failure as a taste call, and never let the reliable half hide that the model is trusted only for the hard half.

**Lock 2 — Floor, not ceiling. Detect resemblance to known FAILS, never pick winners.** A judge that scores "cinematic 7/10" or predicts "the founder will love it" converges everything toward past winners — it would have rejected the fireworks finale *before it existed*, and it flattens the creative spark PREP exists to inject. Instead, the taste-proxy asks one question against each documented failure in the library: **"Does this cut resemble this known failure?"** ("drags like the '2× too long' cut"; "overlaps like the RapidFlow collision"; "feels laboured / recreated like the rejected first video"). Output is *regression flags*, not a quality score. The biggest round-killers in practice are fails, not good-but-not-best — so a fail-catching floor kills most rounds while preserving novelty.

**Lock 3 — The judge is measured, and it learns FROM testers.** "Proficient" = its predicted verdict matches the human's **actual** verdict at a tracked **agreement rate** — its regression test. That number is only meaningful on **held-out** verdicts it has not trained on. Do NOT waterfall "perfect the judge → then roll out." The judge runs with the human gate **ON**; every human accept/reject is logged and grows the library; the agreement rate climbs; only then does the human progressively trust the judge to pre-filter (the every-video → spot-check → exception curve). Tester rollout *is* the calibration stream.

## Inputs

1. **The cut under judgement** — its `VIDEO_RECORD.md` (timeline, captions, assets, changelog) and a set of **key stills** (entrance/hold/exit of the hero beats; the frames where the record makes falsifiable claims). The judge reads the record + stills; it does not watch a render.
2. **The deterministic check results** — the output of the check suite (Lock 1). If not yet run, run it first.
3. **The wins/fails library** (`./library/*.md` + `./library/INDEX.md`) — the labelled corpus of past human verdicts with the human's own words, the diagnosis, the fix, and a **signature** (what to detect). This is the few-shot evidence the taste-proxy reasons against. Use the FAILS as the detectors.
4. **The agreement ledger** (`./library/AGREEMENT.md`) — past predicted-vs-actual rows, so the judge knows its own track record and the human can see whether to trust it yet.

## Procedure

**Phase 0 — Deterministic checks (Lock 1).** Run the check suite. Record each as PASS / FAIL with the file:line or frame that decides it. Any FAIL is an authoritative defect — surface it plainly; do not soften it into a taste opinion. If a hard check fails, the predicted verdict is at most `revise` regardless of the taste pass.

**Phase 1 — Resemblance scan (Lock 2).** For each FAIL entry in the library, judge the current cut against its **signature**: does this cut exhibit that failure mode? For each hit, cite the concrete evidence in *this* cut (the record line / the still) and name the library case it resembles. Be conservative — default to "does not resemble" unless the evidence is concrete. Subjective realism/aesthetic questions you cannot verify ("does the finale *look* cinematic") are NOT yours to score — note them as **human-only** and pass them up (the `record-final-video` human-inspection rule).

**Phase 2 — Predict the verdict.** Combine: `pass` (no hard-check failures, no fail-resemblances), `revise` (one or more resemblances or a soft concern — list them with the fix the library suggests), or `block` (a hard-check failure). The verdict is a **prediction of the human's call**, framed as "I expect the human to ___ because ___." Never state it as fact.

**Phase 3 — Stage for the human + log the prediction.** Write the verdict + evidence to the staging path the command gives you. Append a row to `AGREEMENT.md`: date, cut version, predicted verdict, `actual: <pending>`. When the human later records their real verdict, the row is completed and the agreement rate recomputed. **The judge never auto-approves or auto-ships** — it pre-filters; the human decides.

**Phase 4 — Grow the library (only from real human verdicts).** When a human verdict lands that the library doesn't yet cover — especially a NEW failure mode — add a library entry (verdict, the human's words, diagnosis, fix, signature). Never invent library entries from the judge's own opinion; the library is human-labelled ground truth only.

**Verdict authority (binding — see [./VERDICT_AUTHORITY.md](./VERDICT_AUTHORITY.md)).** The judge's verdict is a **prediction**, never a label. When the human's actual verdict contradicts it, that is the **judge's MISS** (log it, learn from it) — *never* a wrong human and *never* grounds to discount the verdict. The judge must NOT filter human verdicts for "junk" (it is the evaluated party — separation of powers); junk-filtering is a separate, provenance-based gate that is blind to the judge's opinion. Disagreement is the prize training signal, not noise to suppress. If the judge ever finds itself reasoning "the human said X but I think Y, so X should be discounted," that is the override failure the doctrine exists to forbid — stop.

## The overfit guardrail

Reason against **multiple** library cases, not just the most recent. A judge anchored on one job overfits to that job's quirks (it would "learn" one client wants captures and flag a different client's legitimately different choice). If the library is thin (few cases), say so and lower confidence — a thin library means a weak floor, not a strong one.

## Output (per judged cut)

1. **`VERDICT.md`** — predicted verdict (`pass`/`revise`/`block`) framed as a prediction; the deterministic-check table (PASS/FAIL + evidence); the resemblance scan (each fail-signature: hit/miss + this-cut evidence); the human-only questions passed up; a confidence note tied to library breadth + current agreement rate.
2. An appended row in `AGREEMENT.md` (predicted; actual pending).
Keep any returned message short — detail lives in the files.

## Self-evaluation (this skill checks itself)

- **Lock 1 enforced?** Objective facts run as deterministic checks, not model opinions; a hard-check FAIL caps the verdict at `revise`/`block`.
- **Lock 2 enforced?** The taste-proxy only flags resemblance-to-fails; it never emits a "/10" score or picks a winner. If a run ever scores quality on a scale, Lock 2 failed.
- **Lock 3 enforced?** Every prediction logs a row in `AGREEMENT.md` with actual pending; the judge never auto-approves; confidence is tied to held-out agreement rate.
- **Floor not ceiling, in practice?** A genuinely novel-but-good cut (no fail-resemblance) predicts `pass`, not `revise` — novelty is not penalised.
- **Library is human-labelled only?** No entry was created from the judge's own opinion; entries trace to a real human verdict.

## Sub-files

- `./library/INDEX.md` — index of labelled cases (the wins/fails corpus).
- `./library/AGREEMENT.md` — predicted-vs-actual ledger + current agreement rate.
- `./library/*.md` — one labelled case each (verdict, human's words, diagnosis, fix, signature).

## Changelog (append-only — newest first)

- v1 (2026-06-02): Created. Phase E of the video-service strategy — the taste-proxy + deterministic checks that let the approval gate move from every-video toward spot-check. Reuses the skill-improver pattern (read artifact + evidence + rubric → staged verdict → human approves → calibrate). Seeded library from the mygov build's documented wins/fails.
