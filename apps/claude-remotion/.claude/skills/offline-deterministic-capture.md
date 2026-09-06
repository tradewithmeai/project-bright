# offline-deterministic-capture

**Status:** Documented — validated in TEST-009 (pass3 / pass4)  
**Slug:** `offline-deterministic-capture`

---

## Purpose

Capture smooth, true-frame-rate video from a game renderer by advancing the
simulation at a fixed timestep and rendering/capturing each frame
independently — decoupled from wall-clock time.

Frame N always represents exactly `N / FPS` seconds of simulated time,
regardless of how long the host machine takes to render it. This is the
only reliable capture method for a VPS with SwiftShader (software WebGL),
where real-time rendering runs well below 30fps.

---

## When to use

- Real-time capture produces jumpy or staggered motion
- VPS/GPU performance is poor (e.g. SwiftShader headless rendering)
- SwiftShader or Xvfb cannot sustain 30fps wall-clock
- `MediaRecorder` produces `r_frame_rate=1000/1` (VBR WebM timestamps)
- The simulation can be stepped deterministically with a fixed `DT`
- Smooth, broadcast-quality gameplay footage is required

---

## When not to use

- The real-time renderer already produces smooth, consistent 30fps output
- The scene cannot be stepped with a deterministic fixed timestep (e.g. physics is entirely server-driven)
- The render loop cannot be paused and driven from outside (`requestAnimationFrame` only, no override)
- The repo only exposes pre-rendered footage or video files (use those directly)

If any of the above apply, document the limitation and return a PARTIAL or
REJECT decision from `feasibility-rejection-gate`.

---

## Core principle

> Frame N must represent exactly N / FPS seconds of simulated time.

The machine can take 50ms or 500ms to render each frame. The simulation
does not care — it always advances by `DT = 1 / FPS`. The resulting image
sequence, assembled by ffmpeg at `-r FPS`, produces true CFR output.

---

## Why real-time capture failed (TEST-009 passes 1–2)

SwiftShader (software WebGL on headless VPS) rendered the Three.js bloom
scene at ~6–8fps effective rate.

- `canvas.captureStream(30)` requested 30fps but the browser only produced
  new frames when SwiftShader actually completed a render.
- `MediaRecorder` captured those 6–8 unique frames with VBR WebM timestamps
  (`r_frame_rate=1000/1` in ffprobe output).
- Re-encoding with `-r 30` via ffmpeg produced nominal 30fps output, but the
  *content* only changed 6–8 times per second. The result was visibly
  staggered motion — CFR normalisation cannot create new frames that were
  never rendered.

**What fixed it (TEST-009 pass3):** switching to frame-by-frame offline
capture. The render loop was replaced with a manual `for` loop:
advance simulation → render → `canvas.toBlob()` → POST frame to receiver.
Total capture time ~50s for 210 frames (7s at 30fps). Each frame was
individually rendered by SwiftShader; ffmpeg assembled them at exactly 30fps.
Result: true 30fps CFR, smooth motion.

**Pass4 improvement:** resolution bumped from 1280×720 to 1920×1080 and CRF
reduced from 18 to 14. Blockiness eliminated.

---

## Standard parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| FPS | 30 | Target frame rate |
| DT | 1/30 ≈ 0.0333 s | Fixed simulation timestep |
| Resolution | 1920×1080 | Reduce to 1280×720 for fast test passes only |
| Duration | 5–8 s | V2 slot clips; 210 frames = 7s at 30fps |
| `pixelRatio` | 1 | `renderer.setPixelRatio(1)` — no retina scaling |
| `preserveDrawingBuffer` | `true` | Required on `WebGLRenderer` to read backbuffer |
| Canvas dimensions | Must match output WxH | Set on `renderer.setSize(W, H)` before any render |
| Frame format | JPEG (quality 0.92–0.95) | Faster than PNG; acceptable quality at 1080p |
| Settle frames | 6 × FPS = 180 | Pre-simulate before capture to reach steady state |

---

## Frame loop pseudo-code

```
FPS = 30
DT  = 1 / FPS
SETTLE_FRAMES  = 6 * FPS    // run physics before capture starts
CAPTURE_FRAMES = duration * FPS

// Phase 1 — pre-simulate (no rendering; runs instantly)
for i in 0 ..< SETTLE_FRAMES:
  input = bot.tick(car, DT)
  stepPhysics(car, input, DT)

// Phase 2 — capture frames
for frame in 0 ..< CAPTURE_FRAMES:
  t = frame / FPS

  input  = bot.tick(car, DT)
  stepPhysics(car, input, DT)
  updateVisuals(car)
  updateCamera(car, frame, t)
  updateScene(t)        // e.g. arena shader expects elapsed seconds
  renderScene()

  blob = await canvasToBlob(canvas, quality=0.93)
  await postFrame(frame, blob)

await signalDone()
```

The frame receiver server saves each blob, then on `done` runs ffmpeg and
exits. See the [Frame receiver server](#frame-receiver-server) section.

---

## TypeScript capture loop (Bang Bop Cars pattern)

```typescript
const FPS = 30;
const DT  = 1 / FPS;
const SETTLE = 6 * FPS;
const FRAMES = Math.round(durationSeconds * FPS);

// Pre-simulate
for (let i = 0; i < SETTLE; i++) {
  const inp = bot.tick(car, DT);
  stepDummyCar(car, inp, MAX_SPEED, ACCEL, BRAKE, TURN_RATE, DT, obstacles);
}

// Capture
for (let frame = 0; frame < FRAMES; frame++) {
  const inp = bot.tick(car, DT);
  stepDummyCar(car, inp, MAX_SPEED, ACCEL, BRAKE, TURN_RATE, DT, obstacles);

  updateVisuals(car);           // wheel spin, etc.
  updateCamera(car, frame);     // camera drone formula
  arena.update(frame * DT);     // arena shader time

  composer.render();

  const blob = await new Promise<Blob>((res) =>
    canvas.toBlob(b => res(b!), 'image/jpeg', 0.93)
  );
  await fetch(`http://127.0.0.1:9998/frame/${frame}`, {
    method: 'POST', body: blob,
  });
}
await fetch('http://127.0.0.1:9998/done', { method: 'POST' });
```

**WebGL requirement:** `new THREE.WebGLRenderer({ canvas, preserveDrawingBuffer: true })`.
Without `preserveDrawingBuffer: true`, `canvas.toBlob()` reads an already-cleared
(black) backbuffer.

---

## Frame receiver server

A small Node.js HTTP server runs alongside the game dev server. It:

1. Accepts `POST /frame/N` — saves the JPEG body to `/tmp/<clip>-frames/frame-NNNNN.jpg`
2. Accepts `POST /done` — assembles frames with ffmpeg and exits

Minimal implementation:

```javascript
// /tmp/frame-receiver.mjs
import http from 'http';
import fs   from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const FRAME_DIR = '/tmp/circletest-frames';
const OUTPUT    = '/tmp/clip-output.mp4';
const FPS       = 30;

fs.mkdirSync(FRAME_DIR, { recursive: true });

http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/frame/')) {
    const n   = req.url.split('/')[2].padStart(5, '0');
    const out = path.join(FRAME_DIR, `frame-${n}.jpg`);
    const buf = [];
    for await (const chunk of req) buf.push(chunk);
    fs.writeFileSync(out, Buffer.concat(buf));
    res.end('ok');

  } else if (req.method === 'POST' && req.url === '/done') {
    spawnSync('ffmpeg', [
      '-y', '-r', String(FPS),
      '-i', path.join(FRAME_DIR, 'frame-%05d.jpg'),
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-profile:v', 'high', '-level:v', '4.0',
      '-crf', '14', '-preset', 'medium',
      '-movflags', '+faststart', '-an',
      OUTPUT,
    ], { stdio: 'inherit' });
    res.end('done');
    process.exit(0);
  }
}).listen(9998, '127.0.0.1', () =>
  console.log('frame-receiver ready on 127.0.0.1:9998')
);
```

Run this before starting the game dev server:

```bash
node /tmp/frame-receiver.mjs &
```

---

## Capture methods comparison

| Method | Quality | Speed | CFR reliable? | Notes |
|--------|---------|-------|---------------|-------|
| `canvas.toBlob()` JPEG | Good | Fast | Yes | Preferred; low overhead |
| `canvas.toBlob()` PNG | Best | Slow | Yes | 2–3× larger; use only if JPEG artefacts visible |
| `MediaRecorder` + WebM | Variable | Realtime | No | VBR timestamps; do not use on low-fps VPS |
| Screenshot via Playwright | Good | Moderate | Yes | Works but adds Playwright overhead |

**Recommendation:** JPEG via `canvas.toBlob()` at quality 0.93–0.95. PNG only if CRF
artefacts are severe.

---

## Timing and physics rules

- **Do not use wall-clock `DT`.** Never compute `dt = Date.now() - lastFrame`. Always use `DT = 1/FPS`.
- **Camera lerp must use fixed DT.** `lerp` factor of 0.18 at DT=1/30 produces different smoothing at different DT values.
- **Wheel spin and path progress must be DT-scaled.** Any formula that uses elapsed time must use `frame * DT` or `t = frame / FPS`, not `performance.now()`.
- **Arena shader time.** Pass `frame * DT` (elapsed seconds) to any scene-time uniform — not wall-clock.
- **Do not couple movement to `requestAnimationFrame` timing** in the capture path. Remove or bypass the RAF loop entirely during offline capture.

---

## Quality gates

Before reporting a clip as captured:

- [ ] Output plays smoothly at 30fps — no visible stutter or staggered frames
- [ ] `ffprobe r_frame_rate = 30/1` (or expected FPS)
- [ ] `ffprobe avg_frame_rate = 30/1` (or close — minor tolerance for last frame)
- [ ] Frame count equals `round(duration * FPS)` ± 1
- [ ] `pix_fmt = yuv420p`
- [ ] No visible blockiness (if CRF artefacts: lower CRF or increase resolution)
- [ ] Human review decides pass/fail — do not self-approve

---

## Known failure modes

| Failure | Cause | Fix |
|---------|-------|-----|
| Jumpy motion at 30fps | SwiftShader at ~8fps; `MediaRecorder` VBR timestamps | Switch to offline frame-by-frame capture |
| `r_frame_rate=1000/1` in ffprobe | `MediaRecorder` WebM ms-resolution timebase | Offline capture + `-r 30` input flag to ffmpeg |
| Black frames in output | `preserveDrawingBuffer: false` — backbuffer cleared before `toBlob()` | Set `preserveDrawingBuffer: true` on `WebGLRenderer` |
| Camera jerks between frames | Camera smoothing tied to wall-clock DT | Always use fixed `DT = 1/FPS` for lerp |
| Blockiness / compression artefacts | CRF too high (18+) at 1080p, or too much bloom | Lower CRF (14–16), reduce bloom intensity |
| Wrong frame count | `duration` not integer-frame-aligned | Use `Math.round(duration * FPS)` |
| Frame receiver missed frames | Capture loop ran faster than receiver writes | Add await on each frame POST; receiver is synchronous |
| Output inside container, not on host | `/tmp/` paths do not cross container boundary | `docker cp` container output to VPS host before scp |

---

## Output contract

After a successful capture and encode, report:

```
Output path (container): /tmp/<clip-name>.mp4
Duration:                7.000 s
Frames:                  210
FPS (r_frame_rate):      30/1
FPS (avg_frame_rate):    30/1
Resolution:              1920×1080
Codec:                   h264
Pixel format:            yuv420p
movflags:                +faststart present
Capture method:          offline frame-by-frame (canvas.toBlob JPEG)
True CFR achieved:       yes
Known limitations:       SwiftShader; capture time ~50s for 210 frames
```

Verify with:

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,pix_fmt,r_frame_rate,avg_frame_rate,width,height,nb_frames,duration \
  -of default=noprint_wrappers=1 /tmp/<clip-name>.mp4
```
