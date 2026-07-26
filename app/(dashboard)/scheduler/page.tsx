import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  CopyPlus,
  Link2,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import {
  PLATFORM_LABELS,
  SCHEDULER_PLATFORMS,
  connectionLabel,
} from "@/lib/social/platforms";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { SchedulerUploader } from "@/components/scheduler-uploader";
import { PostStatusBadge } from "@/components/post-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  scheduleAction,
  unscheduleAction,
  rematchAction,
  deletePostAction,
  updateCaptionAction,
  duplicatePostAction,
} from "./actions";

export const metadata = { title: "Smart Scheduler · Jidoka Marketing Team OS" };

function confidenceLabel(value: number | null) {
  if (value == null) return "low confidence";
  if (value >= 80) return "high confidence";
  if (value >= 65) return "medium confidence";
  return "low confidence";
}

export default async function SchedulerPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; title?: string; agent_id?: string }>;
}) {
  const { supabase } = await requireUser();
  const { status = "all", title = "", agent_id: defaultAgentId = "" } =
    await searchParams;

  const [{ data: agents }, { data: posts }, { data: accounts }, { data: generatedContent }] =
    await Promise.all([
      supabase.from("marketing_os_writing_agents").select("id, name").order("name"),
      supabase
        .from("marketing_os_scheduled_posts")
        .select(
          "id, title, platform, content_type, status, scheduled_time, caption, generated_content_id, media_path, best_posting_window, ideal_days, confidence_score, schedule_reason, comment_dm_enabled, comment_auto_reply, dm_sequence, social_account_id, writing_agents:marketing_os_writing_agents(name)",
        )
        .order("created_at", { ascending: false }),
      supabase.from("marketing_os_social_accounts").select("platform, status"),
      supabase
        .from("marketing_os_generated_content")
        .select("id, agent_id, title, topic, platform, short_version, organic_version, primary_script")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  const agentList = agents ?? [];
  const allPosts = posts ?? [];
  const postList =
    status === "all" ? allPosts : allPosts.filter((post) => post.status === status);
  const connectedPlatforms = new Set(
    (accounts ?? [])
      .filter((account) => account.status === "active")
      .map((account) => account.platform),
  );
  const agentIdForConnections = defaultAgentId || agentList[0]?.id || "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const calendarDays = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return date;
  });
  const calendarByDay = new Map<string, typeof allPosts>();
  for (const post of allPosts) {
    if (!post.scheduled_time) continue;
    const dateKey = new Date(post.scheduled_time).toISOString().slice(0, 10);
    const dayPosts = calendarByDay.get(dateKey) ?? [];
    dayPosts.push(post);
    calendarByDay.set(dateKey, dayPosts);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Smart Scheduler"
        description="Create social posts and Mailchimp email campaigns, bulk import a spreadsheet, and let Jidoka Marketing Team OS recommend timing from follower activity, audience behavior, and competitor windows."
      />

      <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {SCHEDULER_PLATFORMS.map((platform) => {
          const connected = connectedPlatforms.has(platform.key);
          const disabled = Boolean(platform.disabled);
          const statusLabel = disabled
            ? "API setup"
            : connected
              ? "Connected"
              : "Not connected";
          const canConnectNow = platform.connectable && !disabled;
          return (
            <div
              key={platform.key}
              className={`space-y-3 rounded-md bg-background px-3 py-3 text-sm ${
                disabled ? "text-muted-foreground opacity-60" : ""
              }`}
              title={disabled ? platform.disabledReason : connectionLabel(platform.key, connected)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{platform.label}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      disabled
                        ? "bg-muted-foreground/50"
                        : connected
                          ? "bg-emerald-500"
                          : "bg-red-500"
                    }`}
                  />
                  {statusLabel}
                </span>
              </div>
              {disabled ? (
                <div className="text-xs font-medium text-muted-foreground">
                  API setup in progress
                </div>
              ) : connected ? (
                <div className="text-xs font-medium text-emerald-600">Connected</div>
              ) : canConnectNow && agentIdForConnections ? (
                <a
                  href={`/api/social/connect?agent_id=${agentIdForConnections}&platform=${platform.key}`}
                  className={buttonVariants({ variant: "outline", size: "xs" })}
                >
                  Connect account
                </a>
              ) : !canConnectNow ? (
                <div className="text-xs text-muted-foreground">Setup needed</div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Create an agent first
                </span>
              )}
            </div>
          );
        })}
      </div>

      {agentList.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No agents yet"
          description="Create a Client Content Agent before scheduling content."
          actionLabel="Go to agents"
          actionHref="/agents"
        />
      ) : (
        <SchedulerUploader
          agents={agentList}
          connectedPlatforms={[...connectedPlatforms]}
          defaultAgentId={defaultAgentId}
          defaultTitle={title}
          generatedContent={generatedContent ?? []}
        />
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Calendar
            </h2>
            <p className="text-sm text-muted-foreground">
              Next 30 days from the Smart Scheduler queue.
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {calendarDays.map((date) => {
            const dateKey = date.toISOString().slice(0, 10);
            const dayPosts = calendarByDay.get(dateKey) ?? [];
            return (
              <div key={dateKey} className="min-h-28 rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {date.toLocaleDateString("en-US", { weekday: "short" })}
                  </span>
                </div>
                {dayPosts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Open</p>
                ) : (
                  <div className="space-y-1.5">
                    {dayPosts.slice(0, 3).map((post) => (
                      <div
                        key={post.id}
                        className="rounded-md bg-muted/40 px-2 py-1.5 text-xs"
                      >
                        <p className="truncate font-medium">{post.title}</p>
                        <p className="text-muted-foreground">
                          {PLATFORM_LABELS[
                            post.platform as keyof typeof PLATFORM_LABELS
                          ] ?? post.platform}
                        </p>
                      </div>
                    ))}
                    {dayPosts.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{dayPosts.length - 3} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Queue</h2>
          <div className="flex flex-wrap gap-2">
            {["all", "draft", "scheduled", "failed", "posted"].map((item) => (
              <ButtonLink
                key={item}
                href={`/scheduler?status=${item}`}
                variant={status === item ? "default" : "outline"}
                size="sm"
              >
                {item}
              </ButtonLink>
            ))}
          </div>
        </div>
        {postList.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Nothing scheduled"
            description="Add a post or email campaign above. Tip: give it the same title as a generated piece so the copy attaches automatically."
            actionLabel="Schedule content"
            actionHref="/scheduler"
          />
        ) : (
          <div className="space-y-3">
            {postList.map((p) => {
              const agent = p.writing_agents as unknown as { name: string } | null;
              const isEmailCampaign = p.platform === "mailchimp";
              return (
                <Card key={p.id}>
                  <CardContent className="space-y-3 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {agent?.name ?? "—"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary">
                          {PLATFORM_LABELS[p.platform as keyof typeof PLATFORM_LABELS] ??
                            p.platform}
                        </Badge>
                        <Badge variant="outline">
                          {isEmailCampaign ? "Email campaign" : p.content_type}
                        </Badge>
                        <PostStatusBadge status={p.status} />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {p.generated_content_id ? (
                        <Link
                          href={`/generated/${p.generated_content_id}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <Link2 className="h-3.5 w-3.5" /> Matched voice content
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          No title match yet
                        </span>
                      )}
                      {p.media_path && (
                        <span className="text-muted-foreground">media attached</span>
                      )}
                      {p.scheduled_time && (
                        <span className="text-muted-foreground">
                          {new Date(p.scheduled_time).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="grid gap-3 rounded-md bg-muted/30 p-3 text-sm lg:grid-cols-[1fr_auto]">
                      <div>
                        <p className="mb-1 flex items-center gap-1 font-medium">
                          <Sparkles className="h-3.5 w-3.5" />
                          Best-time recommendation
                        </p>
                        <p className="text-muted-foreground">
                          {p.best_posting_window ?? "Connect analytics to refine timing."}
                        </p>
                        {p.schedule_reason && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {p.schedule_reason}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        {p.ideal_days && (
                          <Badge variant="outline">{p.ideal_days}</Badge>
                        )}
                        {p.confidence_score != null && (
                          <Badge variant="secondary">
                            {confidenceLabel(Number(p.confidence_score))}
                          </Badge>
                        )}
                        {p.social_account_id ? (
                          <Badge>Connected</Badge>
                        ) : (
                          <Badge variant="destructive">Disconnected</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!p.caption && (
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3" />
                          {isEmailCampaign ? "needs email copy" : "needs caption"}
                        </Badge>
                      )}
                      {!isEmailCampaign && !p.media_path && (
                        <Badge variant="outline">
                          <AlertCircle className="h-3 w-3" />
                          needs media
                        </Badge>
                      )}
                      {!p.social_account_id && (
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3" />
                          account disconnected
                        </Badge>
                      )}
                    </div>

                    {p.comment_dm_enabled && (
                      <div className="rounded-md border p-3 text-sm">
                        <p className="mb-1 flex items-center gap-1 font-medium">
                          <MessageCircle className="h-3.5 w-3.5" />
                          Instagram comment to DM flow
                        </p>
                        <p className="text-muted-foreground">
                          Reply: {p.comment_auto_reply || "Dynamic reply enabled"}
                        </p>
                        {p.dm_sequence && (
                          <p className="mt-1 text-muted-foreground">
                            DM: {p.dm_sequence}
                          </p>
                        )}
                      </div>
                    )}

                    <form action={updateCaptionAction} className="space-y-2">
                      <input type="hidden" name="id" value={p.id} />
                      <Textarea
                        name="caption"
                        rows={3}
                        defaultValue={p.caption ?? ""}
                        placeholder={isEmailCampaign ? "Edit email copy / subject notes" : "Edit caption"}
                      />
                      <Button variant="outline" size="sm" type="submit">
                        Save caption
                      </Button>
                    </form>

                    <div className="flex flex-wrap items-center gap-2">
                      {p.status === "scheduled" ? (
                        <form action={unscheduleAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <Button variant="outline" size="sm" type="submit">
                            Unschedule
                          </Button>
                        </form>
                      ) : (
                        <form action={scheduleAction} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={p.id} />
                          <Input
                            name="scheduled_time"
                            type="datetime-local"
                            required
                            className="h-8 w-auto"
                          />
                          <Button variant="outline" size="sm" type="submit">
                            {p.social_account_id ? "Schedule" : "Save draft time"}
                          </Button>
                        </form>
                      )}

                      {!p.generated_content_id && (
                        <form action={rematchAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <Button variant="ghost" size="sm" type="submit">
                            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Re-match title
                          </Button>
                        </form>
                      )}

                      <form action={duplicatePostAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <Button variant="ghost" size="sm" type="submit">
                          <CopyPlus className="mr-1 h-3.5 w-3.5" /> Duplicate
                        </Button>
                      </form>

                      <form action={deletePostAction} className="ml-auto">
                        <input type="hidden" name="id" value={p.id} />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          type="submit"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
