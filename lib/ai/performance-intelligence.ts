import { generateStructured } from "@/lib/ai/anthropic";
import { buildDnaBrief, type DnaInput } from "@/lib/ai/generate";
import {
  performanceIntelligenceReport,
  performanceIntelligenceReportJsonSchema,
  type PerformanceIntelligenceReportData,
} from "@/lib/schemas/performance-intelligence";

/**
 * Deeper analysis on a creator's own historical performance -- the
 * Market Intelligence upsell. Market Intelligence reports the market;
 * this reports the creator's own history.
 */

export type ScoredPost = {
  platform: string;
  caption: string | null;
  performance_score: number;
};

export type PerformanceTiers = {
  top: ScoredPost[];
  middle: ScoredPost[];
  bottom: ScoredPost[];
};

/** Split scored posts into top/middle/bottom quartiles by performance_score. */
export function tierPosts(posts: ScoredPost[]): PerformanceTiers {
  const sorted = [...posts].sort(
    (a, b) => Number(b.performance_score) - Number(a.performance_score),
  );
  const n = sorted.length;
  const topCut = Math.max(1, Math.ceil(n * 0.25));
  const bottomCut = Math.max(1, Math.ceil(n * 0.25));
  return {
    top: sorted.slice(0, topCut),
    middle: sorted.slice(topCut, Math.max(topCut, n - bottomCut)),
    bottom: sorted.slice(Math.max(topCut, n - bottomCut)),
  };
}

function tierBlock(label: string, posts: ScoredPost[]): string {
  if (posts.length === 0) return `${label}: (none)`;
  const lines = posts
    .slice(0, 8)
    .map(
      (post) =>
        `- [${post.platform}, score ${post.performance_score}] ${post.caption?.trim() || "(no caption on record)"}`,
    )
    .join("\n");
  return `${label} (${posts.length} posts):\n${lines}`;
}

const SYSTEM_PROMPT =
  "You are the Performance Intelligence engine inside a Marketing Operating System. " +
  "You analyze one creator's own published content, already tiered by measured " +
  "performance, and explain in plain terms what separates the top tier from the " +
  "bottom tier -- then turn that into specific, actionable recommendations. Never " +
  "give a generic best-practice recommendation that is not grounded in the tiers " +
  "you were given; if the data does not support a claim, say less rather than " +
  "invent a pattern.";

export async function runPerformanceIntelligence(
  dna: DnaInput,
  tiers: PerformanceTiers,
): Promise<PerformanceIntelligenceReportData> {
  const dnaBrief = buildDnaBrief(dna);
  const prompt = [
    dnaBrief ? `BRAND VOICE DNA\n${dnaBrief}` : "",
    "PERFORMANCE TIERS (by measured performance_score, last 90 days)",
    tierBlock("TOP QUARTILE", tiers.top),
    tierBlock("MIDDLE", tiers.middle),
    tierBlock("BOTTOM QUARTILE", tiers.bottom),
  ]
    .filter(Boolean)
    .join("\n\n");

  return generateStructured({
    system: SYSTEM_PROMPT,
    prompt,
    jsonSchema: performanceIntelligenceReportJsonSchema,
    validator: performanceIntelligenceReport,
    maxTokens: 2000,
  });
}
