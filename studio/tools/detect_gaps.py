#!/usr/bin/env python
"""detect_gaps.py — signal-based green-screen / black-gap detector (studio, local).

For clips recorded with green-screen (or black) filler BETWEEN real takes, this finds the
REAL footage windows deterministically by COLOUR — no semantic guessing, no timestamp drift
(unlike an LLM analysis, whose timeline can hallucinate past the clip's real duration).

Method: sample frames at N fps (downscaled), classify each as green / black / content by mean
RGB, then merge runs of 'content' into windows (dropping short slivers). Outputs a
build-clip-cut-compatible windows string ("a-b,c-d,…") + JSON, and prints a per-run timeline.

Usage (repo root, studio venv active — needs Pillow):
    python detect_gaps.py <clip> --ffmpeg <ffmpeg.exe> [--fps 2] [--min-window 2] [--json out.json]

Compose with the cutter:
    python detect_gaps.py clip.mp4 --ffmpeg ... --windows-only   # prints just "34-57,70-96"
    ...then feed that windows string to whatever cutter you use. (The build-clip-cut.mjs cutter
    this was written against lived in the retired video-bright-mvp app and does not ship here.)
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image


def resolve_ffmpeg(explicit):
    if explicit:
        return explicit
    if os.environ.get("FFMPEG"):
        return os.environ["FFMPEG"]
    # Remotion ships a full ffmpeg (with the scale filter) in its win32 compositor package — reuse it.
    bundled = (Path(__file__).resolve().parent.parent
               / "claude-remotion" / "node_modules" / "@remotion"
               / "compositor-win32-x64-msvc" / "ffmpeg.exe")
    return str(bundled) if bundled.is_file() else "ffmpeg"


def classify(path: Path):
    img = Image.open(path).convert("RGB").resize((32, 32))
    px = list(img.getdata())
    n = len(px)
    r = sum(p[0] for p in px) / n
    g = sum(p[1] for p in px) / n
    b = sum(p[2] for p in px) / n
    mx = max(r, g, b)
    if mx < 32:
        return "black", (r, g, b)
    # green screen: green channel strongly DOMINANT over red+blue. Ratio-based so it catches
    # dark forest-green fill (g~70-100) as well as bright chroma green — not an absolute floor.
    if g > 35 and g > r * 1.6 and g > b * 1.6:
        return "green", (r, g, b)
    return "content", (r, g, b)


def main() -> int:
    ap = argparse.ArgumentParser(description="Signal-based green/black gap detector")
    ap.add_argument("clip")
    ap.add_argument("--ffmpeg", default=None, help="ffmpeg binary (default: $FFMPEG, else Remotion's bundled ffmpeg, else PATH)")
    ap.add_argument("--fps", type=float, default=4.0, help="sampling rate (default 4/s — tighter gap boundaries)")
    ap.add_argument("--min-window", type=float, default=2.0, help="drop content windows shorter than this (s)")
    ap.add_argument("--merge-gap", type=float, default=1.0, help="bridge content windows separated by <= this (s)")
    ap.add_argument("--json", default=None, help="also write windows + timeline JSON here")
    ap.add_argument("--windows-only", action="store_true", help="print ONLY the a-b,c-d windows string (for piping)")
    args = ap.parse_args()

    clip = Path(args.clip)
    if not clip.is_file():
        print(f"[gaps] clip not found: {clip}", file=sys.stderr)
        return 1

    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        # Downscaled frame sample at N fps. -r as an OUTPUT option resamples the frame rate
        # (works without the fps/select filters, which stripped-down ffmpeg builds may lack).
        ffmpeg = resolve_ffmpeg(args.ffmpeg)
        cmd = [ffmpeg, "-y", "-i", str(clip), "-vf", "scale=64:-1", "-r", str(args.fps), str(tmp / "f_%05d.png")]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print(f"[gaps] ffmpeg frame extract failed:\n{r.stderr[-400:]}", file=sys.stderr)
            return 1
        frames = sorted(tmp.glob("f_*.png"))
        if not frames:
            print("[gaps] no frames extracted", file=sys.stderr)
            return 1

        labels = []  # (t_seconds, label)
        for i, f in enumerate(frames):
            t = i / args.fps
            lab, _rgb = classify(f)
            labels.append((t, lab))

    # Merge consecutive same-label runs (for the timeline print).
    runs = []
    for t, lab in labels:
        if runs and runs[-1][2] == lab:
            runs[-1][1] = t
        else:
            runs.append([t, t, lab])
    dur = labels[-1][0] + 1.0 / args.fps

    # Content windows = content runs, snapped to whole seconds INSET (ceil start / floor end) so no
    # green/black frame bleeds in at the boundary (sampling has ±1/fps edge uncertainty).
    import math
    raw = []
    for s, e, lab in runs:
        if lab != "content":
            continue
        st = math.ceil(s)
        en = math.floor(e)   # e = last content-frame time; floor keeps the fade-to-green/black OUT
        if en > st:
            raw.append((st, en))
    merged = []
    for s, e in raw:
        if merged and s - merged[-1][1] <= args.merge_gap:
            merged[-1] = (merged[-1][0], e)
        else:
            merged.append((s, e))
    windows = [(s, e) for s, e in merged if (e - s) >= args.min_window]

    win_str = ",".join(f"{s}-{e}" for s, e in windows)

    if args.windows_only:
        print(win_str)
        return 0

    print(f"\n  GAP SCAN — {clip.name}  (~{dur:.0f}s, sampled {args.fps}/s)", file=sys.stderr)
    print("  timeline (run-length):", file=sys.stderr)
    for s, e, lab in runs:
        mark = {"green": "🟩 green", "black": "⬛ black", "content": "🎬 CONTENT"}[lab]
        print(f"    {s:5.1f}–{e + 1.0/args.fps:5.1f}s  {mark}", file=sys.stderr)
    print(f"\n  CONTENT WINDOWS (min {args.min_window}s, bridged <= {args.merge_gap}s): {win_str}", file=sys.stderr)
    print(f"  {len(windows)} window(s), total ~{sum(e - s for s, e in windows)}s of {dur:.0f}s", file=sys.stderr)

    if args.json:
        Path(args.json).write_text(json.dumps({
            "clip": str(clip), "duration_seconds": round(dur, 2), "fps_sampled": args.fps,
            "windows": [{"start": s, "end": e} for s, e in windows],
            "windows_str": win_str,
            "timeline": [{"start": round(s, 2), "end": round(e + 1.0 / args.fps, 2), "label": lab} for s, e, lab in runs],
        }, indent=2), encoding="utf-8")
        print(f"  wrote {args.json}", file=sys.stderr)

    print(win_str)  # stdout = the windows string (pipeable)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
