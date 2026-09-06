# FAIL · caption-overlap / below-reading-floor

- **verdict:** FAIL (found by audit, fix accepted into v11)
- **surface:** captions — RapidFlow demo spine
- **human's words:** _(audit-surfaced; the user approved fixing it before calling the cut final)_
- **date / version:** v10 (present) → fixed v11

## Diagnosis
Two `subtitle`-style captions rendered into the **same bottom-centre slot at full opacity** simultaneously (~9.3–10.3s): "Their record — straight from Parliament." (7.4–10.3) and "From the record to your representative." (9.3–12.0). They visibly stacked. Root cause was unfixable by nudging — the two lines' reading floors (`max(1.8s, chars×0.07s)` = 2.87s + 2.73s = 5.6s) could not both fit the 4.5s of budget left in the 12s section, and the second line's own window was already *under* its floor.

## Fix
Tightened the copy and **re-sequenced**: "Their record, from Parliament." (7.7–9.8) then "Then write to your MP." (10.0–12.0) — each meets its reading floor with a clean 0.2s gap, both demo beats kept, section length unchanged.

## Signature (what to detect) — NOW MECHANISED
This class is checked deterministically (Lock 1) in `scripts/video-checks.cjs`:
- **Same-slot overlap:** two captions of the same `style` (both `subtitle`, or both centred `title`/`kicker`) whose `[in_s, out_s]` windows overlap.
- **Below reading floor:** any caption with `out_s − in_s < max(1.8, text.length × 0.07)`.
The check would have caught this in v10. Treat its output as authoritative; the taste-proxy need not re-judge it.
