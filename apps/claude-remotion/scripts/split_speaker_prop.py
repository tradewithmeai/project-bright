#!/usr/bin/env python3
"""split_speaker_prop.py — separate the #4 speaker cabinet from the room it was extracted with.

    py scripts/split_speaker_prop.py [--dry]

THE BUG
-------
`public/era-devices/speaker_cutout.png` is drawn full-frame on top of `80s_tv_plate.png` and given
the sting rock plus a beat-locked bass-bin squash (StoryVisual, PROP tokens). The plate itself is
clean — the speaker was lifted out of it — so the layering is right and the *extraction* was not.

The original extraction kept, inside its alpha:

  * the speaker cabinet                                     — wanted
  * the cabinet's contact shadow on the floor               — wanted, but must NOT be animated
  * a slab of the amplifier / cassette-deck stack next door — not wanted at all, the plate has it

So every squash scaled the stack fragment and dragged the shadow with it, and because the plate
underneath holds the real, still stack and floor, the two disagreed on screen: the floor, the
skirting line and the stack's shadow all appeared to move. Operator caught it on the 2026-08-03 cut.

WHERE THE CUTS COME FROM (measured, not eyeballed)
--------------------------------------------------
Right edge — the mask's rightmost opaque column, row by row:

    y365..y740   x = 453   (constant — the cabinet's back edge, dead vertical)
    y765..y890   x = 483..494

The bulge starts below y755 and only below y755. That is the stack fragment, and x>453 isolates it.

Bottom edge — the mask's row widths approaching the base:

    y885..y900   left 113   right 453
    y903         left 111   right 450
    y909         left  99   right 430
    y912         left  94   right 420

The cabinet's sides are vertical, so a mask that *widens* below y903 is not cabinet — it is the
shadow splaying across the floor. y<=908 keeps the plinth and drops the splay.

THE OUTPUT
----------
  speaker_cutout.png   the cabinet alone            — animated (rock + squash), as before
  speaker_shadow.png   its contact shadow           — drawn STATIC beneath the prop
  (the stack fragment is discarded; the plate already contains that stack, in the right place)

Splitting the shadow out rather than deleting it keeps the cabinet sitting on the floor instead of
floating, while guaranteeing that the only thing any prop transform can move is the cabinet.

The original is preserved as speaker_cutout.orig.png; re-running is safe because the source is
always read from that backup once it exists.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DEVICES = os.path.join(HERE, "..", "public", "era-devices")

SRC = os.path.join(DEVICES, "speaker_cutout.png")
ORIG = os.path.join(DEVICES, "speaker_cutout.orig.png")
SHADOW = os.path.join(DEVICES, "speaker_shadow.png")

# Measured on the original 1672x941 extraction — see the docstring.
CABINET_RIGHT_X = 453   # the cabinet's back edge; anything right of this is the stack next door
CABINET_BOTTOM_Y = 908  # below this the mask widens, which only the floor shadow does
STACK_ABOVE_Y = 880     # right of the cabinet AND above this = stack fragment; below = cast shadow

ap = argparse.ArgumentParser()
ap.add_argument("--dry", action="store_true", help="report the split without writing anything")
a = ap.parse_args()

source = ORIG if os.path.exists(ORIG) else SRC
if not os.path.exists(source):
    sys.exit(f"[speaker] no source at {source}")

im = Image.open(source).convert("RGBA")
px = np.array(im)
alpha = px[:, :, 3] > 10
h, w = alpha.shape

xs = np.arange(w)[None, :].repeat(h, 0)
ys = np.arange(h)[:, None].repeat(w, 1)

cabinet = alpha & (xs <= CABINET_RIGHT_X) & (ys <= CABINET_BOTTOM_Y)
stack = alpha & (xs > CABINET_RIGHT_X) & (ys < STACK_ABOVE_Y)
shadow = alpha & ~cabinet & ~stack

print(f"[speaker] source {os.path.basename(source)}  {w}x{h}")
print(f"[speaker]   cabinet        {int(cabinet.sum()):>7d} px  -> speaker_cutout.png (animated)")
print(f"[speaker]   contact shadow {int(shadow.sum()):>7d} px  -> speaker_shadow.png (static)")
print(f"[speaker]   stack fragment {int(stack.sum()):>7d} px  -> discarded (the plate owns it)")

if not cabinet.any() or not shadow.any():
    sys.exit("[speaker] refusing to write — a layer came out empty, the constants are wrong")

if a.dry:
    print("[speaker] dry run — nothing written")
    sys.exit(0)

if not os.path.exists(ORIG):
    Image.open(SRC).save(ORIG)
    print(f"[speaker]   original preserved as {os.path.basename(ORIG)}")


def write(mask, path):
    out = px.copy()
    out[:, :, 3] = np.where(mask, px[:, :, 3], 0)
    Image.fromarray(out).save(path)
    print(f"[speaker]   wrote {os.path.basename(path)}")


write(cabinet, SRC)
write(shadow, SHADOW)
