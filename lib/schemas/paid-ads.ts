import { z } from "zod";

import { obj, str, strArr } from "@/lib/schemas/jsonschema";

/**
 * The Paid Ads Generator's output bundle.
 *
 * Ad copy is a deliberate exception to "Convia splits the long-form piece."
 * Everywhere else, per-platform copy is an adaptation of something longer.
 * Here the limits are so tight -- roughly 30 characters for a Google
 * headline, 40 for Meta -- that writing to them IS the writing task, so
 * Jidoka generates per-network variants directly rather than trimming down
 * from one source. Reading ad spend and ROAS is a separate, unbuilt surface
 * (per-network ad-account access); this only ever writes copy.
 */
export const paidAdCopy = z.object({
  meta: z.object({
    headline: z.string(),
    primary_text: z.string(),
    description: z.string(),
  }),
  google: z.object({
    headlines: z.array(z.string()),
    descriptions: z.array(z.string()),
  }),
  tiktok: z.object({
    ad_text: z.string(),
  }),
  linkedin: z.object({
    headline: z.string(),
    intro_text: z.string(),
  }),
});
export type PaidAdCopyData = z.infer<typeof paidAdCopy>;

export const paidAdCopyJsonSchema = obj({
  meta: obj({
    headline: str("Meta/Instagram + Facebook ad headline, 40 characters or fewer"),
    primary_text: str("Meta primary text, 125 characters or fewer, the main body above the headline"),
    description: str("Meta description line, 30 characters or fewer"),
  }),
  google: obj({
    headlines: strArr("3 Google Ads headlines, each 30 characters or fewer, each a distinct angle"),
    descriptions: strArr("2 Google Ads descriptions, each 90 characters or fewer"),
  }),
  tiktok: obj({
    ad_text: str("TikTok ad text, 100 characters or fewer, native and curiosity-driven like an organic caption, not a banner ad"),
  }),
  linkedin: obj({
    headline: str("LinkedIn ad headline, 70 characters or fewer"),
    intro_text: str("LinkedIn intro text above the headline, 150 characters or fewer, professional register"),
  }),
});

/** One post from the last 30 days that the ad copy is written from. */
export const sourcePost = z.object({
  platform: z.string(),
  post_id: z.string().nullable(),
  caption: z.string().nullable(),
  performance_score: z.number(),
});
export type SourcePostData = z.infer<typeof sourcePost>;
