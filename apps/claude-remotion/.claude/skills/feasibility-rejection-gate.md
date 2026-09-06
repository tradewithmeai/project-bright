# feasibility-rejection-gate

**Status:** Documented — required before any clip build work  
**Slug:** `feasibility-rejection-gate`

---

## Purpose

Prevent fake footage, unsupported screens, invented UI, and generic animation
by requiring an explicit ACCEPT / PARTIAL / REJECT decision for every
requested shot before any code is written or any capture is attempted.

This gate is the first step in every clip build. If a requested visual cannot
be produced faithfully from the repo, the gate rejects it and proposes an
honest alternative. Claude must not attempt to produce footage that
misrepresents what the product or game actually does.

---

## When to use

Run the feasibility gate before:

- Gameplay clip generation via `repo_code_gameplay_clip_reconstruction`
- Any repo-derived footage request
- Product UI recreation or screen reconstruction
- Action montage planning (e.g. `five_action_clip_montage`)
- Any shot where the user expects real / repo-supported visuals

Do not skip this gate to save time. A clip that passes generation but fails
human review because it shows a feature that does not exist is worse than a
clear rejection upfront.

---

## Decision types

### ACCEPT

The repo / runtime directly supports the requested shot. All required systems
exist (renderer, physics step, camera control, entity configs, movement
system). The shot can be built from real code with no editorial substitution.

**Example:** "Show a car driving around the arena" — repo has `stepDummyCar()`,
`DummyInputController`, `buildVehicleVisual()`, `ArenaRenderer`. ACCEPT.

### PARTIAL

The repo partially supports the requested shot, but a portion requires an
honest editorial workaround or simplified reconstruction. The workaround must
be clearly labelled as such in the production report. The user must approve
the workaround before build proceeds.

**Example:** "Show the car taking damage" — the game has a damage model in the
physics step but no visual damage state on the vehicle mesh at the current
commit. PARTIAL — can show collision physics, not visual damage. Propose
alternative.

### REJECT

The requested visual does not exist in the repo at the current commit, or
producing it would require fabricating something that does not represent the
actual product. Do not attempt to fake it.

**Example:** "Show the in-game AI car builder screen" — the repo has a JSON
blueprint workflow but no in-game UI builder screen. REJECT — cannot show a
screen that does not exist. Propose fallback (still of a blueprint JSON +
overlay).

---

## Required feasibility report

For each requested shot, produce a table:

| Field | Value |
|-------|-------|
| Requested visual | [description from brief] |
| Decision | ACCEPT / PARTIAL / REJECT |
| Repo evidence | Files / functions / constants inspected |
| What is real | Systems confirmed present in repo |
| What is editorial | Workarounds or reconstructions (if PARTIAL) |
| Workaround description | (if PARTIAL) Honest description of substitution |
| Rejection reason | (if REJECT) Why it cannot be produced faithfully |
| Proposed alternative | Alternative shot if PARTIAL or REJECT |
| Approval needed | Yes / No — does the user need to approve before build? |

Produce this table before writing any studio harness code.

---

## Evidence hierarchy

When evaluating feasibility, inspect repo evidence in this order (highest
confidence first):

1. **Running repo / runtime** — does the dev server start? Does the renderer
   produce the requested visual when driven with test inputs?
2. **Repo renderer / entity / camera code** — `buildVehicleVisual()`,
   `ArenaRenderer`, `stepDummyCar()`, camera control functions
3. **Config / blueprint / asset files** — vehicle blueprints, arena layouts,
   weapon configs, skin/material definitions
4. **Documented workflows** — README, wiki, in-repo docs describing features
5. **Editorial reconstruction, clearly labelled** — if using reconstruction,
   label it PARTIAL and describe what is real and what is editorial
6. **Reject unsupported ideas** — if none of the above confirms the feature
   exists, REJECT and propose what can be shown

Do not invent evidence. If a function does not exist in the repo at the
current commit, it does not exist for this clip.

---

## Lessons from Bang Bop Cars (TEST-009 / TEST-010)

| Requested visual | Decision | Outcome |
|-----------------|----------|---------|
| Car driving in arena with camera behind | ACCEPT | Trailing follow camera — approved TEST-009 pass4 |
| Camera arc over stationary car | ACCEPT | Arc flyover — approved TEST-009 arc pass2 |
| 360 orbit of stationary car | ACCEPT | Orbit shot — approved TEST-010 orbit pass2 |
| Multi-car side-pass (cars passing each other) | ACCEPT (with note) | Produced but not exactly what was intended — kept as named pattern |
| Overhead lane approach (cars approaching camera head-on) | PARTIAL | Took 3 passes due to camera geometry ambiguity; see communication note |
| In-game AI car builder screen | REJECT | No such screen exists in repo at current commit — only JSON blueprint workflow |
| Real-time live gameplay footage | PARTIAL | SwiftShader prevents smooth real-time capture; offline deterministic capture substituted |
| CSS/SVG car recreation | REJECT | Tested in TEST-008; failed human review; not an acceptable substitute for real renderer |
| Camera follow via Colyseus peer map | PARTIAL → REJECT | `getPeer(id)` lookup fails for `__dummy__` peer at auto-follow time; replaced with direct car-state arithmetic |

**Key lesson:** Prose descriptions of camera intent ("camera above, cars approach")
are lossy when translated to 3D geometry. The `overhead_lane_approach` shot
required 3 passes because the geometric interpretation was ambiguous. When a
shot is PARTIAL due to spatial ambiguity:

- Require explicit XYZ position + lookAt XYZ in the feasibility report
- Run a 4-still preview (start/mid/end/mid2) before full capture
- Confirm with human before proceeding

---

## Camera geometry specification rule

When evaluating or proposing a shot with unusual camera placement, do not
describe it only in prose. Include:

1. Camera XYZ position in world space (or formula)
2. lookAt XYZ in world space (not a conceptual description like "the cars")
3. Subject velocity direction at the moment of interest
4. Dot product sign: positive = subject approaching camera, negative = receding

A human description like "camera above, cars approach" is insufficient without
the dot-product analysis. The `overhead_lane_approach` pass1 and pass2 errors
both came from `lookAt(centreX, Y, centreZ)` — looking at the orbit centre
always produces an outside-looking-in shot regardless of camera height.

---

## User feedback loop

- Claude must not self-approve visual quality. Human review decides pass/fail.
- If a PARTIAL workaround is proposed, the user must approve it before build.
- If REJECT, capture the reason and propose an honest alternative. Do not
  attempt to build the rejected shot anyway.
- If a clip fails human review after capture, treat it as a PARTIAL with new
  evidence — record what was wrong and propose a revised approach.

Future Susan / chat UI should surface the ACCEPT/PARTIAL/REJECT decision back
to the user before any generation begins, so the user can redirect the brief
before Claude spends 30–60 minutes on a shot that will be rejected.

---

## Rejection examples

| Requested | Decision | Reason |
|-----------|----------|--------|
| "Show in-game AI car builder" | REJECT | No in-game builder screen exists; only a JSON config workflow |
| "Show live authentic gameplay footage" | PARTIAL | Runtime capture possible; offline deterministic method required; human reviews each clip |
| "Show a screen that does not exist at this commit" | REJECT | Cannot fabricate non-existent UI |
| "Show car collision / impact" | ACCEPT (if physics present) | `stepDummyCar()` handles collisions via `obstacles` list — can demonstrate |
| "Show multiplayer race with real players" | REJECT | No real player sessions; can show dummy-car simulation only |
| "Show real-time streaming gameplay" | PARTIAL | SwiftShader prevents real-time capture; offline deterministic capture is the honest substitute |

---

## Quality gates

- **One clip at a time.** Do not batch-generate multiple shots and then request
  review. Propose one shot, get approval, build, review, then proceed.
- **Start/mid/end stills for spatial shots.** Before any full clip capture,
  render 4 stills (frame 0, 25%, 50%, end) and confirm the camera geometry
  matches intent.
- **No full V2 until individual clips pass.** Do not assemble a montage until
  at least one clip has passed human review.
- **No generic animation when repo footage is possible.** CSS/SVG
  reconstruction or div-drawn cars are only acceptable if the repo has no
  renderable 3D scene whatsoever.
- **Production report must record all rejections and workarounds.** The
  `production_report.json` `workaround_intelligence` section must document any
  PARTIAL decisions and what was substituted.

---

## Output contract

The feasibility gate output is a structured report:

```
Requested shots: [N shots from brief]

| # | Requested visual | Decision | Evidence | Proposed implementation | Approval needed |
|---|-----------------|----------|----------|------------------------|-----------------|
| 1 | Car driving in arena | ACCEPT | stepDummyCar(), DummyInputController, ArenaRenderer | trailing_follow_camera pattern | No |
| 2 | ... | ... | ... | ... | ... |

Build plan:
- Shot 1: trailing_follow_camera — virtual-gameplay-studio + offline-deterministic-capture
- Shot 2: [pending approval on workaround]

Risk:
- Shot 2 requires user approval before build (PARTIAL workaround)

Ready to build: Shot 1 (ACCEPT). Shot 2 pending user decision.
```

Wait for user confirmation on any PARTIAL before proceeding. REJECT shots
should not be built at all — record the rejection and the proposed alternative.
