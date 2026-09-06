# overhead_lane_approach

**Status:** Approved / communication note — TEST-010 multicar pass3  
**Slug:** `overhead_lane_approach`

---

## Purpose

Camera sits above the circular racing lane, oriented along the direction of
travel, looking slightly downstream. Cars approach from the distance, grow in
frame, and pass underneath the camera. Creates a "drone over the track" feel:
the approaching car is the dominant subject, and the passing is visceral.

**Communication note:** this shot required three passes to achieve because
natural language descriptions of "camera above, cars approach" are ambiguous
in 3D. The specific failure was using `lookAt(centreX, Y, centreZ)` which
always produces the outside-looking-in shot regardless of camera position.
**The rule is: do NOT lookAt the circle centre. Look upstream along the tangent.**
See the Known Failure Modes section.

---

## When to use

- "Drone over the racing line" feel
- Multi-car approach where each car in turn passes the camera
- Strong POV for proximity/speed impression
- Pairs well with multi-car-side-pass as a second angle

---

## When not to use

- When you need all cars visible simultaneously (most are off-frame or behind camera)
- When the brief asks for "show the arena" — this shot focuses on the lane
- Short clips under 4s — the approach build-up needs at least 2s of lead-in

---

## Required scene/studio setup

- Same multi-car parametric circle as `multi_car_side_pass`
- **Subject:** 5 cars (all blueprints) on circular path R=22 around (0, −50)
- **Camera anchor:** one point ON the circle (`thetaCam`), elevated at Y=12
- **Obstacle clearance:** same car-circle check (8 samples) + check camera position separately
- **Renderer:** `preserveDrawingBuffer: true`

---

## Camera formula

**Key rule: look upstream along the tangent, NOT at the circle centre.**

```
// Choose anchor angle on the circle
THETA_CAM = PI / 2     // tested and approved; top of circle

// Camera sits on the circle, elevated
camX = centreX + cos(THETA_CAM) * R    // = 0
camZ = centreZ + sin(THETA_CAM) * R    // = -28
camY = 12

// Tangent at THETA_CAM (CCW car travel direction)
tanX = -sin(THETA_CAM)    // = -1
tanZ =  cos(THETA_CAM)    // =  0

// LookAt: 8 units UPSTREAM (anti-tangent) at ground level
// "Upstream" = where cars are coming FROM = anti-tangent direction
lookX = camX - tanX * 8   // = 0 - (-1)*8 = 8
lookY = 1.0
lookZ = camZ - tanZ * 8   // = -28 - 0    = -28

camera.up.set(0, 1, 0)
camera.position.set(camX, camY, camZ)
camera.lookAt(lookX, lookY, lookZ)
```

**Why this works:** `lookAt(8, 1.0, -28)` puts the camera looking in the +X
direction (upstream). Cars at θ < 90° are at positive X, approaching from +X,
and their velocity direction dot product with (camera-to-car) is positive (>0.7
for cars upstream by 45°+). They grow in frame and pass under the camera.

---

## Motion formula

Same as `multi_car_side_pass` — direct parametric circle, `rotY = -angle_i`.

**Start offset:** set `START_OFFSET = THETA_CAM - ANGULAR_SPEED * 2.5` so car 0
starts ~2.5s upstream at t=0 and passes under camera at the clip midpoint.

```
START_OFFSET = PI/2 - 0.5 * 2.5    // car 0 at ~18 deg at t=0, passes at t=2.5s
baseAngle_i  = (2 * PI * i) / N + START_OFFSET
```

---

## Recommended defaults

| Parameter | Tested value | Notes |
|-----------|-------------|-------|
| Duration | 5 s | |
| Frames | 150 | |
| Resolution | 1920×1080 | |
| FPS | 30 CFR | |
| `THETA_CAM` | π/2 | Top of circle; clear of obstacles |
| `camX` | 0 | cos(π/2) × 22 |
| `camY` | 12 | Higher = more overhead, steeper tilt (~54°) |
| `camZ` | −28 | sin(π/2) × 22 + (−50) |
| `lookX` | 8 | camX − tanX × 8 |
| `lookY` | 1.0 | Ground level |
| `lookZ` | −28 | camZ − tanZ × 8 |
| N cars | 5 | All blueprints |
| `CIRCLE_RADIUS` | 22 | |
| `ANGULAR_SPEED` | 0.5 rad/s | |
| `START_OFFSET` | π/2 − 1.25 ≈ 0.321 rad | Car 0 passes under at t=2.5s |
| FOV | 62° | |
| Fog far | 200 | Tighten fog slightly vs side-pass for closer feel |

---

## Implementation notes (Bang Bop Cars)

- **Entry:** `client/src/circletest/MultiCarOverheadLaneTest.ts` — `startMultiCarOverheadLaneTest(canvas)`
- **Route:** `?multicaroverheadlane=1` in `client/src/main.ts`
- **Preview frame indices:** `[0, 37, 75, 112]` — captures car at start, midway, passing, and next approach
- **Key observation from preview:** Still 0 = small car far upper-left; Still 2 = large car filling frame, passing under; Still 3 = next car appearing small in upper-left. This is the correct pattern.

---

## Quality gates

- [ ] Car starts visibly small in frame at t=0 (distance ≈ 28 units from camera)
- [ ] Car grows to dominant size by t≈2.5s (the pass)
- [ ] Car exits through bottom of frame (not side) — confirms camera is above the lane
- [ ] At least 1–2 other cars visible in background/periphery
- [ ] No `lookAt(centre)` — if the arena centre vanishing-point appears mid-frame, the wrong lookAt was used

---

## Known failure modes

| Failure | Cause | Fix |
|---------|-------|-----|
| Outside-looking-in shot (cars pass side-on) | `lookAt(centreX, Y, centreZ)` — looking at circle centre | ALWAYS use `lookAt(camX − tanX*8, lookY, camZ − tanZ*8)` |
| Shot looks identical to multi-car-side-pass | Camera placed outside circle (not on it) and wrong lookAt | Camera must be ON the circle (at `(cos(θ)*R, Y, sin(θ)*R + centreZ)`) |
| Cars approach from the wrong angle (not head-on) | `THETA_CAM` choice puts cars sweeping instead of approaching | Verify: upstream = anti-tangent from camera; dot(carVelocity, camToCarDir) > 0 |
| Car passes side not bottom of frame | Camera not truly above lane (Y too low, or lookAt too far downstream) | Increase camY to 12; set lookAt 8 units upstream not downstream |
| No car visible for long stretches | START_OFFSET too far upstream | Reduce start offset so car 0 enters frame earlier |

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
