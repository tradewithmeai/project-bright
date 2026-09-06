"""gemini_video.py — vendored native-Gemini clip analysis for the studio tools.

Extracted from apps/chatty-susan/content_planner/video_analysis.py so the studio
tools (analyse_clip.py / analyse_folder.py) no longer depend on the Susan package
being importable (cwd=script-dir). Only the Gemini path is vendored — the legacy
gpt-4o-mini frame-sampling fallback and the palette coupling
(content_planner.image_analysis) are intentionally NOT carried here.

ONE native Gemini call on the whole clip → a structured slot-record-style read.
Every call logs token usage + a cost estimate into the returned record (`_usage`),
per the cost-instrumented design. NON-BLOCKING: any failure returns {}.
"""
from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path

log = logging.getLogger("content-planner.video-analysis")

# ── Gemini config + rates ─────────────────────────────────────────────────────
# Rates mirror apps/video-bright-mvp/backend/src/model-costs.ts (canonical source).
GEMINI_MODEL = os.environ.get("GEMINI_VIDEO_MODEL", "gemini-2.5-flash-lite")
# Raise Gemini's video sampling above its 1fps default for fast-cut clips. Blank = SDK
# default (no cost change); e.g. "2". Applies to the inline (<=18MB) path; costs more input tokens.
GEMINI_VIDEO_FPS = os.environ.get("GEMINI_VIDEO_FPS", "").strip()
GEMINI_IN_PER_TOK = 0.10 / 1_000_000   # $0.10 / 1M input tokens
GEMINI_OUT_PER_TOK = 0.40 / 1_000_000  # $0.40 / 1M output tokens
INLINE_MAX_BYTES = 18 * 1024 * 1024    # inline base64 under ~18MB; File API above

_GEMINI_PROMPT = (
    "Analyse this video clip for a motion-graphics editor who will build production "
    "AROUND it without watching it. Return ONLY a JSON object. Keys: "
    "summary (2-3 sentences: what it shows + visual style/mood); "
    "subject (a few words); style_mood (string); "
    "motion (static / slow pan / handheld / fast cuts / action + a short note); "
    "focal_element (what the eye lands on); "
    "on_screen_text (text ACTUALLY VISIBLE on screen — burned-in captions, titles, UI "
    'labels — transcribed verbatim; "" if none. Do NOT put spoken narration/audio here); '
    "suggested_use (how to wrap it: framing, where intro/outro/captions go); "
    "content_window (object {content_start_seconds, content_end_seconds, trim_note}: the "
    "whole-second range of USABLE footage, EXCLUDING leading/trailing dead air such as a "
    "green screen, black frames, a slate, or a static hold; trim_note = one short line on "
    'what to trim, or "" if the whole clip is usable); '
    "scenes (array of the clip's DISTINCT beats — typically 4 to 12, NOT one per second — "
    "each {timestamp_seconds, what_happens}); "
    "shots (array of the clip's distinct SHOTS for editing — each {start_seconds, end_seconds, "
    "shot_type one of wide|medium|close|insert, aroll_broll one of aroll|broll, "
    "audio_type one of speech|ambient|music|silent, "
    "technical_quality array of any of shaky|out-of-focus|green-screen|dead-air ([] if clean), "
    "keep_worthiness integer 0-10 how usable this shot is, suggested_use short string}); "
    "transcript (array of spoken dialogue lines — each {start_seconds, text} — [] if no speech; "
    "this is SPOKEN audio, distinct from on_screen_text); "
    "edit_suggestions (array of concrete edit actions — each {action one of "
    "cut|trim|stabilise|caption|reorder, target_start_seconds, target_end_seconds, "
    "why short string, priority one of high|medium|low}). "
    "Every *_seconds value MUST be a whole integer number of seconds elapsed from the start "
    "of the clip (e.g. the 1 minute 15 second mark is 75). NEVER use mm:ss, m.ss, or decimals. "
    "Be concrete and concise. No markdown."
)

# Structured-output schema (enforced via response_schema) — forces the field set and,
# critically, integer-seconds timestamps so scene/content times are never mm:ss or decimals.
_GEMINI_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "subject": {"type": "string"},
        "style_mood": {"type": "string"},
        "motion": {"type": "string"},
        "focal_element": {"type": "string"},
        "on_screen_text": {"type": "string"},
        "suggested_use": {"type": "string"},
        "content_window": {
            "type": "object",
            "properties": {
                "content_start_seconds": {"type": "integer"},
                "content_end_seconds": {"type": "integer"},
                "trim_note": {"type": "string"},
            },
        },
        "scenes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "timestamp_seconds": {"type": "integer"},
                    "what_happens": {"type": "string"},
                },
                "required": ["timestamp_seconds", "what_happens"],
            },
        },
        "shots": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start_seconds": {"type": "integer"},
                    "end_seconds": {"type": "integer"},
                    "shot_type": {"type": "string"},
                    "aroll_broll": {"type": "string"},
                    "audio_type": {"type": "string"},
                    "technical_quality": {"type": "array", "items": {"type": "string"}},
                    "keep_worthiness": {"type": "integer"},
                    "suggested_use": {"type": "string"},
                },
                "required": ["start_seconds", "end_seconds", "shot_type", "keep_worthiness"],
            },
        },
        "transcript": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start_seconds": {"type": "integer"},
                    "text": {"type": "string"},
                },
                "required": ["start_seconds", "text"],
            },
        },
        "edit_suggestions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "action": {"type": "string"},
                    "target_start_seconds": {"type": "integer"},
                    "target_end_seconds": {"type": "integer"},
                    "why": {"type": "string"},
                    "priority": {"type": "string"},
                },
                "required": ["action", "why"],
            },
        },
    },
    "required": ["summary", "subject", "style_mood", "motion", "focal_element",
                 "on_screen_text", "suggested_use", "scenes"],
}


_MIME = {".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
         ".m4v": "video/mp4", ".mkv": "video/x-matroska"}


def _gemini_video_record(video_abs_path: str) -> dict:
    """ONE native Gemini call on the whole clip → structured record + usage block.
    Returns {} on any failure (caller falls back to the gpt-4o-mini path)."""
    api_key = os.environ.get("GOOGLE_AI_KEY")
    if not api_key:
        log.info("GOOGLE_AI_KEY not set — skipping Gemini, using fallback")
        return {}
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        size = Path(video_abs_path).stat().st_size
        mime = _MIME.get(Path(video_abs_path).suffix.lower(), "video/mp4")
        cfg = types.GenerateContentConfig(response_mime_type="application/json", response_schema=_GEMINI_SCHEMA)

        if size <= INLINE_MAX_BYTES:
            data = Path(video_abs_path).read_bytes()
            part = types.Part.from_bytes(data=data, mime_type=mime)
            if GEMINI_VIDEO_FPS:
                try:
                    part.video_metadata = types.VideoMetadata(fps=float(GEMINI_VIDEO_FPS))
                except Exception as _fps_e:
                    log.warning("GEMINI_VIDEO_FPS=%s ignored: %s", GEMINI_VIDEO_FPS, _fps_e)
            resp = client.models.generate_content(
                model=GEMINI_MODEL, contents=[part, _GEMINI_PROMPT], config=cfg,
            )
        else:
            # File API for larger clips: upload, poll until ACTIVE, then reference.
            up = client.files.upload(file=video_abs_path)
            deadline = time.time() + 180
            while getattr(up, "state", None) and str(up.state).upper().endswith("PROCESSING"):
                if time.time() > deadline:
                    raise TimeoutError("Gemini File API processing timed out")
                time.sleep(2)
                up = client.files.get(name=up.name)
            resp = client.models.generate_content(
                model=GEMINI_MODEL, contents=[up, _GEMINI_PROMPT], config=cfg,
            )

        rec = json.loads(resp.text)

        u = getattr(resp, "usage_metadata", None)
        in_tok = getattr(u, "prompt_token_count", 0) or 0
        out_tok = getattr(u, "candidates_token_count", 0) or 0
        total = getattr(u, "total_token_count", 0) or (in_tok + out_tok)
        cost = in_tok * GEMINI_IN_PER_TOK + out_tok * GEMINI_OUT_PER_TOK
        rec["_usage"] = {
            "provider": "gemini",
            "model": GEMINI_MODEL,
            "input_tokens": in_tok,
            "output_tokens": out_tok,
            "total_tokens": total,
            "cost_usd": round(cost, 6),
            "delivery": "inline" if size <= INLINE_MAX_BYTES else "file_api",
        }
        log.info("Gemini video analysis ok — %d tokens, $%.6f", total, cost)
        return rec
    except Exception as exc:  # noqa: BLE001
        log.warning("Gemini video analysis failed (%s) — using fallback", exc)
        return {}
