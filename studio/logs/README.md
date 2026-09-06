# Studio logs

Central, append-only record of production runs — the always-log-API-cost discipline in one place.

- **`runs.jsonl`** — one JSON line per meaningful run: `{ts, job, tool, model, input_tokens, output_tokens,
  cost_usd, note}`. Tools already print their per-call cost to stdout; this file is the durable roll-up.

Keep it append-only. A run that spends on a paid API (LLM, TTS, Gemini) should land a line here.

- **Agent-side Claude tokens per run** — after each video build/edit/re-render, run
  `node studio/tools/token-report.mjs --label "<run>"`. It reads the session transcript, sums
  tokens per model, and appends a `runs.jsonl` line whose `input_tokens`/`output_tokens`/`cost_usd`
  are the DELTA since the last token entry (that run's cost), plus `cc_cumulative` for the next
  delta. The `$` is an API-equivalent estimate (plan billing differs); the token counts + per-run
  delta are the signal. Log at run boundaries or the delta is not clean.
- **`api-usage.log`** (gitignored `*.log`) — raw per-call provider cost lines; `runs.jsonl` is the
  durable committed roll-up of both provider and agent-token cost.
