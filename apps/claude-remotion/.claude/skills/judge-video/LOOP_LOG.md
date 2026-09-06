# Self-Improvement Loop — health log

Tracks the LEARN loop across every video job, so "is self-improvement working?" is
**measurable**, not asserted. The signal we want over time: **agreement rate rising**,
**skill-candidates-per-job falling** (skills converging on reality), **rounds-to-approval falling**.

Companion to the judge's `AGREEMENT.md` (predicted-vs-actual only). This adds the whole-loop view.

> Honest status: the loop's *mechanism* is proven (build → judge → human verdict → skill-improver →
> redeploy, all working). The *orchestration* is still human-driven (operator runs the preserve/
> improve/redeploy steps by hand). Deliberately NOT automated yet — supervised + human-gated is correct
> pre-rollout. Automate only once user feedback shows it's worth it.

## Runs

| date | job | type | skills used | judge → human | agree | candidates (found / applied) | rounds | notes |
|------|-----|------|-------------|---------------|-------|------------------------------|--------|-------|
| 2026-06-02 | mygov v11 | narrative film | silent-caption, video-tempo, repo-ui-to-motion, render-slot-recorder, terminal-recreation, +finale | revise → pass | MISS | floor-too-strict-for-fast-scenes (calibration note, not edit) | many | hand-built frontier piece; first held-out human verdict |
| 2026-06-05 | AiTop5-001 | news bulletin | silent-caption, video-tempo, terminal-recreation→HUD-widget, quality-judge, browser-safe-export | pass → "very good" | HIT | 2 / 2 (video-tempo beat-floor; video-checks dynamic-caption blind spot) | 1 | first non-mygov job; judge generalising |
| 2026-06-05 | AiTop5-pass2 | bulletin (fx pass) | (all, front-loaded) + Background-energy | pass → "funkier, acceptable" | HIT(soft) | 2 / 0 (hash brief-drift = operator brief error not skill defect; bulletin-fx = deferred per overfit guard, "if it repeats") | 1 | data-driven energy layer; spine intact |
| 2026-06-05 | BangbopDemo-001 | product demo | explainer-arc(adapted), repo-ui-to-motion, render-slot-recorder, silent-caption(manual floors), feasibility-rejection-gate, browser-safe-export, quality-judge | pass -> "wow, using for release" | HIT | 3 / 0 (demo-arc, capture-first-captioning, video-clip-integration — all NEW candidates, deferred to skill-improver) | 1 | first product-demo genre; capture-first HELD (real Three.js stills + ffprobe clips); release-quality. Human notes for draft 2: keep suspense-open + the from-every-angle shot; de-emphasise combat (game in dev), reframe as play-invitation; CTA link bangbop.solvx.uk.
| 2026-06-05 | BangbopDemo-002 | product demo (release) | explainer-arc, repo-ui-to-motion, silent-caption, video-tempo, quality-judge | pass -> "def a pass" | HIT | 1 / 0 (generate-gameplay-clip silently reused an existing clip instead of generating new) | 1 | cc ULTRACODE per-section fan-out (first parallel per-slot build in cc); re-tone + CTA fixes applied cleanly; faster turnaround.
| 2026-06-07 | solvx_explainer_001 | services explainer (FLUID-GENERATION) | explainer-arc, repo-ui-to-motion (capture-first), silent-caption, video-tempo, render-slot-recorder (flexible mode), quality-judge | pass -> "looks good — amazing based on the vague plan, needs minor tweaks" | HIT | 0 applied (minor-tweak specifics not yet captured — gather next operator pass) | 1 | **First fluid-generation test: cc generated the 7-section structure (problem→promise→services→control→proof→price→cta) ITSELF from a loose brief, no slot list.** Validates structure-generation, not just execution. capture-first held (real solvX site captures + graphic sections). First cycle under the hc orchestrator runbook. Imported to the editor via bridge-v2 as flexible project 25; source committed f6162f7. Minor tweaks → next iteration.

## Trend so far (5 jobs + 1 fluid-generation)
- **Agreement:** MISS → HIT → HIT. Judge improving and generalising past mygov. (Far too few rows to trust — pre-warn only.)
- **Candidates/job:** 1 → 2 → 2, with 2 genuinely applied (video-tempo + silent-caption). Skills are absorbing real lessons.
- **Rounds-to-approval:** high (mygov) → 1 (bulletin). Templated/repeatable jobs converge fast — exactly the SaaS thesis.
- **Discipline holding:** deferred a speculative skill (bulletin-fx) and a single-data-point edit (cold-open "ease in") per the overfit guard; caught an operator brief-drift (hash) via code-as-ground-truth.

## How to read it
If, as we add diverse video types, **agree** trends to mostly HIT and **candidates** per job trends toward 0,
the loop is demonstrably converging the skills onto reality. If candidates stay high or agreement stays mixed,
the skills (or the judge) need work — which is itself the loop doing its job. Either way: **measured, not assumed.**
