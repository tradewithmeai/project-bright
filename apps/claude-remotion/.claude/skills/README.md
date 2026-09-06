# Foundation Skill Library — Claude Code

**These are NOT ChatGPT Skills.**

This directory contains foundation-skill documentation for the
`repo_code_gameplay_clip_reconstruction` capability. Each file is an internal
reference document, written for a containerised render path that is no longer part of this repo.
The skills describe the core technical subsystems that underpin the
`/generate-gameplay-clip` command (or equivalent future command).

The intended consumer is a Claude Code command that reads a clip brief, selects
a shot pattern, builds a virtual studio harness, runs offline deterministic
capture, and returns a reviewed clip for V2 slot assembly.

---

## Relationship to parent capability and shot-skill library

```
docs/capabilities/repo-code-gameplay-clip-reconstruction.md   ← parent capability doc
│
├── apps/claude-remotion/.claude/skills/                       ← YOU ARE HERE
│   Foundation subsystems (how each layer works)
│
└── apps/claude-remotion/.claude/shot-skills/                  ← per-pattern specs
    Camera formulae, motion, defaults, gates for each shot
```

Foundation skills describe *how* the machinery works.
Shot skills describe *what camera pattern to use* for a given brief.

---

## Foundation Skill Catalogue

| Slug | File | Status | Notes |
|------|------|--------|-------|
| `feasibility-rejection-gate` | [feasibility-rejection-gate.md](feasibility-rejection-gate.md) | **Documented** | Run before any build work |
| `virtual-gameplay-studio` | virtual-gameplay-studio.md | **Pending doc** | Studio harness construction |
| `drone-camera-rig` | drone-camera-rig.md | **Pending doc** | Camera formula library |
| `offline-deterministic-capture` | [offline-deterministic-capture.md](offline-deterministic-capture.md) | **Documented** | Frame-by-frame capture |
| `browser-safe-video-export` | [browser-safe-video-export.md](browser-safe-video-export.md) | **Documented** | ffmpeg export rules |

---

## Development / Quality Skills

| Slug | File | Status | Notes |
|------|------|--------|-------|
| `iterative-output-lab` | [iterative-output-lab.md](iterative-output-lab.md) | **Documented** | Iterative evaluation of intermediate outputs before expensive renders |

**Purpose:** Breaks chicken-and-egg quality-development loops by providing a
structured way to test Susan slot plans, remotion_hints, and V2 operational
briefs without triggering a full render.

**Modes:** `optimise` (improve one target outcome across iterations) and
`explore` (generate distinct creative directions and compare them).

**Current first-use target:** Susan `base_slot_plan` quality — rubric scoring,
failure-pattern diagnosis, and prompt change recommendation before the next
guided Bang Bop Cars render.

---

## Still Slot Skills

| Slug | File | Status | Notes |
|------|------|--------|-------|
| `repo-product-still-extractor` | [repo-product-still-extractor.md](repo-product-still-extractor.md) | **Proven once — human-reviewed** | Generate repo-derived PNG stills for still slots; avoids generic abstract backgrounds |

**Purpose:** Inspect the real repo/product renderer, extract truthful visual
anchors (vehicles, UI components, blueprints, models) as clean PNG stills, and
use these as product-specific imagery for still slots (S1–S8).

**First validation (2026-05-22):** Bang Bop Cars car product shots via
`buildVehicleVisual()` + vehicle blueprint JSON. Five vehicle outputs
human-approved: Pulse Coupe, Drift Interceptor, Wire Wasp, Iron Hex, quad
panel overview.

**Status:** Promising — proven once. Use it when a still slot is about to
receive a generic abstract background and the repo has a renderable product
visual. Human review required before any still is used in a render.

**Next use:** Replace generic still backgrounds with meaningful product visuals
in future Bang Bop Cars renders. Generalise to other repos as new products are
onboarded.

`virtual-gameplay-studio` and `drone-camera-rig` are documented in the parent
capability doc (`repo-code-gameplay-clip-reconstruction.md`) and shot-skill files.
Dedicated skill docs are the next writing task.

---

## Render Report Skills

| Slug | File | Status | Notes |
|------|------|--------|-------|
| `record-final-video` (post-render report) | [record-final-video/post-render-report.md](record-final-video/post-render-report.md) | **Documented — v0** | Source/spec/export-derived report after a render completes — absorbed into the `record-final-video` skill |

**Purpose:** After a Project Bright render/export, generate a structured
`video_report.md` + `video_report.json` so downstream agents, the operator,
and future pipeline steps understand what video was produced, what it
contains, and what actions to take next.

**v0 honest scope:** Source, spec, and export artefacts only — no visual
analysis of the rendered MP4. Every v0 report carries an explicit source
honesty disclaimer. Frame-sampled visual analysis is a future enhancement.

**Intended consumers:** Social post agents (caption/hashtag drafting),
publishing agents (scheduling/upload), archive/search agents, operator review
before publishing, future video agents that need to understand existing
outputs without re-running the pipeline.

**Status:** Documented only — no automated pipeline hook yet. Run manually
by invoking the skill after `resume-guided-job.mjs` completes. Automation
(post-render writeback hook) is deferred until the manual path is validated
on at least one real render.

---

## Dependency Tree

```
repo-code-gameplay-clip-reconstruction
├── feasibility-rejection-gate      ← first, before any code is written
├── virtual-gameplay-studio         ← studio harness in game repo
├── drone-camera-rig                ← camera positioned from entity state
├── offline-deterministic-capture   ← fixed-DT frame loop + receiver server
├── browser-safe-video-export       ← ffmpeg rules for web-safe MP4
└── shot-skills/*                   ← per-pattern camera + motion specs
    ├── trailing-follow-camera
    ├── front-to-back-arc-flyover
    ├── stationary-car-360-orbit
    ├── multi-car-side-pass
    └── overhead-lane-approach
```

**Execution order for a clip build:**

1. `feasibility-rejection-gate` — inspect repo, decide ACCEPT/PARTIAL/REJECT
2. `virtual-gameplay-studio` — build or locate the controlled test route
3. `drone-camera-rig` + `shot-skills/<pattern>` — configure the camera
4. `offline-deterministic-capture` — run the frame loop and collect frames
5. `browser-safe-video-export` — assemble frames into a browser-safe MP4
6. Human review — PASS / FAIL before proceeding

---

## /generate-gameplay-clip command

The command that orchestrates all five foundation skills is now drafted at:

```
apps/claude-remotion/.claude/commands/generate-gameplay-clip.md
```

It orchestrates:

```
feasibility-rejection-gate
  → virtual-gameplay-studio
  → drone-camera-rig + shot-skills/<pattern>
  → offline-deterministic-capture
  → browser-safe-video-export
  → human review gate (STOP)
```

**Status:** Drafted — documents the validated TEST-009/TEST-010 method.
Next validation: run the command on one approved shot request and confirm
it reproduces those test results.

Do not bake automated pipeline invocation until at least one stitched
multi-shot sequence has passed human review (TEST-010 stitching goal).
See `docs/memory/project-bright-next-tests.md`.
