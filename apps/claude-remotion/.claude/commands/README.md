# Claude Code Commands — claude-remotion

**These are NOT ChatGPT Skills.**

This directory contains Claude Code slash commands for the studio's Remotion
work. Each command is a markdown file that Claude Code reads when the operator
types `/command-name` in a Claude Code session in the monorepo.

---

## Command Catalogue

| Command | File | Status | Purpose |
|---------|------|--------|---------|
| `/judge-video` | [judge-video.md](judge-video.md) | **Active — orchestrator JUDGE loop** | Predict whether a rendered cut clears the human approval gate (deterministic checks + failure-library resemblance scan); stages a verdict, never auto-approves |
| `/improve-skills` | [improve-skills.md](improve-skills.md) | **Active — orchestrator LEARN loop** | Batch-run the improve-skills meta-skill over every skill; stage corrected skills + self-eval rubrics for human approval |

**Parked (Susan/service era — moved out of the loader 2026-07-11):**
`generate-brand-components`, `generate-gameplay-clip`, `generate-product-still` now live in
`studio/archive/commands/` (dead era, revivable from there). Do not resurrect for current studio work.

---

## Adding a new command

1. Create `<command-name>.md` in this directory.
2. Follow the structure of an existing command file:
   - One-line purpose
   - `$ARGUMENTS` section
   - `What this command does` (numbered steps)
   - Rules / hard constraints
   - Output contract
3. Add it to the table above.
4. Commit as a standalone commit (docs only — no source changes).
