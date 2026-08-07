import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Bot, Inbox, Sparkles } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { reviewInboxThreadAction } from "./inbox-actions";
import { PageHeader } from "@/components/page-header";
import { BrandBrainForm } from "@/components/brand-brain-form";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { BrandBrain, InboxMessage, InboxThread } from "@/lib/supabase/types";

type InboxThreadSummary = Pick<
  InboxThread,
  | "id"
  | "agent_id"
  | "scheduled_post_id"
  | "platform"
  | "channel"
  | "participant_username"
  | "status"
  | "review_reason"
  | "last_message_at"
  | "created_at"
>;

type InboxMessageSummary = Pick<
  InboxMessage,
  "id" | "thread_id" | "role" | "message_type" | "body" | "ai_generated" | "status" | "created_at"
>;

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: client } = await supabase
    .from("marketing_os_clients")
    .select("id, name, industry, notes")
    .eq("id", id)
    .maybeSingle();

  if (!client) notFound();

  const { data: agents } = await supabase
    .from("marketing_os_writing_agents")
    .select("id, name, status, platform, industry, last_analyzed_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  const agentList = agents ?? [];
  const agentIds = agentList.map((agent) => agent.id);
  const primaryAgent =
    agentList.find((agent) => agent.status === "ready") ?? agentList[0] ?? null;

  const [{ data: generated }, { data: posts }] =
    agentIds.length > 0
      ? await Promise.all([
          supabase
            .from("marketing_os_generated_content")
            .select("id, agent_id, topic, title, platform, created_at")
            .in("agent_id", agentIds)
            .order("created_at", { ascending: false })
            .limit(8),
          supabase
            .from("marketing_os_scheduled_posts")
            .select(
              "id, agent_id, title, platform, status, scheduled_time, caption, comment_dm_enabled, comment_auto_reply, dm_sequence",
            )
            .in("agent_id", agentIds)
            .order("created_at", { ascending: false })
            .limit(20),
        ])
      : [{ data: [] }, { data: [] }];

  let inboxThreads: InboxThreadSummary[] = [];
  if (agentIds.length > 0) {
    const { data } = await supabase
      .from("marketing_os_inbox_threads")
      .select(
        "id, agent_id, scheduled_post_id, platform, channel, participant_username, status, review_reason, last_message_at, created_at",
      )
      .in("agent_id", agentIds)
      .order("updated_at", { ascending: false })
      .limit(50);
    inboxThreads = (data ?? []) as InboxThreadSummary[];
  }

  let inboxMessages: InboxMessageSummary[] = [];
  const threadIds = inboxThreads.map((thread) => thread.id);
  if (threadIds.length > 0) {
    const { data } = await supabase
      .from("marketing_os_inbox_messages")
      .select("id, thread_id, role, message_type, body, ai_generated, status, created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: true });
    inboxMessages = (data ?? []) as InboxMessageSummary[];
  }

  let brandBrain: BrandBrain | null = null;
  if (primaryAgent) {
    const { data } = await supabase
      .from("marketing_os_brand_brains")
      .select("*")
      .eq("agent_id", primaryAgent.id)
      .maybeSingle();
    brandBrain = data as BrandBrain | null;
  }

  const messagesByThread = new Map<string, InboxMessageSummary[]>();
  for (const message of inboxMessages) {
    const messages = messagesByThread.get(message.thread_id) ?? [];
    messages.push(message);
    messagesByThread.set(message.thread_id, messages);
  }

  const inboxThreadItems: ClientInboxItem[] = inboxThreads.map((thread) => {
    const messages = messagesByThread.get(thread.id) ?? [];
    const incoming = messages.find((message) => message.message_type === "comment");
    const publicReply = messages.find((message) => message.message_type === "public_reply");
    const dmSequence = messages.find((message) => message.message_type === "dm");
    return {
      id: thread.id,
      thread_id: thread.id,
      scheduled_post_id: thread.scheduled_post_id,
      title: thread.participant_username
        ? `@${thread.participant_username}`
        : "Instagram Comment-to-DM flow",
      platform: thread.platform,
      status: thread.status,
      scheduled_time: thread.last_message_at ?? thread.created_at,
      caption:
        incoming?.body ??
        "Incoming Instagram comments will appear here after the connected account sends them.",
      comment_auto_reply: publicReply?.body ?? null,
      dm_sequence: dmSequence?.body ?? null,
      review_reason: thread.review_reason,
      source: "thread",
    };
  });

  const existingThreadPostIds = new Set(
    inboxThreadItems
      .map((item) => item.scheduled_post_id)
      .filter((postId): postId is string => Boolean(postId)),
  );
  const scheduledFallbackItems: ClientInboxItem[] = (posts ?? [])
    .filter(
      (post) =>
        post.platform === "instagram" &&
        post.comment_dm_enabled &&
        !existingThreadPostIds.has(post.id),
    )
    .map((post) => ({
      id: post.id,
      thread_id: null,
      scheduled_post_id: post.id,
      title: post.title,
      platform: post.platform,
      status: "needs_review",
      scheduled_time: post.scheduled_time,
      caption: post.caption,
      comment_auto_reply: post.comment_auto_reply,
      dm_sequence: post.dm_sequence,
      review_reason: "Created from Smart Scheduler. Review before enabling automation.",
      source: "scheduled",
    }));

  const commentDmItems = [...inboxThreadItems, ...scheduledFallbackItems];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link
          href="/clients"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← All clients
        </Link>
      </div>

      <PageHeader
        title={client.name}
        description={client.notes || "Client workspace, agents, generated content, and scheduled posts."}
      >
        <ButtonLink href={`/agents/new?client_id=${client.id}`}>
          Create Writing Agent
          <ArrowRight className="ml-1 h-4 w-4" />
        </ButtonLink>
      </PageHeader>

      {client.industry && <Badge variant="secondary">{client.industry}</Badge>}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Bot} label="Writing Agents" value={agentList.length} />
        <StatCard icon={Sparkles} label="Generated Pieces" value={generated?.length ?? 0} />
        <StatCard icon={Inbox} label="Inbox Review" value={commentDmItems.length} />
      </div>

      <ClientInboxSection clientId={client.id} items={commentDmItems} />

      <section id="brand-brain" className="space-y-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Brand Brain</h2>
          <p className="text-sm text-muted-foreground">
            Auto-filled by the Writing Agent after uploaded content is analyzed.
            Edit anything the client wants to refine.
          </p>
        </div>
        {primaryAgent ? (
          <BrandBrainForm agentId={primaryAgent.id} brain={brandBrain} />
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Create a Writing Agent first. The Brand Brain will be filled from
            that agent uploads and can be edited here.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Writing Agents</h2>
          <ButtonLink href={`/agents/new?client_id=${client.id}`} variant="outline" size="sm">
            New agent
          </ButtonLink>
        </div>
        {agentList.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No agents yet. Create one to upload files, build Brand Voice DNA, and generate content.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {agentList.map((agent) => (
              <Link key={agent.id} href={`/agents/${agent.id}`}>
                <Card className="h-full transition-colors hover:border-primary/50">
                  <CardContent className="space-y-3 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{agent.name}</p>
                      <Badge variant={agent.status === "ready" ? "default" : "outline"}>
                        {agent.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.platform && <Badge variant="secondary">{agent.platform}</Badge>}
                      <Badge variant={agent.last_analyzed_at ? "default" : "outline"}>
                        {agent.last_analyzed_at ? "Analyzed" : "Needs analysis"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityList
          title="Recent Generated Content"
          empty="Generated pieces for this client's agents will appear here."
          items={(generated ?? []).map((item) => ({
            href: `/generated/${item.id}`,
            title: item.topic || item.title || "Untitled piece",
            meta: item.platform || "Generated content",
          }))}
        />
        <ActivityList
          title="Recent Scheduled Posts"
          empty="Scheduled posts for this client's agents will appear here."
          items={(posts ?? []).map((post) => ({
            href: `/calendar?client=${client.id}&view=list`,
            title: post.title || "Untitled post",
            meta: [post.platform, post.status].filter(Boolean).join(" · "),
          }))}
        />
      </div>
    </div>
  );
}

type ClientInboxItem = {
  id: string;
  thread_id: string | null;
  scheduled_post_id: string | null;
  title: string | null;
  platform: string;
  status: string;
  scheduled_time: string | null;
  caption: string | null;
  comment_auto_reply: string | null;
  dm_sequence: string | null;
  review_reason: string | null;
  source: "thread" | "scheduled";
};

function ClientInboxSection({
  clientId,
  items,
}: {
  clientId: string;
  items: ClientInboxItem[];
}) {
  const finishedStatuses = new Set(["approved", "rejected", "posted", "resolved", "archived"]);
  const needsReview = items.filter(
    (item) =>
      !finishedStatuses.has(item.status) &&
      (item.status === "needs_review" ||
        item.status === "draft" ||
        item.status === "failed" ||
        !item.comment_auto_reply ||
        !item.dm_sequence),
  );
  const approved = items.filter((item) => item.status === "approved");
  const rejected = items.filter((item) => item.status === "rejected");
  const posted = items.filter(
    (item) => item.status === "posted" || item.status === "resolved",
  );

  return (
    <section id="inbox" className="space-y-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Inbox</h2>
        <p className="text-sm text-muted-foreground">
          Human review for Instagram Comment-to-DM flows before replies and DM
          sequences are trusted to run.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Comment-to-DM review queue</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No Instagram Comment-to-DM flows yet. Enable the toggle in Smart
              Scheduler to review public replies and DM sequences here.
            </div>
          ) : (
            <Tabs defaultValue="review">
              <TabsList>
                <TabsTrigger value="review">
                  Needs Review
                  <Badge variant="secondary">{needsReview.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="approved">
                  Approved
                  <Badge variant="secondary">{approved.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="posted">
                  Posted
                  <Badge variant="secondary">{posted.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="rejected">
                  Rejected
                  <Badge variant="secondary">{rejected.length}</Badge>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="review" className="pt-4">
                <InboxItemList
                  clientId={clientId}
                  items={needsReview}
                  empty="Nothing needs review right now."
                  reviewable
                />
              </TabsContent>
              <TabsContent value="approved" className="pt-4">
                <InboxItemList
                  clientId={clientId}
                  items={approved}
                  empty="Approved flows appear here once the post is scheduled."
                />
              </TabsContent>
              <TabsContent value="posted" className="pt-4">
                <InboxItemList
                  clientId={clientId}
                  items={posted}
                  empty="Posted Comment-to-DM flows appear here."
                />
              </TabsContent>
              <TabsContent value="rejected" className="pt-4">
                <InboxItemList
                  clientId={clientId}
                  items={rejected}
                  empty="Rejected flows appear here when a reviewer blocks automation."
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function InboxItemList({
  clientId,
  items,
  empty,
  reviewable = false,
}: {
  clientId: string;
  items: ClientInboxItem[];
  empty: string;
  reviewable?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">{item.title || "Untitled Instagram post"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.scheduled_time
                  ? new Date(item.scheduled_time).toLocaleString()
                  : "No scheduled time yet"}
              </p>
            </div>
            <Badge
              variant={
                item.status === "rejected"
                  ? "destructive"
                  : item.status === "approved" || item.status === "posted"
                    ? "default"
                    : "secondary"
              }
              className="capitalize"
            >
              {item.status.replace("_", " ")}
            </Badge>
          </div>
          <div className="mt-3 space-y-3">
            <div className="rounded-md bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Incoming comment or source caption
              </p>
              <p className="mt-1 line-clamp-3 text-sm">
                {item.caption || "No incoming message yet."}
              </p>
            </div>
            {reviewable ? (
              <form action={reviewInboxThreadAction} className="space-y-3">
                <input type="hidden" name="client_id" value={clientId} />
                <input type="hidden" name="thread_id" value={item.thread_id ?? ""} />
                <input
                  type="hidden"
                  name="scheduled_post_id"
                  value={item.scheduled_post_id ?? ""}
                />
                <div className="grid gap-3 lg:grid-cols-2">
                  <label className="space-y-1 text-sm font-medium">
                    Public comment reply
                    <Textarea
                      name="public_reply"
                      defaultValue={item.comment_auto_reply ?? ""}
                      placeholder="Write the public reply."
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium">
                    DM sequence
                    <Textarea
                      name="dm_sequence"
                      defaultValue={item.dm_sequence ?? ""}
                      placeholder="Write the DM sequence."
                    />
                  </label>
                </div>
                <Textarea
                  name="note"
                  defaultValue={item.review_reason ?? ""}
                  placeholder="Optional reviewer note"
                  className="min-h-10"
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" name="action" value="approve">
                    Approve
                  </Button>
                  <Button type="submit" name="action" value="reject" variant="outline">
                    Reject
                  </Button>
                </div>
              </form>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-md bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Public comment reply
                  </p>
                  <p className="mt-1 text-sm">
                    {item.comment_auto_reply ||
                      "Needs a public reply before this flow is ready."}
                  </p>
                </div>
                <div className="rounded-md bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    DM sequence
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {item.dm_sequence ||
                      "Needs a DM sequence before this flow is ready."}
                  </p>
                </div>
              </div>
            )}
          </div>
          {item.review_reason && !reviewable && (
            <p className="mt-3 text-xs text-muted-foreground">
              Review note: {item.review_reason}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function ActivityList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: { href: string; title: string; meta: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, index) => (
              <Link
                key={`${item.href}-${index}`}
                href={item.href}
                className="block rounded-md border p-3 text-sm transition-colors hover:border-primary/50"
              >
                <p className="truncate font-medium">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.meta}</p>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
