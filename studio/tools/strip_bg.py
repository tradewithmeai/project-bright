#!/usr/bin/env python
"""strip_bg.py — key a flat/warm background out of a cartoon image -> transparent foreground.

Part of the "strip the background, do the effects in code" finale workflow: keep the foreground
(e.g. the tablet + hand silhouettes) and remove the flat background (e.g. the orange splash) so a
CODE-DRIVEN animated background (a hue-cycling manga sunburst) can sit behind it — far more
controllable than baking an exciting background into the image.

v1 keys a WARM background (orange/red): bright, clearly warmer than blue and a bit warmer than
green — which the AI Top 5 #1 tablet uses. Everything that ISN'T that (dark silhouettes, the cyan
screen) is kept. Tune the thresholds for other warm backgrounds; the general per-image bg key is a
follow-up. Zero API — pure PIL.

Usage (repo root, studio venv active):
  python strip_bg.py "<image>" --name tablet [--r-min 120 --rb 45 --rg 18] [--largest] [--outdir DIR]
"""
import argparse
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


def keep_largest_component(mask: Image.Image) -> Image.Image:
    """Keep only the largest 4-connected foreground blob (drops stray non-bg specks)."""
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
    ap.add_argument("--name", default="fg")
    ap.add_argument("--r-min", type=int, default=120, help="background red must exceed this (excludes dark foreground)")
    ap.add_argument("--rb", type=int, default=45, help="background must be warmer than blue by this (r - b)")
    ap.add_argument("--rg", type=int, default=18, help="background must be a bit warmer than green by this (r - g)")
    ap.add_argument("--largest", action="store_true", help="keep only the largest foreground blob")
    ap.add_argument("--outdir", default="<repo>/studio/projects/ai-top5/image-tests")
    args = ap.parse_args()

    p = Path(args.image)
    if not p.is_file():
        print(f"[strip] not found: {p}", file=sys.stderr)
        return 1
    im = Image.open(p).convert("RGB")
    r, g, b = im.split()

    def gt(ch: Image.Image, t: int) -> Image.Image:
        return ch.point(lambda v, t=t: 255 if v > t else 0)

    rb = ImageChops.subtract(r, b)  # max(0, r-b)
    rg = ImageChops.subtract(r, g)
    bg = ImageChops.multiply(ImageChops.multiply(gt(r, args.r_min), gt(rb, args.rb)), gt(rg, args.rg))
    fg = bg.point(lambda v: 0 if v > 0 else 255)   # keep everything that ISN'T background
    fg = fg.filter(ImageFilter.MedianFilter(3))     # tidy the key edges
    if args.largest:
        fg = keep_largest_component(fg)

    out = im.convert("RGBA")
    out.putalpha(fg)
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    out.save(outdir / f"{args.name}_fg.png")
    prev = Image.new("RGBA", im.size, (0, 200, 0, 255))
    prev.alpha_composite(out)
    prev.convert("RGB").save(outdir / f"{args.name}_fg_preview.png")

    kept = sum(fg.histogram()[1:])
    total = im.size[0] * im.size[1]
    print(f"[strip] foreground: {kept}/{total} ({100 * kept / total:.1f}%)  -> {args.name}_fg.png (+ _fg_preview.png) in {outdir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
