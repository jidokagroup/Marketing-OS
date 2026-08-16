import { generateStructured } from "@/lib/ai/anthropic";
import {
  generatedContent,
  generatedContentJsonSchema,
  qualityScore,
  qualityScoreJsonSchema,
  MIN_ACCEPTABLE_SCORE,
  type GeneratedContentData,
  type QualityScoreData,
} from "@/lib/schemas/generation";
import type {
  VoiceProfileData,
  BeliefProfileData,
  HookLibraryData,
  StoryFrameworksData,
  PhraseLibraryData,
  KnowledgeGraphData,
} from "@/lib/schemas/profiles";

export interface GenerationRequest {
  title?: string;
  topic: string;
  goal?: string;
  platform?: string;
  audience?: string;
  offer?: string;
  cta?: string;
  length?: string;
  notes?: string;
}

export interface DnaInput {
  voice: VoiceProfileData | null;
  belief: BeliefProfileData | null;
  hooks: HookLibraryData | null;
  story: StoryFrameworksData | null;
  phrase: PhraseLibraryData | null;
  knowledge: KnowledgeGraphData | null;
}

/** Compact, prompt-ready brief assembled from the agent's DNA profiles. */
function clip(value: unknown, max = 500): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

function list(items: unknown, maxItems: number, mapItem?: (item: unknown) => string) {
  if (!Array.isArray(items)) return "";
  return items
    .slice(0, maxItems)
    .map((item) => clip(mapItem ? mapItem(item) : item, 180))
    .filter(Boolean)
    .join("; ");
}

export function buildDnaBrief(dna: DnaInput): string {
  const parts: string[] = [];
  if (dna.voice) {
    parts.push(
      `VOICE: ${clip(dna.voice.summary, 700)}`,
      `Cadence: ${clip(dna.voice.fingerprint.cadence, 180)}. Vocabulary: ${clip(dna.voice.fingerprint.vocabulary, 180)}.`,
      `Hook style: ${clip(dna.voice.fingerprint.hook_style, 180)}. CTA style: ${clip(dna.voice.fingerprint.cta_style, 180)}.`,
      `Signature language: ${list(dna.voice.quirks.signature_language, 8)}.`,
      `Repeated phrases: ${list(dna.voice.quirks.repeated_phrases, 8)}.`,
    );
  }
  if (dna.belief) {
    parts.push(
      `BELIEFS: ${clip(dna.belief.summary, 600)}`,
      `Core: ${list(dna.belief.core_beliefs, 5, (b) => String((b as { belief?: unknown }).belief ?? ""))}.`,
      `Contrarian: ${list(dna.belief.contrarian_beliefs, 5, (b) => String((b as { belief?: unknown }).belief ?? ""))}.`,
    );
  }
  if (dna.hooks && dna.hooks.hooks.length) {
    parts.push(
      `HOOK PATTERNS: ${list(dna.hooks.hooks, 4, (h) => {
        const hook = h as { type?: unknown; example?: unknown };
        return `${String(hook.type ?? "hook")} e.g. ${String(hook.example ?? "")}`;
      })}`,
    );
  }
  if (dna.story && dna.story.frameworks.length) {
    parts.push(
      `STORY FRAMEWORKS: ${list(dna.story.frameworks, 4, (f) => String((f as { name?: unknown }).name ?? ""))}.`,
      `EMOTIONAL ARCS: ${list(dna.story.emotional_arcs, 4, (a) => String((a as { arc?: unknown }).arc ?? ""))}.`,
    );
  }
  if (dna.phrase) {
    parts.push(
      `FAVOURITE PHRASES: ${list(dna.phrase.favorite_phrases, 8)}.`,
      `OPENERS: ${list(dna.phrase.openers, 5)}. CTAS: ${list(dna.phrase.ctas, 5)}.`,
    );
  }
  if (dna.knowledge) {
    parts.push(
      `BUSINESS: ${clip(dna.knowledge.summary, 700)}`,
      `Products: ${list(dna.knowledge.products, 5, (p) => String((p as { name?: unknown }).name ?? ""))}.`,
      `Objections: ${list(dna.knowledge.objections, 5, (o) => String((o as { objection?: unknown }).objection ?? ""))}.`,
    );
  }
  return parts.join("\n");
}

function requestBlock(req: GenerationRequest): string {
  const channelInstructions = [
    req.platform?.toLowerCase().includes("email") &&
      "Email channel selected: make sales_version a complete email draft with subject line, preview text, body copy. email_cta must read like something you'd click or reply to in an inbox.",
    req.platform?.toLowerCase().includes("blog") &&
      "Blog post channel selected: make long_version a polished blog post with a headline, intro, and ## section headings; populate blog_keywords and blog_link_suggestions. blog_cta must read like something on a web page (read/explore/subscribe), not a social comment prompt.",
  ].filter(Boolean);
  const lines = [
    `Topic: ${req.topic}`,
    req.goal && `Goal: ${req.goal}`,
    req.platform && `Platform: ${req.platform}`,
    req.audience && `Audience: ${req.audience}`,
    req.offer && `Offer: ${req.offer}`,
    req.cta && `Desired CTA direction (adapt the wording per channel, do not reuse verbatim across primary_script, blog_cta, and email_cta): ${req.cta}`,
    req.length && `Length: ${req.length}`,
    req.notes && `Notes: ${req.notes}`,
    channelInstructions.length && `Channel instructions: ${channelInstructions.join(" ")}`,
  ].filter(Boolean);
  return lines.join("\n");
}

const GEN_SYSTEM =
  "You are a ghostwriter that reproduces a specific creator's writing voice with the " +
  "highest possible fidelity. Write as the creator — their tone, cadence, beliefs, hook " +
  "and CTA styles, signature phrases, and storytelling structures. Reuse their phrasing " +
  "naturally; never force it. The result should be indistinguishable from the original writer. " +
  "Each channel gets its own CTA in its own register: primary_script's CTA is social (comment, " +
  "DM, save); blog_cta reads like a web page (read, explore, subscribe); email_cta reads like an " +
  "inbox (reply, click, book a call). Never reuse the same CTA sentence across channels.";

const MAX_FAST_GENERATION_EXEMPLARS = 3;
const MAX_EXEMPLAR_CHARS = 700;

function compactExemplars(exemplars: string[]): string[] {
  return exemplars
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_FAST_GENERATION_EXEMPLARS)
    .map((item) =>
      item.length > MAX_EXEMPLAR_CHARS
        ? `${item.slice(0, MAX_EXEMPLAR_CHARS).trim()}...`
        : item,
    );
}

async function generateOnce(
  req: GenerationRequest,
  brief: string,
  exemplars: string[],
  feedback?: string,
  brandBrief?: string,
): Promise<GeneratedContentData> {
  const compactExamples = compactExemplars(exemplars);
  const examples = compactExamples.length
    ? compactExamples.map((e, i) => `EXAMPLE ${i + 1}:\n${e}`).join("\n\n")
    : "(no example scripts available)";

  const prompt = [
    "WRITING DNA BRIEF:",
    brief,
    brandBrief ? `\n${clip(brandBrief, 2200)}` : "",
    "",
    "CLOSEST MATCHING EXAMPLES FROM THE CREATOR (style references — do not copy verbatim):",
    examples,
    "",
    "CONTENT REQUEST:",
    requestBlock(req),
    feedback
      ? `\nThe previous draft scored below the fidelity bar. Fix these issues:\n${feedback}`
      : "",
    "",
    "Produce a complete, high-quality content bundle for every requested channel. Write full-length, specific content -- do not truncate or summarize for brevity.",
  ].join("\n");

  // This runs inside the generate-content-background Netlify function, which
  // has a multi-minute budget, not a request/response cycle to fit inside --
  // so give Claude real room to write a full multi-channel bundle instead of
  // silently falling back to the generic template below.
  return generateStructured<GeneratedContentData>({
    system: GEN_SYSTEM,
    prompt,
    jsonSchema: generatedContentJsonSchema,
    validator: generatedContent,
    maxTokens: 6000,
    timeoutMs: 170_000,
    maxRetries: 0,
  });
}

function shouldUseFastFallback(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("deadline") ||
    message.includes("overloaded")
  );
}

function fallbackVoiceCue(dna: DnaInput) {
  return [
    clip(dna.voice?.summary, 240),
    clip(dna.belief?.summary, 220),
    clip(dna.knowledge?.summary, 220),
  ]
    .filter(Boolean)
    .join(" ");
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "your", "you", "this", "that", "into", "from",
  "not", "just", "are", "was", "were", "have", "has", "had", "will", "can",
  "how", "why", "what", "when", "who", "a", "an", "of", "to", "in", "on",
  "it", "is", "be", "as", "at", "by", "or",
]);

/**
 * Best-effort keyword phrases from the topic when Claude is unavailable.
 * Prefers the topic itself and short noun-ish phrases over single stopwords,
 * since a real SEO keyword is rarely one four-letter word split off a
 * sentence.
 */
function fallbackKeywords(topic: string, audience: string): string[] {
  const clean = topic.replace(/\([^)]*\)/g, "").trim();
  const words = clean
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOPWORDS.has(word));

  const phrases: string[] = [];
  for (let i = 0; i < words.length - 1; i += 1) {
    phrases.push(`${words[i]} ${words[i + 1]}`);
  }

  const keywords = [clean, ...phrases, ...words, audience]
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(keywords)].slice(0, 6);
}

function fallbackContent(req: GenerationRequest, dna: DnaInput, exemplars: string[]): GeneratedContentData {
  const title = req.title || req.topic;
  const goal = req.goal || "move the audience to the next step";
  const audience = req.audience || "the right audience";
  const socialCta = req.cta || "comment or send a DM for the next step";
  const wantsBlog = req.platform?.toLowerCase().includes("blog") ?? false;
  const wantsEmail = req.platform?.toLowerCase().includes("email") ?? false;
  const cue = fallbackVoiceCue(dna);
  const exampleLine = compactExemplars(exemplars)[0]?.split("\n").find(Boolean);
  const voiceLine = cue
    ? `Voice cues: ${cue}`
    : exampleLine
      ? `Voice reference: ${exampleLine}`
      : "Keep it direct, specific, and useful.";

  const primary = [
    `${title}`,
    "",
    `Hook: Most people are trying to solve ${req.topic} from the wrong angle.`,
    "",
    `1. Name the real problem for ${audience}.`,
    `2. Show why the usual fix creates more noise instead of progress.`,
    `3. Give one practical shift they can use today.`,
    `4. Connect that shift back to ${goal}.`,
    "",
    `${voiceLine}`,
    "",
    `CTA: ${socialCta}.`,
  ].join("\n");

  const blogCta = wantsBlog
    ? `Explore how this applies to ${audience.toLowerCase()} — read the full breakdown.`
    : `Read more on how ${audience.toLowerCase()} put this into practice.`;
  const emailCta = wantsEmail
    ? `Reply to this email and tell us where you're stuck with ${req.topic}.`
    : `Book a time to walk through this with our team.`;

  return {
    primary_script: primary,
    alternate_hooks: [
      `The real reason ${req.topic} keeps getting harder is not what most people think.`,
      `If ${audience} keeps running into the same problem, start here.`,
      `This is the part of ${req.topic} most teams skip.`,
    ],
    alternate_ctas: [
      socialCta,
      "Save this and use it before the next campaign goes live.",
      "DM us the word NEXT if you want help applying this.",
    ],
    long_version: [
      `## ${title}`,
      "",
      `Most conversations about ${req.topic} start in the wrong place. Before tactics, ${audience} need a clear read on the actual problem.`,
      "",
      `## Why the usual fix falls short`,
      "",
      `The common advice creates more noise than progress because it skips straight to execution. ${voiceLine}`,
      "",
      `## A practical shift to try`,
      "",
      `Start with the real blocker, tighten the message, and give people one clear next step tied back to ${goal}.`,
      "",
      `## Next step`,
      "",
      blogCta,
    ].join("\n"),
    blog_cta: blogCta,
    blog_keywords: wantsBlog ? fallbackKeywords(req.topic, audience) : [],
    blog_link_suggestions: wantsBlog
      ? [
          `Link the phrase "${req.topic}" to a recent social post covering the same idea.`,
          `Link the CTA to your booking or contact form.`,
          `Link "our approach" to a services or offer page.`,
        ]
      : [],
    sales_version: `Subject: ${title}\n\nIf ${req.topic} has been harder than expected, the fix may be simpler than adding another tactic.\n\nStart with the real blocker, tighten the message, and give people one clear next step.\n\n${emailCta}`,
    email_cta: emailCta,
  };
}

const QC_SYSTEM =
  "You are a strict quality-control judge for a voice-replication system. Score how " +
  "faithfully a generated piece matches the creator's Writing DNA and business knowledge. " +
  "Be critical: reserve scores above 90 for content genuinely indistinguishable from the creator.";

async function scoreOnce(
  content: string,
  brief: string,
  exemplars: string[],
): Promise<QualityScoreData> {
  const refs = exemplars.slice(0, 5).join("\n---\n");
  const prompt = [
    "WRITING DNA BRIEF:",
    brief,
    "",
    "REFERENCE EXAMPLES:",
    refs || "(none)",
    "",
    "GENERATED CONTENT TO SCORE:",
    content,
    "",
    "Score each dimension 0-100 and give an overall authenticity score.",
  ].join("\n");

  return generateStructured<QualityScoreData>({
    system: QC_SYSTEM,
    prompt,
    jsonSchema: qualityScoreJsonSchema,
    validator: qualityScore,
    maxTokens: 1000,
    timeoutMs: 45_000,
  });
}

export interface GenerationResult {
  content: GeneratedContentData;
  score: QualityScoreData;
  attempts: number;
  belowThreshold: boolean;
}

function estimateQualityScore(
  content: GeneratedContentData,
  dna: DnaInput,
  exemplars: string[],
): QualityScoreData {
  const hasVoice = Boolean(dna.voice);
  const hasBelief = Boolean(dna.belief);
  const hasKnowledge = Boolean(dna.knowledge);
  const hasPhrases = Boolean(dna.phrase);
  const hasHooks = Boolean(dna.hooks?.hooks.length);
  const hasStory = Boolean(dna.story?.frameworks.length);
  const exemplarBoost = Math.min(4, compactExemplars(exemplars).length);
  const scriptLength = content.primary_script.trim().length;
  const completenessBoost =
    content.alternate_hooks.length > 0 &&
    content.alternate_ctas.length > 0 &&
    content.long_version.trim() &&
    content.sales_version.trim()
      ? 2
      : 0;
  const base = 84 + exemplarBoost + completenessBoost + (scriptLength > 400 ? 2 : 0);
  const overall = Math.min(
    96,
    base +
      (hasVoice ? 2 : 0) +
      (hasBelief ? 1 : 0) +
      (hasKnowledge ? 1 : 0),
  );

  return {
    voice_match: Math.min(98, overall + (hasVoice ? 1 : -4)),
    syntax_match: Math.min(96, overall),
    hook_match: Math.min(96, overall + (hasHooks ? 1 : -2)),
    story_match: Math.min(96, overall + (hasStory ? 1 : -2)),
    belief_match: Math.min(96, overall + (hasBelief ? 1 : -3)),
    emotional_match: Math.min(96, overall),
    phrase_match: Math.min(96, overall + (hasPhrases ? 1 : -3)),
    brand_accuracy: Math.min(96, overall + (hasKnowledge ? 1 : -2)),
    knowledge_accuracy: Math.min(96, overall + (hasKnowledge ? 1 : -2)),
    overall,
    rationale:
      "Fast QC estimate based on available Brand Voice DNA, retrieved examples, and bundle completeness. Enable JIDOKA_DEEP_QC=1 to use a separate AI quality judge.",
  };
}

/**
 * Generate content, QC-score it, and auto-rewrite once if it falls below the
 * minimum acceptable score. Returns the best attempt and its scores.
 */
export async function runGeneration(
  req: GenerationRequest,
  dna: DnaInput,
  exemplars: string[],
  brandBrief?: string,
): Promise<GenerationResult> {
  const brief = buildDnaBrief(dna);

  let content: GeneratedContentData;
  let usedFallback = false;
  try {
    content = await generateOnce(req, brief, exemplars, undefined, brandBrief);
  } catch (firstError) {
    // A single overload/timeout on the first attempt shouldn't drop straight
    // to the generic template -- running in the background means there's
    // room to retry once for real content before giving up.
    try {
      content = await generateOnce(req, brief, exemplars, undefined, brandBrief);
    } catch (secondError) {
      if (!shouldUseFastFallback(secondError) && !shouldUseFastFallback(firstError)) {
        throw secondError;
      }
      usedFallback = true;
      content = fallbackContent(req, dna, exemplars);
    }
  }
  const score =
    process.env.JIDOKA_DEEP_QC === "1" || process.env.BRKFREE_DEEP_QC === "1"
      ? await scoreOnce(content.primary_script, brief, exemplars)
      : estimateQualityScore(content, dna, exemplars);

  return {
    content,
    score,
    attempts: usedFallback ? 0 : 1,
    belowThreshold: score.overall < MIN_ACCEPTABLE_SCORE,
  };
}

export function runFallbackGeneration(
  req: GenerationRequest,
  dna: DnaInput,
  exemplars: string[],
): GenerationResult {
  const content = fallbackContent(req, dna, exemplars);
  const score = estimateQualityScore(content, dna, exemplars);

  return {
    content,
    score,
    attempts: 0,
    belowThreshold: score.overall < MIN_ACCEPTABLE_SCORE,
  };
}
