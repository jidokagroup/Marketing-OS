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

// The scan runs in a Netlify background function, so it can afford real time
// instead of the tight caps a request/response cycle would force -- but not
// unlimited time: the platform kills the worker at ~15 minutes, and a killed
// worker never runs its catch block, stranding the row at `running` forever.
// The SDK retries once on timeout, so this is doubled in the worst case; at
// 180s that is 6 minutes, which leaves room for the site fetches, the platform
// API calls, and the web-search pass inside the 15-minute budget.
const SCAN_TIMEOUT_MS = 180_000;
const SCAN_MAX_RETRIES = 1;

export type ScanClient = {
  name: string;
  industry: string | null;
  notes: string | null;
  /** What a strategist observed in-app; no API exposes competitor audio trends. */
  trending_audio_notes?: string | null;
} | null;

/** One insight, traceable back to the competitor page it was drawn from. */
export type ScanInsight = {
  insight: string;
  source_url: string | null;
};

export type ScanRecommendation = {
  focus: string;
  move: string;
  why: string;
};

export type CompetitorScanResult = {
  trending_topics: ScanInsight[];
  hooks: ScanInsight[];
  content_formats: ScanInsight[];
  positioning: ScanInsight[];
  content_gaps: ScanInsight[];
  hook_library: ScanInsight[];
  offer_tracker: ScanInsight[];
  comment_themes: ScanInsight[];
  opportunity_signals: ScanInsight[];
  competitor_wins: ScanInsight[];
  recommended_posts: ScanInsight[];
  recommendations: ScanRecommendation[];
  opportunity_score: number;
  content_gap_score: number;
  summary: string;
};

const insightValidator = z.object({
  insight: z.string().min(3),
  source_url: z.string().nullable(),
});

const recommendationValidator = z.object({
  focus: z.string().min(2),
  move: z.string().min(10),
  why: z.string().min(10),
});

const scanShape = {
  trending_topics: z.array(insightValidator).min(1),
  hooks: z.array(insightValidator).min(1),
  content_formats: z.array(insightValidator).min(1),
  positioning: z.array(insightValidator).min(1),
  content_gaps: z.array(insightValidator).min(1),
  hook_library: z.array(insightValidator).min(1),
  offer_tracker: z.array(insightValidator).min(1),
  comment_themes: z.array(insightValidator).min(1),
  opportunity_signals: z.array(insightValidator).min(1),
  competitor_wins: z.array(insightValidator).min(1),
  recommended_posts: z.array(insightValidator).min(1),
  recommendations: z.array(recommendationValidator).min(1),
  opportunity_score: z.number().min(0).max(100),
  content_gap_score: z.number().min(0).max(100),
  summary: z.string().min(20),
};

const scanValidator = z.object(scanShape);

/**
 * The validator for one group, picked from the full shape so a group can never
 * validate against a different rule than the whole report does.
 */
function groupValidator(fields: readonly string[]) {
  return z.object(
    Object.fromEntries(
      fields.map((field) => [field, scanShape[field as keyof typeof scanShape]]),
    ) as Record<string, z.ZodTypeAny>,
  );
}

const insightJsonSchema = (description: string) => ({
  type: "array",
  minItems: 1,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["insight", "source_url"],
    properties: {
      insight: { type: "string", description: "The insight itself, specific enough to act on." },
      source_url: {
        type: ["string", "null"],
        description:
          "The exact competitor URL (from COMPETITOR RESEARCH MATERIAL) this was drawn from, so the " +
          "user can open it for context. Null only for a judgment synthesized across multiple sites.",
      },
    },
  },
  description,
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
        "The decision or next step for the team to make this week, specific to this client's industry " +
        "and audience -- not generic marketing advice. A direction to brief, not finished copy for any platform.",
    },
    why: {
      type: "string",
      description: "One-sentence reasoning tying the move back to specific scan data.",
    },
  },
};

export const scanJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "trending_topics",
    "hooks",
    "content_formats",
    "positioning",
    "content_gaps",
    "hook_library",
    "offer_tracker",
    "comment_themes",
    "opportunity_signals",
    "competitor_wins",
    "recommended_posts",
    "recommendations",
    "opportunity_score",
    "content_gap_score",
    "summary",
  ],
  properties: {
    // Note: the structured-output API only supports minItems of 0 or 1, so
    // item counts are steered via descriptions and the prompt instead.
    trending_topics: insightJsonSchema(
      "Exactly 5-6 topic ideas the client should post about, specific to their industry and audience, informed by competitor positioning.",
    ),
    hooks: insightJsonSchema("Exactly 4-6 scroll-stopping opening lines the client can adapt."),
    content_formats: insightJsonSchema(
      "Exactly 4-6 content formats or angles competitors use well or leave open (e.g. carousel breakdowns, myth-busting reels, comment-to-DM posts).",
    ),
    positioning: insightJsonSchema(
      "Exactly 3-5 statements on how the client should stand out from these specific competitors while staying " +
        "competitive on what actually matters to buyers in this category -- not just 'be different', but " +
        "different in a way that still wins the sale.",
    ),
    content_gaps: insightJsonSchema(
      "Exactly 4-6 gaps where competitors cover an audience need that the client should address more clearly.",
    ),
    hook_library: insightJsonSchema("Exactly 6-8 reusable hook patterns tagged by likely channel or format."),
    offer_tracker: insightJsonSchema(
      "Exactly 4-6 specific offers, lead magnets, CTAs, or booking paths seen or clearly implied on the " +
        "competitor sites -- concrete enough that the client can decide whether to test something similar " +
        "or deliberately not compete on it.",
    ),
    comment_themes: insightJsonSchema(
      "Exactly 4-6 likely buyer questions, objections, complaints, or comment-to-DM triggers based on the competitor material.",
    ),
    opportunity_signals: insightJsonSchema(
      "Exactly 4-6 directional opportunity signals combining likely velocity, save/share value, relevance, and saturation. Do not invent exact performance metrics.",
    ),
    competitor_wins: insightJsonSchema(
      "Exactly 3-5 observations about HOW these competitors execute, not what they talk about: content format " +
        "mix (stories vs. short-form vs. long-form vs. blog), posting cadence, which formats actually earn " +
        "engagement, editing or production patterns, voiceover vs. music-led, on-screen text style, or " +
        "trending audio. Ground these in COMPETITOR EXECUTION DATA (real platform API numbers) first and cite " +
        "the specific figures; TikTok web-search findings are lower confidence, so label them as approximate. " +
        "For audio specifically, use TRENDING AUDIO NOTES if present and say it came from the strategist's own " +
        "observation; if there are no such notes, do not name any trending sound -- no API exposes that data. " +
        "For any account listed under NO EXECUTION DATA AVAILABLE, say so plainly instead of guessing. " +
        "Never a topic or content idea here.",
    ),
    recommended_posts: insightJsonSchema(
      "Exactly 4-6 concrete, ready-to-brief post concepts (format + specific angle) synthesized from the " +
        "findings above, tailored to this client's industry and audience -- not generic post ideas.",
    ),
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
    opportunity_score: {
      type: "number",
      description:
        "Your honest 0-100 judgment of how much real opportunity this client has against these specific " +
        "competitors right now, based on what the scan found -- not a formula, an assessment. Vary it: a " +
        "thin, saturated field scores low; a field with clear open gaps and weak competitor execution scores high.",
    },
    content_gap_score: {
      type: "number",
      description:
        "Your honest 0-100 judgment of how large and addressable the content gaps are for this client, based " +
        "on what the scan found. Vary it based on the actual size and clarity of the gaps identified above.",
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
  content_formats: 6,
  positioning: 5,
  content_gaps: 6,
  hook_library: 8,
  offer_tracker: 6,
  comment_themes: 6,
  opportunity_signals: 6,
  competitor_wins: 5,
  recommended_posts: 6,
};

const FIELD_LABELS = new Set(
  Object.keys(MAX_ITEMS).flatMap((field) => [field, field.replace(/_/g, " ")]),
);

/**
 * Clean one list from the model.
 *
 * Observed failure (string-array era): instead of closing one field and
 * opening the next, the model kept writing into the first array, emitting a
 * bare section label followed by that section's content. Each insight's text
 * is checked the same way here, since the failure mode is about the model's
 * list-boundary behavior, not the item shape.
 */
function cleanList(field: string, items: ScanInsight[]): ScanInsight[] {
  const cleaned = items
    .map((item) => ({ insight: item.insight.trim(), source_url: item.source_url?.trim() || null }))
    .filter((item) => item.insight.length > 0)
    .filter((item) => !FIELD_LABELS.has(item.insight.toLowerCase()));

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

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function cleanScan(scan: CompetitorScanResult): CompetitorScanResult {
  const cleaned = { ...scan };
  for (const field of Object.keys(MAX_ITEMS)) {
    const key = field as keyof CompetitorScanResult;
    const value = cleaned[key];
    if (Array.isArray(value)) {
      (cleaned[key] as ScanInsight[]) = cleanList(field, value as ScanInsight[]);
    }
  }
  cleaned.recommendations = cleanRecommendations(cleaned.recommendations);
  cleaned.opportunity_score = clampScore(cleaned.opportunity_score);
  cleaned.content_gap_score = clampScore(cleaned.content_gap_score);
  return cleaned;
}

export async function fetchSiteExcerpts(websites: string[]) {
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

/**
 * The report, split into four model calls instead of one.
 *
 * The single call asked for thirteen arrays inside one 8,000-token response.
 * When the model reached the ceiling it stopped mid-array, and the JSON that
 * came back could not be parsed — so a scan that had already fetched every
 * competitor site produced nothing at all. Each group here has its own token
 * budget, its own schema and its own retry, and a group that fails costs its
 * own sections rather than the report.
 *
 * The grouping is by what a section is *about*, so each call has one job and
 * a coherent set of instructions rather than thirteen unrelated ones.
 */
export const SCAN_SECTION_GROUPS = [
  {
    key: "messaging",
    label: "competitor messaging",
    fields: ["trending_topics", "hooks", "hook_library"] as const,
    maxTokens: 3000,
    instruction:
      "Read what these competitors are actually saying and how they open. " +
      "Produce:\n" +
      "- trending_topics: 5-6 topics the client should cover\n" +
      "- hooks: 4-6 hooks to adapt\n" +
      "- hook_library: 6-8 reusable hook patterns tagged by channel or format",
  },
  {
    key: "gaps",
    label: "positioning and gaps",
    fields: ["content_formats", "content_gaps", "positioning"] as const,
    maxTokens: 3000,
    instruction:
      "Find where these competitors leave room. Produce:\n" +
      "- content_formats: 4-6 format opportunities\n" +
      "- content_gaps: 4-6 gaps where a buyer need is underserved\n" +
      "- positioning: 3-5 statements on standing out while staying competitive",
  },
  {
    key: "execution",
    label: "how competitors sell and execute",
    fields: [
      "offer_tracker",
      "comment_themes",
      "opportunity_signals",
      "competitor_wins",
    ] as const,
    maxTokens: 3500,
    instruction:
      "Read how these competitors sell and how they execute. Produce:\n" +
      "- offer_tracker: 4-6 specific offer or CTA signals actually seen or implied\n" +
      "- comment_themes: 4-6 buyer questions, objections or comment-to-DM triggers\n" +
      "- opportunity_signals: 4-6 directional signals; invent no exact metrics\n" +
      "- competitor_wins: 3-5 observations on HOW they execute (format mix, cadence, " +
      "which formats earn engagement, editing style, voiceover vs. music, trending " +
      "audio) — never topics or content ideas. Cite the execution figures above, and " +
      "state plainly where no execution data was available rather than guessing",
  },
] as const;

export type ScanSectionGroup = (typeof SCAN_SECTION_GROUPS)[number];

/**
 * The closing call. Deliberately reads the *summaries* the earlier groups
 * produced rather than the raw competitor pages, which keeps its input small
 * and stops the synthesis from re-deriving everything under a token ceiling.
 */
export const SCAN_SYNTHESIS_FIELDS = [
  "recommended_posts",
  "recommendations",
  "opportunity_score",
  "content_gap_score",
  "summary",
] as const;

function groupSchema(fields: readonly string[]) {
  const properties = scanJsonSchema.properties as Record<string, unknown>;
  return {
    type: "object",
    additionalProperties: false,
    required: [...fields],
    properties: Object.fromEntries(
      fields.map((field) => [field, properties[field]]),
    ),
  };
}

const SCAN_SYSTEM =
  "You are a social media competitor analyst for a marketing agency. " +
  "You study competitor websites and produce concrete, education-first content " +
  "ideas the agency's client can post across Instagram, Facebook, YouTube, X, " +
  "TikTok, and email. Health-related ideas must stay compliance-safe: no " +
  "medical claims, no promises of outcomes. Every idea must be specific enough " +
  "to write a post from, tailored to the client's specific industry and audience " +
  "— never generic marketing advice that could apply to any business. Every " +
  "insight must be grounded in the actual competitor research material provided " +
  "— never invented — and cited back to the specific URL it came from wherever " +
  "that's possible.";

const GROUP_RULES =
  "Fill every field separately and keep each one's content inside its own " +
  "array — never continue one section's list into the next field, and never " +
  "emit a section name as a list item. Tailor every field to this client's " +
  "specific industry and audience, not generic marketing advice, and cite the " +
  "source_url each insight came from whenever it traces to one competitor page.";

export type ScanContext = {
  clientBlock: string;
  competitorBlock: string;
  executionBrief: string;
  audioBlock: string;
  gapBlock: string;
};

function contextPrompt(context: ScanContext) {
  return (
    `${context.clientBlock}\n\n` +
    `COMPETITOR RESEARCH MATERIAL:\n${context.competitorBlock}\n` +
    `${context.executionBrief}\n${context.audioBlock}\n${context.gapBlock}\n\n`
  );
}

/**
 * Runs one group. Throws on a group that cannot be produced, so the caller can
 * record which sections are missing and still finish the report.
 */
export async function runScanSectionGroup(
  group: ScanSectionGroup,
  context: ScanContext,
): Promise<Partial<CompetitorScanResult>> {
  const result = await generateStructured<Partial<CompetitorScanResult>>({
    system: SCAN_SYSTEM,
    prompt: `${contextPrompt(context)}${GROUP_RULES}\n\n${group.instruction}`,
    jsonSchema: groupSchema(group.fields),
    validator: groupValidator(group.fields) as never,
    maxTokens: group.maxTokens,
    timeoutMs: SCAN_TIMEOUT_MS,
    maxRetries: SCAN_MAX_RETRIES,
  });
  return result;
}

/** The synthesis call, fed from what the groups already produced. */
export async function runScanSynthesis(
  context: ScanContext,
  sections: Partial<CompetitorScanResult>,
): Promise<Partial<CompetitorScanResult>> {
  // Only the insight text is carried forward. Sending the full objects back
  // would rebuild the very payload the split exists to avoid.
  const digest = Object.entries(sections)
    .filter(([, value]) => Array.isArray(value))
    .map(([field, value]) => {
      const items = (value as { insight?: string }[])
        .map((item) => item?.insight)
        .filter(Boolean)
        .slice(0, 8);
      return `${field.toUpperCase()}:\n${items.map((item) => `- ${item}`).join("\n")}`;
    })
    .join("\n\n");

  return generateStructured<Partial<CompetitorScanResult>>({
    system: SCAN_SYSTEM,
    prompt:
      `${context.clientBlock}\n\n` +
      `FINDINGS FROM THIS SCAN:\n${digest || "No sections were produced."}\n\n` +
      "Synthesize the findings above. Produce:\n" +
      "- recommended_posts: 4-6 concrete, ready-to-brief post concepts for this client\n" +
      "- recommendations: exactly 3 moves, ranked by impact. Each is a decision to " +
      "brief the team on this week — never finished copy, a caption, or a " +
      "publishing instruction\n" +
      "- opportunity_score / content_gap_score: your genuine 0-100 judgment for this " +
      "client and these competitors, moving with what the scan actually found\n" +
      "- summary: what competitors emphasize and where this client can stand out",
    jsonSchema: groupSchema(SCAN_SYNTHESIS_FIELDS),
    validator: groupValidator(SCAN_SYNTHESIS_FIELDS) as never,
    maxTokens: 2500,
    timeoutMs: SCAN_TIMEOUT_MS,
    maxRetries: SCAN_MAX_RETRIES,
  });
}

/** Assembles the prompt blocks once, so every group reads the same context. */
export function buildScanContext({
  client,
  websites,
  executionBrief = "",
  executionGaps = [],
  excerpts,
}: {
  client: ScanClient;
  websites: string[];
  executionBrief?: string;
  executionGaps?: { url: string; reason: string }[];
  excerpts: { url: string; text: string }[];
}): ScanContext {
  const fetched = excerpts.filter((excerpt) => excerpt.text);

  return {
    clientBlock: client
      ? `CLIENT: ${client.name}${client.industry ? ` — industry: ${client.industry}` : ""}${
          client.notes ? `\nAudience / ICP / notes: ${client.notes}` : ""
        }`
      : "CLIENT: a marketing client (no specific client selected).",
    competitorBlock: fetched.length
      ? fetched
          .map((excerpt) => `--- COMPETITOR SITE: ${excerpt.url} ---\n${excerpt.text}`)
          .join("\n\n")
      : `No competitor site content could be fetched. Watchlist entries:\n${websites.join("\n")}`,
    executionBrief,
    audioBlock: client?.trending_audio_notes?.trim()
      ? "\nTRENDING AUDIO NOTES (observed in-app by the client's strategist — treat as " +
        "first-party observation, more reliable than inference, and the only audio " +
        "source available; do not contradict or embellish it):\n" +
        client.trending_audio_notes.trim()
      : "",
    gapBlock: executionGaps.length
      ? "\nNO EXECUTION DATA AVAILABLE FOR THESE ACCOUNTS (say so plainly in competitor_wins " +
        "rather than guessing how they execute):\n" +
        executionGaps.map((gap) => `- ${gap.url}: ${gap.reason}`).join("\n")
      : "",
  };
}

export async function runCompetitorScan({
  client,
  websites,
  executionBrief = "",
  executionGaps = [],
}: {
  client: ScanClient;
  websites: string[];
  /** Real platform-API execution data (Instagram/YouTube), if any. */
  executionBrief?: string;
  /** Watchlist entries with no execution data, and why. */
  executionGaps?: { url: string; reason: string }[];
}): Promise<CompetitorScanResult> {
  const excerpts = await fetchSiteExcerpts(websites);
  const fetched = excerpts.filter((excerpt) => excerpt.text);

  const clientBlock = client
    ? `CLIENT: ${client.name}${client.industry ? ` — industry: ${client.industry}` : ""}${
        client.notes ? `\nAudience / ICP / notes: ${client.notes}` : ""
      }`
    : "CLIENT: a marketing client (no specific client selected).";

  // Hand-entered audio observations. Treated as first-party evidence: a human
  // watched the feed, which is the only reliable source for this right now.
  const audioBlock = client?.trending_audio_notes?.trim()
    ? "\nTRENDING AUDIO NOTES (observed in-app by the client's strategist — treat as " +
      "first-party observation, more reliable than inference, and the only audio " +
      "source available; do not contradict or embellish it):\n" +
      client.trending_audio_notes.trim()
    : "";

  const gapBlock = executionGaps.length
    ? "\nNO EXECUTION DATA AVAILABLE FOR THESE ACCOUNTS (say so plainly in competitor_wins " +
      "rather than guessing how they execute):\n" +
      executionGaps.map((gap) => `- ${gap.url}: ${gap.reason}`).join("\n")
    : "";

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
      "to write a post from, tailored to the client's specific industry and audience " +
      "— never generic marketing advice that could apply to any business. Every " +
      "insight must be grounded in the actual competitor research material provided " +
      "— never invented — and cited back to the specific URL it came from wherever " +
      "that's possible.",
    prompt:
      `${clientBlock}\n\n` +
      `COMPETITOR RESEARCH MATERIAL:\n${competitorBlock}\n` +
      `${executionBrief}\n${audioBlock}\n${gapBlock}\n\n` +
      "Produce the intelligence report. Fill every field separately and keep " +
      "each one's content inside its own array — never continue one section's " +
      "list into the next field, and never emit a section name as a list item. " +
      "Tailor every field to this client's specific industry and audience, not " +
      "generic marketing advice, and cite the source_url each insight came from " +
      "whenever it traces to one specific competitor page:\n" +
      "- trending_topics: 5-6 topics the client should cover\n" +
      "- hooks: 4-6 hooks to adapt\n" +
      "- content_formats: 4-6 content format opportunities\n" +
      "- positioning: 3-5 statements on standing out from these competitors while staying competitive\n" +
      "- content_gaps: 4-6 gaps\n" +
      "- hook_library: 6-8 reusable hook patterns\n" +
      "- offer_tracker: 4-6 specific offer or CTA signals actually seen or implied on these sites\n" +
      "- comment_themes: 4-6 comment themes\n" +
      "- opportunity_signals: 4-6 opportunity signals\n" +
      "- competitor_wins: 3-5 observations on HOW competitors execute (format mix, cadence, which " +
      "formats earn engagement, editing style, voiceover vs. music, trending audio) -- never topics " +
      "or content ideas. Use the real execution data above and cite its figures; state plainly where " +
      "no execution data was available rather than guessing\n" +
      "- recommended_posts: 4-6 concrete, ready-to-brief post concepts specific to this client\n" +
      "- recommendations: exactly 3 moves, ranked by impact, synthesized across the fields " +
      "above. Each is a decision to brief the team on this week (what to prioritize, test, " +
      "or fix) — never finished copy, a caption, or a publishing/scheduling instruction. " +
      "Content generation and distribution are handled downstream by a separate system.\n" +
      "- opportunity_score / content_gap_score: your genuine 0-100 judgment for this specific " +
      "client and this specific set of competitors -- these should move up or down based on what " +
      "the scan actually found, not sit near the same number every time\n" +
      "- summary: what competitors emphasize and where this client can stand out",
    jsonSchema: scanJsonSchema,
    validator: scanValidator,
    maxTokens: 8000,
    timeoutMs: SCAN_TIMEOUT_MS,
    maxRetries: SCAN_MAX_RETRIES,
  });

  return cleanScan(scan);
}
