# Verdict Authority & Hygiene — the anti-override doctrine

Binding governance for the LEARN loop (the `quality-judge` and `skill-improver` skills, and anything that ingests human verdicts for training/self-improvement).

**The failure this prevents:** the system asserts "circle," the human correctly says "square," and the system overrides the human's correct label with its own opinion — poisoning the training set and inverting the entire point of a human-in-the-loop. A self-improving system that can discount human labels it disagrees with trains itself into confident wrongness.

---

## Three authorities (the frame — read first)

Not everything has the same *kind* of truth, so not everything has the same ground-truth owner. The judge already splits this (Lock 1 objective checks vs Lock 2 taste-proxy); the doctrine must too. There are **three authorities**:

- **Objective layer** — facts with a right answer: the mechanical checks (`video-checks.cjs` — determinism, CSS-animation, caption floor/overlap, QR scans) and factual/compliance facts (a stat is real or invented; a claim is true or false). **Ground truth = the check / the fact.** Neither an agent's opinion **nor** a human's taste-verdict relabels an objective fact. **"Circle vs square" lives here** — there is a fact of the matter, and the system must not override the human precisely because *reality says square and the human is tracking it*, not because the human "defines" truth.
- **Taste layer** — irreducibly subjective calls: is the finale cinematic, does it land, is the tone right. **Ground truth = the human's verdict, full stop.** Here "by construction" genuinely holds (the product is "predict the human's taste").
- **Agent opinion** — a prediction. **Authoritative for neither layer.**

**When an objective check and a human verdict conflict** (e.g. the human says "ship it" but `video-checks.cjs` flags a caption overlap): the check wins **on the fact** (the overlap is real), the human may still **choose to ship despite it**, and the system **records both** — "human accepted cut despite defect-X" — and *never silently resolves it to either side*. The human's accept does **not** relabel the defect as absent (that would erode the objective layer); it tunes whether that defect is ship-blocking. Below, "human verdict is ground truth" means the **taste** layer; on the objective layer the check/fact is ground truth.

---

## The seven rules

### 1. Human verdict is ground truth; agent output is only a prediction.
On any question a human has actually ruled on, the human's verdict **is the training label**. The agent's prior output (a judge prediction, an improver proposal) is recorded as **correct or a MISS against that label** — never as a competing label of equal standing. The agent predicts; the human decides; the label is the human's.

### 2. Disagreement is NEVER a junk criterion. (The anti-override rule.)
A human verdict may be filtered as junk **only** on provenance/consistency grounds (rule 3). It may **never** be filtered, discounted, down-weighted, or "re-interpreted" because it conflicts with the agent's opinion. Operationally: **the junk-filter must not have access to the agent's prediction at all.** If it cannot see whether the system agrees, it cannot use disagreement as a discard reason. This single rule is what stops circle/square override.

### 3. What legitimately makes a verdict junk (provenance/consistency only).
A verdict may be quarantined only if it trips one of these — none of which reference whether the system agrees:
- **Not-engaged** — rendered with no evidence the reviewer saw the artifact (e.g. a verdict stamped at/before the artifact opened; a multi-second glance on a multi-minute cut). *Engagement, not opinion.*
- **Internally contradictory** — self-conflicting within the same submission ("ship it" + "the finale is broken") with no resolution. *Consistency, not opinion.*
- **Empty / unattributable** — no content, or not traceable to a real reviewer (accidental input, automated noise). *Provenance, not opinion.*
- **Stale / out-of-scope** — about a different artifact or version than the one under review. *Scope, not opinion.*

### 4. Quarantine, never silently discard.
A verdict that trips a junk criterion is **quarantined and flagged for cheap human re-confirmation** ("This looked like X — did you mean it?"), not dropped by agent fiat. The "this is junk" call could itself be an override in disguise, so a human must confirm any discard. **Default on ambiguity: keep the human signal.**

### 5. Separation of powers.
The junk-filter must **not** be the judge — nor any agent whose opinion is under evaluation. An agent grading its own predictions must not also decide which human verdicts "count," or it will quietly discard dissent to protect its track record. Filtering is mechanical / provenance-based; any "this human verdict seems wrong" **escalates to a human**, it never resolves by the evaluated agent's authority.

### 6. Disagreement is the prize signal — and it updates the TASTE layer, not the objective layer.
A human verdict that **contradicts** the agent's *taste* prediction is the **most valuable** training data — it is precisely where the model's taste is wrong. The loop must **up-weight** such disagreements, never suppress them. But scope what the disagreement updates: a human "ship it" over an **objective** defect the checks flagged (a real caption overlap, a QR that doesn't scan) updates *whether that defect is ship-blocking* (it tunes the threshold) — it does **not** relabel the defect as absent or teach the system the check was wrong. Disagreement tunes taste and thresholds; it never deletes an objective fact. Corollary red flags:
- A suspiciously **high agreement rate with no misses** may mean the filter is eating dissent — investigate.
- A library that only ever **confirms** the agent's priors has stopped learning.

### 7. Asymmetry, not human-infallibility (and only on the taste layer).
This is not a claim that humans are always right in the abstract — and it is **not** a claim that a human can overrule an objective fact (see Three Authorities). It is that **on the taste layer, the human's rendered verdict is the label by construction** — the product is "predict the human's taste," so the human's call defines correctness *there*. On the objective layer the check/fact is ground truth, and a human who contradicts a verified fact (says "circle" of a provable square, or "it scans" when it doesn't) is recorded as accepting-despite-the-fact, not as relabelling it — surfaced via rule 4's confirmation, resolved by a human, never by the agent overruling. The doctrine forbids the agent overriding the human; it equally forbids a taste-verdict overriding a verified objective fact.

---

## How each component obeys this

- **quality-judge** — its verdict is a *prediction* (rule 1). When the human's actual verdict lands in `AGREEMENT.md`, a disagreement is logged as the judge's MISS (rule 6), never as a wrong human. The judge does **not** filter verdicts (rule 5 — it's the evaluated party). It never auto-approves.
- **skill-improver** — when weighing "past-video evidence," **human-labelled evidence outranks agent-generated evidence**; it must never discount a human label because it conflicts with the model's view (rules 1, 2). The improver's "code is ground truth" rule and this "human verdict is ground truth" rule are siblings: agents defer to the two authorities they cannot outrank — the running code and the human's verdict.
- **verdict intake (the junk-filter)** — a separate, provenance-based gate (rule 5). Mechanizable parts mirror the deterministic check suite: engagement (timestamp/dwell), non-empty, version/scope match. The judgemental part (internal contradiction) escalates to a human, never auto-discards (rule 4). The filter is **blind to the agent's opinion** (rule 2).

## Self-check (does an implementation honour the doctrine?)
- Could any code path discard/down-weight a human verdict *because the system disagrees*? If yes → rule 2 violated.
- Does the junk-filter have access to the agent's prediction? If yes → rule 2 at risk; sever it.
- Are junk-flagged verdicts discarded without human confirmation? If yes → rule 4 violated.
- Does the agent being evaluated also decide which verdicts count? If yes → rule 5 violated.
- Are disagreements down-weighted relative to confirmations? If yes → rule 6 inverted.
- Can a human *taste*-verdict relabel an **objective** fact as absent (e.g. "ship it" recorded as "no overlap")? If yes → Three Authorities / rule 7 violated; record accept-despite-the-fact instead.
- Is an objective-check-vs-human conflict ever silently resolved to one side? If yes → record both, resolve via human (Three Authorities).
