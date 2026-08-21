import { z } from "zod";

import { generateStructured } from "@/lib/ai/anthropic";
import { bool, enumStr, obj, str } from "@/lib/schemas/jsonschema";

export const COMMENT_DM_SYSTEM = [
  "You are the JIDOKA Marketing Team OS Comment-to-DM Agent.",
  "Your job is to generate a public Instagram comment reply and a private DM sequence for a scheduled post.",
  "You must ground every reply in the agent's Brand Brain, Writing DNA, approved offers, allowed CTAs, and the post context.",
  "",
  "Hard brand-safety rules:",
  "- Never mention Autom8, autom8, BrkFree, Brk/Free, internal project names, database table names, or legacy brands unless the current Brand Brain explicitly says that is the client's public brand.",
  "- Never say a commenter is curious unless the comment actually shows curiosity.",
  "- Never invent services, pricing, claims, links, guarantees, results, medical claims, legal claims, or availability.",
  "- Do not expose internal automation logic. The public reply should feel native to Instagram.",
  "- If the comment is unclear, numeric, spammy, hostile, complaint-heavy, medical/legal/financial, or asks for a sensitive promise, mark review_required true.",
  "",
  "Public reply standards:",
  "- Keep it short, human, and specific to the comment when possible.",
  "- For nonsense or low-context comments like '1616161616', do not explain services. Acknowledge lightly or ask for a clearer keyword/question.",
  "- For praise like 'Crushing', respond with a simple thank-you or affirming note.",
  "- Use the commenter handle only if it is supplied in the request.",
  "- Use emojis only if the Brand Brain allows them.",
  "",
  "DM sequence standards:",
  "- Write a concise multi-step sequence the team can review before sending.",
  "- Include only approved CTAs or next steps from the Brand Brain.",
  "- If a real link is not supplied in the Brand Brain, refer to the next step without inventing a URL.",
  "- Include a soft opt-out line when the sequence continues beyond the first DM.",
  "",
  "Return JSON only.",
].join("\n");

export const commentDmFlow = z.object({
  public_reply: z.string().min(1),
  dm_sequence: z.string().min(1),
  review_required: z.boolean(),
  review_reason: z.string(),
  risk_level: z.enum(["low", "medium", "high"]),
  confidence: z.enum(["low", "medium", "high"]),
});

export type CommentDmFlow = z.infer<typeof commentDmFlow>;

export const commentDmFlowJsonSchema = obj({
  public_reply: str("The public Instagram reply that appears under the comment."),
  dm_sequence: str("A concise DM sequence, formatted as DM 1, DM 2, etc."),
  review_required: bool("Whether a human should review before use."),
  review_reason: str("Short reason review is or is not required."),
  risk_level: enumStr(["low", "medium", "high"]),
  confidence: enumStr(["low", "medium", "high"]),
});

export interface CommentDmRequest {
  brandBrief: string;
  dnaBrief: string;
  postTitle: string;
  postCaption?: string;
  postScript?: string;
  sampleComment?: string;
  commenterHandle?: string;
  triggerKeywords?: string;
}

function clean(value: string | undefined) {
  return value?.trim() || "(not provided)";
}

export async function generateCommentDmFlow(
  input: CommentDmRequest,
): Promise<CommentDmFlow> {
  const prompt = [
    "BRAND BRAIN:",
    clean(input.brandBrief),
    "",
    "WRITING DNA:",
    clean(input.dnaBrief),
    "",
    "SCHEDULED POST:",
    `Title: ${clean(input.postTitle)}`,
    `Caption: ${clean(input.postCaption)}`,
    `Script / source copy: ${clean(input.postScript)}`,
    "",
    "COMMENT CONTEXT:",
    `Commenter handle: ${clean(input.commenterHandle)}`,
    `Sample incoming comment: ${clean(input.sampleComment)}`,
    `Trigger keywords or desired entry points: ${clean(input.triggerKeywords)}`,
    "",
    "Generate the safest useful public reply and DM sequence for this post.",
    "If the sample comment is missing, generate a default flow for a normal opt-in keyword comment and mark confidence medium.",
    "If the sample comment is low-context, numeric, spammy, or ambiguous, keep the public reply neutral and mark review_required true.",
  ].join("\n");

  const result = await generateStructured<CommentDmFlow>({
    system: COMMENT_DM_SYSTEM,
    prompt,
    jsonSchema: commentDmFlowJsonSchema,
    validator: commentDmFlow,
    maxTokens: 1400,
    timeoutMs: 60_000,
  });

  return {
    public_reply: result.public_reply.trim(),
    dm_sequence: result.dm_sequence.trim(),
    review_required: result.review_required,
    review_reason: result.review_reason.trim(),
    risk_level: result.risk_level,
    confidence: result.confidence,
  };
}
