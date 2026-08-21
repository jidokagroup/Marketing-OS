import { generateStructured } from "@/lib/ai/anthropic";
import { buildDnaBrief, type DnaInput } from "@/lib/ai/generate";
import {
  paidAdCopy,
  paidAdCopyJsonSchema,
  type PaidAdCopyData,
  type SourcePostData,
} from "@/lib/schemas/paid-ads";

/**
 * Ranks a client's organic performance data and hands the top posts to Claude
 * to turn into per-network paid ad copy.
 *
 * Reading spend and ROAS needs read access to each ad account, which is a
 * separate integration per network and not built here. Writing the ads needs
 * none of that: performance_score is already computed on every row Convia
 * pushes to marketing_os_platform_analytics, so "top 30 days" is a query,
 * not an integration.
 */

const LOOKBACK_DAYS = 30;

export function lookbackDate(): string {
  return new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function buildSourcePosts(
  rows: {
    platform: string;
    post_id: string | null;
    caption: string | null;
    performance_score: number;
  }[],
  limit = 5,
): SourcePostData[] {
  return [...rows]
    .sort((a, b) => Number(b.performance_score) - Number(a.performance_score))
    .slice(0, limit)
    .map((row) => ({
      platform: row.platform,
      post_id: row.post_id,
      caption: row.caption,
      performance_score: Number(row.performance_score) || 0,
    }));
}

function sourcePostsBlock(posts: SourcePostData[]): string {
  return posts
    .map(
      (post, i) =>
        `${i + 1}. [${post.platform}, performance_score ${post.performance_score}] ${
          post.caption?.trim() || "(no caption on record)"
        }`,
    )
    .join("\n");
}

const SYSTEM_PROMPT =
  "You are the Paid Ads Generator inside a Marketing Operating System. You turn a " +
  "creator's own best-performing organic posts into paid ad copy for four networks, " +
  "written in the creator's voice, not generic ad-agency copy. Stay under every " +
  "character limit named in the schema -- these are hard platform limits, not " +
  "suggestions. Never invent numbers, offers, or claims that are not implied by the " +
  "source posts or the brand knowledge provided. Each network gets copy written for " +
  "how people actually read that network: TikTok reads like an organic caption, " +
  "LinkedIn reads professional, Meta and Google read like conversion ad copy.";

export async function runPaidAdGeneration(
  dna: DnaInput,
  sourcePosts: SourcePostData[],
): Promise<PaidAdCopyData> {
  const dnaBrief = buildDnaBrief(dna);
  const prompt = [
    dnaBrief ? `BRAND VOICE DNA\n${dnaBrief}` : "",
    "TOP-PERFORMING ORGANIC POSTS (last 30 days, ranked by performance_score)",
    sourcePostsBlock(sourcePosts),
    "",
    "Write paid ad copy for Meta, Google, TikTok, and LinkedIn that adapts the angle " +
      "and hook that already worked organically for this creator -- do not write from " +
      "scratch as if nothing is known about what performs.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return generateStructured({
    system: SYSTEM_PROMPT,
    prompt,
    jsonSchema: paidAdCopyJsonSchema,
    validator: paidAdCopy,
    maxTokens: 1500,
  });
}
