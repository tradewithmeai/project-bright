# Provenance and licences for committed media

Every file under `public/` that is committed to this repository ships to anyone who clones it.
This is the record of where each came from and under what terms.

**Anything marked `Unconfirmed` has not been established.** That is a statement of ignorance, not a
grant of permission — an `Unconfirmed` asset should be verified or removed before it is relied on.
See `studio/ASSET_RECORDS.md` for the rules, and the `record-final-video` skill for the per-asset
fields a new record must carry.

Derived and regenerable media is gitignored rather than committed; see `.gitignore`. What follows
is only what is actually tracked.

---

## `audio/` — AI Top 5 bed and stings

Fully documented in [`audio/CREDITS.md`](audio/CREDITS.md). Synthesised in-house by
`scripts/make-audio-assets.mjs` (deterministic Node DSP, no third-party samples). Licence:
in-house, no attribution required. Regenerate with `node scripts/make-audio-assets.mjs`.

**Read the bed-swap contract in that file before replacing `bed.mp3`** — the motion grid is
tempo-locked to it at 124 BPM, and the contract also requires verifying an individual licence page
rather than a search snippet, because some stock uploads are mislabelled by their uploader.

## `era-devices/` — composited device art

| field | value |
|---|---|
| source | first-party — plates and cutouts composited for the ranked-countdown scene |
| license_name | in-house |
| attribution_required | false |
| notes | Era-device plates (a 50s set, an 80s stereo system, a 90s flatscreen, a projector) and the prop cutouts and shadows layered over them, plus the 20s tablet foreground used by the #1 finale. Every file is drawn by a surviving `AiTop5` scene — checked by `npm run check:assets`, not by reading filenames. The four opaque plates are JPEG (q:v 2): they are photographic art with no transparency, PNG cost 4.9 MB against 641 KB, and the difference on a rendered frame measures 44 dB PSNR with no visible change. The four files that carry alpha stay PNG, because JPEG has none. `20s_tablet_plate.png` was removed: rank 1 renders the finale set-piece instead, so nothing drew it. The campaign screen captures that previously shared this entry are also gone — a screenshot of a live service is not ours to redistribute merely because we took it. |

## `brand/`, `solvx-logo.png`, `solvx-logo-outline.png` — first-party marks

| field | value |
|---|---|
| source | first-party — solvX brand marks |
| license_name | in-house |
| attribution_required | false |
| notes | The wordmark is drawn as vector code by the `recolourable-wordmark` procedure; these raster copies are exports of it. `brand/youtube-qr.png` is the sign-off card's QR code. |

## `logos/si/meta.svg` — a third-party mark the sample edition displays

| field | value |
|---|---|
| source | Simple Icons 16.25.0, vendored by `scripts/vendor-logos.mjs` |
| license_name | **The FILE is CC0. The TRADEMARK is not.** |
| attribution_required | false (for the file) |
| notes | The sample edition's #2 story carries `entities: ["Meta"]`, and `resolveLogo()` renders this mark as a low-opacity watermark behind that story's text — so it is here because a frame displays it, which was verified by rendering, not by reading the manifest. **Eleven marks used to live here and ten were removed this pass**: openai, anthropic, google, deepmind, nvidia, cloudflare, coinbase, baidu, github and linuxfoundation. No composition rendered any of them; they were vendored against the chance that a future edition might name that company, and every clone downloaded them. Simple Icons publishes the FILES under CC0, but a company's trademark is not CC0 and is not covered by this repository's MIT licence — so shipping marks speculatively is a real cost carried for no benefit. Add one back only when an edition actually displays it: `node scripts/vendor-logos.mjs` fetches it and `src/templates/ai_top5/logos.json` maps it. |

## `code1.tsx`, `code2.tsx`, `code3.tsx` — the CodeWalkthrough steps

| field | value |
|---|---|
| source | **first-party** — written for this repository |
| license_name | in-house (MIT, with the rest of the source) |
| attribution_required | false |
| notes | One file per step of the `CodeWalkthrough` composition, found by `getStaticFiles()` in `src/calculate-metadata/get-files.ts` rather than named anywhere. They teach the `readingFloor()` rule this repo actually uses — the last step carries a deliberate type error so the error annotation has something to annotate, and a `^?` query so the Twoslash callout has something to show. They replaced the upstream Remotion starter's lorem-ipsum snippets. Add a step by dropping a `codeN.<ext>` file beside them; the duration and width recalculate. |

## `footage-samples/` — the FootagePromo demo media

| field | value |
|---|---|
| source | **synthesized in-house** by `scripts/make-footage-samples.mjs` |
| license_name | in-house (no third-party material of any kind) |
| attribution_required | false |
| notes | `sample-a.mp4` (960x540) and `sample-b.mp4` (720x720) are generated frame by frame from closed-form maths in Node, written as PNGs and encoded by Remotion's bundled ffmpeg. No stock footage, no filmed material, no third-party frames. The two are deliberately different shapes so the template's handling of footage that does not match the composition is actually exercised rather than merely claimed. `voice-tone-a.mp3` and `voice-tone-b.mp3` are **not speech** — they are voice-band tones with a syllable-rate envelope, standing in for a voiceover so the music duck has something to duck under without anyone paying for a TTS call. Regenerate with `node scripts/make-footage-samples.mjs`; the output is byte-for-byte reproducible. |

---

## The MIT licence covers the code, not the media

`LICENSE` grants MIT rights over this repository's source. It does **not**, and cannot, relicense
third-party material that appears in a capture, nor override a generation provider's terms for
media produced through their service. Treat the two questions separately.
