# Iterative Output Lab

**Status:** Documented — first-use target is Susan slot-plan quality  
**Slug:** `iterative-output-lab`

---

## Purpose

A reusable process for improving Project Bright intermediate outputs through
controlled iteration before expensive full renders.

The lab turns vague quality concerns into concrete evidence: what failed, how
often it failed, which rule or prompt area caused it, and what change to test
next.

---

## When to use

Use when:

- Output quality is unclear and you need evidence before changing code or prompts
- Susan slot plans are weak, generic, or missing structured fields
- A prompt or code change needs measurable justification
- Creative direction is uncertain and multiple distinct approaches should be evaluated
- Full render testing is too expensive to run on every variation
- You want to compare the effect of a prompt or code change without a full pipeline run

---

## When not to use

Avoid when:

- The task is a simple deterministic bug fix with a clear failing test
- The system already has a precise unit or integration test covering the failure
- Full render validation is required immediately (visual quality can only be judged in render)
- The operator has already chosen the creative direction and confirmed it

---

## Core principle

**Generate → score → compare → revise → repeat.**

Iteration happens at the intermediate output level (slot plan, remotion_hint,
viewer copy, V2 fields) — not at the full render level. This keeps the loop
cheap, fast, and specific.

Do not self-approve final quality. Rubric scores are diagnostic signals, not
verdicts. Render validation is the final gate for visual quality judgement.

---

## Modes

### optimise mode

**Goal:** Improve one target outcome across iterations.

**Process:**

1. Define the target goal and quality rubric
2. Generate N attempts (typically 3–5) using the current prompt/code
3. Score each attempt against the rubric
4. Identify recurring failure patterns across attempts
5. Propose the single most impactful prompt or code change
6. Optionally run one more iteration after the change to confirm improvement
7. Report: what changed, confidence level, whether render validation is needed

**Best for:** remotion_hint quality, viewer copy sharpness, V2 operational brief
compliance, consistent visual motif enforcement.

---

### explore mode

**Goal:** Generate several clearly different creative approaches, not just
the "best" one. Diversity is the primary objective.

**Process:**

1. Define 3–5 distinct diversity axes (e.g. tone, narrative frame, emotional hook)
2. Generate one attempt per axis, forcing meaningful variation
3. Score each attempt for both quality and difference from the others
4. Check each against capability boundaries — reject any that overreach
5. Recommend the best 1–2 directions for render testing
6. Report: what directions exist, which are safe, which to test first

**Best for:** creative direction selection early in a campaign, finding the
right framing for a product before committing to a full render.

---

## First supported target: Susan slot-plan quality

The lab initially focuses on Susan's `base_slot_plan` output. The key signals:

| Signal | What to check |
|--------|---------------|
| `text_overlay` | Viewer-facing copy only; max ~8 words; no production instructions |
| `remotion_hint` | 4-part buildable brief: background → element → animation with frame counts → text layer |
| `visual_suggestion` | Describes a composed frame with background + foreground; not a plain card description |
| `story_beat` | Follows the narrative arc: identity → tension → stakes → transformation → invitation |
| V2 structured fields | `production_pattern`, `clip_generation_mode`, `requires_human_clip_review`, `suggested_shot_patterns`, `clip_count_target`, `cta_allowed` |
| Capability compliance | No vague phrases; no unsupported asset references; no fake gameplay |
| Visual motif | Same background treatment family, accent type, and typography weight across all stills |

**How to generate attempts:**

Use the standalone validation approach from this session's validation run:

```bash
docker run --rm \
  -v /tmp/inspect_slot_plan.py:/tmp/inspect_slot_plan.py \
  -v /srv/project-bright/project-bright-monorepo/apps/chatty-susan:/app \
  --env-file /srv/project-bright/project-bright-monorepo/deploy/.env \
  project-bright-susan:latest \
  python3 /tmp/inspect_slot_plan.py
```

The script calls `build_base_slot_plan_prompt()` + `BASE_SLOT_PLAN_SYSTEM_PROMPT`
via the OpenAI client directly. No Susan server, no render worker, no pipeline.

To test a prompt change: edit the prompts in
`apps/chatty-susan/content_planner/prompts.py` or
`apps/chatty-susan/content_planner/video_formats.py`,
then re-run the script and compare outputs.

---

## Capability boundaries

**Project Bright mantra: Creative and constrained.**

Creativity must remain inside known capabilities. Unsupported ideas should be
rejected, redirected, or adapted.

### Still slot primitives (what Remotion can build)

ALLOWED:
- Gradient or solid backgrounds (hex colours, linear/radial combinations)
- SVG geometric shapes (rectangles, triangles, angular stripes, diagonal bands, arcs, circles)
- Bold/ultra-bold typography
- Simple SVG icon paths (car outline, phone outline, star, checkmark, arrow)
- Stat/score/counter as styled text
- Progress bar as styled div
- Brand pattern elements (repeated geometric motifs)
- HUD panels built from styled divs

NOT ALLOWED:
- Game textures from repo
- Real screenshots or photographs
- Complex illustrations
- Live game state visuals
- Imported game-repo image assets
- CSS animation classes (Tailwind, etc.) — use `interpolate()` instead

**Adaptation rule:** If a creative idea requires a NOT ALLOWED asset, describe
an SVG-geometry adaptation instead (e.g. "simplified car silhouette as SVG path"
not "car render from game").

**Reject vague mood-only instructions:**
- "stylish background"
- "dynamic neon aesthetic"
- "visually exciting"
- "sleek design"
- Any instruction that cannot be directly implemented without creative guessing

### V2 repo gameplay capture

When `production_pattern` is `repo_code_gameplay_clip_reconstruction`,
`remotion_hint` must be an operational brief — not visual composition instructions.

Required format:
```
Real gameplay capture from repo renderer via /generate-gameplay-clip.
Shot patterns: [list from suggested_shot_patterns]. Duration: Xs.
Human operator runs /generate-gameplay-clip per clip; human review required before V2 assembly.
```

Do NOT write background, SVG, or animation build instructions in this slot's
`remotion_hint` — the video comes from the real game renderer, not from Remotion.

### Reference docs

- `docs/capabilities/repo-code-gameplay-clip-reconstruction.md`
- `apps/claude-remotion/.claude/commands/generate-gameplay-clip.md`
- `apps/claude-remotion/.claude/skills/feasibility-rejection-gate.md`
- `apps/claude-remotion/.claude/shot-skills/README.md`
- `apps/chatty-susan/tests/test_capability_constraints.py`

---

## Scoring rubric (0–5 per dimension)

Score each attempt on these dimensions:

| Dimension | What 5 looks like | What 0–1 looks like |
|-----------|-------------------|---------------------|
| Story arc clarity | Clear identity → tension → stakes → result → invitation flow | Slots feel disconnected or generic |
| Hook strength | s1 names the world in 5–8 sharp words | s1 is generic ("Introducing X") |
| Viewer copy sharpness | All text_overlay ≤ 8 words, punchy, specific to the brand | Generic or missing text_overlay |
| remotion_hint buildability | All 4 parts present with hex colours, named SVG element, frame counts, text layer | Vague mood language or missing parts |
| Capability compliance | No unsupported asset references; adaptation rule applied if needed | References screenshots, real footage, or game textures |
| Visual theme consistency | Same background family, accent type, typography weight across all stills | Each still has a different visual language |
| V2 operational correctness | production_pattern set; remotion_hint is operational brief; structured fields present | SVG composition in V2 remotion_hint; structured fields missing |
| Advert energy | High-contrast, specific, punchy — feels like a designed advert | Feels like a generic slideshow plan |
| Overreach handling | Unsupported requests adapted or flagged | Unsupported requests accepted silently |
| Render usefulness | A developer could implement this directly without guessing | Multiple unclear fields requiring interpretation |

**Scoring guidance:**
- A high score requires specific, buildable instructions with exact values.
- Penalise generic mood language in remotion_hint (score –1 per vague phrase).
- Penalise production instructions leaking into text_overlay (–2 per occurrence).
- Penalise V2 fake-gameplay instructions when repo gameplay capture is available (score V2 as 0).
- Penalise missing V2 structured fields when repo gameplay is expected (–1 per missing field).
- Reward consistent visual motif across all stills (+1 bonus above 4 if motif is truly unified).

**Total:** 50 points maximum. Thresholds:
- 40+ : ready for render testing
- 30–39: acceptable, note specific weaknesses before render
- Below 30: prompt/code change required before render

---

## Optimise output format

After running N attempts, produce:

**Attempts table**

| Attempt | Top 3 strengths | Top 2 weaknesses | Total score |
|---------|----------------|------------------|-------------|
| 1 | ... | ... | N/50 |

**Recurring failure patterns**

- Pattern: [description]
- Frequency: N/N attempts
- Likely cause: [prompt rule / field validator / post-processor gap]

**Best attempt**

Attempt N (score X/50): [one sentence why it's the best]

**Recommended change**

- Area: `prompts.py` / `gates.py` / `video_formats.py`
- Change: [one specific change]
- Confidence: high / medium / low
- Reason: [based on failure pattern]

**Render validation needed?**

Yes/No — [reason]. If yes, note which specific quality dimension requires visual confirmation.

---

## Explore output format

For each direction (3–5):

**Direction: [Name]**

- Core framing: [one sentence]
- Strongest slot: [which slot would be most distinctive]
- Capability risk: low / medium / high
- Likely render difficulty: easy / medium / hard
- Likely weakness: [one thing to watch]
- Recommend: proceed to render / test with one iteration first / do not proceed

**Diversity score:** [how different are the directions from each other on a 0–5 scale]

**Rejected directions:** [any that overreach capabilities or have structural problems]

**Best 1–2 directions:** [clear recommendation with reason]

---

## Example: Bang Bop Cars optimise run

**Goal:** Improve Susan slot plan for a punchy Bang Bop Cars promo  
**Input:** Action intent + github_repo present + CTA "Play free now"  
**Variants:** 5  
**Rubric focus:** story arc, viewer copy, remotion_hint, V2 correctness, advert energy

**Expected finding patterns:**

- If `remotion_hint` fields are vague (mood language, no hex values, no frame counts):
  → Strengthen the render vocabulary injection in `build_base_slot_plan_prompt()`
  → Check that `STILL_SLOT_RENDER_VOCABULARY` is reaching the LLM

- If V2 structured fields are missing despite correct `remotion_hint` wording:
  → Add deterministic post-processor in `_post_process_base_slot_plan()` to inject
    `production_pattern`, `requires_human_clip_review`, `suggested_shot_patterns`,
    `cta_allowed`, `clip_count_target` when `is_repo_gameplay_intent(summary)` is True

- If stills feel disconnected (each slot has a different visual language):
  → Strengthen the consistent visual motif rule in the hard rules section
  → Consider adding `visual_theme` as a required field in the export to enforce it

- If `text_overlay` contains production instructions:
  → The separation rule is not enforced at the validator level
  → Add a post-processor check in `_validate_base_slot_plan()`

---

## Example: Bang Bop Cars explore run

**Goal:** Find the best creative direction for the next guided render  
**Input:** Bang Bop Cars promo brief

| Direction | Core framing | Capability risk | Recommend |
|-----------|-------------|-----------------|-----------|
| Arcade combat hype | "Drive. Fight. Dominate." — pure action energy | Low — proven in test runs | Proceed to render |
| Build-with-us community invite | Developer journey + early access | Low — text/typography heavy | Test with one iteration |
| Car customisation showcase | Showcase vehicle variants and upgrades | Medium — depends on repo having customisation | Check repo first |
| Competitive arena challenge | Leaderboard + ranking pressure | Low — stat/score visuals are supported | Test with one iteration |
| Dev journey / early-access pitch | Founders building the game | Medium — needs distinctive visual language | Explore first, render later |

**Rejected directions:**
- "Photorealistic car reveal" — requires 3D render asset, not in Remotion capabilities
- "Streamer reaction montage" — requires real footage (testimonial), not available

**Best directions for next render:** Arcade combat hype (proven) + Competitive arena challenge (low risk, different energy)

---

## Human review rules

The lab must not self-approve final quality.

It can:
- Recommend which prompt or code change to test
- Rank attempts against the rubric
- Diagnose recurring failure patterns
- Suggest which direction to proceed with

It cannot:
- Declare a slot plan "render-ready" without human confirmation
- Auto-select the creative direction
- Determine that visual quality is acceptable (only a rendered video can do that)

The operator decides:
- Which prompt or code change to implement
- Which creative direction to test in a render
- Whether to run a full render after iteration

---

## Safety and scope

- Do not run a full render by default — use still frames only if visual check is needed
- Do not call the retired service-era endpoints
- Do not modify source code unless the operator explicitly approves a change
- Do not commit after a lab run — changes require a separate review and commit step
- Do not treat rubric scores as final truth — they are diagnostic signals
- Do not run `claude -p` as part of a lab iteration
- Use render validation (`npx remotion still`) for final visual quality judgement on specific frames
