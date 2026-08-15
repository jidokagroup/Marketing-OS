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

export type ScanRecommendation = {
  focus: string;
  move: string;
  why: string;
};

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
  recommendations: ScanRecommendation[];
  summary: string;
};

const recommendationValidator = z.object({
  focus: z.string().min(2),
  move: z.string().min(10),
  why: z.string().min(10),
});

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
  recommendations: z.array(recommendationValidator).min(1),
  summary: z.string().min(20),
});

const recommendationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["focus", "move", "why"],
  properties: {
    focus: {
      type: "string",
      description: "Which category this recommendation draws on, e.g. 'Content gaps' or 'Offer tracker'.",
    },
    move: {
      type: "string",
      description:
        "The decision or next step for the team to make this week. A direction to brief, not finished copy for any platform.",
    },
    why: {
      type: "string",
      description: "One-sentence reasoning tying the move back to the scan data.",
    },
  },
};

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
    "recommendations",
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
    recommendations: {
      type: "array",
      minItems: 1,
      items: recommendationJsonSchema,
      description:
        "Exactly 3 recommended moves for the team to brief this week, ranked by impact. " +
        "Each is a decision (what to prioritize, what to test, what to fix) drawn from the " +
        "categories above — never a finished post, caption, or platform-specific copy, and " +
        "never a publishing or scheduling instruction.",
    },
    summary: {
      type: "string",
      description: "2-3 sentence brief on what competitors emphasize and where the client can win.",
    },
  },
};

/**
 * Upper bound per list, matching the counts in each schema description.
 * The model treats those as guidance, not limits, so they are enforced here.
 */
const MAX_ITEMS: Record<string, number> = {
  trending_topics: 6,
  hooks: 6,
  content_opportunities: 6,
  positioning: 5,
  content_gaps: 6,
  hook_library: 8,
  offer_tracker: 6,
  comment_themes: 6,
  opportunity_signals: 6,
};

const FIELD_LABELS = new Set(
  Object.keys(MAX_ITEMS).flatMap((field) => [field, field.replace(/_/g, " ")]),
);

/**
 * Clean one list from the model.
 *
 * Observed failure: instead of closing `trending_topics` and opening the next
 * field, the model kept writing into the first array — emitting a bare section
 * label (" hooks") followed by that section's content, every element carrying
 * the leading space of a comma-separated continuation. Each string is a valid
 * string, so the JSON Schema and zod both accept it and the label renders as a
 * one-word card in the UI.
 *
 * Dropping bare labels removes the marker, and capping the list drops the
 * spilled content after it, since the overflow always lands past the documented
 * count.
 */
function cleanList(field: string, items: string[]): string[] {
  const cleaned = items
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item) => !FIELD_LABELS.has(item.toLowerCase()));

  return cleaned.slice(0, MAX_ITEMS[field] ?? cleaned.length);
}

const MAX_RECOMMENDATIONS = 3;

function cleanRecommendations(items: ScanRecommendation[]): ScanRecommendation[] {
  return items
    .map((item) => ({
      focus: item.focus.trim(),
      move: item.move.trim(),
      why: item.why.trim(),
    }))
    .filter((item) => item.focus && item.move && item.why)
    .slice(0, MAX_RECOMMENDATIONS);
}

function cleanScan(scan: CompetitorScanResult): CompetitorScanResult {
  const cleaned = { ...scan };
  for (const field of Object.keys(MAX_ITEMS)) {
    const key = field as keyof CompetitorScanResult;
    const value = cleaned[key];
    if (Array.isArray(value)) {
      (cleaned[key] as string[]) = cleanList(field, value as string[]);
    }
  }
  cleaned.recommendations = cleanRecommendations(cleaned.recommendations);
  return cleaned;
}

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

  const scan = await generateStructured<CompetitorScanResult>({
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
      "Produce the intelligence report. Fill every field separately and keep " +
      "each one's content inside its own array — never continue one section's " +
      "list into the next field, and never emit a section name as a list item:\n" +
      "- trending_topics: 5-6 topics the client should cover\n" +
      "- hooks: 4-6 hooks to adapt\n" +
      "- content_opportunities: 4-6 content format opportunities\n" +
      "- positioning: 3-5 statements differentiating the client from these competitors\n" +
      "- content_gaps: 4-6 gaps\n" +
      "- hook_library: 6-8 reusable hook patterns\n" +
      "- offer_tracker: 4-6 offer or CTA signals\n" +
      "- comment_themes: 4-6 comment themes\n" +
      "- opportunity_signals: 4-6 opportunity signals\n" +
      "- recommendations: exactly 3 moves, ranked by impact, synthesized across the fields " +
      "above. Each is a decision to brief the team on this week (what to prioritize, test, " +
      "or fix) — never finished copy, a caption, or a publishing/scheduling instruction. " +
      "Content generation and distribution are handled downstream by a separate system.\n" +
      "- summary: what competitors emphasize and where this client can stand out",
    jsonSchema: scanJsonSchema,
    validator: scanValidator,
    maxTokens: 2500,
    timeoutMs: SCAN_TIMEOUT_MS,
  });

  return cleanScan(scan);
}
