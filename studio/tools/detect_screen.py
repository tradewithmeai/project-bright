#!/usr/bin/env python
"""detect_screen.py — find the flat solid-colour "screen" region in a cartoon device image.

The TV/tablet/projector images have a flat solid keyable screen colour (default bright cyan).
This detects that region and returns the "known points" the video app needs to land a news image
on it: bounding rect (px + fraction of image), centre, aspect. Also writes a MARKED overlay so a
human can verify the detection. Zero API — pure PIL (like detect_gaps.py).

Runs at FULL resolution by default (accurate edges), and keeps only the LARGEST connected screen
region so stray keyable-colour pixels elsewhere (an EQ "peak level" meter, a status LED, a reflection)
can't inflate the bounding box. The colour mask is vectorised (PIL channel ops), so full-res is fast;
the connected-component pass is the same 4-connectivity BFS used by extract_by_diff.

Usage (repo root, studio venv active):
  python detect_screen.py "<image>" [--out marked.png] [--json out.json] [--colour cyan|green|magenta]
    [--scale S] [--no-largest]
"""
import argparse
import json
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

# Screen-colour matchers — bright, saturated, distinct from muted decor. (r,g,b) -> bool.
# Kept for reference/parity; detection uses the vectorised equivalents in colour_mask().
MATCHERS = {
    "cyan":    lambda r, g, b: b > 200 and g > 165 and r < 120,
    "green":   lambda r, g, b: g > 180 and r < 120 and b < 140,
    "magenta": lambda r, g, b: r > 190 and b > 160 and g < 120,
}

# Per-channel thresholds (lo = value must exceed, hi = value must be below) for each colour.
THRESHOLDS = {
    "cyan":    {"r": ("hi", 120), "g": ("lo", 165), "b": ("lo", 200)},
    "green":   {"r": ("hi", 120), "g": ("lo", 180), "b": ("hi", 140)},
    "magenta": {"r": ("lo", 190), "g": ("hi", 120), "b": ("lo", 160)},
}


def colour_mask(img: Image.Image, colour: str) -> Image.Image:
    """Vectorised binary mask (L, 0/255) of pixels matching the screen colour."""
    chans = dict(zip("rgb", img.split()))
    parts = []
    for ch_name, (kind, val) in THRESHOLDS[colour].items():
        ch = chans[ch_name]
        if kind == "lo":
            parts.append(ch.point(lambda v, t=val: 255 if v > t else 0))
        else:
            parts.append(ch.point(lambda v, t=val: 255 if v < t else 0))
    m = parts[0]
    for p in parts[1:]:
        m = ImageChops.multiply(m, p)  # 255 only where every channel passes
    return m


def keep_largest_component(mask: Image.Image) -> Image.Image:
    """Keep only the largest 4-connected region (the screen); drop stray keyable pixels."""
    w, h = mask.size
    md = bytearray(mask.tobytes())
    seen = bytearray(w * h)
    best: list[int] = []
    for start in range(w * h):
        if md[start] and not seen[start]:
            q = deque([start]); seen[start] = 1; comp = [start]
            while q:
                i = q.popleft(); x = i % w; y = i // w
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if md[j] and not seen[j]:
                            seen[j] = 1; q.append(j); comp.append(j)
            if len(comp) > len(best):
                best = comp
    clean = bytearray(w * h)
    for i in best:
        clean[i] = 255
    return Image.frombytes("L", (w, h), bytes(clean))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--out", default=None, help="marked overlay path (default: <image>_marked.png)")
    ap.add_argument("--json", default=None)
    ap.add_argument("--colour", default="cyan", choices=list(THRESHOLDS))
    ap.add_argument("--scale", type=float, default=1.0, help="detect at this scale (1.0 = full res, accurate edges)")
    ap.add_argument("--no-largest", action="store_true", help="keep ALL matching pixels (skip largest-region cleanup)")
    args = ap.parse_args()

    p = Path(args.image)
    if not p.is_file():
        print(f"[screen] not found: {p}", file=sys.stderr)
        return 1
    full = Image.open(p).convert("RGB")
    W, H = full.size
    if args.scale != 1.0:
        small = full.resize((max(1, int(W * args.scale)), max(1, int(H * args.scale))))
    else:
        small = full

    mask = colour_mask(small, args.colour)
    if not args.no_largest:
        mask = keep_largest_component(mask)

    bbox_small = mask.getbbox()
    if bbox_small is None:
        print(f"[screen] no '{args.colour}' region found — check the screen colour/threshold", file=sys.stderr)
        return 1

    inv = 1.0 / args.scale
    x0, y0, x1, y1 = (int(round(v * inv)) for v in bbox_small)
    # getbbox's right/bottom are exclusive; clamp to image.
    x1 = min(x1, W); y1 = min(y1, H)
    rw, rh = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    changed = sum(mask.histogram()[1:])
    coverage = changed / (mask.size[0] * mask.size[1])

    res = {
        "image": str(p), "image_size": [W, H], "colour": args.colour,
        "screen_px": {"x": x0, "y": y0, "w": rw, "h": rh, "cx": cx, "cy": cy},
        "screen_frac": {"x": round(x0 / W, 4), "y": round(y0 / H, 4),
                        "w": round(rw / W, 4), "h": round(rh / H, 4),
                        "cx": round(cx / W, 4), "cy": round(cy / H, 4)},
        "screen_aspect": round(rw / rh, 3) if rh else None,
        "coverage_pct": round(coverage * 100, 1),
    }
    print(json.dumps(res, indent=2))

    out = Path(args.out) if args.out else p.with_name(p.stem + "_marked.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    marked = full.copy()
    d = ImageDraw.Draw(marked)
    d.rectangle([x0, y0, x1, y1], outline=(255, 0, 0), width=6)
    d.line([cx - 24, cy, cx + 24, cy], fill=(255, 0, 0), width=4)
    d.line([cx, cy - 24, cx, cy + 24], fill=(255, 0, 0), width=4)
    marked.save(out)
    print(f"[screen] marked overlay -> {out}", file=sys.stderr)
    if args.json:
        Path(args.json).write_text(json.dumps(res, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
