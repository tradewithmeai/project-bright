"""N7 failure condition: scan BACKWARD from public/, not forward from template source.

A forward scan (grep templates for staticFile(...music...)) misses every asset that is
referenced dynamically, and misses committed media no template references at all. This
enumerates what actually ships and demands each file be covered by a provenance section.
"""
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUB = "apps/claude-remotion/public"
MEDIA = re.compile(r"\.(mp3|wav|m4a|mp4|mov|webm|png|jpg|jpeg|gif|svg|glb|fbx)$", re.I)

tracked = subprocess.run(
    ["git", "ls-files", PUB], capture_output=True, text=True, cwd=ROOT
).stdout.split()
media = [f for f in tracked if MEDIA.search(f)]

docs = ""
for d in (f"{PUB}/PROVENANCE.md", f"{PUB}/audio/CREDITS.md"):
    p = ROOT / d
    if p.exists():
        docs += p.read_text(encoding="utf-8")

uncovered = []
for m in media:
    rel = m[len(PUB) + 1:]
    top = rel.split("/")[0]
    # Covered if the doc names the file, or names its top-level directory.
    if rel in docs or f"`{top}/`" in docs or f"`{top}`" in docs:
        continue
    uncovered.append(rel)

print(f"  tracked media under {PUB}: {len(media)}")
print(f"  uncovered: {len(uncovered)}")
for u in uncovered:
    print("    MISSING PROVENANCE:", u)

# Prove the check discriminates: a file that does not exist must not be reported as covered.
probe = "definitely-not-recorded-asset.mp3"
covered_probe = probe in docs
print(f"\n  discrimination probe ('{probe}' should NOT be covered): "
      f"{'FAIL - check is blind' if covered_probe else 'ok'}")

sys.exit(1 if uncovered else 0)
