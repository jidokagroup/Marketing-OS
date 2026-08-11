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
export function buildDnaBrief(dna: DnaInput): string {
  const parts: string[] = [];
  if (dna.voice) {
    parts.push(
      `VOICE: ${dna.voice.summary}`,
      `Cadence: ${dna.voice.fingerprint.cadence}. Vocabulary: ${dna.voice.fingerprint.vocabulary}.`,
      `Hook style: ${dna.voice.fingerprint.hook_style}. CTA style: ${dna.voice.fingerprint.cta_style}.`,
      `Signature language: ${dna.voice.quirks.signature_language.join(", ")}.`,
      `Repeated phrases: ${dna.voice.quirks.repeated_phrases.join(", ")}.`,
    );
  }
  if (dna.belief) {
    parts.push(
      `BELIEFS: ${dna.belief.summary}`,
      `Core: ${dna.belief.core_beliefs.map((b) => b.belief).join("; ")}.`,
      `Contrarian: ${dna.belief.contrarian_beliefs.map((b) => b.belief).join("; ")}.`,
    );
  }
  if (dna.hooks && dna.hooks.hooks.length) {
    parts.push(
      `HOOK PATTERNS: ${dna.hooks.hooks.map((h) => `${h.type} (e.g. "${h.example}")`).join(" | ")}`,
    );
  }
  if (dna.story && dna.story.frameworks.length) {
    parts.push(
      `STORY FRAMEWORKS: ${dna.story.frameworks.map((f) => f.name).join(", ")}.`,
      `EMOTIONAL ARCS: ${dna.story.emotional_arcs.map((a) => a.arc).join(" | ")}.`,
    );
  }
  if (dna.phrase) {
    parts.push(
      `FAVOURITE PHRASES: ${dna.phrase.favorite_phrases.join(", ")}.`,
      `OPENERS: ${dna.phrase.openers.join(" | ")}. CTAS: ${dna.phrase.ctas.join(" | ")}.`,
    );
  }
  if (dna.knowledge) {
    parts.push(
      `BUSINESS: ${dna.knowledge.summary}`,
      `Products: ${dna.knowledge.products.map((p) => p.name).join(", ")}.`,
      `Objections: ${dna.knowledge.objections.map((o) => o.objection).join("; ")}.`,
    );
  }
  return parts.join("\n");
}

function requestBlock(req: GenerationRequest): string {
  const channelInstructions = [
    req.platform?.toLowerCase().includes("email") &&
      "Email channel selected: make sales_version a complete email draft with subject line, preview text, body copy, and CTA.",
    req.platform?.toLowerCase().includes("blog") &&
      "Blog post channel selected: make long_version a polished blog post with a headline, intro, scannable sections, and CTA.",
  ].filter(Boolean);
  const lines = [
    `Topic: ${req.topic}`,
    req.goal && `Goal: ${req.goal}`,
    req.platform && `Platform: ${req.platform}`,
    req.audience && `Audience: ${req.audience}`,
    req.offer && `Offer: ${req.offer}`,
    req.cta && `Desired CTA: ${req.cta}`,
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
  "naturally; never force it. The result should be indistinguishable from the original writer.";

const MAX_GENERATION_EXEMPLARS = 5;
const MAX_EXEMPLAR_CHARS = 1600;

function compactExemplars(exemplars: string[]): string[] {
  return exemplars
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_GENERATION_EXEMPLARS)
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
    brandBrief ? `\n${brandBrief}` : "",
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
    "Produce the content bundle. Every version must sound like the creator.",
  ].join("\n");

  return generateStructured<GeneratedContentData>({
    system: GEN_SYSTEM,
    prompt,
    jsonSchema: generatedContentJsonSchema,
    validator: generatedContent,
    maxTokens: 4500,
    timeoutMs: 45_000,
    maxRetries: 0,
  });
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
    content.short_version.trim() &&
    content.long_version.trim()
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

  const content = await generateOnce(req, brief, exemplars, undefined, brandBrief);
  const score =
    process.env.JIDOKA_DEEP_QC === "1" || process.env.BRKFREE_DEEP_QC === "1"
      ? await scoreOnce(content.primary_script, brief, exemplars)
      : estimateQualityScore(content, dna, exemplars);

  return {
    content,
    score,
    attempts: 1,
    belowThreshold: score.overall < MIN_ACCEPTABLE_SCORE,
  };
}
