// load-env.mjs — zero-dependency .env loader for the local studio's Node scripts.
//
// Side-effect import: `import '../../../scripts/load-env.mjs'` as the FIRST import in any script
// that reads API keys at module top-level. Loads the monorepo-root .env into process.env for any
// key NOT already set, so a key exported in the shell always wins over the file. Idempotent (ES
// module cache runs it once). Missing .env is fine — silently no-ops (scripts handle absent keys).
//
// Parser: KEY=VALUE per line; ignores blank lines and # comments; strips a leading `export `,
// surrounding quotes, and trailing \r (Windows). Splits on the FIRST = only (values may contain =).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// This file lives at <repo-root>/scripts/, so the root .env is one level up.
const ENV_PATH = process.env.STUDIO_ENV_FILE || join(dirname(fileURLToPath(import.meta.url)), '..', '.env');

let loaded = 0, skipped = 0;
if (existsSync(ENV_PATH)) {
  for (const rawLine of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    let line = rawLine.replace(/\r$/, '').trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice(7).trim();
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!key || val === '') continue;            // empty value = treat as unset
    if (process.env[key] !== undefined) { skipped++; continue; }  // shell wins
    process.env[key] = val;
    loaded++;
  }
  if (loaded || skipped) {
    console.error(`[env] loaded ${loaded} key(s) from ${ENV_PATH}${skipped ? ` (${skipped} already set in shell, kept)` : ''}`);
  }
}

export {};  // marker: this module's value is its side effect
