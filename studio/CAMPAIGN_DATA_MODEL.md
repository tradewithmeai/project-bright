# Campaign data model — records-first design target

> **Status: DESIGN TARGET, not yet implemented.** The socials-studio bridge (campaign filesystem +
> `outputs[]` v2) is being built FIRST, without waiting on this. This doc is the shape everything
> should *converge toward* so that, when volume makes it necessary, the move to a real database is a
> load script — not a rewrite. Do not let this constrain the bridge work now; use it to avoid
> decisions that would later be expensive to unpick (mainly: breaking the ID thread, or storing
> message/performance as prose instead of fields).

## The core principle

If we ran this by hand we'd use spreadsheets — tables of rows with stable columns. The AI equivalent is
the same thing, not more skills and markdown. **The nightmare is prose scattered across skills / cmds /
files. The escape is: every unit of work is a ROW in a table, identified by a stable ID.** Whether a
row lives in markdown front-matter today or SQLite later is a storage detail. Shape the rows
consistently now and the database becomes a ~50-line loader, deferrable until it actually hurts.

## The 6 entities

Everything we will ever want to query is one of these rows, keyed by a stable ID. Five already exist as
records; the sixth (performance) is the gap that closes the learning loop.

| Entity | Key | Owner | Today's storage | Core fields |
|---|---|---|---|---|
| **campaign** | `campaign_id` (slug) | socials | `campaigns/<slug>/campaign.md` | name, goal, audience, brand, cta, hub_url, status |
| **piece** (the brief / message) | `piece_id` | socials | `campaigns/<slug>/posts/*.md` | campaign_id, message (the ONE thing it says), angle, platforms[], outputs[] |
| **output** (one video) | `output_id` (+ `request_id`) | project-bright | `publish.json` | request_id, piece_id, platform_profile, aspect, edit.style, duration_s, role, promotes, render_path |
| **publish** (where it went live) | `output_id` → url | socials | POST_QUEUE / post_schedule.json | output_id, platform, posted_at, url, status |
| **cost** | `output_id` | project-bright | `runs.jsonl` (agent) + `api-usage.log` (provider) | output_id, api_cost_usd, agent_tokens, agent_cost_usd |
| **performance** ⚠️ | `output_id` | socials | **none yet — the gap** | output_id, platform, date, views, comments, likes, shares, saves, ctr, notes |

## The ID thread (the make-or-break detail)

```
campaign_id → piece_id → request_id → output_id → published url → performance rows
                                          └────────────→ cost rows
```

As long as **nothing breaks this chain**, the entire learning loop — "which brief / hook / format /
length actually worked, and what did it cost" — is available for free later, just by joining on the
keys. The socials bridge plan already threads `request_id` / `output_id`; keep it intact. This is the
one thing worth protecting through all the bridge tweaking.

## The performance gap (the one thing to add)

"Create a lot of output, targeted and on-brief, and monitor how it performs" needs somewhere for the
performance to land. Without a **performance row keyed to `output_id`**, monitoring has no home and
volume is just noise. It does not need to be automated now — even a hand-entered row per post
(`{output_id, platform, date, views, comments, ...}`) closes the loop and makes "what worked"
answerable. Automate the metric-pull later; reserve the shape now.

## The substance gate (no "looks good, says nothing" videos)

Format variety detaches from message when nobody checks. Rule: **no output exists without a `piece`
(brief) it traces to, and a check that the finished video still says that brief.** Variety lives in
*how* it says the message (hook, pacing, format, length); the *what* is locked to the brief. This gate
— you or a judge agent, as the last step before publish — is what stops N videos/month from becoming N
hollow ones. Record the verdict on the `output` row.

## Brand invariants vs. creative variables

Split what is locked from what is explored, so we can run wild creative variation without the brand
wobbling:

- **Invariants (locked, reusable, automatic — never re-litigated):** the character voice (colonel), the
  logo + reusable QR outro, the finger-hero style, the palette. These are *components*.
- **Variables (explicit, logged, trial-and-error):** campaign angle, hook, `edit.style`, format,
  length, CTA framing. These are *fields on the piece/output rows* — so every experiment is recorded
  and the performance loop can tell us which values won.

## Anti-sprawl rules (hold both sides to these)

1. **Records over prose.** New info → a field on an existing row, not a new markdown file.
2. **A new skill/cmd must COLLAPSE complexity, not add surface.** (`campaign.py status` earns its place;
   a fourth overlapping index does not.)
3. **Generated, never duplicated.** Indexes/queues are read-only views of the rows.
4. **No artifact without a stable ID and a schema.** If it can't be a row, don't create it.

## Do-now vs. defer

- **Now (free, ~one page of agreement — NOT code):** agree these 6 entities + the ID thread; reserve the
  **performance** row shape; adopt the substance gate. Enough that current files don't diverge from the
  target.
- **Defer (until querying markdown hurts):** the actual database. When "best-performing hook last month"
  becomes painful to answer by hand/grep, load the rows into SQLite in an afternoon — *because they were
  rows all along.*

## North star, in one line

**Treat it as a database from day one; store it in files until a database is worth it.**
