---
description: Run the improve-skills across all Remotion video skills at once — detect drift vs the shipping code, propose corrected skills + self-eval rubrics into a staging dir for human approval.
---

# /improve-skills

Batch-run the **improve-skills** meta-skill (`.claude/skills/improve-skills/SKILL.md`) over every skill in `.claude/skills/` (except `improve-skills` itself), fanning out one agent per skill.

This is the LEARN loop's batch entry point: it keeps the skill library honest against the code that actually ships. One improver, many skills, one command — **not** one improver per skill.

## What it does

1. **Enumerate** the skills under `apps/claude-remotion/.claude/skills/` (skip `improve-skills`).
2. **Fan out** one improver agent per skill (use the Workflow tool). Each agent follows `improve-skills/SKILL.md` with these inputs:
   - target: `<skill>/SKILL.md` (+ its `rules/`),
   - ground truth: the live code under `mygov-campaign-video/src/**`,
   - past-video evidence (plural): `mygov-campaign-video/VIDEO_RECORD.md` and the audit artifacts under `project-bright/.audit/`.
3. **Stage, don't overwrite.** Each agent writes `SKILL.proposed.md` + `REPORT.md` to `.audit/improve-skills/<skill>/`. The live skills are never edited unattended.
4. **Summarise** the verdicts (per skill: drift counts by class, prune/merge recommendations, confidence note).

## The human gate (required)

After the run, the human reviews the staged diffs and approves which corrections to apply. Only approved `SKILL.proposed.md` files are copied over the live `SKILL.md`. This mirrors the video pipeline's spec-approval gate — capability changes are approved, not auto-merged.

## Guardrails (enforced by the improver skill)

- Code is ground truth; the skill is corrected to match the code, never the reverse.
- Validate against multiple past videos' evidence — flag reduced confidence if only one job is available.
- Minimal edits; preserve what's still accurate; append (never overwrite) the changelog.
- Prune/merge is allowed and expected for orphaned/duplicated skills.

## Notes

Re-run after any substantial build (a new video, a re-cut, a new technique) so discoveries flow back into the skills. Track, over successive runs, how few drift items each skill accrues — a falling count means the skills are keeping pace with the code.
