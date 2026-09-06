#!/usr/bin/env python
"""check_read.py — does the audio actually say what the script says it says?

Catches ONE failure: a voiceover file that does not match its authored text — a stale take left
behind after a rewrite, or the wrong file wired into the wrong lane. That failure ships silently,
because a wrong-but-fluent read sounds perfectly fine.

Deliberately narrow, and the narrowness is the design:

  * ONE verdict. MISMATCH below a containment of 0.55, OK at or above it. No warning tier, no
    score to interpret. A gate with three outcomes gets argued with; a gate with two gets fixed.

  * It compares against the AUTHORED text, which you pass in, not against whatever the generator
    recorded it had said. Recording the text at synthesis time makes the check pass on the exact
    bug it exists to catch: when a fitting step drops a trailing sentence and re-synthesises, the
    recorded text is the amputated text, so it matches the audio perfectly.

  * Containment, not similarity. It asks "how much of the authored line is present, in order",
    so a correct read that was legitimately trimmed to fit its frame budget still passes, while a
    different take fails. Word-error-rate would fail the first as loudly as the second.

The 0.55 threshold sits in a wide empty gap. Measured 2026-08-08 over the ten how-it-works
voiceover lanes, model `base`, comparing each lane against its authored line and then against a
neighbour's line:

    correct pairings   0.938 - 1.000   (10/10 OK)
    wrong pairings     0.000 - 0.273   (10/10 MISMATCH)

Nothing landed between 0.273 and 0.938, which is why one threshold with no warning tier is
enough. If a future corpus lands inside that gap, re-measure and move the threshold deliberately
rather than nudging it until the run goes green.

KNOWN LIMIT, stated because it is easy to mistake for coverage: containment asks how much of the
AUTHORED line is present, so audio containing EXTRA speech still passes. A take from before a
script was shortened scores high against the shortened text. This catches missing and wrong
content, not surplus.

Usage:
    py studio/tools/check_read.py --audio <file.mp3> --script "the authored line"
    py studio/tools/check_read.py --audio <file.mp3> --script-file <path.txt>
    py studio/tools/check_read.py --manifest <lanes.json>   # [{"audio": ..., "script": ...}, ...]

Options:
    --model small|base|tiny   (default: base — CPU, no GPU required)
    --threshold 0.55
    --json                    machine-readable output
    --sidecar                 write <audio>.read-check.json beside each file

Exit codes: 0 all lanes OK · 1 at least one MISMATCH · 2 bad usage or missing dependency
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

THRESHOLD_DEFAULT = 0.55
_WORD = re.compile(r"[a-z0-9']+")

# Spoken-form substitutions, so an authored numeral is not counted as missing when the reader
# says it aloud. Deliberately small: this is a containment check, not a normaliser.
_SPOKEN = {
    "1": "one", "2": "two", "3": "three", "4": "four", "5": "five",
    "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten",
    "&": "and", "%": "percent",
}


def words(text: str) -> list[str]:
    text = text.lower()
    for k, v in _SPOKEN.items():
        text = text.replace(k, f" {v} ")
    return _WORD.findall(text)


def containment(authored: list[str], heard: list[str]) -> tuple[float, int]:
    """Fraction of authored words present IN ORDER in the transcript.

    Longest common subsequence, not a greedy forward pointer. A greedy pointer stalls forever on
    the first word it cannot match: measured here, a read differing from its script by the single
    word "socials" -> "social" scored 0.062 instead of ~0.94, because every later word was then
    compared against a word that never came again. One transcription slip must not read as a
    completely different take.

    Subsequence rather than set membership: order carries meaning, and a bag-of-words match would
    pass a scrambled take that happened to share vocabulary.

    Returns (ratio, matched_count).
    """
    if not authored:
        return 0.0, 0
    if not heard:
        return 0.0, 0
    # Row-wise LCS; sentence-length inputs, so the quadratic cost is irrelevant.
    prev = [0] * (len(heard) + 1)
    for a in authored:
        cur = [0]
        for j, h in enumerate(heard):
            cur.append(prev[j] + 1 if a == h else max(cur[j], prev[j + 1]))
        prev = cur
    matched = prev[-1]
    return matched / len(authored), matched


def transcribe(model, path: pathlib.Path) -> str:
    segments, _info = model.transcribe(str(path), beam_size=1, language="en")
    return " ".join(s.text for s in segments).strip()


def main() -> int:
    ap = argparse.ArgumentParser(description="Verify a voiceover matches its authored script.")
    ap.add_argument("--audio")
    ap.add_argument("--script")
    ap.add_argument("--script-file")
    ap.add_argument("--manifest", help='JSON list of {"audio": path, "script": text}')
    ap.add_argument("--model", default="base")
    ap.add_argument("--threshold", type=float, default=THRESHOLD_DEFAULT)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--sidecar", action="store_true")
    args = ap.parse_args()

    lanes: list[dict] = []
    if args.manifest:
        lanes = json.loads(pathlib.Path(args.manifest).read_text(encoding="utf-8"))
    elif args.audio:
        script = args.script
        if args.script_file:
            script = pathlib.Path(args.script_file).read_text(encoding="utf-8")
        if not script:
            print("error: --script or --script-file is required with --audio", file=sys.stderr)
            return 2
        lanes = [{"audio": args.audio, "script": script}]
    else:
        print("error: pass --audio or --manifest", file=sys.stderr)
        return 2

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("error: faster-whisper is not installed.  pip install faster-whisper", file=sys.stderr)
        return 2

    model = WhisperModel(args.model, device="cpu", compute_type="int8")

    results, worst = [], 1.0
    for lane in lanes:
        p = pathlib.Path(lane["audio"])
        if not p.exists():
            results.append({"audio": str(p), "verdict": "MISMATCH", "reason": "file not found",
                            "containment": 0.0})
            worst = 0.0
            continue
        heard = transcribe(model, p)
        authored_w, heard_w = words(lane["script"]), words(heard)
        ratio, matched = containment(authored_w, heard_w)
        verdict = "OK" if ratio >= args.threshold else "MISMATCH"
        worst = min(worst, ratio)
        r = {
            "audio": str(p), "verdict": verdict, "containment": round(ratio, 3),
            "matched_words": matched, "authored_words": len(authored_w),
            "threshold": args.threshold, "heard": heard,
        }
        results.append(r)
        if args.sidecar:
            p.with_suffix(p.suffix + ".read-check.json").write_text(
                json.dumps(r, indent=2) + "\n", encoding="utf-8")

    failed = [r for r in results if r["verdict"] == "MISMATCH"]
    if args.json:
        print(json.dumps({"results": results, "failed": len(failed)}, indent=2))
    else:
        for r in results:
            mark = "OK      " if r["verdict"] == "OK" else "MISMATCH"
            print(f"  {mark}  {r['containment']:.3f}  {pathlib.Path(r['audio']).name}")
            if r["verdict"] == "MISMATCH":
                print(f"            authored: {r.get('authored_words', '?')} words, "
                      f"matched {r.get('matched_words', '?')} in order")
                if r.get("heard"):
                    print(f"            heard   : {r['heard'][:120]}")
        print(f"\n  {len(results) - len(failed)}/{len(results)} lanes OK "
              f"(threshold {args.threshold}, lowest {worst:.3f})")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
