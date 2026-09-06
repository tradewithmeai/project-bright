Deliver a finished video to the socials-studio queue for sign-off, from a short phrase.

Argument: **** — a few words naming what to deliver, e.g. `yourgov 4steps`, `splitfire advert`,
`example-client promo`, `bangbop vertical`. If empty, ask which video and stop.

The point of this command is that the operator never restates
`--video/--pipeline/--output-id/--role/--title/--desc/--audience` again. You work them out, show
them, and wait for a yes.

**This command never publishes.** It delivers into the queue and stops. Publishing is a separate,
human-triggered step in socials-studio.

Working directory for every command below: `apps/claude-remotion`

---

## 1. Resolve the render

Match the phrase against `out/*.mp4`, newest first. Ignore anything with `SUPERSEDED`, `test`, or
`-probe` in the name.

- Exactly one plausible match → use it.
- Several → list them with date, duration and size, and **ask which**. Do not guess between two
  cuts of the same video; picking the wrong one publishes the wrong edit.
- None → say so and stop.

If the phrase names an explicit path, use that.

## 2. Work out the rest

| field | how |
|---|---|
| `--pipeline` | the project slug from the phrase (`yourgov`, `splitfire`, `bangbop`, `example-client`, `ai-top5`) |
| `--role` | probe the file: 16:9 → `hero`, 9:16 or 1:1 → `spoke`. A spoke that promotes a hero in the same set also needs `--promotes <hero output_id>` |
| `--output-id` | platform-ish id for this cut: `yt-hero`, `ig-spoke`, `tiktok-spoke`. Match the aspect |
| `--audience` | `own` by default. `client` ONLY if the phrase says client/deliverable, plus `--client <name>`. A build-in-public showcase of client work is still `own` |
| `--title` / `--desc` | see below |
| `--brand` | if `studio/brand-packs/bp-<name>/` matches the subject, pass its brand json |

Probe with:
```
node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe -v error \
  -select_streams v:0 -show_entries stream=width,height -show_entries format=duration \
  -of default=nw=1 <video>
```

**Title and description.** `ai-top5` builds its own from `data.json` — pass neither. Everything else
is the generic path, where `--title`/`--desc` default to the filename, which is not deliverable. So
read `studio/projects/<slug>/` (its record, plan or brief) and write a real title and description
from it. Keep the description to what the project actually is; invent no claims, no metrics, no
release dates. If the project folder gives you nothing to work from, say so and ask rather than
writing filler.

## 3. Show it and STOP

Print one block and wait for an explicit yes:

```
DELIVER          <basename>
  size/duration  37.6 MB · 130.0s · 1920x1080
  pipeline       yourgov          role hero        output-id yt-hero
  audience       own              client —
  id             <the handoff id this will land under>
  title          <title>
  description    <first 2 lines…>
  → $SOCIALS_STUDIO_DIR\handoffs\incoming\<id>
```

Do not run the delivery before the operator answers. A timed-out or unanswered question means WAIT,
not proceed.

## 4. Deliver

```
node scripts/publish-handoff.mjs --video <path> --pipeline <slug> \
  --output-id <id> --role <role> [--promotes <hero>] [--audience client --client <name>] \
  [--title "…"] [--desc "…"] [--brand studio/brand-packs/bp-<name>/brand.json] [--id-suffix <s>]
```

**Two traps, both of which have cost a real delivery:**

- **`--id-suffix` is required for a second cut of the same edition.** The handoff id is derived from
  the pipeline and the bulletin/filename — NOT from `--request-id`. Delivering a spoke without a
  suffix resolves to the same id as the hero and silently overwrites it. That happened on
  2026-07-26: a 37 MB hero was replaced by a 1.4 MB spoke and the tool printed success both times.
- **`--request-id` does not change the id.** Verified 2026-08-03 — a run with a distinct
  `--request-id` still wrote to the live `ai-top5-20260803-ed1` package and overwrote it. If you are
  testing, point `--dest` at a scratch directory that contains a `handoffs/incoming/` folder.

## 5. Verify — do not trust the green line

The tool prints success even when it has overwritten something. Check on disk:

- the package directory exists and holds `video.mp4`, `thumb.jpg`, `publish.json`
- `video.mp4` size matches what you delivered (a hero must be tens of MB; ~1 MB means a spoke
  overwrote it — re-deliver the hero with a suffix and re-verify)
- `publish.json` carries the expected `output_id`, `role`, `audience`, `client`
- the `thumb: picked t=…s` line looks sane for the cut

## 6. Ingest

```
cd $SOCIALS_STUDIO_DIR && py ingest_handoffs.py
```

Confirm the package appears in the printed list and report its status verbatim. `requested` is
correct and expected — status is derived from the campaign post, and only becomes `published` when
the publisher writes its `posted_ids`. Re-running is idempotent.

**Then stop.** Report what was delivered, the full path on its own line, and anything that looked
wrong. Do not approve, post, or publish.
