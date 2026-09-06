# AI TOP 5 — Design Bible (broadcast-standard rebuild)

Status: canonical design for the flagship rebuild. Grounded in the code that ships
today at `apps/claude-remotion/src/templates/ai_top5/` and `apps/claude-remotion/scripts/`.
Where the source dimension-designs contradicted the code, this bible resolves to the
code and says so. Build to THIS document; it supersedes the individual dimension notes.

---

## 0. Facts this bible is built on (verified against the repo, 2026-07-01)

These four points were asserted wrongly (or inconsistently) in the input designs. They
are resolved here **once** so nothing downstream re-litigates them.

1. **The composition is LANDSCAPE 1920×1080 — and STAYS landscape (OWNER DECISION 2026-07-01, overrides the design agents).**
   `src/Root.tsx` registers `AiTop5` at `width={1920} height={1080}`, and `Background.tsx:14-15`
   hardcodes `W=1920 / H=1080`. The design agents assumed/authored PORTRAIT; the owner chose to
   **KEEP landscape 1920×1080** (matches the current comp; delivery includes landscape platforms).
   **DECISION: NO orientation change — Build-Plan step 1 is a no-op confirm, not a rebuild.**
   ⚠️ CONSEQUENCE: every pixel offset in §2.2 / §3 / §6 was authored for a 1080-wide PORTRAIT canvas
   and must be **RE-AUTHORED for the 1920-wide × 1080-tall LANDSCAPE canvas** as each motion step is
   built (Phase D). Ring 560px, whip 160px, per-word Y, element positions — all portrait values; treat
   them as *intent*, not literal landscape coordinates. The STRUCTURE/timing (§2.1, §2.3), AUDIO (§4),
   VO engine (§5), palette (§6.2), and consistency system (§9) are orientation-INDEPENDENT and hold as
   written. Keep the existing landscape layout of `StoryCard`/`ColdOpen`/`SignOff` and ENHANCE it,
   rather than re-flowing to portrait.

2. **There is ONE rank→accent heat ramp. It lives in `tokens.ts`. Nothing else owns colour.**
   Three conflicting ladders existed (data.ts `{5:#818cf8,4:#fbbf24,3:#34d399,2:#f472b6,1:#38bdf8}`
   — non-monotonic, blue #1; a brand-dim ramp with cyan #1; a motion-dim ramp with
   hot-pink #1). And `ColdOpen.tsx:9` hardcodes `ACCENT="#22d3ee"` labelled "story #1"
   while data #1 is `#38bdf8` — already broken.
   **DECISION: one monotonic cool→hot ramp, `#1` is the hottest/brightest (§6).**
   `make-ai-top5.mjs:26` currently *writes* `accent` into every story in `data.ts`, so a
   token alone is not enough — the **writer must read the token** or daily regen silently
   reverts the palette. Build Plan step 2 fixes both the token and the writer.

3. **`ffmpeg` is NOT portably bundled. Resolve it per-platform with a PATH fallback.**
   `transcribe.mjs:45-51` hardcodes `node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe`
   and falls back to bare `ffmpeg` on PATH. `assemble-video-record.mjs` calls bare
   `ffmpeg` (PATH). The Linux container render path (removed) ships a *different* compositor
   package (`compositor-linux-x64-*`), so the literal win32 `.exe` path does not exist
   there. **A real `resolveFfmpeg()` is required** (§4.4): `FFMPEG_BIN` env override →
   `compositor-<platform>-<arch>` folder probe → bare `ffmpeg` on PATH. And VO concat
   must degrade to **news-only** if ffmpeg is genuinely absent, so a missing binary can
   never produce a silent story.

4. **There is NO live hook/news overlap bug to "fix".**
   The shipped composition already plays exactly ONE `<Audio src={staticFile(story.vo)}>`
   per story from a single mp3 (`AiTop5Composition.tsx:64-75`), and `generate-vo.mjs:133-135`
   already writes one mp3 per story. The two-beat split is **net-new structure** — it
   ADDS a hook beat and uses baked silence to prevent a NEW overlap the split itself would
   create. We keep the single-clip-per-story contract precisely so the split stays
   invisible to the composition. Framing it as a bug-fix is dropped.

---

## 1. Vision + feel

**AI TOP 5** is a daily, portrait, sound-on-optional countdown of the day's five biggest
A.I. stories, in the energy of a *Top of the Pops / MTV chart rundown*: punchy number
stings, a driving music bed, one hyped presenter voice, fast confident cuts, and bold
kinetic type. Fun and high-tempo, but **credible** for real AI news — the credibility
comes from a strict, repeatable structure and a hard wall between the presenter's creative
patter and the factual news copy.

It is a **template + bounded-generation SYSTEM**, not a one-off. The graphics, timing,
brand, audio spine, and presenter persona are FIXED and broadcast-grade. Only the day's
five stories (facts, accents-by-rank, VO clips) change. That fixed-system / variable-data
split is the sellable product.

The single feel test: **the number reveal must SLAM, not fade.** The current template's
only "impact" is a soft background bloom and a `scale 0.8→1.0` grow — that reads as a
slideshow. The number sting (§3.1) is the load-bearing change.

---

## 2. Show structure + frame-budget timing map (30fps, portrait 1080×1920)

### 2.1 Top-level skeleton

Total runtime **103s = 3090 frames**. The frame skeleton is unchanged from
`tokens.ts` (it is already validated and every section clears its reading floor):

```
0      – 195    COLD OPEN / TITLE STING      195f   6.5s
195    – 2970   FIVE SEGMENTS × 555f         2775f  92.5s   (n = 5→4→3→2→1)
2970   – 3090   SIGN-OFF                      120f   4.0s
                                             ----   -----
                                             3090f  103.0s
```

Segment *i* (i=0..4) starts at `195 + i*555`. Rank shown in segment *i* is `5 - i`
(segment 0 = #5, segment 4 = #1). This matches `AiTop5Composition.tsx:51-59` and the
`sort((a,b)=>b.n-a.n)` in `make-ai-top5.mjs:63`.

**#1 spectacle exception (adopted from the critique "give #1 structural spectacle"):**
the *frame budget stays 555f* for all five segments in V1 (so the audio spine and VO
engine need no per-segment retiming), but #1 earns its finale through **audio + motion
intensity**, not a longer clip: the riser (§4.2) crescendos INTO segment 4, the number
sting escalates to full intensity at #1 (§3.1e), and the bed swells hardest under #1's
takeaway. A *variable-length #1* (longer hold) is a V2 item (§7), gated behind the
audio-driven budget so it can't desync the fixed spine.

### 2.2 Per-segment beat map (555f)

Matches `StoryCard.tsx` order and `tokens.ts` budgets exactly:

```
local f     s          beat        what happens
0   – 75    0.0–2.5    CUE         number sting build, glow bloom, chart-number watermark, cue line
75  – 165   2.5–5.5    REVEAL      "#N" SLAM (§3.1), accent rule snaps, headline arrives per-word (§3.2)
165 – 435   5.5–14.5   BEATS       2 supporting beats × 135f, whip-in/out, dot index
435 – 555   14.5–18.5  TAKEAWAY    "THE WIDER POINT" label + one-line takeaway (climax)
```

### 2.3 The split-VO clip layout (presenter hook + news, non-overlapping)

Per story the VO is ONE mp3 assembled from two separately-generated, separately-TTS'd
beats with **frame-accurate baked silence** between them. Because it is one file with one
`<Audio>` node, hook and news can NEVER overlap in time — the guarantee is a property of
the *asset*, not of fragile multi-Sequence alignment.

**This bible resolves the contradiction between the two input designs** (one specified an
exact `hook 9–84f / gap 84–99f / news 99–540f` layout; the engine design specified an
un-measured `hook + 0.18s + news`). An un-measured concat makes the news start frame
non-deterministic, so the "reveal lands in the clean gap" promise is unenforceable. We
adopt the **frame-accurate** version and MAKE the engine enforce it by measuring the hook
with `ffprobe` and padding to exact frames (§5.3). Clip layout at 30fps:

```
clip f      s            segment beat    content
0   – 9     0.00–0.30    (CUE)           SILENT LEAD-IN — number sting lands with no voice on top
9   – 84    0.30–2.80    CUE→REVEAL      HOOK (presenter, CREATIVE lane). Hard cap 75f/2.5s of speech.
84  – 99    2.80–3.30    (REVEAL)        SILENT GAP 0.5s — the "#N + headline" reveal lands in clean air
99  – 540   3.30–18.00   BEATS→TAKEAWAY  NEWS (facts, ACCURATE lane). Author to ~13.5–14.0s.
540 – 555   18.00–18.50  (TAKEAWAY tail) SILENT TAIL — music-only breath before next sting
```

**Climax protection (critique must-fix "clear the news VO off the climax"):** author the
news copy to END by ~14.0s (≈ clip frame 420), NOT 18.0s. The takeaway card (14.5–18.5s)
then gets a clean **spoken button + music-only outro** — the "wider point" is never talked
over. The 540f news window is the hard ceiling, not the target. The engine warns/trims if
rendered news exceeds ~420f (§5.3).

The `<Audio>` Sequence still starts at segment frame 0 with `layout="none"` — exactly the
existing code. The composition does not change to support the split.

---

## 3. Motion / graphics system (Remotion-concrete)

All motion is `useCurrentFrame()` + `interpolate()`/`spring()` on transform / opacity /
clip-path. **No CSS transitions or animations** (per `apps/claude-remotion/CLAUDE.md`).
`clip-path` with frame-computed values is explicitly allowed. All offsets below are
**portrait** values (1080 wide).

### 3.0 Beat grid (new tokens, ~15 lines in `tokens.ts`)

```ts
export const BPM  = 124;            // SYSTEM CONTRACT — the bed MUST be produced/selected at this tempo
export const BEAT = Math.round(FPS * 60 / BPM);   // ≈15f at 124 BPM
export const BAR  = BEAT * 4;                      // ≈60f
// 1.0 exactly on a beat boundary, decays to 0 across `decay` frames
export const beatPulse = (f: number, decay = BEAT) => Math.max(0, 1 - (f % BEAT) / decay);
```

`STORY_CUE_FRAMES=75` is already 5 beats — REVEAL slams land on a beat boundary for free.
**BPM is a system contract, not a per-episode value:** the bed (§4.1) must be tempo-matched
to `BPM` or "lands on the beat" is a lie. This is documented in `public/audio/CREDITS.md`
and the bed swap checklist (§8). V1 accepts *approximate* sync (visual grid + a 124-BPM
bed tiling ~7.7s/4-bar phrases across 103s); true per-cut beat-lock is V2.

### 3.1 Number sting — rewrite `RevealPhase` `#N` (the flagship change)

Replace the soft `0.8→1.0` grow. On REVEAL local frame 0 (a beat boundary), a 5-part impact:

- **(a) PRE-KICK** — last 4f of CUE: whole stage `scale 1.0→0.94`, a held breath.
- **(b) SLAM** — f0–6: number `scale 2.6→1.0`, `Easing.out(Easing.cubic)`; a 1–3f full-frame
  WHITE FLASH (`opacity 0→0.9@f0→0@f3`); the accent rule SNAPS to full width in 2f (not 30f).
- **(c) RING SHOCKWAVE** — a `borderRadius:50%` div, `width/height 0→560px` over 12f (scaled up
  for the 1080-wide portrait canvas), `opacity 0.9→0`, `4px` accent border, `translate(-50%,-50%)`.
- **(d) SETTLE** — f6–14: secondary bounce `1.0→1.06→1.0` via `EASE_SPRING` so it rings.
- **(e) FAUX-CHROMATIC** — f0–5 on the `#N` glyph: two duplicate offset glyphs (±3px), colours
  from the hot end of the ramp, `opacity 0.35`, `mixBlendMode:"screen"`. A static style, NOT an
  animated CSS filter — Remotion-safe and cheap.
  **Escalate intensity 5→1:** flash duration, chromatic offset, and ring size scale with
  `energyLevel = (6 - n)/5`, so #5 is a subtle tick and #1 is the full broadcast punch. This is
  the motion half of "#1 gets spectacle" and it also prevents sting fatigue across 5 reveals.

### 3.2 Kinetic typography — headline arrives as motion, not a block

- **HEADLINE:** split `story.headline` on spaces; stagger each word by 3f. Per word:
  `opacity 0→1` over 5f, `translateY 34→0` `EASE_SPRING` (slight overshoot), `skewX 6deg→0`.
  Word *i* starts at reveal-local `24 + i*3`. **Clamp so the last word lands by
  `REVEAL_FRAMES - 20`** (critique: long real-day headlines can overrun 90f) — if
  `24 + words*3 + settle > 70`, compress the per-word step to fit. Headline copy cap stays ~40c.
- **BEATS:** keep the sequential windows; give each a WHIP-IN (`translateX +90→0` over 7f,
  `Easing.out(Easing.quad)`, `opacity 0→1` over 6f) and a whip-OUT (`→ -60px`). First word of
  each beat gets a `scale 1.15→1.0` pop. (V2: `**emphasis**` markers throb on `beatPulse`.)

### 3.3 Transitions — a 2-move vocabulary that replaces uniform fades

The uniform 12f crossfade between every phase is the core slideshow tell. **V1 ships the
story→story hard cut** (critique must-fix — do NOT defer it):

- **STORY→STORY (V1):** whip-pan. Last 8f of TAKEAWAY: everything `translateX -160px` +
  `scaleX 1.0→1.08` + `opacity 1→0`; next CUE enters `translateX +160→0` over 8f. Tie the
  whip midpoint to the existing `Background.transitionFlash` frame so the accent bloom masks
  the cut. Direction alternates per story (odd left, even right).
- **PHASE→PHASE (V1.5):** a 3f accent SWIPE wipe via a frame-computed `clip-path` polygon,
  replacing the intra-story crossfade. (Deferred to V1.5 because the story→story cut is the
  load-bearing one; the phase crossfades are secondary.)

### 3.4 Lower-third / category chip — assembles like a broadcast lower-third

`CategoryTag` becomes a lower-third that builds: dark bar (`CARD_BG @0.92`) wipes in from
left via `clip-path inset` over 8f; accent left-edge (4px) draws down first (`scaleY 0→1`);
category text typewriter-reveals (`clip-path inset` right→0 over 8f); a small `beatPulse`
REC-style accent dot. Wipes out on exit. (V1.5.)

### 3.5 Background — rhythmic, not ambient

Keep the aurora but add rhythm (portrait: **swap the hardcoded W/H to 1080/1920** first —
particle `baseX = hash*W` math is orientation-dependent):

- **BEAT PULSE:** grid opacity + edge-glow alpha `+= beatPulse(frame)*0.15*energyLevel`.
- **RANK STROBE:** at each story entry (local 0–3f) a 2f full-frame accent strobe @0.18,
  stacking with the existing `transitionFlash`.
- **SPEED-UP:** particle speed multiplier `= 1 + energyLevel*0.8`, chosen at the story
  boundary via `activeStoryIndex` (constant per story, no mid-story jump) — #1 visibly moves
  faster than #5, so the countdown accelerates.

---

## 4. Audio design

Three lanes, all frame-driven `<Audio>` in `AiTop5Composition.tsx`. No `@remotion/media`.
The composition already has a looped bed + `bedVolume(f)` duck + per-story VO Sequences;
V1 EXTENDS these.

### 4.1 Lane 1 — music bed

One loopable driving instrumental at `public/audio/bed.mp3`, played by the existing looped
`<Audio volume={bedVolume} />`. Replace the flat 0.35/0.12 duck with a **per-section
breathing envelope** (one `interpolate()` over a loop-built keyframe array): full ~0.34
under cold-open and sign-off, ducked ~0.11 under each story VO band, a short swell in each
75f CUE window, and the hardest swell under #1's takeaway. Every boundary is a fixed frame
(`COLD_OPEN_FRAMES`, `STORY_TOTAL_FRAMES`, `SIGN_OFF` start), so it stays deterministic
(no clock, no random).

**Tempo contract:** the bed is produced/selected at **124 BPM** (a 4-bar phrase ≈7.7s tiles
cleanly across ~103s). This binds §3.0's beat grid — the motion beat math depends on the
bed choice; that cross-dimension dependency is now explicit and owned by this bible.

**Loop-seam:** an untrimmed loop clicks every ~7.7s. Pre-process ONCE with ffmpeg (trim to a
bar boundary + short `afade` crossfade) and commit the seamless file. Pre-ship step, not runtime.

**Frame-blind duck (accepted limit):** `bedVolume` ducks by SECTION frame, not actual VO
presence, so a failed story (`vo:null`) leaves the bed ducked over silence. Acceptable for V1.

### 4.2 Lane 2 — SFX stings (net-new)

Short one-shots in `public/audio/sfx/`, each its own `<Sequence layout="none">` wrapping one
`<Audio volume≈0.9>`. Placements from token constants:

| SFX | file | placement (frame) |
|-----|------|-------------------|
| number hit | `sfx/numberHit.mp3` | each slam: `COLD_OPEN_FRAMES + i*STORY_TOTAL_FRAMES + STORY_CUE_FRAMES` (the REVEAL boundary) |
| whoosh | `sfx/whoosh.mp3` | ~7f before each story start: `max(0, storyStart - 7)` |
| riser | `sfx/riser.mp3` | INTO #1 (i=4): `(COLD_OPEN_FRAMES + 4*STORY_TOTAL_FRAMES) - RISER_FRAMES` (~60–75f), with an extra bed-duck keyframe under it |
| cold-open slam | `sfx/coldOpenSlam.mp3` | logo lockup: `COLD_OPEN_FRAMES - 45` |

SFX ride above the ducked bed but NEVER above VO (VO stays 1.0). Place whoosh 7f early so it
clears before the hook word. Keep hits ≤0.9 so they don't drown the hook.

### 4.3 Lane 3 — voiceover

One mp3 per story (the two-beat split, §5). Intro and sign-off stay single lines. Unchanged
composition-side.

### 4.4 ffmpeg assembly + resolver

A shared `resolveFfmpeg()` (mirroring `transcribe.mjs` but per-platform):

```js
function resolveFfmpeg() {
  if (process.env.FFMPEG_BIN) return process.env.FFMPEG_BIN;
  const suffix = process.platform === 'win32' ? '-msvc'
               : process.platform === 'linux' ? '-gnu' : '';
  const dir = `@remotion/compositor-${process.platform}-${process.arch}${suffix}`;
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const bundled = join(ROOT, 'node_modules', dir, exe);
  return existsSync(bundled) ? bundled : 'ffmpeg';   // PATH fallback
}
```

Use the concat **FILTER** form (re-encodes to one normalised stream — safe across
sample-rate/channel differences), NOT the stream-copy demuxer:

```
ffmpeg -i hook.mp3 -f lavfi -t <gapSeconds> -i anullsrc=r=44100:cl=mono -i news.mp3 \
  -filter_complex "[0:a][1:a][2:a]concat=n=3:v=0:a=1[out]" -map "[out]" \
  -c:a libmp3lame -q:a 4 vo/<n>.mp3
```

If the resolver falls back to bare `ffmpeg` and it is absent, **degrade to news-only**
(write the news mp3 as `vo/<n>.mp3`) — never a silent story. Confirm ffmpeg exists in the
Linux render image before relying on concat there.

### 4.5 Licensing-safe sources (a PLAN, not delivered assets)

`public/audio/` does not exist yet — all audio is net-new and must be sourced, each
file's individual licence page verified (not the search snippet — some Pixabay uploads are
mislabelled), and logged in `public/audio/CREDITS.md` (source URL + licence + BPM for the bed).

- **Bed (CC0 / royalty-free, 124 BPM):** Pixabay Music CC0 (`pixabay.com/music/search/cc0/`),
  TunePocket News Countdown / Countdown Loop, OpenGameArt CC0 Music (`opengameart.org/content/cc0-music-0`).
- **SFX (CC0):** VideoEditingSFX CC0 100-pack (`videoeditingsfx.com` — one pack yields all four:
  Impacts→numberHit/coldOpenSlam, Transitions→whoosh, Risers→riser), Pixabay Sound Effects
  (`pixabay.com/sound-effects/search/riser%20whoosh/`), ZapSplat CC0-1.0
  (`zapsplat.com/license-type/cc0-1-0-universal/`).

VideoEditingSFX is the best single drop-in for all four stings. Bed + SFX are one-time free
downloads — no per-render API cost.

---

## 5. VO / script-generation architecture (creative-but-accurate split)

### 5.1 The two-lane LLM contract (`write-script.mjs`)

Keep ONE LLM call over all five stories (preserves cross-story context, no-repeat, one
voice). Change the per-story output from one merged `line` to **two fields: `hook` and
`news`**. Top-level still returns `intro` + `signoff`.

Per story the model returns `{ rank, hook, news }`.

**PRESENTER HOOK (CREATIVE lane):**
- MUST open by stating the ranked place using the exact chart phrasing — pass the per-rank
  `CUE_BY_RANK` string into each story's prompt block so the hook anchors to it
  ("Number five…", "In at number four…", …).
- THEN a bounded creative flourish about the story's vibe: ~8 words, max 12.
- Creative but **NOT a fact claim** — may tease/tone-set, must NOT assert numbers, names,
  or outcomes (those live only in the news lane). This is the lane wall.
- Plain spoken text: "A.I." not "AI", no markdown/emoji/stage-directions.
- CREATIVE lane = the daily-variety lever (temperature 0.8), but structurally pinned.

**NEWS CONTENT (ACCURATE lane):**
- ~30 words, max 34.
- Tell the day's story conversationally from the supplied facts (summary/beats/takeaway/
  source) with one touch of why-it-matters.
- Do NOT restate the chart number (the hook said it). Start straight into substance.
- Faithful: invent no names/numbers/claims not in the facts; use DIFFERENT words than the
  on-screen beats/takeaway.
- **Author to END by ~14.0s of speech** so it clears the takeaway climax (§2.3).

Word budgets: hook ~8 (max 12) + news ~30 (max 34) ≈ 38–46 words total — matches the current
~40-word single-line budget, so the 555f slot needs no retiming for V1. Temperature stays 0.8.

**Hard fallback (updated):** the all-stories-present check must now require BOTH `hook` AND
`news` per story, else return `null` and let the fixed-pool path take over (no half-written
runs). Update the check at `write-script.mjs:118-122`.

### 5.2 The lane wall — how creative liberty can't corrupt the record

STRUCTURE is the repeatable, accurate spine: 5→1 countdown, exact ranked-place phrasing,
fixed word budgets, fixed lane separation. GENERATION gives variety: hook flourish + news
wording regenerate daily at temp 0.8. ACCURACY is protected because the hook is *forbidden*
from asserting facts and the news is length/faithfulness-bounded and fact-sourced — and the
two lanes literally become two audio files, so the creative lane can never bleed over the
accurate lane in time either.

**V1 enforcement is prompt-only, and that is a known gap.** gpt-4o-mini at temp 0.8 over
entity/number-dense AI news (GPT-5.6, Fable 5, "two-week ban") WILL sometimes leak a fact
into the hook. **V1.1 adds a validator** (§7): reject a hook containing digits or a known
story-entity, regenerate once. Ship V1 with the prompt prohibition; harden immediately after.

### 5.3 Two-beat generation + frame-accurate concat (`generate-vo.mjs`)

Per story:
1. `hookText = story.hookScript` (from `--ai-script`) `|| CUE_BY_RANK[n]` (keyless fallback — a
   natural spoken place-announce, so V1 works with no OPENAI key).
2. `newsText = story.newsScript || story.voiceover || story.summary`.
3. TTS each separately → `vo/<n>_hook.mp3`, `vo/<n>_news.mp3`. (Reuse the existing
   OpenAI/ElevenLabs swap-point. V1.1: distinct `instructions` per lane — hookier vs steadier.)
4. **Measure the hook** with `ffprobe` (resolved next to ffmpeg). Enforce the 75f/2.5s speech
   cap: if hook > 75f, trim or regenerate. Compute the exact silence needed so the assembled
   clip hits the frame layout of §2.3:
   - `0.30s` silent lead-in, then hook, then a silent gap sized so **news starts at clip
     frame 99** (`gap = (99 - 9 - hookFrames)/30` s, floored at a 0.30s minimum breath),
     then news, then tail to 555f.
   - This is what makes §2.3's "reveal lands in the clean gap" *enforced*, not hoped.
5. Concat with the ffmpeg FILTER form (§4.4). Delete the two part files after.
6. **Fallbacks (all non-fatal, preserving current discipline):** concat fails → news-only mp3;
   one TTS part fails → use the other; both fail → `vo:null` (silent). Log every degradation.
7. **Cost + op logging:** sum chars across BOTH parts, log per-provider est cost, AND log the
   ffmpeg concat op (time/exit) — the always-log-API-cost rule, extended to the assembly step.

Doubling TTS calls (5→10/video) is negligible on $ (char-based) but doubles the failure
surface. **Acceptance gate (critique):** WARN LOUDLY (not just a log line) if any story lost a
lane — a "broadcast-standard" run should not silently ship a hook-missing story.

### 5.4 Data-contract changes

- **`data.ts`:** serialized `Story` shape UNCHANGED — `vo` stays `string | null`. The overlap
  guarantee is produced upstream (one file), not by template sequencing. (Optional additive,
  non-serialized in-memory `hook?`/`news?` for debug only — keep `data.ts` diff-clean.)
- **`write-script.mjs`:** `writeScript` returns `{ intro, signoff, stories: {[n]: {hook, news}} }`
  (was `{[n]: line}`). Both-fields hard-fallback check (§5.1).
- **`make-ai-top5.mjs`:** in the `--ai-script` block (currently `st.lineScript = script.stories[st.n]`,
  ~line 83), set `st.hookScript = line.hook; st.newsScript = line.news`. Everything else stays.
- **`generate-vo.mjs`:** read `story.hookScript` / `story.newsScript` (was `story.lineScript`);
  add the two-beat TTS + ffprobe-measure + frame-accurate concat. Return shape unchanged
  (`{ [n]: "vo/<n>.mp3", intro, signoff }`) — so the composition needs ZERO wiring change.

---

## 6. Brand / identity + presenter persona

### 6.1 Wordmark + `Brand.tsx`

Keep the brand string **"AI TOP 5"** (already in `ColdOpen.tsx` + `SignOff.tsx`). Extract ONE
locked `Brand.tsx` `Wordmark(scale, glow, accent)` verbatim from the existing title block
(FONT_BUBBLE weight 700, letterSpacing 8, the glow recipe
`textShadow 0 0 50*glow px accent + 0 0 110*glow px accent55`, and the sine glow-pulse). Both
cards re-import it so they cannot drift. The **"5"** is the logo hero — its own span ~1.12×,
in the #1 hot accent.

### 6.2 The ONE rank→accent heat ramp (the palette single-source-of-truth)

**Monotonic cool→hot, `#1` is the hottest/brightest.** Promote into `tokens.ts`:

```ts
export const RANK_ACCENT: Record<number, string> = {
  5: "#38bdf8", // cool sky blue    (coolest, lowest energy)
  4: "#22d3ee", // cyan
  3: "#34d399", // green  → shifting warm
  2: "#f59e0b", // amber
  1: "#ff2e88", // hot magenta-pink (hottest — the chart-topper)
};
export const BRAND_ACCENT = "#22d3ee";   // signature ident colour (intro/outro)
export const FLASH_WHITE   = "#ffffff";   // sting/flash secondary punch
export const SHOW_NAME      = "AI TOP 5";
```

Grammar: **intro + sign-off always use `BRAND_ACCENT` (signature cyan); the countdown body
climbs `RANK_ACCENT` toward the hot #1.** This deliberately makes the ident colour ≠ the #1
colour, so the finale (#1 hot-pink) reads as the *countdown climax* while the show ident stays
a stable cyan across every episode. (Resolves the critique note that `BRAND_ACCENT == #1`
would make the sign-off and the finale compete.)

**Repoint everything to the token, and fix the writer:**
- `ColdOpen.tsx:9` `ACCENT="#22d3ee"` → import `BRAND_ACCENT`.
- `make-ai-top5.mjs:26` `ACCENT_BY_RANK` → import `RANK_ACCENT` from tokens (or stop writing
  `accent` per-story and let the template read `RANK_ACCENT[n]`). **Without this the daily
  regen keeps overriding the token** — this is the leak the critique flagged.

Why this ramp over the two rejected ones: it is the only candidate that is simultaneously
(a) monotonic cool→hot, (b) has an unambiguously hottest #1, and (c) reuses colours already
present in the shipped data, so per-rank legibility on the near-black BG is already
eyeball-tested for 4 of 5. **Verify amber #2 and the new hot-pink #1 contrast in a still**
(green/amber are lower-contrast than cyan on #05070f).

### 6.3 Recurring visual signature (critique: "add a signature, don't be generic aurora")

The dark aurora/particle field is shared with every other repo template and every AI-news
reel — invisible in a sound-off feed. Give AI TOP 5 unmistakable furniture:

- **RankStamp** — a big FONT_BUBBLE numeral that spring-slams identically every story (§3.1):
  the signature number-sting is the brand's motion logo.
- **Chart-bar HUD** — a thin FONT_MONO `"AI TOP 5 · NO.n"` strip (reuse the existing mono
  kicker), present every story: the persistent brand furniture a muted viewer reads.
- **Two-font rule = the brand:** numbers + stings are ALWAYS Fredoka; all techy/meta chrome is
  ALWAYS mono. That contrast IS the identity.
- (V2/V3 furniture: animated "5"-as-spinning-dial lockup; a presenter/mascot anchor.)

### 6.4 Presenter persona — "THE COUNTDOWN"

ONE voice: a hyped late-night chart DJ — fast, warm, cocky-but-credible. Tics: states the
place first ("Number five…") then a bounded flourish; a bounded catchphrase pool; a fixed
sign-off shape. Lives as a FIXED `persona.md` + a `persona` seed feeding the VO prompt. Fixed
persona + variable facts = recognisable daily without drifting character. The persona card is
read-only to generation — the daily generator fills only story facts, the flourish, and the
sign-off.

### 6.5 Signature sting asset

One ~1s `public/audio/sfx/coldOpenSlam.mp3` (+ the per-story `numberHit.mp3`) at the three
brand hooks (cold-open lockup, each rank stamp, sign-off). V1 = a 3-note rising arpeggio.
Pre-baked, played via `<Audio>`/`staticFile` — no new dep. Keep ~1s and duck under VO to
avoid the fatigue of the same stinger ~7×/episode; V2 transposes it per rank.

---

## 7. V1 — START SIMPLE (build now) vs PROGRESSION ROADMAP

### V1 — build now

The critique warned that "all five dimensions' V1s together" is a large surface. So V1 is
**scoped to the load-bearing minimum that flips slideshow→broadcast**, and **sequenced VO-first**
(everything downstream assumes the split clip exists and is frame-predictable):

1. **Portrait rebuild** — `Root.tsx` AiTop5 → 1080×1920; `Background.tsx` W/H swap; re-check offsets.
2. **One rank-accent ramp** — `RANK_ACCENT`/`BRAND_ACCENT` in `tokens.ts`; repoint `ColdOpen`
   and `make-ai-top5.mjs` (writer reads the token).
3. **VO two-beat engine** — `write-script.mjs` `{hook,news}`; `make-ai-top5.mjs` wiring;
   `generate-vo.mjs` two-beat TTS + `resolveFfmpeg()` + ffprobe-measured frame-accurate concat +
   news-only degrade + loud lane-loss warning. **Prove the concat on the actual Linux render
   target**, not just Windows.
4. **Number sting** — `RevealPhase` 5-part slam (pre-kick / white flash / ring shockwave / settle /
   faux-chromatic), intensity-escalated 5→1. *The single most important change.*
5. **Beat grid + rhythmic background** — `BEAT`/`BAR`/`beatPulse` tokens; background beat-pulse +
   rank strobe + per-story speed-up.
6. **Per-word kinetic headline** — staggered word arrival, clamped to REVEAL budget.
7. **Story→story hard cut / whip-pan** — NOT deferred (it's the core slideshow tell).
8. **Audio spine** — source + verify-licence + commit bed (124 BPM, seamless-looped) + 4 SFX +
   `CREDITS.md`; per-section breathing `bedVolume`; 4 SFX Sequences + riser-into-#1 + extra duck.
9. **Fixed persona + `Brand.tsx`** — extract locked `Wordmark`; `persona.md`; keyless CUE fallback.

Timing (555f/3090f) is UNTOUCHED in V1 — the VO engine, audio spine, and motion all reuse the
existing budgets, so nothing has to re-validate frame math.

### PROGRESSION ROADMAP (design toward — do NOT build in V1)

- **V1.1** — lane-wall validator (reject hook with digits/known-entity, regen once); per-lane TTS
  `instructions` (hookier hook, steadier news); tune inter-beat silence per rank; expose SFX gain /
  duck depths / `RISER_FRAMES` as tokens.
- **V1.5** — phase→phase accent-swipe wipes; the assembling lower-third; catchphrase-pool rotation
  so the fixed cue phrasing varies day-to-day (the real answer to "won't it get boring", since V1's
  only variety is ~8 words of flourish + temperature).
- **V2** — audio-driven segment budget (derive per-story `durationInFrames` from measured clip
  length, rounded to 30f) so long news never clips AND #1 can hold longer (variable finale);
  true per-cut beat-lock (snap segment length to a whole-bar multiple of the measured bed);
  `**emphasis**` markers in `data.ts` that throb on `beatPulse`; rank speed-up polish; per-rank
  sting transpose.
- **V3 (the creative-lane roadmap)** — presenter tells a bounded **JOKE** per story (a new bounded
  field in the persona card, still inside the hook window, still fact-free); collect the day's
  jokes; the **SIGN-OFF calls back** to one joke (tongue-in-cheek setup/payoff) via a
  `callbackJokeIndex` chosen at signoff generation so setup↔payoff are explicitly linked. Distinct
  on-screen typo lanes: presenter/hook lines get a bouncy beat-synced Fredoka lower-third, news
  lines get the clean kinetic headline — the CREATIVE and ACCURATE lanes visually separated to
  match the two-lane VO. **Prototype ONE joke+callback before committing** — comedy needs the
  ~8-word setup to breathe under a number slam, which may fight the energetic pacing (critique).
- **V4** — dynamic total runtime (75–120s) "fast 3" / "deep 5" editions; per-weekday bed variants;
  animated "5"-dial lockup; commissioned music bed. Segment template + split-VO contract reused.

---

## 8. Ordered BUILD PLAN (rebuild composition + generation engine)

Sequenced so each step is independently checkable (`npm run lint`, then
`npx remotion still AiTop5 --frame=N --scale=0.5` at a CUE / REVEAL-slam / BEATS frame), and
so the VO/timing risks land first. Commit after each numbered step (repo commit discipline:
scoped, reversible).

**Phase A — foundation (correctness, no feel yet)**
1. **Orientation.** `Root.tsx` AiTop5 → `width={1080} height={1920}`. Swap `Background.tsx`
   `W=1080 / H=1920`; audit every hardcoded offset (ring 560px, whip 160px, per-word Y) against
   the portrait canvas. Lint + still at 3 frames. Commit.
2. **Palette single-source.** Add `RANK_ACCENT` / `BRAND_ACCENT` / `FLASH_WHITE` / `SHOW_NAME`
   to `tokens.ts`. Repoint `ColdOpen.tsx:9`. Make `make-ai-top5.mjs` import `RANK_ACCENT` (writer
   reads the token). Re-run `make-ai-top5` (no audio) to prove `data.ts` regen keeps the ramp.
   Commit.

**Phase B — VO / generation engine (prove the spine before decorating it)**
3. **`resolveFfmpeg()`** shared helper (per-platform + `FFMPEG_BIN` + PATH fallback). Verify
   ffmpeg/ffprobe resolve on BOTH Windows and the Linux Linux render image. Commit.
4. **Two-lane script.** `write-script.mjs` → `{hook,news}` shape, both-fields hard fallback,
   cue-anchored hook prompt, climax-clearing news budget. Standalone-test with a facts json. Commit.
5. **Two-beat VO.** `make-ai-top5.mjs` wiring (`hookScript`/`newsScript`); `generate-vo.mjs`
   two-beat TTS + ffprobe-measure + frame-accurate concat + news-only degrade + lane-loss WARN +
   extended cost/op logging. Run `--ai-script --with-audio`, inspect the assembled `vo/<n>.mp3`
   duration to confirm the §2.3 frame layout. Commit.

**Phase C — audio assets**
6. **Source + verify + commit audio.** Bed (124 BPM, licence-verified, seamless-looped via ffmpeg)
   + 4 SFX + `public/audio/CREDITS.md`. Confirm `bedIfPresent()` + a new `sfxIfPresent()` presence
   check pick them up. Commit (assets + credits).
7. **Audio wiring.** Per-section breathing `bedVolume`; 4 SFX `<Sequence layout="none">` at token
   frames; riser-into-#1 + extra duck. Render a short range to hear placement. Commit.

**Phase D — motion (the feel)**
8. **Beat grid.** `BPM`/`BEAT`/`BAR`/`beatPulse` in `tokens.ts`. Commit.
9. **Number sting.** Rewrite `RevealPhase` `#N` (5-part slam, escalate 5→1). Still at a REVEAL-slam
   frame per rank. **This is the load-bearing feel change — prioritise and eyeball it.** Commit.
10. **Rhythmic background.** Beat-pulse + rank strobe + per-story speed-up. Commit.
11. **Kinetic headline.** Per-word stagger, clamped to REVEAL budget. Commit.
12. **Story→story whip-pan.** Alternating direction, tied to `transitionFlash`. Commit.

**Phase E — brand + persona**
13. **`Brand.tsx`** locked `Wordmark` (verbatim extract); re-import in `ColdOpen`/`SignOff`;
    `RankStamp` + chart-bar HUD as recurring signature. Commit.
14. **Persona.** `persona.md` + `persona` seed into the VO prompt; keyless CUE fallback confirmed.
    Commit.

**Phase F — full pass**
15. Full `make-ai-top5 --ai-script --with-audio` → `npx remotion render AiTop5 out/…` → review gate
    (quality-judge / still-preview), then socials-studio publish. Tag only after a clean end-to-end.

**Do NOT start Phase D/E motion polish until Phase B (VO spine) renders a frame-predictable clip on
the real target platform** — everything downstream assumes it.

---

## 9. Consistency system (why it stays fixed while the day varies)

Read-only brand constants: `tokens.ts` (`RANK_ACCENT`, `BRAND_ACCENT`, `BPM`/beat grid, all
`STORY_*` budgets), `Brand.tsx`, `persona.md`, `public/audio/` (bed + SFX + `CREDITS.md`). The
daily bounded generation fills ONLY `data.ts` `TODAY.stories` (facts, per-rank accent-from-token,
VO clip paths). No per-episode motion editing, no per-episode colour editing. That is what makes
it a sellable product: a fixed broadcast-grade system where only the day's five stories change.
