// data.ts — the sample edition. One day's bulletin, as data.
//
// ── The shipped edition is DELIBERATELY SILENT, and that is a decision ────────────────────────
//
// Until this pass this file named `vo/intro.mp3`, `vo/1.mp3` … `vo/signoff.mp3` and
// `public/vo/` did not exist. That is not "optional audio": Remotion resolves an <Audio> src at
// render time, so a fresh clone did not render a quiet video — it died on
//
//     Error while downloading .../public/vo/intro.mp3: Received a status code of 404
//
// The repository's headline example could not be rendered by anyone who cloned it.
//
// The honest fix is one of two things, and only one of them was available. A voiced example would
// need a redistributable, licence-clean speech set; every route to one here is either a paid API
// (which would make the shipped example require a key) or third-party audio whose terms are not
// established. Synthesised voice-band tones would be worse than silence — they would be pretending
// to be speech in the one example meant to show the real thing.
//
// So the edition is silent BY DESIGN, not by omission. Every VO field is a real `null`, the render
// mounts no speech, and the section lengths come from the reading floors of the copy on screen
// rather than from a clip nobody can hear. The music bed and the SFX remain: both are synthesized
// in-house by scripts/make-audio-assets.mjs and are licence-clean.
//
// The voiced path is NOT removed. `vo`/`voFrames` on a story and `intro_vo`/`signoff_vo` on the
// bulletin still drive the mix and still drive section length — see storyBeatsFor in grid.ts. A
// regenerated edition (scripts/make-ai-top5.mjs --with-audio) populates them and the show speaks.
//
// ── Which fields do what ──────────────────────────────────────────────────────────────────────
//
//   RENDERED    n, category, cue, headline, beats, explainer, screen, entities, bg_word, bg_tone
//               brand, tagline, date, edition, bed
//   MIX         vo, voFrames, intro_vo, signoff_vo  (null here — see above)
//   REGENERATES so_what and detail feed scripts/write-script.mjs; voiceover is the text handed to
//               scripts/generate-vo.mjs; story_type is the aggregator's own classification, which
//               make-ai-top5.mjs resolves `category` from and the run record logs.
//
// Removed this pass, having been proved dead rather than merely unused-looking: `accent` (the
// palette comes from RANK_ACCENT and the generator never wrote it), `takeaway` (the on-screen
// kicker was cut on 2026-07-24 and nothing has read the field since), and `image_keywords` (the
// image generator builds its own concepts from the live feed and never read it).

export type Story = {
  n: number;
  // What the viewer SEES on the chip, the HUD and the rank line. Resolved in make-ai-top5.mjs from
  // the feed's `story_type` (a closed enum) and only falling back to its free-text `category`.
  // See story_type below for why.
  category: string;
  // API v7 (2026-08-03): the aggregator's closed classification —
  // LAUNCH | MONEY | POLICY | RESEARCH | TOOLING | CULTURE | INCIDENT.
  // Kept alongside `category` so the run record logs what the aggregator actually decided.
  story_type?: string;
  cue: string;
  headline: string;
  beats: string[];
  explainer?: string;        // 2-3 sentence "text explains" paragraph (API v4) — the reading layer
  entities?: string[];       // API v4: named orgs the story is about → real-logo background (Phase 3)
  bg_word?: string;          // API v5: short subject word for the no-logo brand-arrival stinger
  bg_tone?: string;          // API v5: tone enum (launch|hot|money|shock|bad|neutral) → effect + tag
  so_what?: string;          // API v6: the implication / "so what" — the SOLE input to the voice
  detail?: string;           // API v6: one concrete anchor fact (number/spec/name) — shown on screen
  screen?: string;           // app-written clean FACTS line for the reading layer (voice carries the why)
  voiceover: string;
  vo?: string | null;        // per-story spoken line mp3 (set by make-ai-top5 --with-audio); null = silent
  voFrames?: number | null;  // MEASURED length of that clip in frames — drives this story's section
                             // length (design bible §7 V2). Absent → the fixed budget is used.
};

export type Bulletin = {
  brand: string;
  tagline: string;
  date: string;
  edition: number;
  bed?: string | null;        // music-bed mp3 path (public/audio/bed.mp3) or null
  intro_vo?: string | null;   // ToP intro voiceover mp3 (vo/intro.mp3), played over the cold-open
  signoff_vo?: string | null; // presenter sign-off mp3 (vo/signoff.mp3), played over the sign-off card
  stories: Story[];
};

export const TODAY: Bulletin = {
  brand: "AI TOP 5",
  tagline: "the day's biggest AI news — counted down",
  date: "2026-08-03",
  edition: 1,
  bed: "audio/bed.mp3",
  intro_vo: null,
  signoff_vo: null,
  stories: [
    {
      n: 5,
      category: "RESEARCH",
      cue: "At number five this week…",
      headline: "Chain-of-Models for Bias Auditing",
      beats: ["Automates bias auditing", "Improves judgment accuracy"],
      explainer: "The Chain-of-Models framework aims to tackle the issue of cognitive biases in AI judgments by using a second model to audit the reasoning of the first. This innovative approach has shown improved accuracy in identifying biases across various models and datasets, making it a vital tool for ensuring fairness in AI evaluations. The findings could reshape how AI systems are audited and refined.",
      screen: "A new bias auditing method aims to improve fairness in A.I. judgments.",
      entities: [],
      bg_word: "Bias Auditing",
      bg_tone: "neutral",
      so_what: "For organizations using AI judges, implementing this auditing method could significantly reduce bias and enhance the fairness of automated decisions.",
      detail: "9 models evaluated",
      voiceover: "The Chain-of-Models approach introduces a novel way to audit AI judgments for cognitive biases. By employing a secondary model to evaluate the reasoning of the primary model, this method significantly enhances the accuracy of judgments, addressing the critical issue of bias in automated evaluations.",
    },
    {
      n: 4,
      category: "RESEARCH",
      cue: "In at number four…",
      headline: "Validity Audit of Agent-Safety",
      beats: ["Evaluates four safety benchmarks", "Correlates capability with safety"],
      explainer: "This research investigates the validity of agent-safety benchmarks, which are essential for assessing AI behavior. By testing four benchmarks on various models, the study uncovers significant discrepancies in their scoring and effectiveness. The findings emphasize the importance of precise metrics in safety claims, impacting how AI systems are evaluated and improved for safety.",
      screen: "Four A.I. safety benchmarks were validated for better reliability in assessments.",
      entities: [],
      bg_word: "Agent-Safety",
      bg_tone: "neutral",
      so_what: "For AI developers, understanding the validity of safety benchmarks can lead to more reliable assessments and improvements in AI safety protocols.",
      detail: "22 models tested",
      voiceover: "A new study has scrutinized the validity of various agent-safety benchmarks, revealing inconsistencies in how they measure safety. By analyzing four different benchmarks across multiple models, the research highlights the need for clearer definitions and metrics in evaluating AI safety, which is crucial for developing reliable AI systems.",
    },
    {
      n: 3,
      category: "TOOLING",
      cue: "Number three on the list…",
      headline: "condense-json 1.0 Released",
      beats: ["Simplifies JSON storage", "Reduces data duplication"],
      explainer: "condense-json 1.0 is designed to help developers efficiently manage JSON data by reducing redundancy. By implementing a unique syntax for duplicated strings, it allows for more compact storage, which is particularly beneficial for applications like SQLite logs generated by large language models. This update is a practical tool for developers looking to optimize their data handling.",
      screen: "Condense-json 1.0 released, optimizing JSON handling for developers.",
      entities: [],
      bg_word: "Condense-json",
      bg_tone: "launch",
      so_what: "With Condense-json in play, builders have a new option to weigh before committing their next build.",
      detail: "1.0",
      voiceover: "The release of condense-json 1.0 marks a significant milestone for developers working with JSON data. This library streamlines the storage of JSON by condensing duplicated data, making it easier to manage and more efficient for applications, especially those generating extensive logs.",
    },
    {
      n: 2,
      category: "MODELS",
      cue: "And at number two…",
      headline: "Meta AI's Memory Coach Agent",
      beats: ["Improves task accuracy by 8.3%", "Prevents error repetition"],
      explainer: "Meta AI's new memory coach agent addresses the challenge of AI agents forgetting previous errors during complex tasks. By maintaining a structured memory bank, this agent decides when to remind the main agent, effectively enhancing performance and reducing the likelihood of repeating mistakes. The results show significant improvements in accuracy, making this a promising development in AI task management.",
      screen: "Meta AI's memory coach agent improves task accuracy by 8.3%.",
      entities: ["Meta"],
      bg_word: "Memory Coach",
      bg_tone: "hot",
      so_what: "For teams relying on AI for complex tasks, this memory-coaching system could drastically improve performance and reduce costly errors.",
      detail: "8.3% accuracy boost",
      voiceover: "Meta AI has introduced a novel approach to improve the reliability of AI agents during complex tasks. By utilizing a secondary memory agent, the system helps the main agent avoid repeating past mistakes, leading to a notable increase in task accuracy across benchmarks.",
    },
    {
      n: 1,
      category: "TOOLING",
      cue: "Which brings us to number one…",
      headline: "Embabel Agent Framework 1.0 Released",
      beats: ["Supports Java and Kotlin", "Integrates with Spring AI"],
      explainer: "The Embabel framework enables developers to define AI agents as typed domain objects, enhancing the development process. Built on Spring AI, it supports various model providers and combines planning with predefined state machines, making it a versatile tool for AI workflows. This release is significant for developers looking to streamline their agent implementations.",
      screen: "Embabel Agent Framework 1.0 released for Java and Kotlin developers.",
      entities: ["Embabel"],
      bg_word: "Embabel",
      bg_tone: "launch",
      so_what: "If you're developing AI agents in Java or Kotlin, this framework could significantly simplify your workflow and enhance your project capabilities.",
      detail: "1.0",
      voiceover: "Embabel has officially launched its 1.0 version, providing a robust framework for AI agents tailored for Java and Kotlin developers. By integrating with Spring AI, it allows for greater flexibility in defining agents, making it easier to create complex workflows.",
    },
  ],
};
