import { z } from "zod";

import { obj, str, num, strArr } from "@/lib/schemas/jsonschema";

/**
 * The Content Generation Module output bundle.
 *
 * Scoped to what Jidoka owns: a short-form script, a blog post, and an
 * email. Short captions and carousel copy are Convia's distribution layer
 * (it splits one long-form piece across every platform), so they are not
 * generated here. Blog and email each get their own CTA -- reusing the
 * short-form script's social CTA on a blog or in an email read wrong (e.g.
 * "Comment X" on an email), so the three channels are written to be
 * genuinely distinct rather than one CTA string copied everywhere.
 */
export const generatedContent = z.object({
  primary_script: z.string(),
  alternate_hooks: z.array(z.string()),
  alternate_ctas: z.array(z.string()),
  long_version: z.string(),
  blog_cta: z.string(),
  blog_keywords: z.array(z.string()),
  blog_link_suggestions: z.array(z.string()),
  sales_version: z.string(),
  email_cta: z.string(),
});
export type GeneratedContentData = z.infer<typeof generatedContent>;

export const generatedContentJsonSchema = obj({
  primary_script: str("the main short-form script, fully in the creator's voice, CTA embedded"),
  alternate_hooks: strArr("3-5 alternate opening hooks"),
  alternate_ctas: strArr("2-4 alternate calls to action for the short-form script specifically"),
  long_version: str(
    "an expanded, longer cut; if Blog post is selected, make this a complete blog post with " +
      "markdown-style ## section headings, written to rank -- naturally work in the blog_keywords " +
      "rather than stuffing them",
  ),
  blog_cta: str(
    "A call to action styled for a blog reader (read/explore/download/subscribe), never the same " +
      "phrasing as the short-form script's social CTA (e.g. never 'comment X').",
  ),
  blog_keywords: strArr(
    "5-8 SEO/AEO keywords and phrases this post should target. Empty array if Blog post was not selected.",
  ),
  blog_link_suggestions: strArr(
    "3-5 internal link opportunities as plain guidance, e.g. 'Link \"our intake process\" to the " +
      "booking form' or 'Link this section to the Instagram post about X'. Not live URLs -- the user " +
      "wires up the actual link. Empty array if Blog post was not selected.",
  ),
  sales_version: str("a conversion-focused cut; if Email is selected, make this a complete email draft with subject line and body"),
  email_cta: str(
    "A call to action styled for an email reader (reply/click/book a call), never the same phrasing " +
      "as the short-form script's social CTA.",
  ),
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
