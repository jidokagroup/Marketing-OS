import Link from "next/link";
import { CalendarClock, CopyPlus, Download, Edit3, Sparkles } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ScoreBadge } from "@/components/score-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { duplicateGeneratedContentAction } from "./actions";

export const metadata = { title: "Generated Content · Jidoka Marketing Team OS" };

type GeneratedItem = {
  id: string;
  agent_id: string;
  topic: string | null;
  title: string | null;
  platform: string | null;
  goal: string | null;
  length: string | null;
  primary_script: string | null;
  short_version: string | null;
  long_version: string | null;
  organic_version: string | null;
  sales_version: string | null;
  overall_score: number | null;
  below_threshold: boolean;
  created_at: string;
};

function contentKind(
  item: Pick<GeneratedItem, "title" | "topic" | "platform" | "goal" | "length">,
) {
  const text = [item.title, item.topic, item.platform, item.goal, item.length]
    .join(" ")
    .toLowerCase();
  if (text.includes("email") || text.includes("mailchimp") || text.includes("newsletter")) {
    return "email";
  }
  if (text.includes("carousel")) return "carousel";
  if (text.includes("reel") || text.includes("video") || text.includes("script")) {
    return "reel script";
  }
  return "caption";
}

function libraryStatus(
  item: Pick<GeneratedItem, "below_threshold">,
  postStatuses: string[],
) {
  if (item.below_threshold) return "needs revision";
  if (postStatuses.includes("posted")) return "published";
  if (postStatuses.includes("scheduled") || postStatuses.includes("posting")) {
    return "scheduled";
  }
  if (postStatuses.includes("approved")) return "approved";
  return "draft";
}

export default async function GeneratedPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    agent?: string;
    client?: string;
    platform?: string;
    status?: string;
    type?: string;
  }>;
}) {
  const { supabase } = await requireUser();
  const {
    q = "",
    agent = "all",
    client: rawClient = "",
    platform = "all",
    status = "all",
    type = "all",
  } = await searchParams;

  const [{ data: items }, { data: scheduledPosts }, { data: agents }, { data: clients }] =
    await Promise.all([
      supabase
        .from("marketing_os_generated_content")
        .select(
          "id, agent_id, topic, title, platform, goal, length, primary_script, short_version, long_version, organic_version, sales_version, overall_score, below_threshold, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("marketing_os_scheduled_posts").select("generated_content_id, status"),
      supabase
        .from("marketing_os_writing_agents")
        .select("id, name, client_id")
        .order("updated_at", { ascending: false }),
      supabase.from("marketing_os_clients").select("id, name").order("name"),
    ]);

  const itemList = (items ?? []) as GeneratedItem[];
  const agentRows = agents ?? [];
  const requestedAgent =
    agent !== "all" ? agentRows.find((row) => row.id === agent) : null;
  const client =
    rawClient === "all"
      ? "all"
      : rawClient || requestedAgent?.client_id || agentRows[0]?.client_id || "all";
  const agentById = new Map(agentRows.map((row) => [row.id, row]));
  const clientById = new Map((clients ?? []).map((row) => [row.id, row.name]));
  const statusesByContent = new Map<string, string[]>();
  for (const post of scheduledPosts ?? []) {
    if (!post.generated_content_id) continue;
    const statuses = statusesByContent.get(post.generated_content_id) ?? [];
    statuses.push(post.status);
    statusesByContent.set(post.generated_content_id, statuses);
  }

  const enriched = itemList.map((item) => {
    const agentRow = agentById.get(item.agent_id);
    const agentName = agentRow?.name ?? "Unknown agent";
    const clientName = agentRow?.client_id
      ? clientById.get(agentRow.client_id) ?? "No client"
      : "No client";
    const derivedStatus = libraryStatus(item, statusesByContent.get(item.id) ?? []);
    const kind = contentKind(item);
    return {
      ...item,
      agentName,
      clientId: agentRow?.client_id ?? "",
      clientName,
      derivedStatus,
      kind,
    };
  });
  const query = q.trim().toLowerCase();
  const platforms = [
    "all",
    ...Array.from(new Set(enriched.map((item) => item.platform).filter(Boolean))).sort(),
  ];
  const visiblePool =
    client === "all"
      ? enriched
      : enriched.filter((item) => item.clientId === client);
  const filtered = visiblePool.filter((item) => {
    const haystack = [
      item.title,
      item.topic,
      item.platform,
      item.goal,
      item.agentName,
      item.clientName,
      item.kind,
      item.derivedStatus,
    ]
      .join(" ")
      .toLowerCase();
    return (
      (!query || haystack.includes(query)) &&
      (agent === "all" || item.agent_id === agent) &&
      (platform === "all" || item.platform === platform) &&
      (status === "all" || item.derivedStatus === status) &&
      (type === "all" || item.kind === type)
    );
  });
  const scopedAgentRows =
    client === "all"
      ? agentRows
      : agentRows.filter((row) => row.client_id === client);
  const firstAgent =
    agent !== "all"
      ? scopedAgentRows.find((row) => row.id === agent)
      : scopedAgentRows[0];
  const firstAgentHref = firstAgent?.id
    ? `/agents/${firstAgent.id}?tab=generate`
    : client !== "all"
      ? `/agents/new?client_id=${client}`
      : "/agents";

  function schedulerHref(item: { agent_id: string; clientId: string; title: string | null; topic: string | null }) {
    const params = new URLSearchParams({
      agent_id: item.agent_id,
      title: item.title || item.topic || "",
    });
    if (item.clientId) params.set("client", item.clientId);
    return `/scheduler?${params.toString()}`;
  }

  return (
    <div>
      <PageHeader
        title="Generated Content"
        description="Review, filter, duplicate, export, and send generated pieces to the scheduler."
      />

      {visiblePool.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nothing generated yet"
          description="Open a Writing Agent, use the Generate tab, and create the first caption, script, email, or carousel draft."
          actionLabel="Generate first piece"
          actionHref={firstAgentHref}
        />
      ) : (
        <div className="space-y-4">
          <form className="grid gap-2 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_150px_150px_150px_150px_auto]">
            <Input name="q" defaultValue={q} placeholder="Search content" />
            <select
              name="client"
              defaultValue={client}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">All clients</option>
              {(clients ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select
              name="agent"
              defaultValue={agent}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">All agents</option>
              {agentRows.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <select
              name="platform"
              defaultValue={platform}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {platforms.map((item) => (
                <option key={item ?? "none"} value={item ?? ""}>
                  {item === "all" ? "All platforms" : item}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={status}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {["all", "draft", "approved", "scheduled", "published", "needs revision"].map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All statuses" : item}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Filter
            </Button>
            <select
              name="type"
              defaultValue={type}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:col-start-5"
            >
              {["all", "caption", "reel script", "carousel", "email"].map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All types" : item}
                </option>
              ))}
            </select>
          </form>

          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            {filtered.length} of {visiblePool.length} generated piece
            {visiblePool.length === 1 ? "" : "s"} shown. Status is based on revision
            score and scheduler activity.
          </div>

          <div className="space-y-3">
            {filtered.map((item) => {
              const exportText =
                item.primary_script ??
                item.long_version ??
                item.short_version ??
                item.organic_version ??
                item.sales_version ??
                "";
              return (
                <Card key={item.id} className="transition-colors hover:border-primary/50">
                  <CardContent className="space-y-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          href={`/generated/${item.id}`}
                          className="font-medium hover:underline"
                        >
                          {item.title || item.topic || "Untitled piece"}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {item.clientName} · {item.agentName}
                          {item.platform ? ` · ${item.platform}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <Badge
                          variant={
                            item.derivedStatus === "needs revision"
                              ? "destructive"
                              : item.derivedStatus === "draft"
                                ? "outline"
                                : "default"
                          }
                        >
                          {item.derivedStatus === "draft" && (
                            <CalendarClock className="mr-1 h-3 w-3" />
                          )}
                          {item.derivedStatus}
                        </Badge>
                        <Badge variant="secondary">{item.kind}</Badge>
                        {item.overall_score != null && (
                          <ScoreBadge score={Number(item.overall_score)} />
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ButtonLink href={`/generated/${item.id}`} variant="outline" size="sm">
                        <Edit3 className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </ButtonLink>
                      <ButtonLink
                        href={schedulerHref(item)}
                        variant="outline"
                        size="sm"
                      >
                        <CalendarClock className="mr-1 h-3.5 w-3.5" />
                        Send to scheduler
                      </ButtonLink>
                      <form action={duplicateGeneratedContentAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <Button type="submit" variant="outline" size="sm">
                          <CopyPlus className="mr-1 h-3.5 w-3.5" />
                          Duplicate
                        </Button>
                      </form>
                      <a
                        href={`data:text/plain;charset=utf-8,${encodeURIComponent(exportText)}`}
                        download={`${(item.title || item.topic || "generated-content").replace(/[^a-z0-9_-]+/gi, "-")}.txt`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        <Download className="mr-1 h-3.5 w-3.5" />
                        Export
                      </a>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {filtered.length === 0 && (
              <EmptyState
                icon={Sparkles}
                title="No generated content matches"
                description="Clear a filter or generate a new piece from a Writing Agent."
                actionLabel="Generate content"
                actionHref={firstAgentHref}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
