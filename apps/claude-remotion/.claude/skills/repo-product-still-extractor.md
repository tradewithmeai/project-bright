# Repo Product Still Extractor

**Status:** Proven (Bang Bop Cars, 2026-05-22 + 2026-06-04) — multi-vehicle, multi-angle, human-reviewed  
**Slug:** `repo-product-still-extractor`

---

## Purpose

Generate product-specific still image anchors from a real repo/product renderer so
video still slots do not rely on generic abstract visuals.

The skill inspects the actual repo, identifies real renderable entities (vehicles,
UI components, cards, blueprints), and produces clean PNG stills using the repo's
own renderer. These stills become honest visual anchors for still slots — grounded
in what the product actually looks like, not invented geometry.

This is **NOT** a ChatGPT Skill. It is an internal Claude Code skill for use
inside the container render path (removed) during guided Stage 0.

---

## When to use

Use when:

- A still slot needs product-specific imagery and is about to receive a generic
  abstract background instead
- The repo contains renderable product entities, UI components, blueprints, models,
  or visual components
- The requested still concept does not exactly exist as UI, but a related real
  repo object can be extracted as an honest substitute
- A meaningful repo-derived fallback is better than invented decorative visuals
- The operator wants to validate what the product actually looks like before
  committing to still slot design

---

## When not to use

Avoid when:

- The operator has already supplied approved images or clips
- No repo or renderable visual components are available
- The task requires a full gameplay/action clip rather than a still
- The only option would be a CSS-faked product that does not exist in the repo
- The still requires a UI that does not exist and cannot be approximated honestly
  (use `feasibility-rejection-gate` to surface this clearly)

---

## Core principle

**Prefer real repo-derived visual anchors over generic decorative geometry.**

If the exact concept does not exist in the repo, do not invent it. Use the
closest truthful repo-derived visual instead, and label it honestly.

**Example:**

If the slot says "Design your dream machine" but the repo has no car-builder UI:
- do NOT fake a car-builder screen
- use a real rendered vehicle blueprint/product shot from the repo
- optionally frame it with design/build-themed HUD typography

Abstract decorative geometry (gradient stripes, random SVG shapes) is acceptable
only as a support element — never as the primary visual when a concrete product
concept is requested.

---

## Validated example: Bang Bop Cars (2026-05-22, extended 2026-06-04)

**Repo:** the product repo (worked example was a private game repo)

**Inspected files:**
- `client/src/rendering/VehicleRenderer.ts` — core Three.js renderer
- `content/vehicles/*.json` — vehicle blueprints (one file per vehicle)

**Renderer function identified:** `buildVehicleVisual(bp, renderMode)` — constructs
Three.js geometry from blueprint JSON; self-contained, no game server dependency

**Exact harness method (2026-06-04, fully validated):**

1. Clone the product repo you are extracting from (a private repo needs a token with read access:
   `git clone https://x-access-token:${GITHUB_PAT}@github.com/<owner>/<repo> /tmp/<repo>`)
2. Ensure Remotion Chrome headless shell is downloaded:
   ```js
   const { ensureBrowser } = require('@remotion/renderer');
   await ensureBrowser({ browser: 'chrome' });
   ```
   Path after download: `/app/node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell`
3. Install puppeteer-core once: `npm install puppeteer-core --prefix /tmp/puppeteer-env --no-package-lock`
   Load via: `require('/tmp/puppeteer-env/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')`
4. Write a **self-contained HTML template** (`/tmp/bbc-single-shot.html`) that:
   - Loads Three.js via importmap from `unpkg.com/three@0.169.0/build/three.module.js`
   - Contains `buildVehicleVisual()` ported verbatim from `VehicleRenderer.ts`
   - Reads blueprint via template tokens (`%%BP_JSON%%`, `%%CAM_X%%`, etc.) replaced at render time
   - Sets `window.__RENDER_DONE__ = true` after `renderer.render(scene, cam)`
5. For each shot: replace tokens in template → write to `/tmp/bbc-shot-tmp.html` → Puppeteer page.goto → waitForFunction → page.screenshot
6. Launch flags (REQUIRED — container runs as root): `['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']`
7. Do NOT use `--screenshot` CLI flag — it does not work reliably; use Puppeteer's `page.screenshot()` instead

**Validated vehicle outputs (human-reviewed):**

| Vehicle | Blueprint slug | Angles rendered | Status |
|---------|---------------|----------------|--------|
| Pulse Coupe | `balanced-starter` | hero, 3q-front, side, top-3q | Pending operator sign-off |
| Drift Interceptor | `drift-interceptor` | hero | Pending operator sign-off |
| Wire Wasp | `glass-cannon-scout` | hero | Pending operator sign-off |
| Iron Hex | `heavy-bruiser` | hero | Pending operator sign-off |
| Quad panel (all vehicles) | — | overview | Pending operator sign-off |

**Standard camera angles (all from these positions, looking at car centre-of-mass):**

| Angle | camX | camY | camZ | FOV |
|-------|------|------|------|-----|
| hero | 3.5 | 2.2 | 4.8 | 38° |
| 3q-front | 3.8 | 2.4 | 4.5 | 42° |
| side | 5.5 | 2.0 | 0.2 | 38° |
| top-3q | 1.5 | 5.5 | 3.2 | 40° |

Camera lookAt: `(0, bp.body.height * 0.4 + bp.wheels.size * 0.5, 0)`

**Background used:** Dark arena/grid (`#04060d` bg, cyan `GridHelper`, cyan horizon
line) — keeps product readable without adding false context. Transparent background
was not required here but can be enabled with `scene.background = null; alpha: true`.

---

## Workflow

### Step 1 — Inspect repo for renderable visual entities

Look for:
- Renderer files (`VehicleRenderer.ts`, `CardRenderer.ts`, etc.)
- Component files (UI cards, product tiles, shop items)
- Blueprint/config JSON (entity definitions, stats, appearance)
- Assets (textures, icons, SVGs)
- Existing test harnesses or minimal setup examples

### Step 2 — Identify the truthful visual anchor

Determine what the repo can actually render:
- Product object / vehicle / character
- UI card or tile
- Screenshot candidate (existing DOM component)
- Model or 3D mesh
- Blueprint data renderable via repo's own tooling

### Step 3 — Decide whether the exact requested visual exists

If yes: extract it directly.

If no: choose the closest honest repo-derived substitute and note the gap.
Do not silently substitute without flagging. Use phrasing like:
> "Slot requests X. Repo does not contain X. Closest honest substitute: Y.
> Using Y. Operator should confirm this is acceptable."

### Step 4 — Build minimal extraction harness

- Prefer the repo's existing renderer/component over writing new rendering code
- Preserve real geometry, colour, and style from the blueprint
- Do not redraw with CSS if the repo has a canvas/WebGL renderer
- Keep the harness minimal — just enough to produce clean still output
- Use a dark/neutral background unless the product requires its own background
- Avoid arena obstacles (confirmed gap from TEST-009: default spawn at (0,0) is
  inside the central obstacle; use a cleared position)

### Step 5 — Render 2–4 review images

Recommended coverage:
- Hero angle (front 3/4 or dominant angle from the product's own perspective)
- Side/profile if useful for slot concept
- Top/three-quarter if useful for spatial context
- Overview/quad panel if multiple entities should be shown together

### Step 6 — Save to /tmp and report

- Save files with descriptive names (see Output standards below)
- Report: paths, method used, which vehicles/entities were rendered, and honest
  note on whether the output matches the slot concept
- Do not commit generated media

### Step 7 — Human review gate

Stop and present paths for human review. Do not self-approve visual quality.

---

## Output standards

Images should be:
- Repo-derived — rendered by the actual product renderer
- Product-specific — showing real blueprint/entity, not invented geometry
- Readable at social-video size (1080p playback)
- Suitable as still-slot visual anchors
- Free of arena obstacles or unwanted background elements
- Honest about what exists in the repo

Preferred format:
- PNG
- 1920×1080 unless another size is requested
- Dark/simple background by default
- Transparent background optional if reliable

**Filename convention:**
```
/tmp/<product>-<entity>-<angle>.png
/tmp/<product>-quad-panel.png
```

Examples:
```
/tmp/bangbopcars-car-balanced-starter-hero.png
/tmp/bangbopcars-car-drift-interceptor-hero.png
/tmp/bangbopcars-car-heavy-bruiser-hero.png
/tmp/bangbopcars-quad-panel.png
```

---

## Human review

The skill must not self-approve final visual quality.

It can say:
- "Method proven — images rendered from real repo renderer"
- "Image is a candidate for still slot X — human review required"
- "Closest available repo visual used — slot concept X was approximated with Y"

It cannot:
- Declare images "approved" or "render-ready"
- Skip the human review gate
- Auto-assign images to still slots in the scene-spec without operator confirmation

---

## Failure modes

| Failure | Description |
|---------|-------------|
| No renderable component | Repo has data/config but no renderer — CSS fake is the only option; reject and flag |
| Exact concept missing | Slot requests something the repo does not have; must surface gap, not invent |
| Renderer needs app state | Renderer depends on live game server or app context; extraction harness is impractical |
| Missing assets/textures | Renderer loads external textures not present in the repo; falls back to untextured geometry |
| Output too abstract | Even the repo's own renderer produces generic-looking output for this entity |
| Arena/obstacle collision | Entity spawns inside an obstacle at default position; must move to a clear spawn point |
| Output too small / low contrast | Dark entity on dark background; adjust camera distance, background lightness, or entity position |
| Truthful visual does not match slot concept | Closest honest visual is visually different from what the slot brief requests; flag and let operator decide |

---

## Relation to other skills

```
repo-product-still-extractor   ← YOU ARE HERE (static stills from repo renderer)
│
├── feasibility-rejection-gate  ← run first; if repo has no renderer, reject here
├── iterative-output-lab        ← evaluate still quality before embedding in slot plan
│
└── (separate clip path):
    ├── virtual-gameplay-studio ← full gameplay scene setup
    ├── drone-camera-rig        ← camera movement / shot patterns
    ├── offline-deterministic-capture ← frame-by-frame video capture
    └── browser-safe-video-export    ← ffmpeg export for V2 clips
```

**Key distinctions:**

| Skill | Output type | Use for |
|-------|------------|---------|
| `repo-product-still-extractor` | Static PNG stills | Still slots (S1–S8) needing product-specific imagery |
| `generate-gameplay-clip` command | MP4 action clip | V2 video slot (action/gameplay footage) |
| `virtual-gameplay-studio` | Gameplay scene setup | Clip capture (V2 video, not stills) |
| `drone-camera-rig` | Camera motion formula | Shot patterns for V2 clips |

Still slots and video clips are entirely separate paths. This skill is for stills only.

---

## Safety and scope

- Do not run a full pipeline render — stills only
- Do not call the retired service-era pipeline endpoints
- Do not commit generated media unless the operator explicitly requests it
- Do not modify scene-spec or slot assignments without operator confirmation
- Do not run `claude -p` as part of this skill
- Generated PNGs go to `/tmp` — they do not enter the pipeline automatically
- Operator must explicitly approve images before they are used in a render
