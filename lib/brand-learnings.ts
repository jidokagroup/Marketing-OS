/**
 * What the system has learned about a client since Voice DNA was built.
 *
 * Voice DNA is an analysis of what a client already published. A learning is
 * something discovered afterwards: a phrase they strike out of every draft, a
 * hook style that outperformed, a CTA length that converted. Without somewhere
 * to put these, the same correction gets made again next week and the product
 * is no better in month six than in week one.
 *
 * Two rules shape everything here.
 *
 * Brand Brain never rewrites itself silently. A learning is proposed, a person
 * accepts it, and it stays visible, attributable and reversible — because a
 * writing agent that quietly changes how it sounds is one nobody can trust
 * with a client's voice.
 *
 * And confidence is expressed, not hidden. One person striking a word out once
 * is an observation; the same edit across nine drafts is a rule. Rendering
 * both as rules would put a guess and a finding in the same sentence, so the
 * wording changes with the evidence.
 */

export const LEARNING_KINDS = [
  "terminology",
  "prohibited_phrase",
  "cta_style",
  "emoji",
  "length",
  "voice_pattern",
  "positioning",
  "format",
  "other",
] as const;
export type LearningKind = (typeof LEARNING_KINDS)[number];

export const LEARNING_SOURCES = [
  "manual",
  "user_edit",
  "client_edit",
  "rejected_draft",
  "approved_draft",
  "publishing_performance",
  "revenue_attribution",
  "campaign_result",
  "performance_intelligence",
] as const;
export type LearningSource = (typeof LEARNING_SOURCES)[number];

export type LearningOrigin = "manual" | "performance";

export type BrandLearning = {
  id: string;
  statement: string;
  kind: LearningKind;
  source: LearningSource;
  origin: LearningOrigin;
  confidence: number;
  supporting_examples: number;
  active: boolean;
  learned_at: string;
};

/** Sources that mean "performance proved this" rather than "a person said so". */
const PERFORMANCE_SOURCES: LearningSource[] = [
  "publishing_performance",
  "revenue_attribution",
  "campaign_result",
  "performance_intelligence",
];

export function originForSource(source: LearningSource): LearningOrigin {
  return PERFORMANCE_SOURCES.includes(source) ? "performance" : "manual";
}

/** How the source reads to a person asking why the agent believes this. */
export const SOURCE_LABEL: Record<LearningSource, string> = {
  manual: "Added by you",
  user_edit: "From your edits",
  client_edit: "From the client's edits",
  rejected_draft: "From rejected drafts",
  approved_draft: "From approved drafts",
  publishing_performance: "From published performance",
  revenue_attribution: "From attributed revenue",
  campaign_result: "From campaign results",
  performance_intelligence: "From Performance Intelligence",
};

/**
 * Confidence from evidence.
 *
 * Deliberately saturating rather than linear: the difference between one
 * example and four is most of what there is to know, and the difference
 * between twenty and forty is nearly nothing. A person's explicit instruction
 * starts high because they are stating a preference, not providing evidence
 * for one.
 */
export function confidenceFor(source: LearningSource, supportingExamples: number): number {
  const examples = Math.max(0, Math.floor(supportingExamples));
  if (source === "manual") return examples > 1 ? 0.95 : 0.9;

  const floor = originForSource(source) === "performance" ? 0.3 : 0.4;
  const ceiling = 0.95;
  // Approaches the ceiling as evidence accumulates, never reaching certainty.
  const earned = 1 - 1 / (1 + examples * 0.6);
  return Math.min(ceiling, Math.max(floor, Number((floor + (ceiling - floor) * earned).toFixed(2))));
}

export type ConfidenceBand = "observed" | "likely" | "established";

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.8) return "established";
  if (confidence >= 0.55) return "likely";
  return "observed";
}

/** How much weight a reader should give it, in words rather than a number. */
export function confidenceLabel(learning: Pick<BrandLearning, "confidence" | "supporting_examples">) {
  const band = confidenceBand(learning.confidence);
  const examples = learning.supporting_examples;
  const evidence = `${examples} example${examples === 1 ? "" : "s"}`;

  if (band === "established") return `Established · ${evidence}`;
  if (band === "likely") return `Likely · ${evidence}`;
  return `Observed once · ${evidence}`;
}

/**
 * Renders active learnings for the generation prompt.
 *
 * Split by strength on purpose. A model given fifteen equally-worded rules
 * treats them all as absolute and writes something stilted; separating what
 * must be obeyed from what is merely a tendency is what keeps the output
 * sounding like the client rather than like a compliance document.
 *
 * Returns an empty string when there is nothing to say, so callers can
 * concatenate without checking.
 */
export function buildLearningsBrief(learnings: BrandLearning[]): string {
  const active = learnings.filter((learning) => learning.active);
  if (active.length === 0) return "";

  const ranked = active
    .slice()
    .sort((a, b) => b.confidence - a.confidence)
    // A prompt is finite and this section is not the most important part of
    // it; past a couple of dozen the weakest ones only dilute the strong ones.
    .slice(0, 24);

  const rules = ranked.filter((learning) => confidenceBand(learning.confidence) === "established");
  const tendencies = ranked.filter((learning) => confidenceBand(learning.confidence) !== "established");

  const lines: string[] = ["LEARNED PREFERENCES (what this client has taught us since the voice profile was built):"];

  if (rules.length) {
    lines.push(
      "Follow these — they are settled preferences, and breaking one is a mistake the client has already corrected:",
      ...rules.map((learning) => `- ${learning.statement}`),
    );
  }

  if (tendencies.length) {
    lines.push(
      "Lean towards these where they fit. They are patterns, not rules, so do not force one at the cost of the writing:",
      ...tendencies.map(
        (learning) =>
          `- ${learning.statement} (${learning.supporting_examples} example${
            learning.supporting_examples === 1 ? "" : "s"
          })`,
      ),
    );
  }

  return `${lines.join("\n")}\n`;
}

/**
 * Whether two statements are the same lesson.
 *
 * Matches the database's uniqueness rule so the app can merge before insert
 * rather than catching a constraint violation and guessing what to do with it.
 */
export function isSameLearning(a: string, b: string): boolean {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  return normalize(a) === normalize(b);
}

/**
 * Merging the same lesson learned again.
 *
 * Evidence accumulates and confidence is recomputed from it. The source of the
 * stronger claim wins, so a preference a person stated is not downgraded by a
 * weaker performance signal arriving later.
 */
export function mergeLearning(
  existing: Pick<BrandLearning, "source" | "supporting_examples" | "confidence">,
  incoming: Pick<BrandLearning, "source" | "supporting_examples">,
): { source: LearningSource; supporting_examples: number; confidence: number; origin: LearningOrigin } {
  const supporting = existing.supporting_examples + Math.max(1, incoming.supporting_examples);
  const source = existing.source === "manual" ? existing.source : incoming.source;
  return {
    source,
    supporting_examples: supporting,
    confidence: confidenceFor(source, supporting),
    origin: originForSource(source),
  };
}
