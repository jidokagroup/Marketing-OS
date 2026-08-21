import { generateStructured } from "@/lib/ai/anthropic";
import { buildDnaBrief, type DnaInput } from "@/lib/ai/generate";
import { touchpointBrief } from "@/lib/acquisition/touchpoints";
import {
  outreachMessage,
  outreachMessageJsonSchema,
  outreachVerification,
  outreachVerificationJsonSchema,
  type OutreachChannel,
  type OutreachMessageData,
  type OutreachVerificationData,
} from "@/lib/schemas/acquisition";

/**
 * Client acquisition outreach: write a first touch, then verify it.
 *
 * Both prompts are adapted from the Jidoka Group site's outreach pipeline.
 * The structure is theirs and is good — personalization grounded in evidence,
 * a tight word count, a channel-matched close, and an independent second pass
 * before a human sees the draft. What changed is whose offer is being sold:
 * theirs named JIDOKA's business units, this writes from the client's own
 * Brand Brain, since each agency runs this on behalf of their clients.
 */

export type LeadContext = {
  leadName: string | null;
  company: string | null;
  email: string | null;
  linkedinUrl: string | null;
  sourceChannel: string | null;
  sourceUrl: string | null;
  evidence: string | null;
};

const CHANNEL_GUIDANCE: Record<OutreachChannel, string> = {
  email:
    "Channel is email. Write a subject line. The close should be a question they can " +
    "answer by replying — never 'comment' or 'DM'.",
  linkedin:
    "Channel is a LinkedIn message. No subject line (return an empty string). Keep it " +
    "shorter than an email would be, and close on something answerable in one line.",
  instagram_dm:
    "Channel is an Instagram DM. No subject line (return an empty string). Native and " +
    "casual, no formal salutation or sign-off, and a close that reads like a real DM.",
};

function leadBlock(lead: LeadContext): string {
  return [
    `Name: ${lead.leadName || "unknown"}`,
    `Company: ${lead.company || "unknown"}`,
    lead.email ? `Email: ${lead.email}` : "",
    lead.linkedinUrl ? `LinkedIn: ${lead.linkedinUrl}` : "",
    lead.sourceChannel ? `Found via: ${lead.sourceChannel}` : "",
    lead.sourceUrl ? `Source URL: ${lead.sourceUrl}` : "",
    `Evidence / context: ${lead.evidence?.trim() || "(none supplied)"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const GENERATION_SYSTEM =
  "You write first-touch acquisition outreach on behalf of a client, in that " +
  "client's own voice. You are given the client's Brand Brain (their offers, " +
  "proof and positioning), their Voice DNA, and what is known about one " +
  "prospect.\n\n" +
  "Open with genuine, specific personalization drawn from the evidence — not a " +
  "compliment that would fit anyone. Name a concrete pain and connect it to one " +
  "of the client's actual offers. 65-125 words, conversational, and close on a " +
  "low-friction question.\n\n" +
  "Never invent facts, results, numbers, case studies or a shared connection " +
  "that the evidence does not support. When the evidence is thin, soften the " +
  "message honestly rather than inventing a reason to have reached out — a " +
  "vaguer opener is recoverable, a fabricated one is not. Write in the language " +
  "the evidence is in.";

export async function generateOutreachMessage(input: {
  brandBrief: string;
  dna: DnaInput;
  lead: LeadContext;
  channel: OutreachChannel;
  attemptNo: number;
  previousMessages: string[];
}): Promise<OutreachMessageData> {
  const dnaBrief = buildDnaBrief(input.dna);
  const prompt = [
    input.brandBrief ? `CLIENT BRAND BRAIN\n${input.brandBrief}` : "",
    dnaBrief ? `CLIENT VOICE DNA\n${dnaBrief}` : "",
    `PROSPECT\n${leadBlock(input.lead)}`,
    CHANNEL_GUIDANCE[input.channel],
    touchpointBrief(input.attemptNo),
    input.previousMessages.length > 0
      ? "ALREADY SENT, UNANSWERED:\n" +
        input.previousMessages.map((m, i) => `--- touch ${i + 1} ---\n${m}`).join("\n\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return generateStructured({
    system: GENERATION_SYSTEM,
    prompt,
    jsonSchema: outreachMessageJsonSchema,
    validator: outreachMessage,
    maxTokens: 1200,
  });
}

const VERIFICATION_SYSTEM =
  "You independently check a first-touch outreach message before any human sees " +
  "it. Another agent proposed it; your job is to catch what it got wrong, not to " +
  "rubber-stamp it.\n\n" +
  "Reject or rewrite for: facts not supported by the evidence, pain that is " +
  "oversold or misread, an offer the client does not actually sell, generic filler " +
  "that would fit any prospect, a weak call to action, or a call to action that " +
  "does not match the contact channel.\n\n" +
  "Keep the message in the language it was written in — do not translate. When you " +
  "rewrite, change only what is wrong and preserve the client's voice.";

export async function verifyOutreachMessage(input: {
  brandBrief: string;
  lead: LeadContext;
  channel: OutreachChannel;
  proposed: OutreachMessageData;
}): Promise<OutreachVerificationData> {
  const prompt = [
    input.brandBrief ? `CLIENT BRAND BRAIN\n${input.brandBrief}` : "",
    `PROSPECT\n${leadBlock(input.lead)}`,
    `CHANNEL: ${input.channel}`,
    `PROPOSED PAIN: ${input.proposed.pain_point}`,
    `PROPOSED OFFER ANGLE: ${input.proposed.offer_angle}`,
    `MESSAGE LANGUAGE: ${input.proposed.message_language}`,
    `PROPOSED MESSAGE\n"""\n${input.proposed.body}\n"""`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return generateStructured({
    system: VERIFICATION_SYSTEM,
    prompt,
    jsonSchema: outreachVerificationJsonSchema,
    validator: outreachVerification,
    maxTokens: 1200,
  });
}
