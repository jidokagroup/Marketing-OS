import { z } from "zod";

import { enumStr, num, obj, str, strArr } from "@/lib/schemas/jsonschema";

/**
 * Client acquisition outreach — a generation pass and a verification pass.
 *
 * The two-stage shape is ported from the Jidoka Group site's outreach
 * pipeline: one agent writes the first touch, a second independently checks
 * it before a human ever sees it. That second pass is what keeps invented
 * facts, mismatched CTAs and generic filler out of a message going to a real
 * prospect under a client's name.
 *
 * Re-pointed for this product: the original wrote JIDOKA's own offers to
 * JIDOKA's prospects. Here the offer, the voice and the proof all come from
 * the client's Brand Brain, because each agency runs this for their clients.
 */

export const OUTREACH_CHANNELS = ["email", "linkedin", "instagram_dm"] as const;
export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export const outreachMessage = z.object({
  subject: z.string(),
  body: z.string(),
  pain_point: z.string(),
  offer_angle: z.string(),
  message_language: z.string(),
});
export type OutreachMessageData = z.infer<typeof outreachMessage>;

export const outreachMessageJsonSchema = obj({
  subject: str(
    "Subject line. Required for email; empty string for LinkedIn and Instagram DM, which have no subject.",
  ),
  body: str(
    "The first-touch message, 65-125 words, conversational, opening with specific " +
      "personalization drawn from the evidence provided and closing on a low-friction " +
      "question suited to the contact channel.",
  ),
  pain_point: str("The specific pain this message speaks to, drawn from the evidence."),
  offer_angle: str("Which of the client's offers this leads with, and why it fits this prospect."),
  message_language: str(
    "The language the message is written in, matching the language of the evidence (e.g. 'English').",
  ),
});

export const outreachVerification = z.object({
  verdict: z.enum(["approved", "revised", "rejected"]),
  score: z.number(),
  issues: z.array(z.string()),
  approved_message: z.string(),
  reasoning: z.string(),
});
export type OutreachVerificationData = z.infer<typeof outreachVerification>;

export const outreachVerificationJsonSchema = obj({
  verdict: enumStr(
    ["approved", "revised", "rejected"],
    "approved: send as written. revised: approved_message holds your rewrite. " +
      "rejected: do not send, the prospect or the angle is wrong.",
  ),
  score: num("0-100 confidence that this message is worth sending to this prospect."),
  issues: strArr(
    "Every problem found: invented facts unsupported by the evidence, oversold or " +
      "misread pain, mismatched offer, generic filler, a weak CTA, or a CTA that does " +
      "not match the contact channel. Empty array if genuinely none.",
  ),
  approved_message: str(
    "The message to actually send. Identical to the proposed body when the verdict is " +
      "approved; your rewrite when revised; empty string when rejected. Keep the " +
      "original language -- do not translate.",
  ),
  reasoning: str("One or two sentences: why this verdict."),
});
