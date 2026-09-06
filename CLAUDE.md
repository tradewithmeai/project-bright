# Project Bright

Read `README.md` first — it is the source of truth for what this is, what it is not, the
requirements, and the day-one path.

## The framing, which is load-bearing

**Ask for a video and Claude builds it here.** That interaction is the product, and it is meant to
be easy: a request in plain language, and Claude authors the Remotion program that satisfies it.
**The skills are how it knows how.**

What must not drift is the MECHANISM. Claude authors the production in CODE — it does not sample a
video from a model or stitch generated clips into a slideshow. That is the whole reason real
footage, repository assets, HTML/React animation, motion graphics, typography and audio can combine
in one piece, and the reason any part of the result stays editable afterwards.

⚠️ This section previously said the opposite — "there is no describe-a-video-and-get-one-back path,
and its absence is deliberate" — and told you not to add turnkey language. That was corrected on
2026-09-06 by the owner: the system can and should start from a description. Do not reinstate it.
The claims still worth defending are that nothing renders or publishes unattended, that a human
decides when a video is finished, and that the output is a program rather than an opaque file.

## Working in this repo

Video work runs from `apps/claude-remotion/`. Rendering is a local command, not a service.

| Task | Command |
|------|---------|
| Prove the install renders | `npm run hello` (no API key, no assets, no network) |
| Live preview | `npm run dev` (Remotion Studio) |
| Type check + lint | `npm run lint` |
| Check committed media is used and documented | `npm run check:assets` |
| Check the AI Top 5 musical grid has not drifted | `npm run check:grid` |
| Render a composition | `npx remotion render <CompositionId> out/<name>.mp4` |
| Check one frame fast | `npx remotion still <CompositionId> out/f.png --frame=<N> --scale=0.5` |
| Regenerate the daily edition | `node scripts/make-ai-top5.mjs --ai-script --with-audio` |

`npm run lint` must exit **0** — `tsc` and `eslint src` both clean. Keep it that way: fix the
cause rather than adding an `eslint-disable`, and do not leave a red lint for someone else to
inherit.

## Layout

| Path | What it is |
|---|---|
| `apps/claude-remotion/` | the studio — compositions, skills, scripts. Everything happens here |
| `apps/video-reviewer/` | a React review UI, served by `scripts/serve-reviewer.mjs`. Reads VIDEO_RECORD.json under `studio/projects/`, so it is empty until you build something |
| `studio/` | how the studio works: file protocol, asset records, voice registry, tools |
| `docs/` | the public product page, served by GitHub Pages. Static HTML, no build step |

## Rules for an agent operating here

- **Never render or build a video unattended.** Ask first. A question that times out means wait, not
  proceed.
- **Never run anything that can spend money without asking.** Voice, music, images and script
  generation all call paid APIs. Before running such a script, prove the environment is keyless if
  that is what you intend — `load-env.mjs` reloads keys from the repo-root `.env` regardless of the
  shell, so clearing a shell variable is *not* enough to make a run free.
- **Verify artefacts, not exit codes.** This project has shipped a de-blinding leak and a week-long
  render bug with exit code 0. When you write a check, state what input makes it FAIL *and* confirm
  correct input PASSES it. A check that cannot fail is this project's signature defect.
- **Measure, do not assume.** Do not quote a number you did not just measure, and do not carry a
  number across machines — the same render measured 260,887 B on one box and 188,869 B on another.
- **The human eye is the gate on anything visual.** "Looks better" is not "correct", and a passing
  check is not a passing render.
- **Report problems plainly.** Do not claim success you have not verified, and do not paper over a
  failure you recovered from — the recovery is the interesting part.

## Media records

**Every piece of media this studio creates gets a record. A render task is not finished until the
record is written.** The full rules are in `studio/ASSET_RECORDS.md`; the canonical format is the
`record-final-video` skill.

A final-render record states, derived from the source rather than by watching: composition id and
source file; dimensions/fps/duration; the section timeline in frames (frames are authoritative,
seconds derived at 30 fps); layers back-to-front; the palette's actual hexes; the audio lanes with
their provider, voice and settings; every asset with its provenance and licence; **the cost of every
paid call**; the commands to reproduce it; a changelog entry per version; and the operator's verdict
when it arrives. Anything the source does not state is `"Unconfirmed"` — never invented.

The record is what a judge checks a render against, so a render without one cannot be evaluated or
compared across versions. It is also the only provenance that survives, since derived media is
gitignored.

## Commits

- Commit in scoped units — one fix, one behaviour change, one documentation update. If a commit
  touches five unrelated things, split it.
- Before every commit: `git status`, then read `git diff --staged` in full, then run the relevant
  syntax/type check, then scan the diff for secrets.
- **Never commit** a `.env`, anything containing credentials, logs, generated video, or unrelated
  files that happened to be dirty.
- Commit messages: scoped and imperative. Say what changed and why it was wrong before.
- **Do not mention AI, Claude, Anthropic or agents in a commit message.**

## Environment

No key is needed for `npm run hello`, `npm run dev` or `npm run lint`. Keys are needed only when a
step calls a paid service — see `apps/claude-remotion/.env.example`.

`ANTHROPIC_API_KEY` is not used by anything here and does not need to be set. It is named only
because it used to be actively rejected: the container render worker exited 1 when it found it.
That worker has been removed, so the key is now simply ignored.

The voiceover path reserves against `PB_BUDGET_CREDITS` (default 3000) before each paid call and
refuses past it. Other paid scripts are unfenced — treat them with corresponding care.
