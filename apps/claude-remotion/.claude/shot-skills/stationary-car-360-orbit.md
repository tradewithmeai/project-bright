# stationary_car_360_orbit

**Status:** Approved — TEST-010 orbit pass2 (H=3, R=8)  
**Slug:** `stationary_car_360_orbit`

---

## Purpose

Camera circles a stationary car at a fixed height and fixed radius, always
looking at the car centre. Full 360° in 5 s. Produces a clean "showroom
turntable" feel. More complete than the arc flyover (full circle vs half-arc)
and keeps a constant eye-level perspective rather than sweeping overhead.

---

## When to use

- Showroom / vehicle-select reveal
- When the brief asks for "rotate around the car" or "show all sides"
- Establishing shot before cutting to action
- Vehicle specification or comparison content

---

## When not to use

- Moving vehicles (orbit centre drifts)
- When the scene needs energy — the static car and linear orbit can feel slow
  unless post-processed with speed ramps
- Very tight arenas with obstacles on all sides (obstacle check may fail at small R)

---

## Required scene/studio setup

- **Subject:** one stationary vehicle
- **Arena:** `ArenaRenderer(DEFAULT_ARENA_LAYOUT)`
- **Movement:** none
- **Obstacle clearance:** check 8 orbit sample positions at the chosen radius; car position (0, −50) with R=8 cleared with >20-unit margin on all sides
- **Camera target:** car centre, `TARGET_Y = 1.4`
- **Renderer:** `preserveDrawingBuffer: true`

---

## Camera formula

```
t     = frame / (TOTAL_FRAMES - 1)   // 0..1 (note: frame 0 = frame N-1 position)
angle = 2 * PI * t                   // 0..2PI — linear orbit, constant showroom speed

camX = carX + cos(angle) * R
camZ = carZ + sin(angle) * R
camY = H

camera.up.set(0, 1, 0)    // horizontal orbit — world-up always stable, no gimbal risk
camera.lookAt(carX, TARGET_Y, carZ)
```

**No lerp needed** — camera moves on a fixed path, not following a moving subject.

**Note on loop vs non-loop:** With `t = frame / (TOTAL_FRAMES - 1)`, frames 0 and
`TOTAL_FRAMES-1` are the same camera position — seamless for a non-looping clip.
For a true seamless loop use `t = frame / TOTAL_FRAMES` (stops one step short of
completing the circle).

---

## Motion formula

Car is stationary. No per-frame position update.

---

## Recommended defaults

| Parameter | Tested value | Notes |
|-----------|-------------|-------|
| Duration | 5 s | |
| Frames | 150 | |
| Resolution | 1920×1080 | |
| FPS | 30 CFR | |
| `R` (radius) | 8 | Approved in pass2; pass1 used R=10 (too wide) |
| `H` (height) | 3 | Approved in pass2; pass1 used H=5 (too high) |
| `TARGET_Y` | 1.4 | |
| FOV | 62° | |
| Car position | (0, −50) | Confirmed obstacle-free |
| `carRotY` | 0 | Orientation does not matter for 360 orbit |
| Easing | None / linear | Constant showroom speed; slight ease-in/out is acceptable |

---

## Implementation notes (Bang Bop Cars)

- **Entry:** `client/src/circletest/OrbitTest.ts` — `startOrbitTest(canvas)`
- **Route:** `?orbittest=1` in `client/src/main.ts`
- **Flags pattern:** `PREVIEW_ONLY = true` for 4-still preflight, `false` for full capture
- **Preview frame indices:** `[0, 37, 75, 112]` — covers 0°/90°/180°/270°
- **Arena time:** `arena.update(frame / FPS)` each frame

---

## Quality gates

- [ ] Car visible and centred throughout all four cardinal angles
- [ ] Stable horizon — no roll at any point in the orbit
- [ ] No obstacles blocking car or entering close foreground
- [ ] Car fills roughly the lower-centre third of frame (verify R is not too large)
- [ ] Bloom glow present and consistent across all angles

---

## Known failure modes

| Failure | Cause | Fix |
|---------|-------|-----|
| Camera too high / car too small | H too large (e.g., H=5) | Reduce H to 3–4; use preview stills to verify |
| Car too small in frame | R too large | Reduce R to 8–10; preview first |
| Orbit starts and ends on same frame (same position) | `t = frame / (frames-1)` | Expected for non-looping clips; use `t = frame / frames` for seamless loop |

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
