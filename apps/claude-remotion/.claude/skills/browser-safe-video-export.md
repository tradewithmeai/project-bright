# browser-safe-video-export

**Status:** Documented — mandatory for all MP4 output  
**Slug:** `browser-safe-video-export`

---

## Purpose

Ensure every MP4 produced by gameplay capture, Remotion rendering, manual
stitching, or any ffmpeg step is playable in Chrome, Safari, Firefox, and
Video Bright. A non-browser-safe export silently fails for end users.

Apply these rules to every final clip and every preview clip. There are no
exceptions for "internal" or "test" outputs — a clip that cannot play in a
browser cannot be reviewed.

---

## When to use

- Assembling a frame image sequence into MP4 (offline deterministic capture)
- Re-encoding any clip whose `pix_fmt` or `moov` position is unknown
- Stitching multiple clips together
- Any Remotion video slot (`v1`, `v2`, `v3`) exported via `npx remotion render`
- Any preview MP4 shared with a human reviewer
- Any MP4 uploaded to Video Bright or served from `render.solvx.uk`

---

## TEST-008 browser bug

In TEST-008 the full assembled Bang Bop Cars video could not play in Chrome,
Safari, or Firefox.

**Root cause:** `npx remotion render` defaulted to H.264 High 4:4:4 Predictive
profile (`yuv444p`). Remotion did not enforce pixel format, so the hardware
encoder or software encoder chose `yuv444p` for quality. Most browsers only
hardware-decode H.264 up to High profile 4.1 (`yuv420p`).

**Fix:** `renderSlot()` in the container render path now passes `--pixel-format yuv420p`
to every `npx remotion render` call. `validateAsset()` runs an ffprobe
`pix_fmt` check and throws a hard error if the output is not `yuv420p`.

**Lesson:** Never assume the encoder's default pixel format is browser-safe.
Always specify `-pix_fmt yuv420p` explicitly.

---

## Required MP4 settings

| Setting | Required value | Why |
|---------|---------------|-----|
| Video codec | `h264` / `libx264` | Universal browser support |
| Pixel format | `yuv420p` | Browsers only hardware-decode yuv420p for H.264 |
| Fast start | `-movflags +faststart` | `moov` atom at front; required for inline streaming |
| Frame rate | 30fps CFR (or match source) | Browsers play VFR unreliably |
| Dimensions | Even width and height | libx264 requires even dimensions |
| Audio | Optional; `-an` for no audio | Silence or absent audio is fine for clip previews |
| Profile | `high` | Broad compatibility at 1080p |
| Level | `4.0` or `4.1` | 4.0 safe for all devices at 1080p30 |

---

## Standard ffmpeg command — image sequence → MP4

Use this for all offline deterministic capture output:

```bash
ffmpeg -y \
  -r 30 \
  -i "/tmp/frames/frame-%05d.jpg" \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
  -c:v libx264 \
  -pix_fmt yuv420p \
  -profile:v high \
  -level:v 4.0 \
  -crf 14 \
  -preset medium \
  -movflags +faststart \
  -an \
  /tmp/output.mp4
```

**Flag notes:**
- `-r 30` on the input sets the image sequence frame rate, giving true `30/1` CFR output.
- `scale=trunc(iw/2)*2:trunc(ih/2)*2` forces even dimensions without changing content.
- `-crf 14` is sharper than the default 18; use 16–18 for quick passes, 14 for review/final.
- `-preset medium` balances speed and file size; use `fast` or `ultrafast` for rapid tests.

---

## Re-encode command — fix an existing file

Use when `ffprobe` shows wrong `pix_fmt`, missing `faststart`, or unknown codec:

```bash
ffmpeg -y \
  -i input.mp4 \
  -c:v libx264 \
  -pix_fmt yuv420p \
  -profile:v high \
  -level:v 4.0 \
  -crf 16 \
  -preset fast \
  -movflags +faststart \
  -an \
  output-browser.mp4
```

---

## Stitch / concat command — join clips in sequence

Use when concatenating multiple approved clips:

```bash
# Step 1 — write file list
cat > /tmp/concat.txt << 'EOF'
file '/tmp/clip-a.mp4'
file '/tmp/clip-b.mp4'
EOF

# Step 2 — demux concat + re-encode for compatibility
ffmpeg -y \
  -f concat -safe 0 -i /tmp/concat.txt \
  -c:v libx264 \
  -pix_fmt yuv420p \
  -profile:v high \
  -level:v 4.0 \
  -crf 14 \
  -preset medium \
  -movflags +faststart \
  -an \
  /tmp/stitched.mp4
```

Do not use `-c:v copy` on concat unless both clips have identical codec,
resolution, pixel format, and frame rate — mismatches cause dropped frames.

---

## Quality defaults

| Use case | CRF | Preset | Resolution |
|----------|-----|--------|------------|
| Final clip for review or V2 | 14 | medium | 1920×1080 |
| Preview still or quick pass | 18 | fast | 1920×1080 |
| Rapid iteration test | 20 | ultrafast | 1280×720 |
| Stitched / final sequence | 14 | medium | 1920×1080 |

If compression blockiness appears in 1080p output at CRF 14, the cause is
usually heavy bloom post-processing. Reduce bloom strength in the renderer
rather than lowering CRF further (CRF < 12 produces diminishing returns and
very large files).

---

## Validation — required ffprobe checks

Run after every encode. Report these values in the output contract:

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,pix_fmt,r_frame_rate,avg_frame_rate,width,height,nb_frames,duration \
  -of default=noprint_wrappers=1 \
  /tmp/output.mp4
```

**Required values:**

| Field | Required |
|-------|----------|
| `codec_name` | `h264` |
| `pix_fmt` | `yuv420p` |
| `r_frame_rate` | `30/1` (or source FPS) |
| `avg_frame_rate` | `30/1` (or close) |
| `width` | Even number, matches target |
| `height` | Even number, matches target |
| `nb_frames` | Matches `round(duration * fps)` |

Check for `faststart` (moov atom at front):

```bash
ffprobe -v trace -i /tmp/output.mp4 2>&1 | grep -m1 'moov\|mdat'
# Expected: moov appears before mdat
```

---

## Common failures

| Failure | Symptom | Fix |
|---------|---------|-----|
| `yuv444p` output | Video plays in VLC but not Chrome/Safari | Re-encode with `-pix_fmt yuv420p` |
| `moov` atom at end | Video does not start until fully downloaded; spinner hangs | Re-encode with `-movflags +faststart` |
| Variable frame rate | Playback speed appears wrong; audio sync issues | Re-encode from image sequence with `-r 30` input flag |
| Odd width or height | libx264 error; render fails | Add `scale=trunc(iw/2)*2:trunc(ih/2)*2` filter |
| Blockiness / artefacts | CRF too high, or heavy bloom | Lower CRF (14–16), reduce renderer bloom |
| File is huge | CRF too low (< 10) | Use CRF 14 for final; 18 for preview |
| File not on host | Output is inside container `/tmp/` | `docker cp` to VPS then `scp` to local |

---

## Copy / download workflow

Container output paths (`/tmp/...`) are not visible on the VPS host.
Always copy files explicitly:

```bash
# 1. Copy from container to VPS host
docker cp <render-container>:/tmp/clip-name.mp4 /srv/project-bright/clip-name.mp4

# 2. Download from VPS to local machine
scp user@vps-hostname:/srv/project-bright/clip-name.mp4 ~/Downloads/clip-name.mp4
```

Never assume a path inside the container equals the same path on the host.

---

## Output contract

After every successful encode, report:

```
Container output path: /tmp/<clip-name>.mp4
Host output path:      /srv/project-bright/<clip-name>.mp4  (after docker cp)
codec_name:            h264
pix_fmt:               yuv420p
r_frame_rate:          30/1
avg_frame_rate:        30/1
width × height:        1920×1080
nb_frames:             210
duration:              7.000 s
movflags:              faststart confirmed (moov before mdat)
browser-safe:          YES

docker cp command:
  docker cp <render-container>:/tmp/<clip-name>.mp4 /srv/project-bright/<clip-name>.mp4

scp command:
  scp user@vps-hostname:/srv/project-bright/<clip-name>.mp4 ~/Downloads/<clip-name>.mp4
```
