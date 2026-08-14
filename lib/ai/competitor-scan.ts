import { z } from "zod";

import { generateStructured } from "./anthropic";
import { fetchPageText } from "../extract/html";

/**
 * Competitor scan agent: reads competitor websites and produces a
 * client-specific intelligence report (topics, hooks, content formats).
 */

// Sites are fetched in parallel, so raising this costs one extra prompt's worth
// of input tokens rather than extra wall-clock time. Kept well under the
// watchlist sizes people actually paste so the prompt stays focused.
const MAX_SITES = 12;
const MAX_SITE_CHARS = 3500;
const SITE_FETCH_TIMEOUT_MS = 8000;

// The scan runs in a Netlify background function (~15 min budget), not in a
// request handler. Generating ten populated arrays takes well over a minute, so
// this is sized for the model finishing rather than for a request deadline.
// The SDK retries once on timeout, so worst case is roughly double this.
const SCAN_TIMEOUT_MS = 240_000;

export type ScanClient = {
  name: string;
  industry: string | null;
  notes: string | null;
} | null;

export type CompetitorScanResult = {
  trending_topics: string[];
  hooks: string[];
  content_opportunities: string[];
  positioning: string[];
  content_gaps: string[];
  hook_library: string[];
  offer_tracker: string[];
  comment_themes: string[];
  opportunity_signals: string[];
  summary: string;
};

const scanValidator = z.object({
  trending_topics: z.array(z.string()).min(1),
  hooks: z.array(z.string()).min(1),
  content_opportunities: z.array(z.string()).min(1),
  positioning: z.array(z.string()).min(1),
  content_gaps: z.array(z.string()).min(1),
  hook_library: z.array(z.string()).min(1),
  offer_tracker: z.array(z.string()).min(1),
  comment_themes: z.array(z.string()).min(1),
  opportunity_signals: z.array(z.string()).min(1),
  summary: z.string().min(20),
});

const scanJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "trending_topics",
    "hooks",
    "content_opportunities",
    "positioning",
    "content_gaps",
    "hook_library",
    "offer_tracker",
    "comment_themes",
    "opportunity_signals",
    "summary",
  ],
  properties: {
    // Note: the structured-output API only supports minItems of 0 or 1, so
    // item counts are steered via descriptions and the prompt instead.
    trending_topics: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
      description:
        "Exactly 5-6 topic ideas the client should post about, informed by competitor positioning.",
    },
    hooks: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
      description: "Exactly 4-6 scroll-stopping opening lines the client can adapt.",
    },
    content_opportunities: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
      description:
        "Exactly 4-6 content formats or angles competitors use well or leave open.",
    },
    positioning: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
      description:
        "Exactly 3-5 statements on how the client should position against these competitors: unique angles, differentiators, and messaging stances the competitors leave open.",
    },
    content_gaps: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
      description:
        "Exactly 4-6 gaps where competitors cover an audience need that the client should address more clearly.",
    },
    hook_library: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
      description:
        "Exactly 6-8 reusable hook patterns tagged by likely channel or format.",
    },
    offer_tracker: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
      description:
        "Exactly 4-6 offers, lead magnets, CTAs, booking paths, or conversion moves detected or logically inferred from the public websites.",
    },
    comment_themes: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
      description:
        "Exactly 4-6 likely buyer questions, objections, complaints, or comment-to-DM triggers based on the competitor material.",
    },
    opportunity_signals: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
      description:
        "Exactly 4-6 directional opportunity signals combining likely velocity, save/share value, relevance, and saturation. Do not invent exact performance metrics.",
    },
    summary: {
      type: "string",
      description: "2-3 sentence brief on what competitors emphasize and where the client can win.",
    },
  },
};

async function fetchSiteExcerpts(websites: string[]) {
  const urls = websites
    .filter((site) => site.startsWith("http://") || site.startsWith("https://"))
    .slice(0, MAX_SITES);

  const settled = await Promise.allSettled(
    urls.map((url) => fetchPageText(url, SITE_FETCH_TIMEOUT_MS)),
  );

  return urls.map((url, index) => {
    const result = settled[index];
    return result.status === "fulfilled"
      ? { url, text: result.value.slice(0, MAX_SITE_CHARS) }
      : { url, text: "" };
  });
}

export async function runCompetitorScan({
  client,
  websites,
}: {
  client: ScanClient;
  websites: string[];
}): Promise<CompetitorScanResult> {
  const excerpts = await fetchSiteExcerpts(websites);
  const fetched = excerpts.filter((excerpt) => excerpt.text);

  const clientBlock = client
    ? `CLIENT: ${client.name}${client.industry ? ` — industry: ${client.industry}` : ""}${
        client.notes ? `\nNotes: ${client.notes}` : ""
      }`
    : "CLIENT: a marketing client (no specific client selected).";

  const competitorBlock = fetched.length
    ? fetched
        .map((excerpt) => `--- COMPETITOR SITE: ${excerpt.url} ---\n${excerpt.text}`)
        .join("\n\n")
    : `No competitor site content could be fetched. Watchlist entries:\n${websites.join("\n")}`;

  return generateStructured({
    system:
      "You are a social media competitor analyst for a marketing agency. " +
      "You study competitor websites and produce concrete, education-first content " +
      "ideas the agency's client can post across Instagram, Facebook, YouTube, X, " +
      "TikTok, and email. Health-related ideas must stay compliance-safe: no " +
      "medical claims, no promises of outcomes. Every idea must be specific enough " +
      "to write a post from, and tailored to the client — not generic marketing advice.",
    prompt:
      `${clientBlock}\n\n` +
      `COMPETITOR RESEARCH MATERIAL:\n${competitorBlock}\n\n` +
      "Produce the intelligence report: 5-6 trending topics the client should " +
      "cover, 4-6 hooks to adapt, 4-6 content format opportunities, 3-5 " +
      "positioning statements that differentiate the client from these " +
      "competitors, 4-6 content gaps, 6-8 hook-library entries, 4-6 offer " +
      "or CTA signals, 4-6 comment themes, 4-6 opportunity signals, and a " +
      "short summary of what competitors emphasize and where this client can stand out.",
    jsonSchema: scanJsonSchema,
    validator: scanValidator,
    maxTokens: 2500,
    timeoutMs: SCAN_TIMEOUT_MS,
  });
}
