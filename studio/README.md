# Studio — local video production suite

Owner at the controls, Claude Code as the control layer. This directory is the operational home:
produce videos here, log every run, publish via the **socials-studio** app (separate repo, 5 platforms).

- **`STUDIO.md`** — the operating manual: the tool index + job recipes + pipelines. Read it first.
- **`projects/`** — one folder per video job (`source/ clips/ analysis/ brief/ renders/` + `record.md`).
  Big media is gitignored; the text metadata (analysis, transcript, brief, record) is versioned.
- **`pipelines/`** — automated pipeline recipes (e.g. `ai-top5.md`): the tool sequence from source → render → publish.
- **`logs/`** — central append-only cost/token/run log (the always-log-API-cost discipline, one place).
- **`archive/`** — the Susan-backend preservation manifest + pointers to the preserved VPS data tarballs.

The production tools live in `apps/` (where their relative paths + bundled ffmpeg resolve); `STUDIO.md` indexes them.
