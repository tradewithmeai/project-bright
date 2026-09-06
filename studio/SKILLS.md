# Skills inventory

**The skills are the interface.** A build follows the relevant skill rather than being
improvised, and what you learn goes back into the skill, so the next video starts where the
last one finished.

⚠️ **`loads` is the distinction that matters.** A skill in its own **directory** with a
`SKILL.md` is loadable and will be used. A loose `.md` file in the same directory is a written
procedure that does **not** load — it is a note, not the interface. Both are listed below,
separately, because conflating them is how the previous version of this file came to be wrong
in both directions at once.

**15 load. 9 do not.**

*This file is generated from the tree. If you add a skill, regenerate it rather than
hand-editing, or it will drift again.*

## Skills that load

| skill | where | what it does |
|---|---|---|
| `build-film-section` | video work | End-to-end build loop that turns ONE narrative section of the MyGov campaign film into a built, review-gated Remotion section — composing the sibling skills (capture-first product footage, the diagram… |
| `diagram-flythrough` | video work | Turn a static high-res system diagram (or a DOM/SVG rebuild of one) into a visual node map a virtual camera flies across — lighting one node at a time and (optionally) handing off into product footage… |
| `edl-scored-music` | video work | Compose a music track TO the cut — timed sections via the ElevenLabs composition plan so a drop lands on an exact video frame — then mix it against voiceover with a constant bed + speech duck. |
| `explainer-arc` | video work | Structure an explainer video as a proven narrative arc — Hook → Problem → Solution → Proof/Demo → CTA — and map each beat to a frame budget. |
| `footage-moment-triage` | video work | Turn raw screen-recorded footage (minutes to hours) into owner-approved cut candidates via a two-pass Gemini analysis — a cheap coarse index over proxies, then a 30s-chunk fine pass that finds ACTION… |
| `improve-skills` | video work | The maintenance skill-skill. |
| `judge-video` | video work | Predict whether a rendered Remotion video would clear the human approval gate — BEFORE a person watches it — so the human reviews fewer, better candidates and iteration-rounds-to-approval falls. |
| `make-product-footage` | video work | Put a real product screen on screen in motion for a Remotion cut. |
| `message-triggered-animation` | video work | In a silent caption-driven Remotion video, bind a chosen IMPORTANT caption's drop frame to fire both a small TriggerPulse flash on/near the caption AND the start of a target animation (code stream, pa… |
| `record-final-video` | video work | Read a multi-layer Remotion template (3-4 AbsoluteFill layers) and emit a precise text + JSON record of every layer, motion, colour, focal element, timing, and 11-slot id — so an agent understands a r… |
| `remotion-best-practices` | video work | Best practices for Remotion - Video creation in React |
| `silent-caption-system` | video work | The discipline and component contract for telling a SILENT MyGov video entirely through on-screen captions — every narration idea becomes a readable Title / Kicker / Subtitle / Label on a per-scene ca… |
| `terminal-recreation` | video work | Recreate real developer tool terminal/app interfaces as high-fidelity Remotion components — frame-based, animated, composable. |
| `video-tempo` | video work | Pace a silent, caption-driven video with a varied "train" rhythm — steady cadence that eases off into important moments and accelerates away — instead of uniform slowness. |
| `extract-image-layers` | repo root | Turn a generated cartoon SCENE image into layered video assets — isolate an added prop as a clean transparent layer (the "add then diff" method), and locate the flat-colour SCREEN as a known landing t… |

## Written procedures that do NOT load

These are notes. To make one an interface, move it into its own directory as `SKILL.md`.

| procedure | where | what it covers |
|---|---|---|
| `browser-safe-video-export.md` | video work | browser-safe-video-export |
| `campaign-poster-video.md` | video work | Turn ONE precise landscape campaign image (a comic/meme advert poster) into a short, high-energy video — a virtual camera scans/cuts up the single still in sync with a shouty character voiceover writt… |
| `feasibility-rejection-gate.md` | video work | feasibility-rejection-gate |
| `iterative-output-lab.md` | video work | Iterative Output Lab |
| `multiformat-story-video.md` | video work | Turn a set of 4 art-directed story images into ONE short video rendered in MULTIPLE formats (16:9 + 9:16) from a single composition. |
| `offline-deterministic-capture.md` | video work | offline-deterministic-capture |
| `produce-v2-request.md` | video work | Action a video_production_request_v1 (v2, outputs[]) from socials-studio end-to-end — ingest the request, render every output (hero + spokes) via the right pipeline, deliver each with the grouping key… |
| `recolourable-wordmark.md` | video work | Build a brand wordmark ONCE as a font-based vector component with colour as props — so every colourway is a preset and any new colour is a one-line change, vector-crisp at any size (no raster blockine… |
| `repo-product-still-extractor.md` | video work | Repo Product Still Extractor |
