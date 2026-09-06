import { Story } from "./data";

// Brand-arrival derivations for the no-logo text stinger. Prefer the news API's v5 fields
// (`story.bg_word` / `story.bg_tone`) when present; fall back to local heuristics until they ship.
// Deterministic (no clock/random).

// The short subject word shown big: API bg_word → primary named org → first meaningful headline words.
export function brandWord(story: Story): string {
  if (story.bg_word && story.bg_word.trim()) return story.bg_word.trim();
  if (story.entities && story.entities.length) return story.entities[0];
  const stop = new Set(["the", "a", "an", "of", "for", "to", "and", "in", "on", "at", "new", "ai", "its"]);
  const words = (story.headline || "").split(/\s+/).filter((w) => w && !stop.has(w.toLowerCase()));
  return (words.slice(0, 2).join(" ") || story.headline || "").trim();
}

export type ToneKind = "launch" | "hot" | "money" | "shock" | "bad" | "neutral";
export type Tone = { tag: string; kind: ToneKind };

// tone kind → on-screen tagline (the video owns the tag text; the API only supplies the kind).
const TAG_BY_KIND: Record<ToneKind, string> = {
  launch: "LAUNCH!",
  hot: "IT'S HOT!",
  money: "BIG MONEY",
  shock: "ALERT!",
  bad: "OUCH",
  neutral: "BREAKING",
};

// Local fallback: category → tone kind (used only until the API carries bg_tone).
const CATEGORY_KIND: Record<string, ToneKind> = {
  PRODUCT: "launch",
  MODELS: "hot",
  SECURITY: "shock",
  BUSINESS: "money",
  HARDWARE: "launch",
  TOOLING: "neutral",
  "OPEN SOURCE": "neutral",
};

export function brandTone(story: Story): Tone {
  const apiKind = (story.bg_tone || "").toLowerCase() as ToneKind;
  const kind: ToneKind = TAG_BY_KIND[apiKind] ? apiKind : CATEGORY_KIND[(story.category || "").toUpperCase()] ?? "neutral";
  return { tag: TAG_BY_KIND[kind], kind };
}
