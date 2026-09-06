#!/usr/bin/env python
"""analyse_folder.py — Gemini analysis across a whole FOLDER of clips (studio, local).

Drives the same engine as analyse_clip.py (the vendored gemini_video._gemini_video_record)
over every video in a folder, writing one <stem>.analysis.json per clip plus an aggregated
manifest (JSON + markdown) and a total-cost line into studio/logs/. Built for the exploratory
"feed the google model a stack of files" pass (e.g. a folder of location footage).

Design for a long, unattended run on a low usage budget:
  - RESUMABLE: skips a clip whose .analysis.json already exists (rerun to continue).
  - SMALL-FIRST: processes ascending by size so quota/time exhaustion still leaves the most files
    done; the one huge clip is attempted last.
  - ROBUST: a per-clip failure is logged and the batch continues.

Run with Susan's venv python (needs google-genai + GOOGLE_AI_KEY in the repo-root .env):
    .venv/Scripts/python.exe studio/tools/analyse_folder.py "<folder>" --out-dir "<dir>"
"""
import argparse
import json
import os
import sys
import time
import traceback
from pathlib import Path

# The Windows console default (cp1252) can't encode our progress glyphs (→ ✔ ·); force UTF-8.
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)
except Exception:
    pass

VIDEO_EXTS = {".mov", ".mp4", ".m4v", ".webm", ".mkv", ".avi"}
REPO_ROOT = Path(__file__).resolve().parents[2]
LOG_DIR = REPO_ROOT / "studio" / "logs"


def human(n):
    for u in ["B", "KB", "MB", "GB"]:
        if n < 1024:
            return f"{n:.0f}{u}"
        n /= 1024
    return f"{n:.0f}TB"


def main() -> int:
    ap = argparse.ArgumentParser(description="Gemini analysis over a folder of clips → per-clip JSON + manifest")
    ap.add_argument("folder", help="folder of video clips")
    ap.add_argument("--out-dir", required=True, help="where to write <stem>.analysis.json + manifest")
    ap.add_argument("--largest-first", action="store_true", help="process biggest first (default: smallest first)")
    ap.add_argument("--retries", type=int, default=5, help="attempts per clip on empty/503 (transient overload), with backoff")
    args = ap.parse_args()

    folder = Path(args.folder)
    if not folder.is_dir():
        print(f"[folder] not a directory: {folder}", file=sys.stderr)
        return 1
    if not os.environ.get("GOOGLE_AI_KEY"):
        print("[folder] GOOGLE_AI_KEY not set — required for Gemini.", file=sys.stderr)
        return 2

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    clips = sorted(
        [p for p in folder.iterdir() if p.suffix.lower() in VIDEO_EXTS and p.is_file()],
        key=lambda p: p.stat().st_size,
        reverse=args.largest_first,
    )
    if not clips:
        print(f"[folder] no video files in {folder}", file=sys.stderr)
        return 1

    from gemini_video import _gemini_video_record

    def analyse_with_retry(clip_path: str):
        """_gemini_video_record swallows transient 503s and returns falsy; retry with backoff."""
        for a in range(args.retries):
            rec = _gemini_video_record(clip_path)
            if rec:
                return rec
            if a < args.retries - 1:
                wait = min(60, 8 * (a + 1))  # 8,16,24,32,40s …
                print(f"    empty/overloaded — retry {a + 1}/{args.retries - 1} in {wait}s …", flush=True)
                time.sleep(wait)
        return None

    print(f"[folder] {len(clips)} clip(s), total {human(sum(c.stat().st_size for c in clips))}", flush=True)
    manifest = []
    total_cost = 0.0
    total_tokens = 0
    t_start = time.time()

    for i, clip in enumerate(clips, 1):
        out = out_dir / (clip.stem + ".analysis.json")
        if out.exists():
            print(f"[{i}/{len(clips)}] SKIP (done): {clip.name}", flush=True)
            try:
                rec = json.loads(out.read_text(encoding="utf-8"))
            except Exception:
                rec = {}
        else:
            print(f"[{i}/{len(clips)}] {clip.name} ({human(clip.stat().st_size)}) → Gemini …", flush=True)
            t0 = time.time()
            try:
                rec = analyse_with_retry(str(clip.resolve()))
            except Exception as e:  # noqa: BLE001
                print(f"    ! FAILED: {e}", flush=True)
                traceback.print_exc()
                manifest.append({"file": clip.name, "error": str(e)})
                continue
            if not rec:
                print("    ! Gemini returned nothing (key/quota/format?)", flush=True)
                manifest.append({"file": clip.name, "error": "empty result"})
                continue
            out.write_text(json.dumps(rec, indent=2), encoding="utf-8")
            print(f"    ✔ {time.time()-t0:.0f}s → {out.name}", flush=True)

        usage = rec.get("_usage") or {}
        cost = float(usage.get("cost_usd") or 0)
        toks = int(usage.get("total_tokens") or 0)
        total_cost += cost
        total_tokens += toks
        cw = rec.get("content_window") or {}
        summary = (rec.get("summary") or "")[:240]
        manifest.append({
            "file": clip.name,
            "size": human(clip.stat().st_size),
            "summary": summary,
            "shots": len(rec.get("shots") or []),
            "content_window": cw,
            "transcript_lines": len(rec.get("transcript") or []),
            "edit_suggestions": rec.get("edit_suggestions") or [],
            "cost_usd": cost,
            "tokens": toks,
            "model": usage.get("model"),
            "delivery": usage.get("delivery"),
        })
        print(f"    running cost: ~${total_cost:.3f} ({total_tokens} tok)", flush=True)

    # Aggregated manifest.
    man_json = out_dir / "manifest.json"
    man_json.write_text(json.dumps({
        "folder": str(folder),
        "clips": len(clips),
        "total_cost_usd": round(total_cost, 4),
        "total_tokens": total_tokens,
        "elapsed_s": round(time.time() - t_start, 1),
        "items": manifest,
    }, indent=2), encoding="utf-8")

    lines = [f"# Gemini folder analysis — {folder.name}", "",
             f"- clips: {len(clips)}",
             f"- total cost: **~${total_cost:.3f}**  ({total_tokens} tokens)",
             f"- elapsed: {time.time()-t_start:.0f}s", ""]
    for m in manifest:
        if m.get("error"):
            lines += [f"## {m['file']} — ERROR: {m['error']}", ""]
            continue
        cw = m.get("content_window") or {}
        lines += [
            f"## {m['file']}  ({m.get('size','?')})",
            f"{m.get('summary','')}",
            f"- shots: {m['shots']}  ·  keep-window: {cw.get('content_start_seconds','?')}-{cw.get('content_end_seconds','?')}s"
            f"  ·  transcript lines: {m['transcript_lines']}  ·  cost ~${m.get('cost_usd',0):.3f}",
        ]
        for s in (m.get("edit_suggestions") or [])[:5]:
            lines.append(f"  - edit: {s}")
        lines.append("")
    (out_dir / "manifest.md").write_text("\n".join(lines), encoding="utf-8")

    # Cost log (always-log-API-cost rule).
    with (LOG_DIR / "api-usage.log").open("a", encoding="utf-8") as f:
        f.write(json.dumps({
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "tool": "analyse_folder.py", "provider": "google", "folder": folder.name,
            "clips": len(clips), "total_cost_usd": round(total_cost, 4), "total_tokens": total_tokens,
        }) + "\n")

    print(f"[folder] DONE. {len(clips)} clips, ~${total_cost:.3f} total. Manifest: {man_json}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
