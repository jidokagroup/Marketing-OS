import { z } from "zod";

import { generateStructured } from "@/lib/ai/anthropic";
import { extractFromUrl } from "@/lib/extract";

const MAX_SOURCES = 10;
const MAX_FETCHED_SOURCES = 6;
const MAX_SOURCE_CHARS = 4000;
const SOURCE_FETCH_TIMEOUT_MS = 8000;

export type ContentGeneratorSource = {
  raw: string;
  platform: string;
  handle: string;
  profileUrl: string | null;
  displayName: string;
};

export type ContentGeneratorClient = {
  name: string;
  industry: string | null;
  notes: string | null;
} | null;

export type GeneratedIdea = {
  title: string;
  description: string;
  channel: string;
  format: string;
  funnel_stage: "awareness" | "consideration" | "conversion" | "retention";
  generator_prompt: string;
  scheduler_suggestion: string;
};

export type ContentGeneratorTrendReport = {
  summary: string;
  trending_topics: string[];
  hooks: string[];
  competitor_patterns: string[];
  content_opportunities: string[];
  brand_angles: string[];
  generated_ideas: GeneratedIdea[];
  scheduler_suggestions: string[];
  limitations: string[];
};

const generatedIdeaSchema = z.object({
  title: z.string().min(4),
  description: z.string().min(20),
  channel: z.string().min(1),
  format: z.string().min(2),
  funnel_stage: z.enum([
    "awareness",
    "consideration",
    "conversion",
    "retention",
  ]),
  generator_prompt: z.string().min(20),
  scheduler_suggestion: z.string().min(10),
});

const reportValidator = z.object({
  summary: z.string().min(20),
  trending_topics: z.array(z.string()).min(1),
  hooks: z.array(z.string()).min(1),
  competitor_patterns: z.array(z.string()).min(1),
  content_opportunities: z.array(z.string()).min(1),
  brand_angles: z.array(z.string()).min(1),
  generated_ideas: z.array(generatedIdeaSchema).min(1),
  scheduler_suggestions: z.array(z.string()).min(1),
  limitations: z.array(z.string()).default([]),
});

const generatedIdeaJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "description",
    "channel",
    "format",
    "funnel_stage",
    "generator_prompt",
    "scheduler_suggestion",
  ],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    channel: { type: "string" },
    format: { type: "string" },
    funnel_stage: {
      type: "string",
      enum: ["awareness", "consideration", "conversion", "retention"],
    },
    generator_prompt: { type: "string" },
    scheduler_suggestion: { type: "string" },
  },
};

const reportJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "trending_topics",
    "hooks",
    "competitor_patterns",
    "content_opportunities",
    "brand_angles",
    "generated_ideas",
    "scheduler_suggestions",
    "limitations",
  ],
  properties: {
    summary: { type: "string" },
    trending_topics: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
      description: "5-7 trend topics or audience angles to watch.",
    },
    hooks: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
      description: "5-7 hooks rewritten for the selected brand brain.",
    },
    competitor_patterns: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
      description:
        "3-5 patterns observed or hypothesized from the submitted watchlist. Do not invent metrics.",
    },
    content_opportunities: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
      description: "4-6 useful content opportunities for the selected client.",
    },
    brand_angles: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
      description:
        "3-5 ways the client should make the trend more specific, ownable, and on brand.",
    },
    generated_ideas: {
      type: "array",
      minItems: 1,
      items: generatedIdeaJsonSchema,
      description:
        "Exactly 5-8 content ideas ready to save as Jidoka Marketing OS ideas.",
    },
    scheduler_suggestions: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
      description:
        "3-5 concise scheduling recommendations based on the selected channels.",
    },
    limitations: {
      type: "array",
      items: { type: "string" },
      description:
        "Any data limitations, especially social pages that could not be fetched server-side.",
    },
  },
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timed out")), ms),
    ),
  ]);
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function fallbackReport({
  client,
  sources,
  channels,
  goal,
}: {
  client: ContentGeneratorClient;
  sources: ContentGeneratorSource[];
  channels: string[];
  goal: string | null;
}): ContentGeneratorTrendReport {
  const clientName = client?.name ?? "the selected client";
  const channelList = channels.length ? channels : ["instagram"];
  const sourceLabels = sources.length
    ? sources.map((source) => `${titleCase(source.platform)} ${source.handle}`)
    : ["the competitor watchlist"];
  const objective = goal || "turn attention into qualified conversations";

  return {
    summary:
      `${clientName} should use the watchlist to turn competitor themes into clearer, more specific content. ` +
      `This draft report is based on submitted accounts and any public page text available to the app, then rewritten for the client's Brand Brain.`,
    trending_topics: [
      `What buyers are asking before they are ready to ${objective}`,
      `The hidden cost of waiting too long to solve the main customer problem`,
      `A simple framework that makes the client's process easier to understand`,
      `Mistakes competitors normalize that ${clientName} can correct`,
      `Proof-led education that builds trust before a sales conversation`,
    ],
    hooks: [
      "Most people are solving the visible problem, not the real one.",
      "If this keeps showing up in your industry, it deserves a clearer explanation.",
      "Here is the part your audience is probably not being told.",
      "Before you copy the popular advice, check this first.",
      "A better question to ask before you choose the next step.",
    ],
    competitor_patterns: [
      `${sourceLabels.slice(0, 3).join(", ")} should be watched for recurring topics, calls to action, and formats.`,
      "Short, specific teaching posts are usually easier to reuse than broad thought leadership.",
      "High-intent comments are strongest when the post gives one clear next step.",
    ],
    content_opportunities: [
      "Create a point-of-view post that challenges generic industry advice without attacking competitors.",
      "Turn one common objection into a carousel, short video, and comment-to-DM resource.",
      "Use a before-and-after process story to show why the client's approach is easier to trust.",
      "Build a 3-part sequence: problem, mistake, next step.",
    ],
    brand_angles: [
      `Make every idea sound like ${clientName}, not like a trend recap.`,
      "Use the client's approved offers, language, and calls to action from Brand Brain.",
      "Turn competitor inspiration into original education with clearer proof and cleaner next steps.",
    ],
    generated_ideas: channelList.slice(0, 6).map((channel, index) => ({
      title: `${titleCase(channel)} idea ${index + 1}: the missing next step`,
      description:
        `Adapt a trend from the watchlist into an on-brand ${channel} post that explains the audience problem and gives one practical next step.`,
      channel,
      format: channel === "youtube" || channel === "tiktok" ? "short video" : "caption",
      funnel_stage: index % 3 === 0 ? "awareness" : index % 3 === 1 ? "consideration" : "conversion",
      generator_prompt:
        `Create an on-brand ${channel} content package for ${clientName}. ` +
        `Use the competitor watchlist for inspiration only, avoid copying, and focus on ${objective}.`,
      scheduler_suggestion:
        `Send to Smart Scheduler as a ${channel} draft after the client agent generates the final copy.`,
    })),
    scheduler_suggestions: [
      "Start with the strongest education post early in the week, then schedule the objection or proof post two days later.",
      "Use comment-to-DM only when the post offers a specific resource or next step.",
      "Keep platform-specific versions separate so captions, timing, and media can be edited before publishing.",
    ],
    limitations: [
      "Hosted scans use public pages and connected platform data available to the app. Logged-in Chrome session scanning requires a browser connector.",
    ],
  };
}

async function fetchSourceExcerpts(sources: ContentGeneratorSource[]) {
  const fetchable = sources
    .filter((source) => source.profileUrl?.startsWith("http"))
    .slice(0, MAX_FETCHED_SOURCES);

  const settled = await Promise.allSettled(
    fetchable.map((source) =>
      withTimeout(extractFromUrl(source.profileUrl as string), SOURCE_FETCH_TIMEOUT_MS),
    ),
  );

  return fetchable.map((source, index) => {
    const result = settled[index];
    return {
      source,
      text:
        result.status === "fulfilled"
          ? result.value.slice(0, MAX_SOURCE_CHARS)
          : "",
    };
  });
}

export async function runContentGeneratorTrendReport({
  client,
  sources,
  channels,
  brandBrainBrief,
  goal,
  offer,
}: {
  client: ContentGeneratorClient;
  sources: ContentGeneratorSource[];
  channels: string[];
  brandBrainBrief: string;
  goal: string | null;
  offer: string | null;
}): Promise<ContentGeneratorTrendReport> {
  const cleanSources = sources.slice(0, MAX_SOURCES);
  if (!process.env.ANTHROPIC_API_KEY) {
    return fallbackReport({ client, sources: cleanSources, channels, goal });
  }

  const excerpts = await fetchSourceExcerpts(cleanSources);
  const fetched = excerpts.filter((excerpt) => excerpt.text);
  const sourceList = cleanSources
    .map((source) =>
      [
        `Platform: ${source.platform}`,
        `Handle: ${source.handle}`,
        source.profileUrl ? `URL: ${source.profileUrl}` : null,
      ]
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n");
  const fetchedBlock = fetched.length
    ? fetched
        .map(
          ({ source, text }) =>
            `--- PUBLIC PAGE TEXT: ${source.displayName} (${source.profileUrl}) ---\n${text}`,
        )
        .join("\n\n")
    : "No public page text was fetched. Use the watchlist as context only.";
  const clientBlock = client
    ? `Client: ${client.name}${client.industry ? `\nIndustry: ${client.industry}` : ""}${
        client.notes ? `\nClient notes: ${client.notes}` : ""
      }`
    : "Client: no specific client selected.";

  try {
    return await generateStructured({
      system:
        "You are the JIDOKA Marketing OS Content Generator intelligence agent. " +
        "You turn competitor and influencer watchlists into original, on-brand content ideas for a marketing team or agency. " +
        "Use Brand Brain as the authority for tone, offers, proof, and calls to action. " +
        "Do not copy competitors. Do not invent metrics, claims, exact post performance, or private account details. " +
        "If a social profile cannot be fetched, treat it as watchlist context and state the limitation plainly.",
      prompt:
        `${clientBlock}\n\n` +
        `Selected channels: ${channels.join(", ") || "Instagram"}\n` +
        `Goal: ${goal || "Generate qualified content ideas"}\n` +
        `Offer or CTA focus: ${offer || "Use Brand Brain approved offers and CTAs"}\n\n` +
        `${brandBrainBrief || "Brand Brain: not available. Keep the output practical, specific, and neutral."}\n\n` +
        `Watchlist:\n${sourceList || "No sources submitted."}\n\n` +
        `Fetched public evidence:\n${fetchedBlock}\n\n` +
        "Create a weekly trend report and 5-8 on-brand content ideas. " +
        "Each idea must be ready for a client agent to generate final copy, and each must include a Smart Scheduler suggestion.",
      jsonSchema: reportJsonSchema,
      validator: reportValidator,
      maxTokens: 4500,
      timeoutMs: 60_000,
    });
  } catch {
    return fallbackReport({ client, sources: cleanSources, channels, goal });
  }
}
