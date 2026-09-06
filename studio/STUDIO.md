# Studio — Operating Manual

> ⚠️ **Partly historical. Read this first, or the tool index below will waste your time.**
>
> Sections (a)–(d) describe how the studio is driven and still apply. **The tool index lists a
> number of scripts under `apps/chatty-susan/` and `apps/video-bright-mvp/`, and neither directory
> exists in this release** — those applications were retired on 2026-07-11 and removed. Any row
> whose path begins with either is a record of what the tool did, not something you can run.
>
> The tools that do exist and are runnable live in `studio/tools/` and
> `apps/claude-remotion/scripts/`. Check the path before following a row.

## (a) What the studio is

The studio is a **local video-production suite** run from the terminal. **Claude Code is the
control layer** — no web UI, no multi-user auth, no chat gate. You drive the pipeline by calling
standalone CLI tools (below), and Claude Code orchestrates them.

- **Input:** clips, stills, facts, briefs.
- **Processing:** automated pipelines chain the standalone tools — analyse clips, detect gaps, cut
  segments, transcribe, script, voice, render (Remotion).
- **Output:** rendered videos.
- **Publishing:** handled by the **separate socials-studio app**, which publishes a finished video
  to the 5 platforms. Publishing is NOT part of this suite — the studio produces the file; the
  socials app distributes it. The **handoff** between them is the publish bridge:
  `publish-handoff.mjs` (below) drops a finished-video package into socials-studio for sign-off.
  Contract: `studio/contracts/finished_video_publish_v1.md`.

  **The standard method is the `/deliver` command** (`.claude/commands/deliver.md`), not a
  hand-assembled `publish-handoff.mjs` line. Say what to send in a few words - "deliver the yourgov
  4steps", "deliver the splitfire advert" - and it resolves the render, works out
  pipeline/role/output-id from the file's aspect, writes title and description from the project
  record, shows one block for approval, delivers, VERIFIES the package on disk, and ingests. It
  stops there: publishing stays a separate human step in socials-studio. `/top5render` remains the
  AI Top 5 daily path and already includes its own delivery.

  Two facts worth knowing before hand-rolling a handoff: `--id-suffix` is REQUIRED for a second cut
  of the same edition, or the spoke silently overwrites the hero (it did, 2026-07-26); and
  `--request-id` does NOT change the package id, so it cannot be used to keep a test run away from
  a live package - point `--dest` at a scratch dir instead (verified 2026-08-03).

This replaces the retired Susan FastAPI service. The backend logic worth keeping was ported to the
tools below; the web/UI/auth/chat-gate/legacy-11-slot-template surfaces were retired. See
`studio/archive/SUSAN_BACKEND_INVENTORY.md` for the full preservation manifest.

## (b) File structure

```
studio/
  projects/     one dir per video job — inputs, intermediate artifacts, final render
  pipelines/    pipeline definitions / runbooks (e.g. ai-top5.md)
  logs/         cost / token / usage / event logs (every paid API call logs here)
  archive/      preservation manifest + retired-module record (SUSAN_BACKEND_INVENTORY.md)
```

**Logging rule:** every paid API call MUST log token usage + a cost estimate into the record /
sidecar for the job. Model this on the Gemini `_usage` block in `video_analysis.py`
(provider, model, input/output/total tokens, `cost_usd`). Never ship an API integration without it.

## (c) Tool index

Standalone tools already built for the studio (all runnable directly):

| Tool | Path | One-line usage |
|------|------|----------------|
| analyse_clip.py | `studio/tools/analyse_clip.py` | one clip → Gemini deepened analysis JSON (shots / keep_worthiness / content_window / transcript) |
| analyse_folder.py | `studio/tools/analyse_folder.py` | whole FOLDER of clips → per-clip Gemini analysis JSON + aggregated manifest + total cost log (resumable, small-first) |
| process_audit.py | `apps/chatty-susan/process_audit.py` | content-audit loop (project-bright side): reads a socials-studio audit drop (studio/audits/incoming/<id>) → Gemini catalogue + completeness/omissions → content_audit_v1 back to socials. Contract: content_audit_exchange_v1.md |
| cast_promo.py | `apps/chatty-susan/cast_promo.py` | two-pass promo build: `--mode cast` (all analyses + skeleton brief → slot casting + feasibility score + fallback) then `--mode cut` (+casting → ordered EDL with transitions/PIP) |
| extract_edl.py | `apps/chatty-susan/extract_edl.py` | cut an edl.json's segments out of the source clips (frame-accurate, native res) → per-cut files in play order; `--assembly` for a rough straight-cut concat |
| build_promo_assets.py | `apps/chatty-susan/build_promo_assets.py` | extract an edl.json's clips + PIP insets into a Remotion `public/` dir + emit `promo.config.json` (render manifest). NB: Remotion's bundled ffmpeg has NO `-vf` filters — scale in Remotion, not ffmpeg. |
| detect_gaps.py | `studio/tools/detect_gaps.py` | signal green/black gap detection → content-window string |
| transcribe.mjs | `apps/claude-remotion/scripts/transcribe.mjs` | audio/video → text (OpenAI STT; `--timestamps`) |
| build-clip-cut.mjs | `apps/video-bright-mvp/scripts/build-clip-cut.mjs` | windows/analysis → cut-plan (flexible_cut_v2 bridge), or `--extract` segment files |
| make-ai-top5.mjs | `apps/claude-remotion/scripts/make-ai-top5.mjs` | daily AI Top 5: fetch facts API → script → TTS → render hint. Also emits `data.json` (exact rendered bulletin) for the record step |
| record-ai-top5.mjs | `apps/claude-remotion/scripts/record-ai-top5.mjs` | refresh VIDEO_RECORD.{md,json} to match a rendered daily (data.json/API + ffprobe + tokens). Run AFTER render so the companion record never goes stale |
| write-script.mjs | `apps/claude-remotion/scripts/write-script.mjs` | facts → full spoken script (gpt-4o-mini) |
| generate-vo.mjs | `apps/claude-remotion/scripts/generate-vo.mjs` | TTS (OpenAI default; ElevenLabs fallback; Piper next) |
| generate-promo-vo.mjs | `apps/claude-remotion/scripts/generate-promo-vo.mjs` | per-line promo VO from a cue file (OpenAI TTS) → voN.mp3 + vo.manifest.json; cost logged |
| generate-music.mjs | `apps/claude-remotion/scripts/generate-music.mjs` | text prompt → instrumental track via ElevenLabs Music (`/v1/music`); logs credit delta. Sectioned/scored-to-cut upgrade planned (composition_plan) |
| view_image.py | `apps/chatty-susan/view_image.py` | downscale a big still/frame → small JPEG so the Read tool can view it (32MB API-cap workaround; see note below) |
| publish-handoff.mjs | `apps/claude-remotion/scripts/publish-handoff.mjs` | OUTGOING publish bridge: finished render → handoff package (video+thumb+publish.json) into socials-studio for sign-off (never auto-publishes) |
| ingest-requests.mjs | `apps/claude-remotion/scripts/ingest-requests.mjs` | RETURN bridge intake: socials-studio production requests (video_production_request_v1) → studio/requests/QUEUE.md. The marketing brain commissioning production |
| run-brand-pack.ts | `apps/video-bright-mvp/backend/scripts/run-brand-pack.ts` | standalone brand-pack capture (video-bright engine, no Express/auth/DB): `npx tsx run-brand-pack.ts <url> <outDir>` → brand_pack.json (strict/legitimacy path). NB: some sites 403-block headless (WordPress anti-bot) |
| build-brand-sting.mjs | `apps/claude-remotion/scripts/build-brand-sting.mjs` | scraped brand_pack.json → brand-sting config (colour-role assignment) for the BrandSting composition. The scrape → repeatable-asset seam |

**The 32MB image note:** "Request too large max 32MB" when reading a full-res render frame is a HARD
Anthropic Messages-API request-size limit — there is **no Claude Code / API config switch to remove it**,
and the model downsizes every image to ≤1568px internally regardless. So downscale first and read
the small copy instead. Nothing the model would have seen is lost. (The `view_image.py` helper this
was done with lived in the retired `chatty-susan` app and does **not** ship here — any
downscale-then-read step will do.)

## (d) Job recipes

Practical tool sequences. Run from repo root. Quote paths with spaces. The Python tools use the
studio venv: `.venv/Scripts/python.exe` (deps: google-genai, Pillow, python-dotenv).
Keys auto-load from the repo-root `.env`; the bundled Remotion ffmpeg/ffprobe is auto-resolved (no install).

### Clip → clean segments  (signal path — best for green/black gap removal)
```
PY=.venv/Scripts/python.exe

# 1. Detect content windows (drops green/black dead air) -> "22-27,38-43,64-87"
$PY studio/tools/detect_gaps.py "<clip>" --windows-only

# 2. Cut each window to its own clean .mp4 (audio kept)
node apps/video-bright-mvp/scripts/build-clip-cut.mjs --clip "<clip>" --windows "<windows>" --extract "<out_dir>"
```
Semantic path (Gemini shots / keep_worthiness / content_window / transcript) instead of --windows:
```
$PY studio/tools/analyse_clip.py "<clip>" --out analysis.json          # needs GOOGLE_AI_KEY
node apps/video-bright-mvp/scripts/build-clip-cut.mjs --clip "<clip>" --analysis analysis.json --plan-only   # review
node apps/video-bright-mvp/scripts/build-clip-cut.mjs --clip "<clip>" --analysis analysis.json --extract "<out_dir>"
```
⚠ Gemini reads CONTENT well but its TIMESTAMPS can drift past the real duration — prefer the signal
path (detect_gaps) for gap removal; use the semantic path for keep-worthiness selection.

### Transcribe a clip
```
node apps/claude-remotion/scripts/transcribe.mjs "<clip>"                              # -> text
node apps/claude-remotion/scripts/transcribe.mjs "<clip>" --timestamps --out t.json    # -> timed segments
```

### Daily AI Top 5
Facts → script → TTS → render. Iterate the copy for free first, then spend on TTS.
```
# from apps/claude-remotion
node scripts/make-ai-top5.mjs --ai-script                 # FREE dry-run: writes + prints the script (~$0.0004, no TTS)
node scripts/make-ai-top5.mjs --with-audio --ai-script    # + OpenAI TTS (~$0.02); prints the dated render path
npx remotion render AiTop5 out/ai-top5_<date>_ed<edition>.mp4   # use the path step 2 printed
```
Runbook: **`studio/pipelines/ai-top5.md`**. `make-ai-top5.mjs` internally uses `write-script.mjs`
(facts → spoken script) and `generate-vo.mjs` (TTS); call those directly for a script/voiceover alone.

## (e) Ported from Susan / still to port

Drawn from `studio/archive/SUSAN_BACKEND_INVENTORY.md`.

**Already ported / superseded** (use the standalone tool, not the Susan module):
- clip understanding → `analyse_clip.py` (reconcile the richer Gemini record from
  `video_analysis.py` into it — shots + transcript + content_window + edit_suggestions)
- gap detection → `detect_gaps.py`
- transcription → `transcribe.mjs`
- cut planning / segment extraction → `build-clip-cut.mjs`
- AI Top 5 → `make-ai-top5.mjs`
- scripting → `write-script.mjs`
- voiceover → `generate-vo.mjs`

**Still to port (keep-as-tool):**
- `image_analysis.extract_palette` → standalone palette tool (needed by any clip tool;
  add usage logging to `describe_image` if ported)
- `fluid_brief_exporter.py` → the live fluid brief exporter (drop container mount rewrite)
- `recipe_validator.py` → recipe-contract-v0 validator (port verbatim, dependency-free)
- `gates.py` (Gate 1 brief) + `prompts.py` + `brief_tracker.py` → a `tools/susan-brief/` brief
  builder (**add token/cost logging** — the OpenAI path currently logs none)
- `cleanup_pipeline_runs.py` → maintenance CLI in a `scripts/` dir

**Port later:**
- `session_store.py` → local `job_store.py` (drop owner/auth fields; keep atomic writes, OPEN asset
  schema, and the `meta`/`result` cost-carrier fields)

**Retired (web / auth / legacy-template / social-publish — no standalone value):**
`main.py`, `video_formats.py`, `format_checker.py`, `yaml_exporter.py`, `youtube_exporter.py`,
`youtube_publisher.py`, `pipeline.py`, `openai_client.py`, `post_log.py`, `auth_db.py`,
`auth_middleware.py`, `auth_routes.py`, `create_user.py`. Publishing moves to the separate
socials-studio app.

---
Preserved VPS data (all Susan-era records/assets/logs) tarball:
`<external-project>\pb-preserve-20260630-045000\`
