# front_to_back_arc_flyover

**Status:** Approved — TEST-009 arc pass2  
**Slug:** `front_to_back_arc_flyover`

---

## Purpose

A vertical half-orbit arc: camera starts in front of a stationary car, rises
over the roof at the apex, and ends behind at equal distance. The car is always
centred and the camera focus never breaks. Creates a polished "hero reveal"
feel — good for product intros, vehicle select screens, and cinematic openers.

---

## When to use

- Hero reveal of a single vehicle
- Intro slot or identity shot before action clips
- When the car is stationary and you need graceful 3D motion from the camera
- Pairs well with trailing-follow: arc first, then cut to follow

---

## When not to use

- Moving vehicles (camera loses lock as car drifts from arc centre)
- Multi-car scenes
- When the arena background isn't interesting — the arc sweeps through 180° of sky, exposing the full surround
- Short clips under 3 s — the easing needs room to breathe

---

## Required scene/studio setup

- **Subject:** one stationary vehicle at a known XZ position (no movement)
- **Arena:** `ArenaRenderer(DEFAULT_ARENA_LAYOUT)`
- **Movement:** none — car group is static
- **Obstacle clearance:** critical — verify car position is not inside or adjacent to any arena obstacle before placing; (0, 0) is inside the central obstacle, (0, −50) is confirmed clear
- **Camera target:** fixed lookAt at car centre, Y ≈ 1.4 (car hood height)
- **Renderer:** `preserveDrawingBuffer: true`

---

## Camera formula

```
// easeInOutSine: (1 - cos(PI * t)) / 2
t      = easeInOutSine(frame / (totalFrames - 1))   // 0..1 eased
arcAngle = PI * t                                     // 0..PI (front to rear)

camX = carX + sin(carRotY) * cos(arcAngle) * D + sideX * DRIFT
camZ = carZ + cos(carRotY) * cos(arcAngle) * D + sideZ * DRIFT
camY = CAM_H + sin(arcAngle) * ARC_HEIGHT

camera.up.set(0, 1, 0)   // world-up stable throughout — no DRIFT = gimbal lock at apex
camera.lookAt(carX, CAM_LOOK_Y, carZ)
```

Where:
- `sideX = cos(carRotY)`, `sideZ = -sin(carRotY)` — car's right vector
- `DRIFT = SIDE_DRIFT * D` — small lateral offset (~0.66 units) keeps the
  apex look-vector a few degrees off straight-down, preventing gimbal lock
  without visibly tilting the car

---

## Motion formula

Car is stationary. Set `visual.group.position.set(carX, 0, carZ)` and
`visual.group.rotation.y = carRotY` once at init. No per-frame update needed.

---

## Recommended defaults

| Parameter | Tested value | Notes |
|-----------|-------------|-------|
| Duration | 4 s | |
| Frames | 120 | |
| Resolution | 1920×1080 | |
| FPS | 30 CFR | |
| `D` (horizontal dist) | 11 | |
| `CAM_H` (base height) | 4 | Height at start and end |
| `ARC_HEIGHT` (apex extra) | 9 | Apex total = CAM_H + ARC_HEIGHT = 13 |
| `CAM_LOOK_Y` | 1.4 | |
| `SIDE_DRIFT` | 0.06 × D ≈ 0.66 | Keep < 0.1 × D |
| FOV | 62° | |
| Car position | (0, −50) | Avoid (0, 0) — inside central obstacle |
| `carRotY` | 0 | Car faces +Z; front visible from arc start |

---

## Implementation notes (Bang Bop Cars)

- **Entry:** `client/src/circletest/ArcTest.ts` — `startArcTest(canvas)`
- **Route:** `?arctest=1` in `client/src/main.ts`
- **No pre-simulation phase** — car is stationary, begin capture immediately
- **Arena time:** `arena.update(frame / FPS)` each frame
- **Frame loop:** same offline `canvas.toBlob()` → POST pattern as CircleTest

---

## Quality gates

- [ ] Camera starts cleanly in front of car (car nose visible in first frame)
- [ ] Apex does not show horizon roll — `camera.up=(0,1,0)` must be set
- [ ] Car stays centred throughout with no drift off-centre
- [ ] Start and end heights match (symmetric arc)
- [ ] No gimbal-lock jitter at apex — verify DRIFT > 0

---

## Known failure modes

| Failure | Cause | Fix |
|---------|-------|-----|
| Car inside or clipping obstacle | Default car at (0,0) is on the central obstacle | Move car to (0,−50) or another confirmed-clear position |
| Horizon roll at apex | `camera.up` not explicitly set to `(0,1,0)` | Set `camera.up.set(0,1,0)` once before loop |
| Gimbal lock jitter at apex | No lateral drift, look-vector aligned with world-up | Add `SIDE_DRIFT = 0.06 × D` offset in car's side direction |
| Arc not symmetric | easeInOutSine applied to frame index, not normalised 0..1 | Normalise: `t = frame / (totalFrames - 1)` before easing |

---

## Output contract

```
Duration:  4.000 s
Frames:    120
codec:     h264
pix_fmt:   yuv420p
r_frame_rate: 30/1
width:     1920
height:    1080
movflags:  +faststart
```
