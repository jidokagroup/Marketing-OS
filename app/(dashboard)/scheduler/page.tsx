import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  CopyPlus,
  Link2,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import {
  getEmailProviderDefinition,
  normalizeEmailProvider,
} from "@/lib/email-providers";
import {
  asRow,
  isOpsSchemaMissing,
  opsTable,
} from "@/lib/marketing-os/operations";
import {
  PLATFORM_LABELS,
  SCHEDULER_PLATFORMS,
  connectionLabel,
  isAutoPublishableContent,
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
  updateCommentDmFlowAction,
  duplicatePostAction,
} from "./actions";

export const metadata = { title: "Smart Scheduler · Jidoka Marketing Team OS" };

type EmailProviderSettingsRow = {
  provider: string;
  provider_label: string | null;
  status: string;
};

function confidenceLabel(value: number | null) {
  if (value == null) return "low confidence";
  if (value >= 80) return "high confidence";
  if (value >= 65) return "medium confidence";
  return "low confidence";
}

export default async function SchedulerPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    title?: string;
    agent_id?: string;
    client?: string;
    content_id?: string;
  }>;
}) {
  const { user, supabase } = await requireUser();
  const {
    status = "all",
    title = "",
    agent_id: requestedAgentId = "",
    client: rawClient = "",
    content_id: contentId = "",
  } = await searchParams;

  const [{ data: allAgents }, { data: clients }] = await Promise.all([
    supabase
      .from("marketing_os_writing_agents")
      .select("id, name, client_id")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("marketing_os_clients")
      .select("id, name")
      .eq("owner_id", user.id)
      .order("name"),
  ]);

  const allAgentList = allAgents ?? [];
  const requestedAgent = requestedAgentId
    ? allAgentList.find((agent) => agent.id === requestedAgentId)
    : null;
  const scopedClientId =
    rawClient === "all"
      ? ""
      : rawClient || requestedAgent?.client_id || allAgentList[0]?.client_id || "";
  const scopedClient = scopedClientId
    ? (clients ?? []).find((item) => item.id === scopedClientId)
    : null;
  const scopedAgents = scopedClientId
    ? allAgentList.filter((agent) => agent.client_id === scopedClientId)
    : allAgentList;
  const scopedAgentIds = scopedAgents.map((agent) => agent.id);
  const requestedAgentInScope = Boolean(
    requestedAgent && scopedAgents.some((agent) => agent.id === requestedAgent.id),
  );
  const postAgentIds =
    requestedAgentInScope && requestedAgent ? [requestedAgent.id] : scopedAgentIds;
  const effectiveDefaultAgentId =
    requestedAgentInScope && requestedAgent
      ? requestedAgent.id
      : scopedAgents[0]?.id ?? "";

  let postsQuery = supabase
    .from("marketing_os_scheduled_posts")
    .select(
      "id, title, platform, content_type, status, scheduled_time, caption, generated_content_id, media_path, best_posting_window, ideal_days, confidence_score, schedule_reason, comment_dm_enabled, comment_auto_reply, dm_sequence, social_account_id, error, writing_agents:marketing_os_writing_agents(name)",
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  let accountsQuery = supabase
    .from("marketing_os_social_accounts")
    .select("platform, status")
    .eq("owner_id", user.id);
  let generatedContentQuery = supabase
    .from("marketing_os_generated_content")
    .select("id, agent_id, title, topic, platform, short_version, organic_version, primary_script")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (scopedClientId) {
    postsQuery = postsQuery.in("agent_id", postAgentIds);
    accountsQuery = accountsQuery.in("agent_id", postAgentIds);
    generatedContentQuery = generatedContentQuery.in("agent_id", postAgentIds);
  }
  if (status !== "all") postsQuery = postsQuery.eq("status", status);

  const [
    postsResult,
    accountsResult,
    generatedContentResult,
    emailProviderResult,
  ] =
    scopedClientId && postAgentIds.length === 0
      ? await Promise.all([
          Promise.resolve({ data: [] }),
          Promise.resolve({ data: [] }),
          Promise.resolve({ data: [] }),
          opsTable(supabase, "marketing_os_email_provider_settings")
            .select("provider, provider_label, status")
            .eq("owner_id", user.id)
            .maybeSingle(),
        ])
      : await Promise.all([
          postsQuery,
          accountsQuery,
          generatedContentQuery,
          opsTable(supabase, "marketing_os_email_provider_settings")
            .select("provider, provider_label, status")
            .eq("owner_id", user.id)
            .maybeSingle(),
        ]);

  const agentList = scopedAgents;
  const posts = postsResult.data ?? [];
  const accounts = accountsResult.data ?? [];
  const generatedContent = generatedContentResult.data ?? [];
  const postList = posts;
  const emailProviderSettings = isOpsSchemaMissing(emailProviderResult.error)
    ? null
    : asRow<EmailProviderSettingsRow>(emailProviderResult.data);
  const selectedEmailProvider = normalizeEmailProvider(
    emailProviderSettings?.provider,
  );
  const selectedEmailProviderDefinition =
    getEmailProviderDefinition(selectedEmailProvider);
  const selectedEmailProviderLabel =
    emailProviderSettings?.provider_label ??
    selectedEmailProviderDefinition.label;
  const connectedPlatforms = new Set(
    (accounts ?? [])
      .filter((account) => account.status === "active")
      .map((account) => account.platform),
  );
  const emailProviderConnected =
    selectedEmailProvider === "mailchimp"
      ? connectedPlatforms.has("mailchimp")
      : emailProviderSettings?.status === "connected";
  if (emailProviderConnected) connectedPlatforms.add("mailchimp");
  const agentIdForConnections = effectiveDefaultAgentId || agentList[0]?.id || "";
  const scopedParams = new URLSearchParams();
  if (scopedClientId) scopedParams.set("client", scopedClientId);
  if (requestedAgentInScope && requestedAgent) {
    scopedParams.set("agent_id", requestedAgent.id);
  }
  if (title) scopedParams.set("title", title);
  function schedulerHref(nextStatus: string) {
    const params = new URLSearchParams(scopedParams);
    params.set("status", nextStatus);
    return `/scheduler?${params.toString()}`;
  }
  const schedulerHomeHref = scopedParams.toString()
    ? `/scheduler?${scopedParams.toString()}`
    : "/scheduler";

  return (
    <div className="space-y-8">
      <PageHeader
        title={scopedClient ? `${scopedClient.name} Smart Scheduler` : "Smart Scheduler"}
        description={`Create social posts and ${selectedEmailProviderLabel} email campaigns, bulk import a spreadsheet, and let Jidoka Marketing Team OS recommend timing from follower activity, audience behavior, and competitor windows.`}
      />

      <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-6">
        {SCHEDULER_PLATFORMS.map((platform) => {
          const isEmailCampaign = platform.key === "mailchimp";
          const connected = connectedPlatforms.has(platform.key);
          const disabled = Boolean(platform.disabled);
          const autoPostingLive = platform.mediaTypes.some((type) =>
            isAutoPublishableContent(platform.key, type),
          );
          const statusLabel = disabled
            ? "API setup"
            : connected
              ? "Connected"
              : "Not connected";
          const canConnectNow =
            platform.connectable &&
            !disabled &&
            (!isEmailCampaign || selectedEmailProvider === "mailchimp");
          const platformLabel = isEmailCampaign
            ? "Email Campaign"
            : platform.label;
          return (
            <div
              key={platform.key}
              className={`space-y-3 rounded-md bg-background px-3 py-3 text-sm ${
                disabled ? "text-muted-foreground opacity-60" : ""
              }`}
              title={disabled ? platform.disabledReason : connectionLabel(platform.key, connected)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{platformLabel}</span>
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
              ) : isEmailCampaign && selectedEmailProvider !== "mailchimp" ? (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Provider: {selectedEmailProviderLabel}
                  </div>
                  <ButtonLink href="/settings" variant="outline" size="xs">
                    Edit provider
                  </ButtonLink>
                </div>
              ) : connected ? (
                <div className="text-xs font-medium text-emerald-600">
                  {autoPostingLive ? "Auto-posting live" : "Connected for planning"}
                </div>
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
          description="Create a writing agent before scheduling content."
          actionLabel="Go to agents"
          actionHref="/agents"
        />
      ) : (
        <SchedulerUploader
          agents={agentList}
          connectedPlatforms={[...connectedPlatforms]}
          emailProviderLabel={selectedEmailProviderLabel}
          defaultAgentId={effectiveDefaultAgentId}
          defaultTitle={title}
          defaultContentId={contentId}
          generatedContent={generatedContent ?? []}
        />
      )}

      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Queue</h2>
          <div className="flex flex-wrap gap-2">
            {["all", "draft", "scheduled", "failed", "posted"].map((item) => (
              <ButtonLink
                key={item}
                href={schedulerHref(item)}
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
            actionHref={schedulerHomeHref}
          />
        ) : (
          <div className="space-y-3">
            {postList.map((p) => {
              const agent = p.writing_agents as unknown as { name: string } | null;
              const isEmailCampaign = p.platform === "mailchimp";
              const autoPublishable = isAutoPublishableContent(
                p.platform,
                p.content_type,
              );
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
                          <Badge>
                            {autoPublishable ? "Auto-posting live" : "Connected"}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Disconnected</Badge>
                        )}
                        {!autoPublishable && (
                          <Badge variant="outline">Manual draft</Badge>
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
                      {p.social_account_id && !autoPublishable && (
                        <Badge variant="outline">
                          <AlertCircle className="h-3 w-3" />
                          auto-posting not live
                        </Badge>
                      )}
                    </div>

                    {p.error && (
                      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        {p.error}
                      </div>
                    )}

                    {p.platform === "instagram" && (
                      <form
                        action={updateCommentDmFlowAction}
                        className="space-y-3 rounded-md border p-3 text-sm"
                      >
                        <input type="hidden" name="id" value={p.id} />
                        <label className="flex items-start gap-2 font-medium">
                          <input
                            type="checkbox"
                            name="comment_dm_enabled"
                            defaultChecked={Boolean(p.comment_dm_enabled)}
                            className="mt-0.5 h-4 w-4"
                          />
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-3.5 w-3.5" />
                            Instagram comment to DM flow
                          </span>
                        </label>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1.5">
                            <label
                              htmlFor={`comment_auto_reply_${p.id}`}
                              className="text-xs font-medium text-muted-foreground"
                            >
                              Comment replies
                            </label>
                            <Textarea
                              id={`comment_auto_reply_${p.id}`}
                              name="comment_auto_reply"
                              rows={3}
                              defaultValue={p.comment_auto_reply ?? ""}
                              placeholder={
                                "Reply 1: On your way!\nReply 2: Check your inbox!\nReply 3: Just sent it over."
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label
                              htmlFor={`dm_sequence_${p.id}`}
                              className="text-xs font-medium text-muted-foreground"
                            >
                              DM sequence
                            </label>
                            <Textarea
                              id={`dm_sequence_${p.id}`}
                              name="dm_sequence"
                              rows={3}
                              defaultValue={p.dm_sequence ?? ""}
                              placeholder={
                                "DM 1: Here it is!\nDM 2: *link*\nDM 3 [2 hours later]: What'd you think about it?"
                              }
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Add multiple reply options and DM steps. Timing notes
                          like [2 hours later] are saved with the sequence.
                        </p>
                        <Button variant="outline" size="sm" type="submit">
                          Save Comment-to-DM flow
                        </Button>
                      </form>
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
                            {p.social_account_id && autoPublishable
                              ? "Schedule"
                              : "Save draft time"}
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
