import { z } from "zod";

import { obj, str, num, strArr } from "@/lib/schemas/jsonschema";

/** The Content Generation Module output bundle. */
export const generatedContent = z.object({
  primary_script: z.string(),
  alternate_hooks: z.array(z.string()),
  alternate_ctas: z.array(z.string()),
  short_version: z.string(),
  long_version: z.string(),
  organic_version: z.string(),
  sales_version: z.string(),
});
export type GeneratedContentData = z.infer<typeof generatedContent>;

export const generatedContentJsonSchema = obj({
  primary_script: str("the main piece, fully in the creator's voice"),
  alternate_hooks: strArr("3-5 alternate opening hooks"),
  alternate_ctas: strArr("2-4 alternate calls to action"),
  short_version: str("a tighter, shorter cut"),
  long_version: str("an expanded, longer cut; if Blog post is selected, make this a complete blog post"),
  organic_version: str("a non-salesy, value-first cut"),
  sales_version: str("a conversion-focused cut; if Email is selected, make this a complete email draft with subject line and body"),
});

/** Quality Control Engine — the ten authenticity sub-scores (0-100). */
export const qualityScore = z.object({
  voice_match: z.number(),
  syntax_match: z.number(),
  hook_match: z.number(),
  story_match: z.number(),
  belief_match: z.number(),
  emotional_match: z.number(),
  phrase_match: z.number(),
  brand_accuracy: z.number(),
  knowledge_accuracy: z.number(),
  overall: z.number(),
  rationale: z.string(),
});
export type QualityScoreData = z.infer<typeof qualityScore>;

export const qualityScoreJsonSchema = obj({
  voice_match: num("0-100"),
  syntax_match: num("0-100"),
  hook_match: num("0-100"),
  story_match: num("0-100"),
  belief_match: num("0-100"),
  emotional_match: num("0-100"),
  phrase_match: num("0-100"),
  brand_accuracy: num("0-100"),
  knowledge_accuracy: num("0-100"),
  overall: num("0-100, the overall authenticity score"),
  rationale: str("brief justification and what to improve if below 90"),
});

export const MIN_ACCEPTABLE_SCORE = 90;
