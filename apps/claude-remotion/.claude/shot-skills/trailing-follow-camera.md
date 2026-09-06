# trailing_follow_camera

**Status:** Approved — TEST-009 pass4  
**Slug:** `trailing_follow_camera`

---

## Purpose

A trailing drone that follows a moving vehicle from behind, looking slightly
forward of the car. Creates the "live gameplay footage" feel: the car dominates
the lower-centre of frame, the arena stretches ahead, and the motion feels
reactive. The strongest single-car action shot for gameplay trailers.

---

## When to use

- Main V2 action clip when one car in motion is the subject
- Product demos emphasising car speed and handling
- Any time the brief asks for "gameplay footage," "driving shot," or "behind the car"
- Best when the car follows a curved or circular path (direction changes read as steering)

---

## When not to use

- Stationary car showcases (use `stationary_car_360_orbit` instead)
- Multi-car scenes where all cars must be visible simultaneously
- Repos with no dummy/bot movement system and no scripted path
- When the car moves too slowly — stutter appears at < 5 units/s visible speed

---

## Required scene/studio setup

- **Subject:** one vehicle entity with a valid blueprint, rendered via `buildVehicleVisual(bp, 'solid')`
- **Arena:** `ArenaRenderer(DEFAULT_ARENA_LAYOUT)` — real arena, not a bare plane
- **Movement:** `DummyInputController('circle')` + `stepDummyCar()` at fixed DT=1/30
- **Pre-simulate:** run physics for 6×FPS frames before capture so the car reaches steady circle speed
- **Obstacle clearance:** default spawn (0,0) is inside a central obstacle — pre-simulate to a clear position or override start; (0,−50) is confirmed clear
- **Camera target:** a point ahead of the car, not the car pivot
- **Renderer requirement:** `WebGLRenderer` with `preserveDrawingBuffer: true`

---

## Camera formula

```
// Three.js Y-up convention
forwardX = sin(car.rotY)
forwardZ = cos(car.rotY)

// Camera behind car — MINUS sign is critical
targetCamX = car.x - forwardX * CAM_BACK
targetCamY = CAM_HEIGHT
targetCamZ = car.z - forwardZ * CAM_BACK

// Exponential lerp each frame (at fixed DT=1/30)
smoothCam.x += (targetCamX - smoothCam.x) * CAM_LERP
smoothCam.y += (CAM_HEIGHT  - smoothCam.y) * CAM_LERP
smoothCam.z += (targetCamZ  - smoothCam.z) * CAM_LERP

camera.position.copy(smoothCam)
camera.lookAt(
  car.x + forwardX * LOOK_AHEAD,
  CAM_LOOK_Y,
  car.z + forwardZ * LOOK_AHEAD
)
```

**Sign rule:** `car.pos + forward * CAM_BACK` places camera *ahead* of the car
(pass1 bug — rear-view mirror strip). The minus sign places it *behind*. Always
verify sign with a first-frame still before full capture.

---

## Motion formula

`DummyInputController('circle')` drives the car around corner waypoints at
`(±70, ±70)`. Advance simulation with fixed `DT = 1/30` per frame. No wall-clock
dependency.

---

## Recommended defaults

| Parameter | Tested value | Notes |
|-----------|-------------|-------|
| Duration | 7 s | Short enough for a V2 slot |
| Frames | 210 | FPS × duration |
| Resolution | 1920×1080 | |
| FPS | 30 CFR | |
| `CAM_BACK` | 10 | > 12 makes car too small |
| `CAM_HEIGHT` | 5 | |
| `CAM_LOOK_Y` | 1.5 | Hood/roof height |
| `LOOK_AHEAD` | 8 | Look-at point in front of car |
| `CAM_LERP` | 0.18 | Per-frame at DT=1/30; stable |
| FOV | 60° | `PerspectiveCamera(60, aspect, 0.1, 600)` |
| `MAX_SPEED` | 45 | Reduced from 70 for readable motion |
| `SETTLE_FRAMES` | 180 | 6s pre-simulation |
| Encoding | CRF 14, preset medium | Sharper than CRF 18 |

---

## Implementation notes (Bang Bop Cars)

- **Repo:** `/tmp/bangbopcars` (cloned in container render path (removed))
- **Entry:** `client/src/circletest/CircleTest.ts` — `startCircleTest(canvas)`
- **Route:** `?circletest=1` injected into `client/src/main.ts`
- **Imports:** `DummyInputController`, `stepDummyCar`, `DEFAULT_ARENA_LAYOUT` from `@neon-arena/shared`
- **Vehicle:** `buildVehicleVisual(bp, 'solid')` + `visual.wheelGroups` spin each frame
- **Frame capture:** `canvas.toBlob()` POST to `http://127.0.0.1:9998/frame/N` per frame
- **Frame receiver:** `/tmp/frame-receiver.mjs` — saves JPEGs, triggers ffmpeg on `/done`
- **Arena time:** `arena.update(frame * DT)` each frame for floor shader animation

---

## Quality gates

Before approving a clip, verify:

- [ ] Car occupies roughly the lower-centre third of frame at typical speed
- [ ] Arena grid visible and correctly perspective-distorted (not flat)
- [ ] Camera lerp smooth — no frame-to-frame jitter visible at 30fps
- [ ] Car does not disappear behind camera at any point
- [ ] No orange-box or zone-overlay artefacts (suppress client-side damage geometry if visible)
- [ ] Bloom glow present on trim strip and headlight bar

---

## Known failure modes

| Failure | Cause | Fix |
|---------|-------|-----|
| Camera facing wrong way (rear-view strip) | `+forwardX * CAM_BACK` sign error | Use minus sign |
| Jumpy motion at 30fps | SwiftShader renders at ~8fps; `MediaRecorder` captures VBR | Use offline frame-by-frame capture, not `captureStream()` |
| `r_frame_rate=1000/1` in ffprobe | `MediaRecorder` WebM VBR timestamps | Offline capture + `-r 30` input flag |
| Car exits frame during turn | `CAM_BACK` too large or `LOOK_AHEAD` too small | Reduce `CAM_BACK` to 8–10, increase `LOOK_AHEAD` |
| Drone unreliable via network | `getPeer(id)` lookup depends on Colyseus snapshot | Compute camera directly from local car state |

---

## Output contract

```
Path:      /tmp/test009-drone-follow-clip1-pass4.mp4  (example)
Duration:  7.000 s
Frames:    210
codec:     h264
pix_fmt:   yuv420p
r_frame_rate: 30/1
avg_frame_rate: 30/1
width:     1920
height:    1080
movflags:  +faststart
```

Verify with:
```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,pix_fmt,r_frame_rate,width,height,nb_frames \
  -of default=noprint_wrappers=1 output.mp4
```
