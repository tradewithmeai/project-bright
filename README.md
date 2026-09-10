# Project Bright

**You've seen [OpenMontage](https://github.com/calesthio/OpenMontage). Now try Project Bright.**

**Open-source agentic video production, built in code.**

[![Website](https://img.shields.io/badge/website-project--bright-ffb020?style=flat-square)](https://tradewithmeai.github.io/project-bright/)
[![clean-clone CI](https://img.shields.io/github/actions/workflow/status/tradewithmeai/project-bright/clean-clone.yml?branch=main&label=clean-clone&style=flat-square)](https://github.com/tradewithmeai/project-bright/actions/workflows/clean-clone.yml)
[![Public beta](https://img.shields.io/badge/public%20beta-v0.1.0--beta.1-4c8eda?style=flat-square)](https://github.com/tradewithmeai/project-bright/releases)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-3fa46a?style=flat-square)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-required-d97757?style=flat-square)](https://claude.com/claude-code)
[![React 19](https://img.shields.io/badge/React-19-61dafb?style=flat-square)](https://react.dev)
[![Remotion 4](https://img.shields.io/badge/Remotion-4.0.521-0b84f3?style=flat-square)](https://remotion.dev)

**[Website](https://tradewithmeai.github.io/project-bright/)** · **[What it can make](https://tradewithmeai.github.io/project-bright/#gallery)** · **[Try it](#try-it)**

A video studio where the videos are **programs**.

Tell Project Bright what video you want. Claude Code operates the studio and builds the production
itself in React + [Remotion](https://remotion.dev) — editing footage, creating animation and motion
graphics, handling typography, graphics, audio and timing, rendering the result and iterating with
you.

The result is not a black-box video you have to accept. The production is code you can open,
inspect, change, rerender and keep building.

### For example

> **You:** *"Make me a 45-second product launch video from these clips."*

Project Bright takes that brief and whatever assets you have, builds the production, renders it,
inspects the result and iterates with you. There is no prompt syntax to learn and no template to
choose — it is an ordinary sentence, and a vaguer or a much more specific one works just as well.

## Try it

```bash
git clone https://github.com/tradewithmeai/project-bright.git
cd project-bright
cd apps/claude-remotion
npm install
npm run hello
```

`npm run hello` needs no API key and no assets you have to go and find. It renders a real
composition and then checks the file it produced, so a pass means the install genuinely works.

Then **open Claude Code at the repository root and ask Project Bright to make a video, in plain
language.** You do not need to know the codebase to start, and you do not pick anything from a list.

Requirements, the spend guards and the longer walk-through are below under
[Requirements](#requirements) and [Day one](#day-one).

If you want to see where this goes, **[star the repo](https://github.com/tradewithmeai/project-bright)**. It helps other people find the beta.

## Project Bright and OpenMontage

OpenMontage was first to publicly establish open-source agentic video production as a category, and
its success showed just how much interest there is in the idea.

Project Bright was being developed independently at almost the same time. Its earliest predecessor
dates from April 2026, and the system has since been pushed through months of real production work.

The two solve broadly the same problem in broadly the same way: an AI coding agent operates a
programmable production environment. That shared idea is the substance of both projects, not a
difference to argue over.

Project Bright takes that core idea and keeps pushing it outward. Today it gives Claude a code-driven
video production studio with accumulated production skills and tooling for footage, animation,
graphics, typography, audio, timing, rendering and review.

The production itself remains editable React + Remotion code.

## How it differs from a text-to-video model

It starts from a description, the same as any of them. The difference is what happens next: Claude
authors the production **in code** rather than sampling it from a black box or stitching generated
clips into a slideshow. That is what makes real footage, repository assets, HTML/React animation,
motion graphics, typography and audio combinable in one piece — and what makes any part of the
result editable afterwards.

**The skills are how the knowledge carries forward.** A build follows the relevant skill rather than
being improvised, and what is learned goes back into the skill, so the next video starts where the
last one finished.

## What this is not

- **Nothing renders or publishes by itself.** A human decides what the video is and judges the
  result. The automated checks pre-filter; they do not approve.
- **It is not a clip assembler.** Assembling existing footage is one option among many, not the
  mechanism.
- **It is not hosted.** This runs on your machine, renders on your machine, and publishes nothing
  on its own.
- **It does not hide the code.** The production is a program in the repository. If you never want
  that to be true, this is the wrong tool.

## Where this is going

Video is the first part of the studio, not the intended boundary.

**None of the following ships in v0.1.0-beta.1.** This section is the direction of travel rather
than a capability list: every item is planned or exploratory, and no dates are attached to any of
it. What exists today is the video studio described above — that is what you get when you clone this
repository.

Planned work:

- a **Blender bridge** and a **Unity bridge**, so the same agent can drive 3D scenes and engine content
- broader **animation workflows**, with sequencing and editing of animation clips as first-class material
- **image-to-3D** model generation
- **animation and motion dataset** integration
- **unified skeleton and animation protocols**, so rigs and clips stay portable between tools
- **local automatic rigging**, operated through Claude Code
- **multi-device motion capture**

The long-term direction, in one line:

```
image -> 3D model -> rig -> animation -> scene -> finished video or game asset
```

## Requirements

- **Windows.** Every measurement in this repo was taken on Windows 11. Nothing here is known to be
  broken elsewhere, but nothing here has been tested elsewhere either, and one preflight script
  silently exits 0 on non-Windows — so treat other platforms as unverified rather than supported.
- **Node 22.** `package.json` declares `engines: { node: ">=22.0.0" }`, so npm warns below that.
  Developed and measured on v22.17.1 with npm 11.4.2; the floor states a minimum, not a tested
  ceiling. Remotion itself declares no `engines` — the constraint comes from eslint 9.
- **Clone to a short path.** Remotion's bundled `chrome-headless-shell.exe` sits about 120
  characters below the repo root, so a clone deeper than roughly 140 characters pushes it past
  Windows' 260-character `MAX_PATH` and the render dies with
  `Failed to launch the browser process! ... ENOENT` — naming an executable that is present on
  disk. This was hit for real from a 140-character path (266-character exe path). `C:\dev\bright`
  is fine; a deep folder under `AppData\Local\Temp` is not. Either shorten the path or enable
  Windows long paths.
- **Claude Code, with a subscription.** This is how the studio is used: the skills are Claude
  Code skills and they are the interface the whole system is built around. Codex would probably
  work in its place, but that is untested here — treat it as unsupported rather than as an
  option. You can still render every composition and run the checks without it; what you cannot
  do is drive the studio the way it is meant to be driven.
- **No API key to get started.** See "Day one".

## Day one

The quick start above is the whole install. Here is what it proves and what comes after it.

`npm run hello` renders a 150-frame composition that uses no API key, no assets from `public/`, no
web font and no audio — so the only thing it can prove is whether your install works. It then checks
the file it produced rather than the exit code: over the 50 KB floor, and exactly 150 frames by
`ffprobe`. A blank render measures ~14 KB and fails.

Then open the studio and look around:

```bash
npm run dev
```

`HelloWorld` is registered first in `src/Root.tsx`. Neither of these commands needs a key.

**Then make something.** Open Claude Code at the repository and tell it what video you want, in
plain language. It uses the skills and the accumulated production knowledge here to create or
modify whatever composition the request needs, then renders it so you can watch it and say what to
change.

You do not need to know the codebase to start, and you do not pick anything from a list. If you
*want* to work directly in Remotion and React — copying `src/templates/hello_world/` to a new
directory and registering it in `src/Root.tsx` — that path is open and nothing hides it.

Keys are needed only when a step calls a paid service (voice, music, images, script generation). See
`apps/claude-remotion/.env.example`, which carries two keys (`OPENAI_API_KEY`,
`ELEVENLABS_API_KEY`), the optional `PB_BUDGET_CREDITS` spend guard, and a note that
`ANTHROPIC_API_KEY` is not used by anything here.

## What is here

```
apps/claude-remotion/   the studio: Remotion compositions, the skills, the scripts
apps/video-reviewer/    a React review UI, served by claude-remotion's serve-reviewer.mjs
studio/                 how the studio works: file protocol, asset records, voice registry, tools
docs/                   the public product page (GitHub Pages) — static HTML, no build step
ops/, scripts/          operational helpers
```

### What months of production left behind

Working methods for footage editing, motion graphics, product and interface animation, musical
timing, branding, explainers, social formats and structured storytelling — the awkward parts, solved
and tested against real work. Claude reuses, combines, alters or ignores them as a request needs.
They are production machinery, not a catalogue to choose from.

Fifteen of them load as Claude Code skills: **15** (14 for video work under
`apps/claude-remotion/.claude/skills/`, plus `extract-image-layers` at the root). A skill is
production knowledge and workflow that Claude loads to do the work — you do not select one — and it
is why a new request does not start from a blank prompt.

A further **9** procedures are written up as loose `.md` files in the same directory and do **not**
load; they are notes. The distinction matters: a skill in its own directory with a `SKILL.md` is
loadable and will be used, a loose file will not be.

## Honest limits

These are known and unfixed, and are listed so you find them here rather than by surprise:

- **The reviewer has no records to show in a fresh clone.** `apps/video-reviewer/` reads
  `VIDEO_RECORD.json` files under `studio/projects/`, and no projects ship with this release, so it
  opens on an empty list until you build something. It was verified working before release: it
  builds clean, `node scripts/serve-reviewer.mjs` serves it, `GET /api/videos` went from 0 records
  to 1 when a record was placed on disk and parsed its composition and frame count, and posting a
  verdict persisted to the record. Run it with:

  ```bash
  node apps/claude-remotion/scripts/serve-reviewer.mjs      # then open the printed URL
  ```
- **Text-to-speech is not deterministic**, so anything that predicts a clip's length from its text
  is wrong by construction. The frame budget is the authority; the read is measured after the fact.
- **Voice tone is the hardest lever** and lands maybe a third of the time without careful direction.
- **The human gate is load-bearing.** The automated judge pre-filters; it does not approve.
- **Every composition in `src/Root.tsx` renders from a clean clone.** All eleven, with no key and
  no asset you have to go and find. That was not true until the consolidation passes: most of the
  55 compositions this repository once carried referenced locally generated media that was never
  committed, and the headline example died on a 404 before its first frame.
- **Spend is capped only in the voiceover path.** `PB_BUDGET_CREDITS` (default 3000) is reserved
  before each paid call there. Other paid scripts are unfenced.

## History

This repository was, until **2026-07-11**, a set of services running on a VPS — a chat-based planner
feeding a render worker feeding a video editor, deployed with Docker behind nginx. That era is over:
the server was deleted, and the planner and editor applications have been removed from this tree.
What survives is the part that was actually good — drawing frames in code, and the skills that
describe how.

The documents that carried that era's assumptions have gone with it. What is left describes the
studio as it is now.

## Licence

MIT — see [LICENSE](LICENSE).
