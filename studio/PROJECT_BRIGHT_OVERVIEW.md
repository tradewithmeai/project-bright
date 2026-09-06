# Project Bright — what it is, and how it works

**One line:** a video studio where the videos are *programs*. Every frame is drawn by React code
running under Remotion, and the system measures its own output before a human is asked to watch.

---

## What it does

**You tell Claude Code what video you want, and it builds the production in code.** It writes the
animation, edits the footage, uses assets from the repository, handles graphics, typography, timing
and audio, renders the result and iterates with you.

It starts from a description like any text-to-video tool; what differs is the mechanism. Claude
authors the production rather than sampling it from a model or stitching generated clips together,
which is why real footage, repository assets, code-drawn animation and audio combine in one piece —
and why every part of the result stays editable.

Drafting, voice, music, the frame arithmetic, rendering, the records, packaging and delivery are all
automated around that. **The skills are how the production knowledge carries forward.** The same
engine currently produces:

| | |
|---|---|
| **A daily news bulletin** | AI Top 5 — a live feed becomes a rendered, voiced, 100-second countdown every morning. The one case that runs to a fixed recipe, because it was designed once and now replicates; it still stops and waits for sign-off |
| **Broadcast-spec adverts** | 30s TV spots conformed to a strict media spec (−16 LUFS, −1 dBTP, CFR 30, keyframe at 0) and delivered into another repo |
| **Campaign videos** | a single poster scanned by a virtual camera, with a character voice designed to match |
| **Client promos** | brand-pack scrape → colour/logo extraction → repeatable branded asset |
| **Personal films** | a photo story with a written voiceover and bespoke vector graphics |

## How it works

**1 · Skills, not prompts.** Procedures are written down as skills — **15 that load** (14 for video
work, plus `extract-image-layers`) — covering narrative arc, tempo, caption legibility, terminal
recreation, music scored to the cut, quality judging. A build follows the relevant skill rather than
being improvised, and new knowledge goes back into the skill, so the next video starts where the
last one finished. A further 9 procedures are written up but sit as loose `.md` files that do **not**
load as skills; they are notes, not the interface.

**2 · The window is the authority.** Every video is a frame budget first. The word count for a
voiceover is *derived* from the frames available at the presenter's measured speaking rate — not
guessed and then trimmed. When the two disagreed, code quietly amputated a sentence from every story
for four days; that is now a hard build failure.

**3 · Audio and picture share one clock.** A 124 BPM grid drives motion, cuts, music and stings from
one token file. Sections resize to fit their actual measured voiceover, rounded to whole beats, so
nothing is padded with silence and no read is clipped.

**4 · Determinism is enforced.** No clocks, no randomness, no CSS animation — a seeded hash instead.
The same inputs render the same frames, which is what makes a daily product possible at all.

**5 · It checks itself.** A deterministic suite verifies frame maths, reading floors, captions and
handoff integrity; a judge predicts the human verdict against a library of past failures and logs
predicted-versus-actual. Every render writes a record; every daily run appends a line noting what
went wrong, including the failures it recovered from.

**6 · Delivery is a bridge, not a button.** Finished videos are packaged and delivered to
**socials-studio**, which publishes to five platforms — after one human sign-off. Nothing posts by
itself, ever.

## What is distinctive

- **It writes the code that draws the frame.** Assembly of existing clips is one option among many,
  not the mechanism.
- **It measures instead of assuming** — voiceover length, loudness, thumbnail content, package
  contents on disk after delivery.
- **It records its own failures.** The run log's value is the bad days, not the good ones.

## Honest limits

**It needs an operator.** Videos are built, not requested. Someone has to decide what the video is,
pick the skills, and judge the result — and that person needs to be comfortable in a terminal and a
React codebase. If you are looking for something that turns a sentence into a finished film, this is
the wrong tool and no amount of documentation will change that.

Voice tone remains the hardest lever and succeeds perhaps a third of the time without careful
direction. Text-to-speech is not deterministic, so anything predicting a clip's length is wrong by
construction. Story *selection* for the daily bulletin lives upstream in a separate service, and it
has served the same story twice in one edition. **The human gate is load-bearing** — the judge
pre-filters, it does not approve. Nine of the written procedures do not load as skills. And every
measurement quoted here was taken on Windows.

---

*Written 2026-08-04.*
