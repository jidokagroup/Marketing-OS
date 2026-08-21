import { z } from "zod";

import { bool, obj, str } from "@/lib/schemas/jsonschema";

/**
 * Inbox Moderator's per-message output.
 *
 * Channel-agnostic on purpose -- unlike the Instagram-specific Comment-to-DM
 * flow (lib/ai/comment-dm.ts), which always returns a public reply plus a DM
 * sequence, this drafts one reply for whatever the thread's channel actually
 * is. The risk fields are the escalation signal: "an agent that writes
 * responses when applicable, and pings a human whenever it should not"
 * means every draft carries its own answer to "does this need a human."
 */
export const inboxReply = z.object({
  reply: z.string().min(1),
  needs_human: z.boolean(),
  reason: z.string(),
  risk_level: z.enum(["low", "medium", "high"]),
});
export type InboxReplyData = z.infer<typeof inboxReply>;

export const inboxReplyJsonSchema = obj({
  reply: str("The reply to send back on this thread, in the brand's voice, grounded only in the brand brief and DNA provided."),
  needs_human: bool(
    "True if a person should read this before it goes out -- unclear intent, a complaint, anything medical/legal/financial, hostility, or a request the brand brief does not cover.",
  ),
  reason: str("One short sentence: why a human is or is not needed."),
  risk_level: str("One of: low, medium, high."),
});
