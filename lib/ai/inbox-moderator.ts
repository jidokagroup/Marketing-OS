import { generateStructured } from "@/lib/ai/anthropic";
import { buildDnaBrief, loadDnaInput } from "@/lib/ai/generate";
import { buildBrandBrainBrief } from "@/lib/brand-brain";
import { opsTable } from "@/lib/marketing-os/operations";
import { hasVoiceDna } from "@/lib/agent-readiness";
import { inboxReply, inboxReplyJsonSchema, type InboxReplyData } from "@/lib/schemas/inbox-moderator";
import type { BrandBrain } from "@/lib/supabase/types";

const SYSTEM_PROMPT =
  "You are the Inbox Moderator inside a Marketing Operating System -- a chatbot " +
  "that drafts replies across every connected inbox in the brand's own voice, and " +
  "flags anything a human should see before it goes out. You are drafting a reply " +
  "to one message on one thread; you are not deciding whether to send it. Ground " +
  "every reply only in the brand brief and voice DNA given to you -- never invent " +
  "services, pricing, availability, or promises. Set needs_human true for anything " +
  "unclear, numeric or spammy, hostile, a complaint, medical/legal/financial, or " +
  "outside what the brand brief covers. When in doubt, flag it rather than guess.";

export interface InboxModeratorInput {
  brandBrief: string;
  dnaBrief: string;
  platform: string;
  channel: string;
  participant: string | null;
  messageBody: string;
}

export async function draftInboxReply(
  input: InboxModeratorInput,
): Promise<InboxReplyData> {
  const prompt = [
    input.brandBrief ? `BRAND BRIEF\n${input.brandBrief}` : "",
    input.dnaBrief ? `VOICE DNA\n${input.dnaBrief}` : "",
    `THREAD\nPlatform: ${input.platform}\nChannel: ${input.channel}${
      input.participant ? `\nFrom: ${input.participant}` : ""
    }`,
    `MESSAGE TO REPLY TO\n${input.messageBody}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return generateStructured({
    system: SYSTEM_PROMPT,
    prompt,
    jsonSchema: inboxReplyJsonSchema,
    validator: inboxReply,
    maxTokens: 800,
  });
}


type ModeratorThread = {
  id: string;
  agent_id: string | null;
  platform: string;
  channel: string;
  participant_username: string | null;
};

type ModeratorMessage = {
  thread_id: string;
  role: string;
  body: string;
  created_at: string;
};

type ModeratorSupabase = Parameters<typeof opsTable>[0];

/** Roles that represent a real person writing in -- eligible for a reply. */
const INBOUND_ROLES = new Set(["commenter", "user", "human"]);
/** Roles that represent a reply already drafted, by this agent or another. */
const ASSISTANT_ROLES = new Set(["assistant", "ai"]);

/**
 * Ceiling on threads answered per pass. Each one is a sequential Claude
 * call, and both callers run under a wall-clock budget (300s for the cron
 * sweep, 120s for the on-demand button). A backlog is worked through over
 * successive passes rather than risking the whole pass timing out and
 * committing nothing.
 */
const MAX_THREADS_PER_PASS = 15;

/**
 * One pass over one agent's inbox: draft a reply for every thread that is
 * still waiting on one, then either leave it for a human (needs_human, or
 * the setting says every draft needs a look) or mark it ready to send.
 *
 * Never posts anything to a platform -- that stays a separate, deliberate
 * human action through the existing Inbox review flow. This only removes
 * the blank-page problem and tells the human which threads it already
 * trusts, so review time goes to the ones that actually need it.
 */
export async function runModeratorPassForAgent(
  supabase: ModeratorSupabase,
  ownerId: string,
  agentId: string,
  autoApproveLowRisk: boolean,
): Promise<{
  drafted: number;
  flagged: number;
  /** How many open threads were examined, so "nothing to do" is legible. */
  checked: number;
  skipped?: "untrained";
}> {
  // Guarded here rather than only in the routes so the scheduled sweep is
  // covered too: a setting can be enabled and the agent's training removed
  // (or never finished) afterwards, and a reply written with no Voice DNA is
  // a generic reply going out under the client's name.
  if (!(await hasVoiceDna(supabase, agentId))) {
    return { drafted: 0, flagged: 0, checked: 0, skipped: "untrained" };
  }

  const threadsResult = await opsTable(supabase, "marketing_os_inbox_threads")
    .select("id, agent_id, platform, channel, participant_username")
    .eq("owner_id", ownerId)
    .eq("agent_id", agentId)
    .eq("status", "needs_review");
  const threads = (threadsResult.data ?? []) as ModeratorThread[];
  // Reporting how many threads were examined is what separates "there was
  // nothing to do" from "this did not run".
  if (threads.length === 0) return { drafted: 0, flagged: 0, checked: 0 };

  const messagesResult = await opsTable(supabase, "marketing_os_inbox_messages")
    .select("thread_id, role, body, created_at")
    .eq("owner_id", ownerId)
    .in(
      "thread_id",
      threads.map((thread) => thread.id),
    )
    .order("created_at", { ascending: true });
  const messages = (messagesResult.data ?? []) as ModeratorMessage[];

  // Role sets match how the Inbox page itself reads a thread (see
  // app/(dashboard)/inbox/page.tsx). Both matter:
  //   - "ai" counts as an existing draft, or a thread the Comment-to-DM flow
  //     already answered would get a second, duplicate reply.
  //   - only genuine inbound roles are eligible to be replied to. Treating
  //     "everything that is not 'assistant'" as inbound would let the agent
  //     reply to an "ai" draft or a "system" note -- that is, to itself.
  const inbound = messages.filter((m) => INBOUND_ROLES.has(m.role));
  const alreadyDrafted = new Set(
    messages.filter((m) => ASSISTANT_ROLES.has(m.role)).map((m) => m.thread_id),
  );
  // Ordered ascending by created_at, so the last write per thread wins.
  const latestInbound = new Map<string, ModeratorMessage>();
  for (const message of inbound) {
    latestInbound.set(message.thread_id, message);
  }

  const brainResult = await opsTable(supabase, "marketing_os_brand_brains")
    .select("*")
    .eq("agent_id", agentId)
    .maybeSingle();
  const brandBrief = buildBrandBrainBrief((brainResult.data as BrandBrain) ?? null);
  const dna = await loadDnaInput(supabase, agentId);
  const dnaBrief = buildDnaBrief(dna);

  let drafted = 0;
  let flagged = 0;

  const pending = threads
    .filter((thread) => !alreadyDrafted.has(thread.id) && latestInbound.has(thread.id))
    .slice(0, MAX_THREADS_PER_PASS);

  for (const thread of pending) {
    const inboundMessage = latestInbound.get(thread.id);
    if (!inboundMessage) continue;

    const result = await draftInboxReply({
      brandBrief,
      dnaBrief,
      platform: thread.platform,
      channel: thread.channel,
      participant: thread.participant_username,
      messageBody: inboundMessage.body,
    });

    const needsHuman = result.needs_human || result.risk_level !== "low";
    const messageStatus = !needsHuman && autoApproveLowRisk ? "approved" : "draft";

    await opsTable(supabase, "marketing_os_inbox_messages").insert({
      owner_id: ownerId,
      thread_id: thread.id,
      role: "assistant",
      message_type: thread.channel === "dm" ? "dm" : "public_reply",
      body: result.reply,
      ai_generated: true,
      status: messageStatus,
    });

    // A thread the existing Inbox page's "needs review" filter matches on
    // either status='needs_review' or a non-null review_reason (see
    // app/(dashboard)/inbox/page.tsx). An auto-approved low-risk draft must
    // clear both, or it would still show up in the pile it was meant to
    // clear -- the whole point of auto-approving it.
    await opsTable(supabase, "marketing_os_inbox_threads")
      .update(
        needsHuman
          ? { status: "needs_review", review_reason: result.reason }
          : autoApproveLowRisk
            ? { status: "approved", review_reason: null }
            : { status: "needs_review", review_reason: `Drafted, low risk: ${result.reason}` },
      )
      .eq("id", thread.id);

    drafted += 1;
    if (needsHuman) flagged += 1;
  }

  return { drafted, flagged, checked: threads.length };
}
