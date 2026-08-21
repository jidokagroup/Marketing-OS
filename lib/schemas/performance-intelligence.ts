import { z } from "zod";

import { obj, str, strArr } from "@/lib/schemas/jsonschema";

/**
 * Performance Intelligence — the Market Intelligence upsell.
 *
 * Market Intelligence reports the market: competitor moves, trends, gaps to
 * own. This reports the client's own history: which of their own posts
 * actually worked, what those posts had in common, and what to change next.
 * Tiering itself (top/middle/bottom) is computed in code from
 * performance_score, which is already on every analytics row -- Claude's job
 * is the qualitative read of WHY the top tier worked and what to do about it,
 * not the ranking itself.
 */
export const performanceIntelligenceReport = z.object({
  top_tier_pattern: z.string(),
  bottom_tier_pattern: z.string(),
  best_hooks: z.array(z.string()),
  best_ctas: z.array(z.string()),
  best_formats: z.array(z.string()),
  recommendations: z.array(
    z.object({
      do: z.string(),
      why: z.string(),
    }),
  ),
  summary: z.string(),
});
export type PerformanceIntelligenceReportData = z.infer<
  typeof performanceIntelligenceReport
>;

export const performanceIntelligenceReportJsonSchema = obj({
  top_tier_pattern: str(
    "2-3 sentences on what the top-performing tier of posts has in common -- hook style, format, topic, CTA, anything a pattern shows.",
  ),
  bottom_tier_pattern: str(
    "2-3 sentences on what the bottom tier has in common, stated plainly rather than diplomatically.",
  ),
  best_hooks: strArr("3-5 actual or paraphrased opening hooks from the top-tier posts, the ones worth repeating"),
  best_ctas: strArr("2-4 CTAs from the top-tier posts that drove action"),
  best_formats: strArr("2-4 concrete formats that worked, e.g. 'carousel with a proof-led opening slide', not just 'carousel'"),
  recommendations: {
    type: "array",
    items: obj({
      do: str("one concrete, specific action to take on the next piece of content"),
      why: str("the evidence from this creator's own data that supports it -- cite the pattern, not a generic best practice"),
    }),
    description: "3-6 recommendations, most impactful first",
  },
  summary: str("one paragraph: the single highest-leverage change to make next, and why it is the highest-leverage one"),
});
