# Shot-Skill Library — Claude Code

**These are NOT ChatGPT Skills.**

This directory contains reusable shot-pattern documentation for the
`repo_code_gameplay_clip_reconstruction` capability. They are internal
reference files, written for a containerised render path that is no longer part of this repo.
They describe how to construct, configure, and capture a specific cinematic
camera shot from a game's real renderer using the virtual gameplay studio
approach validated in TEST-009 and TEST-010.

The intended consumer is a future `/generate-gameplay-clip` Claude Code command
(or equivalent) that reads a scene spec, selects an appropriate shot pattern,
builds the corresponding harness in the game repo, runs offline deterministic
capture, and returns a reviewed clip.

---

## Relationship to `repo_code_gameplay_clip_reconstruction`

The parent capability doc is at:
`docs/capabilities/repo-code-gameplay-clip-reconstruction.md`

That document describes the full architecture. This directory contains the
per-shot specifications that live beneath it. Think of the capability doc as the
factory spec and these files as the individual tool blueprints.

---

## Shot Catalogue

| Slug | File | Status | Test |
|------|------|--------|------|
| `trailing_follow_camera` | [trailing-follow-camera.md](trailing-follow-camera.md) | **Approved** | TEST-009 pass4 |
| `front_to_back_arc_flyover` | [front-to-back-arc-flyover.md](front-to-back-arc-flyover.md) | **Approved** | TEST-009 arc pass2 |
| `stationary_car_360_orbit` | [stationary-car-360-orbit.md](stationary-car-360-orbit.md) | **Approved** | TEST-010 orbit pass2 |
| `multi_car_side_pass` | [multi-car-side-pass.md](multi-car-side-pass.md) | **Useful / approved, not original intent** | TEST-010 multicar pass1 |
| `overhead_lane_approach` | [overhead-lane-approach.md](overhead-lane-approach.md) | **Approved / communication note** | TEST-010 multicar pass3 |

### Status notes

- `trailing_follow_camera` and `front_to_back_arc_flyover`: clean first-class
  approvals. Proven stable across multiple passes.
- `stationary_car_360_orbit`: approved after adjusting H and R from preview
  stills. Solid showroom shot.
- `multi_car_side_pass`: the shot that appeared when the camera was placed
  outside the circle looking inward. Human reviewer described it as "useful"
  but noted it was not the intended overhead-lane shot. Kept as a valid named
  pattern in its own right.
- `overhead_lane_approach`: achieved on pass 3 after two incorrect camera
  placements. The root cause was that natural-language descriptions of spatial
  intent ("camera above the cars, cars approach") are lossy when translated
  into 3D geometry. The fix required explicit tangent-direction math and the
  key rule "do NOT lookAt the circle centre." See the communication note below.

---

## Communication / Abstraction Issue

Natural language spatial descriptions are lossy when translated to 3D camera
geometry. "Camera above the cars, cars approach" produced three different shots
before the geometry was specified precisely.

**Rule for future shot authoring:** always express camera intent in terms of:

1. Camera XYZ position in world space
2. lookAt XYZ in world space (not a conceptual target like "the centre")
3. Which direction the subject moves relative to the camera's forward vector
4. Whether the dot product of subject velocity and camera-to-subject direction is positive (approaching) or negative (receding)

When a human reviewer says "that's not the right shot," the fastest path is:
compare the actual camera position and lookAt against the intended geometry,
not iterate on prose descriptions.

---

## Future: Virtual Studio Concept

Current workflow requires Claude to construct camera geometry from text prompts
and verify via preview stills. This is slow (2–4 iteration passes per shot).

A future virtual studio interface could provide:
- Stage/arena selection
- Subject spawning at defined positions
- Camera rig placement via preset + parameter sliders
- Path preview (wireframe overlay of camera and subject paths)
- One-click preview capture (4 stills, ~90 seconds)
- Shot pattern library selector

Claude should retain creative control within approved shot-pattern boundaries:
selecting which patterns fit the scene spec, tuning parameters within the
tested ranges, and verifying obstacle clearance. The virtual studio would
reduce the geometry-description round-trips, not remove Claude from the loop.

---

## Next Step

Combine these shot patterns into a `/generate-gameplay-clip` Claude Code
command that:

1. Reads a clip brief (subject, mood, duration, preferred pattern)
2. Selects a shot pattern from this library
3. Builds or extends the virtual studio harness in the game repo
4. Runs obstacle clearance check and preview-still gate
5. Runs full offline deterministic capture
6. Returns clip path for human review

Do not bake this command until at least one stitched sequence using multiple
shot patterns has passed human review (see TEST-010 stitching goal).
