---
name: improve-skills
description: The maintenance skill-skill. Keep a Remotion video skill honest against the code that actually ships — detect drift (the skill describing a superseded or never-built approach), propose minimal corrective edits, generate/refresh the skill's own self-evaluation rubric, and prune or merge skills that have been orphaned. Code is ground truth; the human approves the diff. Validates against evidence from multiple past videos, never overfitting to the latest job.
metadata:
  tags: skill, meta, improver, self-learning, drift, rubric, maintenance, remotion
---

## Why this exists

Skills are written from *design intent*. The build process then *discovers better approaches* (capture beat recreate; ClickFlash beat a cursor; shared chrome beat per-tool hex tables). Those discoveries land in the **code** — and nothing carries them back into the **skill**. The skill silently rots until it describes the opposite of what ships and an agent following it "literally produces broken code." (A one-time audit found this in 7 of 8 skills.)

This skill is the missing **LEARN loop**: it re-reads a skill against current reality, finds the drift, and proposes the fix — so capability compounds instead of decaying. It is the one improver that any skill's rubric can drive; there is deliberately **not** one improver per skill.

## The single most important rule

**Code is ground truth. The skill must describe what the code does — never the reverse.** When the skill and the code disagree, the code wins and the skill is wrong. (The only exception: a genuine code *bug* the skill correctly warns against — flag it, don't "correct" the skill to match a bug.)

## Inputs

1. **The target skill** — `<skill>/SKILL.md` and any `rules/` sub-files.
2. **Its `## Self-evaluation` rubric**, if present (older skills won't have one yet — generate it on this pass; see Phase 4).
3. **The current code = ground truth** — the live composition source the skill governs (e.g. `mygov-campaign-video/src/**`). Read the actual files the skill names; if they moved or were deleted, that itself is drift.
4. **Past-video evidence — plural.** The record(s) of how videos were actually built (`VIDEO_RECORD.md`, prior audit artifacts under `.audit/`, committed changelogs). **Use more than the latest job.** A skill must serve every past video, not just the most recent one.

## Procedure

**Phase 0 — Read everything before judging.** The skill, its rubric, the named code files, and the past-video evidence. Resolve every file/path/symbol the skill references against the real tree.

**Phase 1 — Run the rubric (or reconstruct it).** For each check in `## Self-evaluation`, verify it against the code: PASS / FAIL (with the file:line that decides it). If there is no rubric yet, derive the checks from the skill's own load-bearing claims (its directives, prop names, coordinate conventions, file pointers, worked examples) — each claim becomes a falsifiable check.

**Phase 2 — Classify each piece of drift.** For every FAIL or stale claim, label it:
- **Inverted** — the skill says the opposite of what ships (highest severity; e.g. "recreate, never screenshot" when the cut uses real captures).
- **Never-built** — documents an API/prop/name that does not exist in code (an agent following it errors).
- **Stale-pointer** — names a file/symbol/example that moved, was renamed, or was deleted.
- **Architecture-miss** — silent about the structure all current work uses (e.g. the `SECTIONS` + chapter-card model).
- **Convention-mismatch** — a worked example uses the wrong units/format (e.g. pixels where code wants fractional 0..1).
- **Framing-stale** — accurate but aimed at a superseded workflow (e.g. "remedial only" when tempo is now authored up front).

**Phase 3 — Propose MINIMAL corrective edits.** Change only what the evidence forces. Quote the wrong text and the corrected text, each anchored to the file:line that justifies it. Do not rewrite voice, reorder for taste, or add scope the code doesn't demand. Preserve everything that is still accurate.

**Phase 4 — Generate/refresh the `## Self-evaluation` rubric.** Emit the rubric that *would have caught this drift*: 5–12 falsifiable checks, each `claim → code location that confirms it → how to test`. This is the skill's regression test, co-located with the skill. Going forward, Phase 1 runs it instead of reconstructing it.

**Phase 5 — Consider prune / merge (you are allowed to retire skills).** Without this the proliferation you are curing re-grows.
- **Prune** if the skill is fully orphaned — its technique appears nowhere in current or recently-shipped code and no near-term plan needs it. Recommend retiring (or archiving), don't silently delete.
- **Merge** if ≥~70% of its content duplicates a sibling. Recommend the consolidation target.
- Default is **keep + correct**. Only prune/merge with clear evidence; say why.

**Phase 6 — Append a changelog entry** to the skill (`## Changelog`, newest first): date, what changed, why (the drift class + the code fact). Never overwrite history.

## The guardrails that make or break it

- **Human-labelled evidence outranks agent-generated evidence (binding — see [../judge-video/VERDICT_AUTHORITY.md](../judge-video/VERDICT_AUTHORITY.md)).** When weighing past-video evidence, a real human verdict (a documented win/fail, an approval, a rejection in the human's words) is **ground truth**; an agent's prior opinion or self-assessment is not. **Never discount, re-interpret, or down-weight a human label because it conflicts with your view** — that is the override failure (the system "knows better" than a correct human and poisons its own training). "Code is ground truth" and "human verdict is ground truth" are the two authorities an improver cannot outrank: defer to both. Disagreement between a human label and the model is signal *about the model*, never grounds to dismiss the human.
- **Validate against multiple past videos, not just the latest.** If only one job's evidence is available, say so and mark confidence reduced — a single-job improver overfits and *degrades* the skill (it would "learn" that one client uses captures and delete the recreate path another client needs). A correction must hold across the past evidence you have.
- **Human approves the diff.** Write proposals to a staging path; do not overwrite the live `SKILL.md` unattended. Apply only what the human approves. (Same spec-approval principle as the video pipeline, applied to capability.)
- **Minimal-edit bias.** The smallest change that makes the skill true. Resist the urge to "improve" prose that is already correct.
- **Never invent.** If you can't find a file/symbol the skill names, report it missing — don't guess what it became.

## Output (per skill)

Write to the staging dir the batch command gives you (`<staging>/<skill>/`):
1. **`SKILL.proposed.md`** — the full corrected skill, including the new/updated `## Self-evaluation` rubric and `## Changelog` entry.
2. **`REPORT.md`** — the drift table (each item: class, wrong text, corrected text, file:line evidence), the rubric PASS/FAIL run, any prune/merge recommendation, and a one-line confidence note on the breadth of past evidence used.

Return a short verdict object/summary: skill name, verdict (`solid` / `minor-improvements` / `needs-work` / `consider-retiring`), count of drift items by class, and whether a human-review diff is ready.

## Self-evaluation (this skill checks itself, too)

- **Ground-truth rule present and first?** The "code is ground truth" rule must lead; if an improver run ever "corrects" a skill to match the skill rather than the code, this rule failed.
- **Prune/merge actually exercised?** If every run returns "keep + correct" and never recommends a retire/merge even for an orphaned skill, Phase 5 is dead — check it against a known-orphaned skill.
- **Multi-evidence guard honoured?** A run that consumed only one video's evidence must lower its own confidence; if it doesn't, the overfit guard failed.
- **Human-gate respected?** Proposals land in staging, never overwrite live skills unattended.

## Changelog (append-only — newest first)

- v1 (2026-06-01): Created. Bootstraps the LEARN loop after an audit found 7/8 skills drifted with no feedback mechanism.
