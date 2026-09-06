# Remotion Lab Foundation

## Purpose

Remotion Lab is a research and production environment for structured AI-assisted video composition. It is not a prompt-to-video system.

The objective is to discover repeatable scene systems that:
- look visually strong with limited creator assets,
- can be directed by AI through structured specifications,
- and can later integrate with Susan's campaign planning pipeline.

**Remotion is the rendering engine, the composition framework, and the experimentation platform.**

---

## Philosophy

Bad approach:
```
Prompt → magical AI video
```

Correct approach:
```
Structured campaign idea
→ scene_spec.json
→ reusable composition template
→ rendered output
```

The system favours repeatability, modularity, and controlled experimentation over novelty.

---

## Relationship to Susan

Susan is the campaign planning layer. Remotion Lab is the visual execution research layer.

Susan eventually outputs:
- campaign direction and platform strategy
- hooks, storyboard intent, media requirements
- scene specifications (scene_spec.json)

Remotion Lab interprets those into:
- Remotion compositions and scene timing
- transitions, overlays, rendered media

The bridge between systems: `scene_spec.json`

Susan must not directly control low-level animation behaviour.

---

## Target Content

- YouTube Shorts and Bluesky promotional clips
- Developer content, gameplay showcases, AI-assisted devlogs
- Technical/social hybrid short-form vertical video

Not films, not long-form editing, not cinematic production.

---

## Asset Assumptions

Creators typically have: gameplay clips, screenshots, terminal recordings, UI captures, logos, code snippets, bug footage, rough recordings — **limited but rich**.

The system therefore favours:
- authenticity and proof over polish
- movement and layered composition over static beauty
- graceful fallback when footage is absent

---

## Layering System

Professional output comes primarily from **layer interaction**, not footage quality.

A scene may contain:
- background video (or gradient fallback)
- masked/cropped video fragments
- angular shape panels
- text overlays with staggered reveal
- foreground overlays and captions
- CTA elements

---

## Motion Philosophy

Motion must:
- support emphasis and guide attention
- reinforce pacing
- be frame-driven (never CSS transitions or animations)

Motion must not:
- exist for spectacle
- overwhelm readability
- create visual chaos

Preferred: smooth, intentional, directional, reusable.

---

## Template Research Targets

### 1. Triangle Split Promo ← current
Fullscreen video background, central angular text panel, side accent slices, layered captions, CTA ending. Target: developer promo, short-form ad, devlog trailer.

### 2. Devlog Breakdown ← next
Gameplay/UI footage, floating code/terminal panels, animated technical callouts, progress indicators, structured explanations.

### 3. Chaos Reel ← future
Fast cuts, bug highlights, aggressive emphasis, humour framing, motion-heavy pacing, strong CTA close.

---

## Standardisation Priorities

These must be consistent across all templates:
- fonts (display + monospace)
- caption behaviour and timing
- colour system (dark base + accent)
- transition timing and easing curves
- CTA structure and placement
- motion density conventions
- layout spacing system

Without this, template quality collapses into inconsistency.

---

## Experimentation Structure

Every experiment preserves:
```
experiments/
  experiment_name/
    experiment.md   ← goals, observations, decisions
    scene_spec.json ← structured input used
    notes.md        ← manual review notes
    render.mp4      ← output (gitignored)
```

This creates institutional memory for visual systems.

---

## Scene Specification Direction

Long-term output moves toward structured scene specs:

```json
{
  "template": "triangle_split_promo",
  "duration_seconds": 20,
  "style": "technical_chaos",
  "assets": { "primary_video": "", "logo": "", "audio": "" },
  "text": { "hook": "", "middle": "", "proof": "", "cta": "" },
  "timing": { "intro_seconds": 3, "middle_seconds": 14, "outro_seconds": 3 }
}
```

The spec describes intent, not animation code. Susan writes specs. Remotion Lab renders them.

---

## Research Questions

- What layouts create perceived production quality?
- What motion systems increase clarity without chaos?
- What scene structures improve engagement for technical content?
- What can AI reliably direct? What should remain template-controlled?
- What pacing works best for short-form developer content?

---

## Near-Term Priorities

1. Stabilise Remotion workflow and dev tooling
2. Build and validate Triangle Split Promo template
3. Build Devlog Breakdown template
4. Test same content across different templates
5. Refine timing, pacing, and layer interaction
6. Establish reusable CTA system
7. Define stable scene_spec.json schema
8. Feed findings back into Susan's storyboard generation
