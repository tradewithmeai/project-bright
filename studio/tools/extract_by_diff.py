#!/usr/bin/env python
"""extract_by_diff.py — isolate an ADDED element by comparing two images (base vs base+element).

The "hard to remove, easy to add" workflow: GPT adds one item to a scene; this diffs the two
frames, keeps only the region that changed, and writes that as a TRANSPARENT PNG layer (ready to
composite + animate in Remotion). Also writes a mask + a magenta-backed preview so a human can
judge how clean the extraction is. Zero API — pure PIL.

Usage (repo root, studio venv active):
  python extract_by_diff.py "<base.png>" "<base+item.png>" --name chair [--thresh 45] [--outdir DIR]
"""
import argparse
import sys
from pathlib import Path

from collections import deque

from PIL import Image, ImageChops, ImageFilter


def keep_largest_component(mask: Image.Image) -> Image.Image:
    """Keep only the largest 4-connected white blob (the added element); drop scattered noise."""
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


def fill_holes(mask: Image.Image) -> Image.Image:
    """Fill fully-enclosed background holes inside the mask (for SOLID opaque props).

    Flood-fills the OFF pixels reachable from the image border = the true background;
    any OFF pixel NOT reachable is an enclosed hole (e.g. a dark cabinet panel that
    matched the wall behind it) -> set it ON. Perfect for solid speakers/TVs/tables.
    Do NOT use for props with genuine see-through gaps (chair legs, grilles) — those
    open to the border so they stay OFF, but a fully-enclosed gap would be filled in.
    """
    w, h = mask.size
    md = bytearray(mask.tobytes())
    bg = bytearray(w * h)
    q = deque()
    for x in range(w):                       # seed from top + bottom rows
        for i in (x, (h - 1) * w + x):
            if not md[i] and not bg[i]:
                bg[i] = 1; q.append(i)
    for y in range(h):                       # seed from left + right cols
        for i in (y * w, y * w + w - 1):
            if not md[i] and not bg[i]:
                bg[i] = 1; q.append(i)
    while q:
        i = q.popleft(); x = i % w; y = i // w
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h:
                j = ny * w + nx
                if not md[j] and not bg[j]:
                    bg[j] = 1; q.append(j)
    out = bytearray(w * h)
    for i in range(w * h):
        if md[i] or not bg[i]:               # object OR enclosed hole
            out[i] = 255
    return Image.frombytes("L", (w, h), bytes(out))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("plus")
    ap.add_argument("--name", default="element")
    ap.add_argument("--thresh", type=int, default=28, help="per-pixel diff magnitude to count as changed (low enough to catch item parts that match the bg, e.g. brown legs on a brown floor)")
    ap.add_argument("--no-largest", action="store_true", help="keep all changed regions (skip largest-blob cleanup)")
    ap.add_argument("--fill-holes", action="store_true", help="fill fully-enclosed holes (SOLID opaque props: speakers/TVs/tables; NOT props with see-through gaps like chair legs)")
    ap.add_argument("--erode", type=int, default=0, help="shrink the mask N px inside the true edge (ANIMATE-grade: removes the background halo ring that otherwise travels with a moving prop; ~2-3 for solid props, ~1 for thin-legged ones)")
    ap.add_argument("--outdir", default="<repo>/studio/projects/ai-top5/image-tests")
    args = ap.parse_args()

    bp, pp = Path(args.base), Path(args.plus)
    for f in (bp, pp):
        if not f.is_file():
            print(f"[diff] not found: {f}", file=sys.stderr)
            return 1
    base = Image.open(bp).convert("RGB")
    plus = Image.open(pp).convert("RGB")
    if base.size != plus.size:
        print(f"[diff] sizes differ (base {base.size} vs plus {plus.size}) — resizing base to plus", file=sys.stderr)
        base = base.resize(plus.size)

    # Difference magnitude → binary mask → despeckle.
    diff = ImageChops.difference(base, plus).convert("L")
    mask = diff.point(lambda p: 255 if p > args.thresh else 0)
    mask = mask.filter(ImageFilter.MedianFilter(5))       # kill isolated regeneration speckle
    mask = mask.filter(ImageFilter.MaxFilter(7))          # close small holes/gaps in the element

    if not args.no_largest:
        mask = keep_largest_component(mask)               # drop scattered regeneration noise
    if args.fill_holes:
        mask = fill_holes(mask)                           # solid props: close interior holes that matched the bg
    if args.erode > 0:
        mask = mask.filter(ImageFilter.MinFilter(2 * args.erode + 1))  # pull the matte inside the edge (kill the halo)

    changed = sum(mask.histogram()[1:])  # count non-zero mask pixels
    total = mask.size[0] * mask.size[1]
    bbox = mask.getbbox()

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    # 1) mask viz
    mask.save(outdir / f"{args.name}_mask.png")
    # 2) transparent element (plus, alpha = mask)
    elem = plus.convert("RGBA")
    elem.putalpha(mask)
    elem.save(outdir / f"{args.name}_cutout.png")
    # 3) magenta-backed preview (so a human can see the cut cleanly)
    preview = Image.new("RGBA", plus.size, (255, 0, 255, 255))
    preview.alpha_composite(elem)
    preview.convert("RGB").save(outdir / f"{args.name}_preview.png")

    print(f"[diff] changed pixels: {changed}/{total} ({100*changed/total:.1f}%)  bbox: {bbox}")
    print(f"[diff] wrote {args.name}_cutout.png (transparent), _mask.png, _preview.png to {outdir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
