#!/usr/bin/env python
"""analyse_clip.py — standalone single-clip Gemini analysis → JSON (studio, local).

One native Gemini call on a clip → the deepened structured record (summary, shots[] with
keep_worthiness, content_window, transcript, edit_suggestions, scenes) written to JSON. This
is the input that apps/video-bright-mvp/scripts/build-clip-cut.mjs consumes to propose a cut.

It calls the vendored gemini_video._gemini_video_record (extracted from
content_planner.video_analysis) — the same engine Susan uses on uploaded clips — so the
schema/prompt/cost are identical, with none of the asset-extraction scaffolding analyse_video needs.

Run with the studio venv python (needs google-genai):
    $env:GOOGLE_AI_KEY = "..."          # required (paid Gemini call; cost is logged)
    .venv/Scripts/python.exe studio/tools/analyse_clip.py <clip.mp4> [--out analysis.json]

Cost: ~$0.005-0.02 for a short clip (gemini-2.5-flash-lite). Usage/cost is in the JSON's _usage
block and printed to stderr (always-log-API-cost rule).
"""
import argparse
import json
import logging
import os
import sys
from pathlib import Path

# Load the monorepo-root .env (the local studio's keys) so GOOGLE_AI_KEY persists across sessions.
# A key already set in the shell wins (override=False). Repo root = studio/tools → studio → root.
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)
except Exception:  # python-dotenv absent is non-fatal — the shell env still works
    pass

logging.basicConfig(level=logging.INFO, format="%(message)s")


def main() -> int:
    ap = argparse.ArgumentParser(description="Single-clip Gemini analysis → JSON")
    ap.add_argument("clip", help="path to the video clip (mp4/mov/webm/mkv)")
    ap.add_argument("--out", default=None, help="output JSON path (default: <clip>.analysis.json)")
    args = ap.parse_args()

    clip = Path(args.clip)
    if not clip.is_file():
        print(f"[analyse-clip] clip not found: {clip}", file=sys.stderr)
        return 1
    if not os.environ.get("GOOGLE_AI_KEY"):
        print("[analyse-clip] GOOGLE_AI_KEY not set — required for the Gemini call.", file=sys.stderr)
        return 2

    # Import after the key check so the failure message is clean.
    from gemini_video import _gemini_video_record

    print(f"[analyse-clip] analysing {clip.name} via Gemini …", file=sys.stderr)
    rec = _gemini_video_record(str(clip.resolve()))
    if not rec:
        print("[analyse-clip] Gemini returned nothing (check key/quota/clip). See log above.", file=sys.stderr)
        return 1

    usage = rec.get("_usage") or {}
    if usage:
        print(
            f"[analyse-clip] cost: {usage.get('total_tokens','?')} tokens "
            f"~${usage.get('cost_usd','?')} ({usage.get('model','?')}, {usage.get('delivery','?')})",
            file=sys.stderr,
        )
    n_shots = len(rec.get("shots") or [])
    cw = rec.get("content_window") or {}
    print(
        f"[analyse-clip] shots={n_shots}  "
        f"content_window={cw.get('content_start_seconds','?')}-{cw.get('content_end_seconds','?')}s  "
        f"transcript_lines={len(rec.get('transcript') or [])}  "
        f"edit_suggestions={len(rec.get('edit_suggestions') or [])}",
        file=sys.stderr,
    )
    if n_shots == 0 and not cw:
        print("[analyse-clip] WARNING: no shots[] and no content_window — build-clip-cut needs one of these.", file=sys.stderr)

    out = Path(args.out) if args.out else clip.with_suffix(clip.suffix + ".analysis.json")
    out.write_text(json.dumps(rec, indent=2), encoding="utf-8")
    print(f"[analyse-clip] wrote {out}", file=sys.stderr)
    print(str(out))  # stdout = the path, so it can be piped/captured
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
