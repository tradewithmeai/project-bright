import type { SolvxStyle } from "./SolvxWordmark";

// The 21 unique historical solvx.uk designs, expressed as PRESETS of the one
// recolourable wordmark (3b === 4b were byte-identical → included once as 3b).
// Colours read from the per-logo palette isolation (studio/projects analysis).
// `bg` tells the showcase which side of a split light/dark tile carries it.
export const SOLVX_PRESETS: SolvxStyle[] = [
  { id: "1c", label: "outline · thin", bg: "light", weight: 400, fill: false, outline: "#101010", outlineWidth: 0.014 },
  { id: "2a", label: "outline · bold + white fill", bg: "light", weight: 600, fill: true, body: "#ffffff", outline: "#101010", outlineWidth: 0.05 },
  { id: "3a", label: "black + orange dot", bg: "light", weight: 500, body: "#141414", dot: "#f2751a" },
  { id: "3b", label: "cyan neon glow", bg: "dark", weight: 500, body: "#a6f2f2", glow: "#79e9ea" },
  { id: "3c", label: "gradient · purple→pink", bg: "light", weight: 500, gradient: ["#b070d0", "#f05070"], gradientAngle: 20 },
  { id: "3d", label: "black + green dot", bg: "light", weight: 500, body: "#141414", dot: "#3fae6b" },
  { id: "3e", label: "off-white + red dot", bg: "dark", weight: 500, body: "#f0f0f0", dot: "#9c2f2f" },
  { id: "3f", label: "white fill + black outline + orange dot", bg: "light", weight: 600, fill: true, body: "#ffffff", outline: "#141414", outlineWidth: 0.045, dot: "#f2751a" },
  { id: "3g", label: "solid orange", bg: "light", weight: 500, body: "#f2751a" },
  { id: "3h", label: "solid blue", bg: "light", weight: 500, body: "#2f74d0" },
  { id: "3i", label: "gradient · green", bg: "light", weight: 500, gradient: ["#12b47a", "#0f7d55"], gradientAngle: 20 },
  { id: "3j", label: "solid gold", bg: "dark", weight: 500, body: "#f0cf5f" },
  { id: "4a", label: "black + orange dot (v2)", bg: "light", weight: 500, body: "#141414", dot: "#f2803a" },
  { id: "4c", label: "gradient · coral→magenta", bg: "light", weight: 500, gradient: ["#b050b0", "#f07050"], gradientAngle: 20 },
  { id: "4d", label: "black + green dot (v2)", bg: "light", weight: 500, body: "#141414", dot: "#46c46f" },
  { id: "4e", label: "solid black", bg: "light", weight: 500, body: "#101010" },
  { id: "4f", label: "white fill + black outline + orange dot (v2)", bg: "light", weight: 600, fill: true, body: "#ffffff", outline: "#141414", outlineWidth: 0.045, dot: "#f2803a" },
  { id: "4g", label: "black + orange dot (v3)", bg: "light", weight: 500, body: "#141414", dot: "#f2803a" },
  { id: "4h", label: "solid indigo", bg: "light", weight: 500, body: "#5050d0" },
  { id: "4i", label: "gradient · green (v2)", bg: "light", weight: 500, gradient: ["#37b877", "#1f8f63"], gradientAngle: 20 },
  { id: "4j", label: "solid gold (v2)", bg: "dark", weight: 500, body: "#f0cf5f" },
];

// The house primary — the strong wordmark used as the hero in the showcase.
export const SOLVX_PRIMARY: SolvxStyle = { id: "3a", weight: 500, body: "#141414", dot: "#f2751a" };
