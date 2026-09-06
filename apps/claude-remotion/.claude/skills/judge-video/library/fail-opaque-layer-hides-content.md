# FAIL · opaque-layer-hides-content

- **verdict:** FAIL (build-found; after fix the user said "bravo on fireworks")
- **surface:** FireworksFinale
- **human's words:** _(found during the build; the finale was the user's headline request — "def fireworks")_
- **date / version:** v8 (during finale assembly) → fixed same cut

## Diagnosis
`FinaleLogo` painted an **opaque full-frame `backgroundColor: "#07090f"`** and, because it rendered **last** in the finale's layer stack, it silently covered the diagram backdrop AND the firework bursts at *every* frame. Review stills came back black where the diagram and fireworks should have been. The smoke survived only because `SmokeHaze` carried a `zIndex`, which masked how total the failure was.

## Fix
Removed the opaque fill from `FinaleLogo` and lifted the lockup above the smoke with an explicit `zIndex`. Diagram + fireworks then composited correctly under the logo.

## Signature (what to detect)
- A layer with an **opaque full-frame background** (`backgroundColor`/`background: <solid>` on an `AbsoluteFill`) that renders **after** (or above) content it is meant to sit over.
- A hero beat that renders **black/empty** on a still when the record says content should be visible there.
- Z-order reasoning that depends on render order without explicit `zIndex` on the layers that must show through.

## Why this is a detector
Determinism and "no CSS-animation" were both clean here — the bug was pure **compositing/z-order**, invisible to those checks and only caught by looking at a still. A new finale or multi-layer beat that stacks an opaque fill last resembles this fail. (Stills of hero beats are the evidence; this is partly a deterministic check — "is the hero frame non-black?" — and partly human-eyes.)
