#!/usr/bin/env python
"""make-qr.py — reusable QR-code generator (studio tool).

Generates a high-quality PNG QR code locally (no external service). Reused across the studio for
CTAs, posters, and video end-cards.

Usage:
  python studio/tools/make-qr.py <url> -o <out.png>
  python studio/tools/make-qr.py https://yourgov.solvx.uk -o apps/claude-remotion/public/yourgov/campaign/yourgov-qr.png
  python studio/tools/make-qr.py <url> -o <out.png> --box 16 --border 4 --fg "#111827" --bg "#ffffff" --ec H

Options:
  --box <int>     pixels per module (default 16 → crisp for video/print)
  --border <int>  quiet-zone modules (default 4; keep >=4 for reliable scanning)
  --fg <hex>      foreground/module colour (default black #000000)
  --bg <hex>      background colour (default white #ffffff; use "transparent" for alpha)
  --ec <L|M|Q|H>  error correction (default M; use H if placing a logo over the centre)
"""
import argparse
import sys
import qrcode
from qrcode.constants import ERROR_CORRECT_L, ERROR_CORRECT_M, ERROR_CORRECT_Q, ERROR_CORRECT_H

EC = {"L": ERROR_CORRECT_L, "M": ERROR_CORRECT_M, "Q": ERROR_CORRECT_Q, "H": ERROR_CORRECT_H}


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate a QR-code PNG locally.")
    ap.add_argument("url", help="the URL/text to encode")
    ap.add_argument("-o", "--out", required=True, help="output PNG path")
    ap.add_argument("--box", type=int, default=16, help="pixels per module (default 16)")
    ap.add_argument("--border", type=int, default=4, help="quiet-zone modules (default 4)")
    ap.add_argument("--fg", default="#000000", help="module colour (default black)")
    ap.add_argument("--bg", default="#ffffff", help="background colour, or 'transparent'")
    ap.add_argument("--ec", default="M", choices=list(EC), help="error correction L/M/Q/H (default M)")
    args = ap.parse_args()

    qr = qrcode.QRCode(
        version=None,  # auto-fit the data
        error_correction=EC[args.ec],
        box_size=args.box,
        border=args.border,
    )
    qr.add_data(args.url)
    qr.make(fit=True)

    transparent = args.bg.lower() == "transparent"
    img = qr.make_image(
        fill_color=args.fg,
        back_color=(0, 0, 0, 0) if transparent else args.bg,
    )
    if transparent:
        img = img.convert("RGBA")

    img.save(args.out)
    px = img.size[0]
    print(f"[make-qr] {args.url!r} -> {args.out}  ({px}x{px}px, ec={args.ec}, box={args.box}, border={args.border})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
