import { Inbox } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { INBOX_PLATFORM_OPTIONS } from "@/lib/core-agents";
import {
  asRows,
  formatDate,
  isOpsSchemaMissing,
  opsTable,
  titleCase,
  type CampaignRow,
  type ClientOption,
} from "@/lib/marketing-os/operations";
import { EmptyState } from "@/components/empty-state";
import { OpsSchemaNotice } from "@/components/ops-schema-notice";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { updateInboxThreadStatusAction } from "./actions";
import { setModeratorSettingAction } from "./moderator-actions";
import { trainedAgentIds } from "@/lib/agent-readiness";
import { InboxModeratorRunButton } from "@/components/inbox-moderator-run-button";
import { UntrainedAgentNotice } from "@/components/untrained-agent-notice";

export const metadata = { title: "Inbox · Jidoka Marketing Team OS" };

type InboxThread = {
  id: string;
  campaign_id?: string | null;
  client_id: string | null;
  agent_id: string | null;
  platform: string;
  channel: string;
  participant_username: string | null;
  status: string;
  review_reason: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

type InboxMessage = {
  id: string;
  thread_id: string;
  role: string;
  body: string;
  message_type?: string;
  status: string;
  created_at: string;
};

function latestMessage(
  messages: InboxMessage[],
  threadId: string,
  roles: string[],
) {
  return messages.find(
    (message) => message.thread_id === threadId && roles.includes(message.role),
  );
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string; review?: string }>;
}) {
  const { platform = "all", review = "all" } = await searchParams;
  const { user, supabase } = await requireUser();
  const threadsResult = await opsTable(supabase, "marketing_os_inbox_threads")
    .select("id, campaign_id, client_id, agent_id, platform, channel, participant_username, status, review_reason, last_message_at, created_at, updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });
  const schemaMissing = isOpsSchemaMissing(threadsResult.error);

  const [fallbackThreads, campaignsResult, clientsResult, agentsResult, moderatorSettingsResult] = await Promise.all([
    schemaMissing
      ? opsTable(supabase, "marketing_os_inbox_threads")
          .select("id, client_id, agent_id, platform, channel, participant_username, status, review_reason, last_message_at, created_at, updated_at")
          .eq("owner_id", user.id)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: null }),
    schemaMissing
      ? Promise.resolve({ data: null })
      : opsTable(supabase, "marketing_os_campaigns")
          .select(
            "id, owner_id, client_id, name, campaign_type, status, stage, health, priority, goal, primary_kpi, target_audience, owner_name, budget, actual_spend, expected_revenue, attributed_revenue, lead_goal, leads_count, start_date, end_date, notes, created_at, updated_at",
          )
          .eq("owner_id", user.id),
    supabase
      .from("marketing_os_clients")
      .select("id, name, industry")
      .eq("owner_id", user.id),
    supabase
      .from("marketing_os_writing_agents")
      .select("id, name, status")
      .order("created_at", { ascending: false }),
    opsTable(supabase, "marketing_os_inbox_moderator_settings")
      .select("agent_id, enabled, auto_approve_low_risk")
      .eq("owner_id", user.id),
  ]);

  const allThreads = schemaMissing
    ? asRows<InboxThread>(fallbackThreads.data)
    : asRows<InboxThread>(threadsResult.data);
  const threads = allThreads.filter((thread) => {
    const platformMatch = platform === "all" || thread.platform === platform;
    const reviewMatch =
      review !== "needs" ||
      thread.status === "needs_review" ||
      Boolean(thread.review_reason);
    return platformMatch && reviewMatch;
  });
  const messagesResult =
    allThreads.length > 0
      ? await opsTable(supabase, "marketing_os_inbox_messages")
          .select("id, thread_id, role, body, message_type, status, created_at")
          .eq("owner_id", user.id)
          .in(
            "thread_id",
            allThreads.map((thread) => thread.id),
          )
          .order("created_at", { ascending: false })
      : { data: null, error: null };
  const messages = asRows<InboxMessage>(messagesResult.data);
  const campaigns = schemaMissing
    ? []
    : asRows<CampaignRow>(campaignsResult.data);
  const clients = (clientsResult.data ?? []) as ClientOption[];
  const moderatorAgents = (agentsResult.data ?? []) as {
    id: string;
    name: string;
    status: string;
  }[];
  const moderatorSettings = isOpsSchemaMissing(moderatorSettingsResult.error)
    ? []
    : asRows<{ agent_id: string; enabled: boolean; auto_approve_low_risk: boolean }>(
        moderatorSettingsResult.data,
      );
  const trainedAgents = await trainedAgentIds(
    supabase,
    moderatorAgents.map((agent) => agent.id),
  );
  const moderatorSettingByAgent = new Map(
    moderatorSettings.map((setting) => [setting.agent_id, setting]),
  );
  const campaignById = new Map(campaigns.map((item) => [item.id, item]));
  const clientById = new Map(clients.map((item) => [item.id, item]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        description="All comments and messages from connected platforms, with high-risk items held for human review."
      />

      {schemaMissing && <OpsSchemaNotice title="Campaign inbox links need migration 0016" />}

      {moderatorAgents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Inbox Moderator</CardTitle>
            <p className="text-sm text-muted-foreground">
              An agent that drafts replies in the brand&rsquo;s voice for every open thread, and pings you
              only for the ones it flags. Nothing is ever sent to a platform automatically &mdash; sending
              still happens below, the same way it always has.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {moderatorAgents.map((agent) => {
              const setting = moderatorSettingByAgent.get(agent.id);
              if (!trainedAgents.has(agent.id)) {
                return (
                  <div key={agent.id} className="space-y-2">
                    <p className="text-sm font-medium">{agent.name}</p>
                    <UntrainedAgentNotice agentId={agent.id} what="Every reply the moderator drafts" />
                  </div>
                );
              }
              return (
                <div
                  key={agent.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <form
                    action={setModeratorSettingAction}
                    className="flex flex-wrap items-center gap-4"
                  >
                    <input type="hidden" name="agent_id" value={agent.id} />
                    <span className="text-sm font-medium">{agent.name}</span>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        name="enabled"
                        defaultChecked={setting?.enabled ?? false}
                        className="h-4 w-4"
                      />
                      On for this agent
                    </label>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        name="auto_approve_low_risk"
                        defaultChecked={setting?.auto_approve_low_risk ?? false}
                        className="h-4 w-4"
                      />
                      Auto-approve low-risk drafts
                    </label>
                    <Button type="submit" size="sm" variant="outline">
                      Save
                    </Button>
                  </form>
                  <InboxModeratorRunButton agentId={agent.id} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <form className="grid gap-2 rounded-lg border p-3 md:grid-cols-[220px_220px_auto]">
        <select
          name="platform"
          defaultValue={platform}
          className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {INBOX_PLATFORM_OPTIONS.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          name="review"
          defaultValue={review}
          className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="all">All review states</option>
          <option value="needs">Needs human review</option>
        </select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {threads.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Inbox is clear"
          description="Inbound social comments, DMs, and review threads will appear here."
        />
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => {
            const customerMessage = latestMessage(messages, thread.id, [
              "commenter",
              "user",
              "human",
            ]);
            const assistantDraft = latestMessage(messages, thread.id, [
              "assistant",
              "ai",
            ]);
            const campaign = thread.campaign_id
              ? campaignById.get(thread.campaign_id)
              : null;
            const client = thread.client_id
              ? clientById.get(thread.client_id)
              : null;
            const suggestedReply =
              assistantDraft?.body ??
              "Thanks for reaching out. We are reviewing this and will follow up with the right next step.";

            return (
              <Card key={thread.id}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {thread.participant_username ??
                          campaign?.name ??
                          client?.name ??
                          "Inbox thread"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {titleCase(thread.platform)} · {titleCase(thread.channel)} ·{" "}
                        {campaign?.name ?? client?.name ?? "No campaign"} ·{" "}
                        {formatDate(thread.last_message_at ?? thread.updated_at)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        thread.status === "needs_review"
                          ? "destructive"
                          : thread.status === "resolved"
                            ? "default"
                            : "outline"
                      }
                    >
                      {thread.status === "needs_review"
                        ? "Needs human review"
                        : titleCase(thread.status)}
                    </Badge>
                  </div>

                  {thread.review_reason && (
                    <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                      {thread.review_reason}
                    </p>
                  )}

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Message
                      </p>
                      <p className="mt-2 text-sm">
                        {customerMessage?.body ?? "No inbound body saved yet."}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Suggested reply
                      </p>
                      <p className="mt-2 text-sm">{suggestedReply}</p>
                    </div>
                  </div>

                  <form
                    action={updateInboxThreadStatusAction}
                    className="space-y-3"
                  >
                    <input type="hidden" name="id" value={thread.id} />
                    <input
                      type="hidden"
                      name="campaign_id"
                      value={thread.campaign_id ?? ""}
                    />
                    <input
                      type="hidden"
                      name="message_id"
                      value={assistantDraft?.id ?? ""}
                    />
                    <Textarea
                      name="reply"
                      defaultValue={suggestedReply}
                      rows={3}
                      aria-label="Reply"
                    />
                    <Textarea
                      name="note"
                      placeholder="Internal note, optional"
                      rows={2}
                      aria-label="Internal note"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" name="status" value="posted">
                        Send reply
                      </Button>
                      <Button
                        type="submit"
                        name="status"
                        value="resolved"
                        variant="outline"
                      >
                        Mark resolved
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
