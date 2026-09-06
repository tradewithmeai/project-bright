# multi_car_side_pass

**Status:** Useful / approved, not original intent — TEST-010 multicar pass1  
**Slug:** `multi_car_side_pass`

---

## Purpose

Multiple cars drive around a circular path while the camera sits just outside
the circle, level with the cars, watching them stream past side-on. Creates a
"convoy" or "race-start" feel with continuous depth variation: the nearest car
is large and dominant as it passes while background cars provide depth and
context. Useful for establishing that this is a multiplayer/racing product.

**Note on origin:** this shot emerged from a miscommunication on TEST-010 when
the intended shot was overhead-lane-approach. It was retained as a named
pattern because the human reviewer confirmed it looks "useful." It is a valid
shot in its own right, distinct from the overhead view.

---

## When to use

- Establishing multi-car or multiplayer context
- Race-start or convoy sequences
- When the brief asks for "multiple cars driving," "race feel," or "busy track"
- Good second clip after a single-car hero shot

---

## When not to use

- Single-car showcases
- When "cars approaching the camera" is the explicit requirement (use
  `overhead_lane_approach` instead)
- Very small arenas — background cars may exit the arena boundary

---

## Required scene/studio setup

- **Subjects:** N cars (4–5), each built via `buildVehicleVisual(bp, 'solid')`
  — use different blueprints for visual variety
- **Arena:** `ArenaRenderer(DEFAULT_ARENA_LAYOUT)`
- **Movement:** direct parametric circle — no `DummyInputController` needed
- **Obstacle clearance:** verify 8 sample positions on the car circle path;
  (0, −50) with R=22 clears all obstacles with >5-unit margin
- **Camera target:** circle centre
- **Renderer:** `preserveDrawingBuffer: true`

---

## Camera formula

Camera is fixed outside the circle, looking at the centre:

```
camX = centreX + CIRCLE_RADIUS + 6   // just outside circle
camY = 4
camZ = centreZ
camera.lookAt(centreX, 1.2, centreZ)
```

Camera does not move per frame.

---

## Motion formula

Direct parametric circle — no physics, no AI:

```
// Per frame, per car i:
angle_i = baseAngle_i + ANGULAR_SPEED * (frame * DT)
x_i     = centreX + cos(angle_i) * CIRCLE_RADIUS
z_i     = centreZ + sin(angle_i) * CIRCLE_RADIUS

car.visual.group.position.set(x_i, 0, z_i)
car.visual.group.rotation.y = -angle_i    // tangent direction, CCW

// Wheel spin (tied to linear speed):
linearSpeed = ANGULAR_SPEED * CIRCLE_RADIUS
WHEEL_SPIN  = (linearSpeed / MAX_SPEED_REF) * DT * 10
wg.rotation.x += WHEEL_SPIN

// Initial spacing:
baseAngle_i = (2 * PI * i) / N + startOffset
```

**Rotation rule:** `rotY = -angle_i` for counterclockwise (CCW) orbit.  
Verify: forward vector = `(sin(rotY), 0, cos(rotY))` = `(-sin(angle), 0, cos(angle))` = CCW tangent. Correct.

---

## Recommended defaults

| Parameter | Tested value | Notes |
|-----------|-------------|-------|
| Duration | 5 s | |
| Frames | 150 | |
| Resolution | 1920×1080 | |
| FPS | 30 CFR | |
| N cars | 4 | 5 also works; 4 gives cleaner spacing (90° gaps) |
| `CIRCLE_RADIUS` | 22 | |
| `ANGULAR_SPEED` | 0.5 rad/s | One full orbit ~12.6 s |
| `START_OFFSET` | −π/8 | First car enters sweet-spot ~0.4s in |
| `MAX_SPEED_REF` | 45 | From CircleTest blueprint convention |
| `CAM_X` | centreX + R + 6 | 6 units outside circle |
| `CAM_Y` | 4 | |
| `CAM_Z` | centreZ | |
| lookAt Y | 1.2 | |
| FOV | 62° | |
| Circle centre | (0, −50) | Confirmed obstacle-free |
| Blueprints | balanced, scout, bruiser, drifter | All 4 from Bang Bop Cars |

---

## Implementation notes (Bang Bop Cars)

- **Entry:** `client/src/circletest/MultiCarTest.ts` — `startMultiCarTest(canvas)`
- **Route:** `?multicartest=1` in `client/src/main.ts`
- **No pre-simulation** — parametric motion, no physics warm-up needed
- **5 blueprints available:** balanced-starter, glass-cannon-scout, heavy-bruiser,
  drift-interceptor, long-range-striker
- **Arena time:** `arena.update(frame * DT)` each frame

---

## Quality gates

- [ ] At least 2 cars visible in frame at any moment
- [ ] Closest car dominant (large) as it passes the camera-facing point
- [ ] Wheel spin visible on passing car
- [ ] Background cars visible at varying depths (arena scale readable)
- [ ] No cars clipping into arena obstacles

---

## Known failure modes

| Failure | Cause | Fix |
|---------|-------|-----|
| Cars look like same vehicle | All using one blueprint | Use different blueprints per car slot |
| Cars too small | R too large or camera too far | Reduce R or reduce camera offset from 6 to 4 |
| Bunching | START_OFFSET misaligned | Use `(2*PI*i)/N` with consistent startOffset |

---

## Output contract

```
Duration:  5.000 s
Frames:    150
codec:     h264
pix_fmt:   yuv420p
r_frame_rate: 30/1
width:     1920
height:    1080
movflags:  +faststart
```
