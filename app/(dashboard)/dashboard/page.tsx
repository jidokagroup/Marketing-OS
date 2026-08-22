import Link from "next/link";
import {
  ArrowRight,
  ListChecks,
  MessageSquare,
  ShieldCheck,
  Target,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import { activeSeat, type SeatContext } from "@/lib/seat";
import { seatScopedHref } from "@/lib/seat-cookie";
import { campaignPipeline, campaignRevenue } from "@/lib/campaign-money";
import { nextBestActions } from "@/lib/next-actions";
import { seatReadiness, readinessSummary } from "@/lib/seat-readiness";
import { postLifecycle } from "@/lib/scheduler-lifecycle";
import { publishReadyPlatforms } from "@/lib/social/publishing-readiness";
import type { ScanReport } from "@/lib/intelligence-scan";
import {
  coreTrainingLabel,
  coreTrainingState,
  type CoreTrainingFields,
} from "@/lib/core-training";
import { countMemoriesByAgent, type CoreMemoryRow } from "@/lib/core-memory";
import { CORE_AGENTS, ORCHESTRATOR_AGENT } from "@/lib/core-agents";
import {
  asRow,
  asRows,
  formatMoney,
  isOpsSchemaMissing,
  opsTable,
  type CampaignRow,
  type DbError,
  type LeadRow,
  type RevenueEventRow,
  type WorkItemRow,
} from "@/lib/marketing-os/operations";
import { cn } from "@/lib/utils";
import { OpsSchemaNotice } from "@/components/ops-schema-notice";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Core Command · Jidoka Marketing Team OS" };

type SeatPostRow = {
  id: string;
  title: string | null;
  platform: string;
  content_type: string;
  status: string;
  caption: string | null;
  media_path: string | null;
  social_account_id: string | null;
  scheduled_time: string | null;
  error: string | null;
};

type SeatPost = {
  id: string;
  title: string | null;
  platform: string;
  lifecycle: ReturnType<typeof postLifecycle>;
};

type TrainingRow = CoreTrainingFields & {
  id: string;
  agent_key: string;
  updated_at: string;
};

async function getCommandData() {
  const { user, supabase } = await requireUser();

  const [
    clients,
    agents,
    content,
    scheduledPosts,
    inboxThreads,
    trainingResult,
    campaignsResult,
    workResult,
    leadsResult,
    revenueResult,
    memoryResult,
    campaignContentResult,
  ] = await Promise.all([
    supabase
      .from("marketing_os_clients")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id),
    supabase
      .from("marketing_os_writing_agents")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id),
    supabase
      .from("marketing_os_generated_content")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id),
    supabase
      .from("marketing_os_scheduled_posts")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id),
    opsTable(supabase, "marketing_os_inbox_threads")
      .select("id")
      .eq("owner_id", user.id)
      .eq("status", "needs_review"),
    opsTable(supabase, "marketing_os_core_agent_training")
      .select(
        "id, agent_key, updated_at, training_data, operating_rules, approval_rules, handoff_rules, data_sources",
      )
      .eq("owner_id", user.id),
    opsTable(supabase, "marketing_os_campaigns")
      .select(
        "id, owner_id, client_id, name, campaign_type, status, stage, health, priority, goal, primary_kpi, target_audience, owner_name, budget, actual_spend, expected_revenue, attributed_revenue, lead_goal, leads_count, start_date, end_date, notes, created_at, updated_at",
      )
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(8),
    opsTable(supabase, "marketing_os_work_items")
      .select("id, campaign_id, client_id, title, description, work_type, status, priority, assignee_name, due_at, estimate_hours, actual_hours, created_at, updated_at")
      .eq("owner_id", user.id)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(12),
    opsTable(supabase, "marketing_os_leads")
      .select("id, campaign_id, client_id, lead_name, email, status, estimated_value, actual_value, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    opsTable(supabase, "marketing_os_revenue_events")
      .select("id, campaign_id, client_id, amount, event_type, occurred_at")
      .eq("owner_id", user.id)
      .order("occurred_at", { ascending: false })
      .limit(50),
    opsTable(supabase, "marketing_os_memory_records")
      .select("record_type, title, memory_owner, affected_business_systems")
      .eq("owner_id", user.id)
      .eq("status", "active")
      .limit(200),
    // Which campaigns actually have content made for them — the difference
    // between a campaign that is progressing and a brief nobody has acted on.
    supabase
      .from("marketing_os_generated_content")
      .select("campaign_id")
      .eq("owner_id", user.id)
      .not("campaign_id", "is", null)
      .limit(1000),
  ]);

  const opsSchemaReady = !isOpsSchemaMissing(campaignsResult.error);
  const coreSchemaReady = !isOpsSchemaMissing(trainingResult.error);
  const campaigns = opsSchemaReady
    ? asRows<CampaignRow>(campaignsResult.data)
    : [];
  const workItems = opsSchemaReady ? asRows<WorkItemRow>(workResult.data) : [];
  const leads = opsSchemaReady ? asRows<LeadRow>(leadsResult.data) : [];
  const revenueEvents = opsSchemaReady
    ? asRows<RevenueEventRow>(revenueResult.data)
    : [];
  const training = coreSchemaReady
    ? asRows<TrainingRow>(trainingResult.data)
    : [];
  const trainingByAgent = new Map(training.map((item) => [item.agent_key, item]));
  // Memory counts towards readiness: an agent with stored knowledge and no
  // rules is in a different state from one with neither.
  const memories = isOpsSchemaMissing(memoryResult.error)
    ? []
    : asRows<CoreMemoryRow>(memoryResult.data);
  const memoryByAgent = countMemoriesByAgent(memories, CORE_AGENTS);
  const contentByCampaign = new Map<string, number>();
  for (const row of campaignContentResult.data ?? []) {
    if (!row.campaign_id) continue;
    contentByCampaign.set(
      row.campaign_id,
      (contentByCampaign.get(row.campaign_id) ?? 0) + 1,
    );
  }

  return {
    opsSchemaReady,
    coreSchemaReady,
    clients: clients.count ?? 0,
    agents: agents.count ?? 0,
    content: content.count ?? 0,
    scheduledPosts: scheduledPosts.count ?? 0,
    inboxNeedsReview: asRows<{ id: string }>(inboxThreads.data).length,
    campaigns,
    workItems,
    leads,
    revenueEvents,
    trainingByAgent,
    memoryByAgent,
    contentByCampaign,
  };
}


function countUntouchedLeads(
  leadsResult: { data: unknown; error: DbError | null },
  attemptsResult: { data: unknown; error: DbError | null },
) {
  if (isOpsSchemaMissing(leadsResult.error) || isOpsSchemaMissing(attemptsResult.error)) {
    return 0;
  }
  const touched = new Set(
    asRows<{ lead_id: string }>(attemptsResult.data).map((row) => row.lead_id),
  );
  return asRows<{ id: string }>(leadsResult.data).filter(
    (lead) => !touched.has(lead.id),
  ).length;
}

/**
 * Everything the readiness panel and the operating brief need, for one seat.
 *
 * Deliberately separate from `getCommandData`, which is workspace-wide: these
 * two answer "what should this client do next", and mixing another client's
 * blocked posts into that would be worse than useless.
 */
async function getSeatBrief(seat: SeatContext) {
  const { user, supabase } = await requireUser();

  const { data: agentRow } = seat.agentId
    ? await supabase
        .from("marketing_os_writing_agents")
        .select("id, name, client_id")
        .eq("id", seat.agentId)
        .maybeSingle()
    : seat.clientId
      ? await supabase
          .from("marketing_os_writing_agents")
          .select("id, name, client_id")
          .eq("client_id", seat.clientId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

  const agentId = agentRow?.id ?? null;
  if (!agentId) {
    return {
      agentId: null,
      agentName: null,
      clientId: seat.clientId,
      hasVoiceDna: false,
      connectedPlatforms: [] as string[],
      analyticsRows: 0,
      contentCount: 0,
      postCount: 0,
      posts: [] as SeatPost[],
      inboxNeedsReview: 0,
      moderatorEnabled: false,
      leadsAwaitingFirstTouch: 0,
      latestScan: null as ScanReport | null,
      billingStatus: null as string | null,
    };
  }

  const [
    voiceResult,
    accountsResult,
    analyticsResult,
    postsResult,
    inboxResult,
    moderatorResult,
    scanResult,
    billingResult,
    leadsResult,
    attemptsResult,
    contentCountResult,
    postCountResult,
  ] = await Promise.all([
    supabase
      .from("marketing_os_voice_profiles")
      .select("agent_id")
      .eq("agent_id", agentId)
      .maybeSingle(),
    supabase
      .from("marketing_os_social_accounts")
      .select("platform, status")
      .eq("agent_id", agentId),
    supabase
      .from("marketing_os_platform_analytics")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId),
    supabase
      .from("marketing_os_scheduled_posts")
      .select(
        "id, title, platform, content_type, status, caption, media_path, social_account_id, scheduled_time, error",
      )
      .eq("agent_id", agentId)
      .neq("status", "posted")
      .order("scheduled_time", { ascending: true, nullsFirst: false })
      .limit(50),
    opsTable(supabase, "marketing_os_inbox_threads")
      .select("id")
      .eq("owner_id", user.id)
      .eq("agent_id", agentId)
      .eq("status", "needs_review"),
    opsTable(supabase, "marketing_os_inbox_moderator_settings")
      .select("enabled")
      .eq("owner_id", user.id)
      .eq("agent_id", agentId)
      .maybeSingle(),
    supabase
      .from("marketing_os_social_intelligence_reports")
      .select("status, requested_at, scanned_at, error_message")
      .eq("owner_id", user.id)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    opsTable(supabase, "marketing_os_billing_subscriptions")
      .select("status")
      .eq("owner_id", user.id)
      .maybeSingle(),
    // Leads for this seat's client, and every attempt recorded against them,
    // so "no first touch drafted" is a fact rather than a guess.
    seat.clientId
      ? opsTable(supabase, "marketing_os_leads")
          .select("id")
          .eq("owner_id", user.id)
          .eq("client_id", seat.clientId)
      : Promise.resolve({ data: null, error: null }),
    opsTable(supabase, "marketing_os_acquisition_attempts")
      .select("lead_id")
      .eq("owner_id", user.id)
      .limit(1000),
    supabase
      .from("marketing_os_generated_content")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId),
    supabase
      .from("marketing_os_scheduled_posts")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId),
  ]);

  const readyPlatforms = publishReadyPlatforms();
  const posts: SeatPost[] = ((postsResult.data ?? []) as SeatPostRow[]).map(
    (row) => ({
      id: row.id,
      title: row.title,
      platform: row.platform,
      lifecycle: postLifecycle(row, readyPlatforms),
    }),
  );

  return {
    agentId,
    agentName: agentRow?.name ?? null,
    clientId: agentRow?.client_id ?? seat.clientId,
    hasVoiceDna: Boolean(voiceResult.data),
    connectedPlatforms: (accountsResult.data ?? [])
      .filter((account) => account.status === "active")
      .map((account) => account.platform),
    analyticsRows: analyticsResult.count ?? 0,
    posts,
    inboxNeedsReview: isOpsSchemaMissing(inboxResult.error)
      ? 0
      : asRows<{ id: string }>(inboxResult.data).length,
    moderatorEnabled: isOpsSchemaMissing(moderatorResult.error)
      ? false
      : Boolean(asRow<{ enabled: boolean }>(moderatorResult.data)?.enabled),
    contentCount: contentCountResult.count ?? 0,
    postCount: postCountResult.count ?? 0,
    leadsAwaitingFirstTouch: countUntouchedLeads(leadsResult, attemptsResult),
    latestScan: (scanResult.data ?? null) as ScanReport | null,
    billingStatus: isOpsSchemaMissing(billingResult.error)
      ? null
      : (asRow<{ status: string }>(billingResult.data)?.status ?? ""),
  };
}

function MetricRow({
  title,
  metrics,
  link,
}: {
  title: string;
  metrics: { label: string; value: string | number; href: string }[];
  link: (href: string) => string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {metrics.map((metric) => (
          <Link
            key={metric.label}
            href={link(metric.href)}
            className={cn(
              "rounded-lg border p-4 transition-colors hover:border-primary/50",
              metric.label === "Needs review" &&
                Number(metric.value) > 0 &&
                "border-destructive/40 bg-destructive/5",
            )}
          >
            <p className="text-xs font-medium text-muted-foreground">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {metric.value}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ agent_id?: string; client?: string }>;
}) {
  const { agent_id: agentParam, client: clientParam } = await searchParams;
  const seat = await activeSeat({ agent_id: agentParam, client: clientParam });
  const [data, brief] = await Promise.all([
    getCommandData(),
    getSeatBrief(seat),
  ]);
  const link = (href: string) =>
    seatScopedHref(href, brief.agentId ?? seat.agentId, brief.clientId);
  const OrchestratorIcon = ORCHESTRATOR_AGENT.icon;
  const activeCampaigns = data.campaigns.filter((item) =>
    ["planning", "active"].includes(item.status),
  );
  const openWork = data.workItems.filter(
    (item) => !["done", "cancelled"].includes(item.status),
  );
  // Same helpers the campaign and Money pages use, so the three agree.
  const revenueTotal = data.campaigns.reduce(
    (sum, campaign) => sum + campaignRevenue(campaign, data.revenueEvents),
    0,
  );
  const pipelineValue = campaignPipeline(data.leads);

  const readiness = seatReadiness({
    agentId: brief.agentId,
    clientId: brief.clientId,
    agentName: brief.agentName,
    hasVoiceDna: brief.hasVoiceDna,
    connectedPlatforms: brief.connectedPlatforms,
    publishReadyPlatforms: publishReadyPlatforms(),
    coreTraining: CORE_AGENTS.map((agent) => ({
      row: data.trainingByAgent.get(agent.key) ?? null,
      memoryCount: data.memoryByAgent.get(agent.key) ?? 0,
    })),
    analyticsRows: brief.analyticsRows,
    publishableposts: brief.posts.filter((post) => post.lifecycle.canAutoPublish)
      .length,
    blockedPosts: brief.posts.filter((post) => !post.lifecycle.canAutoPublish)
      .length,
    moderatorEnabled: brief.moderatorEnabled,
    inboxNeedsReview: brief.inboxNeedsReview,
    billingStatus: brief.billingStatus,
  });
  const readinessCount = readinessSummary(readiness);

  const seatCampaigns = data.campaigns.filter(
    (campaign) => !brief.clientId || campaign.client_id === brief.clientId,
  );
  const actions = nextBestActions({
    posts: brief.posts,
    campaigns: seatCampaigns.map((campaign) => {
      const campaignLeads = data.leads.filter(
        (lead) => lead.campaign_id === campaign.id,
      );
      return {
        id: campaign.id,
        name: campaign.name,
        stage: campaign.stage,
        generatedCount: data.contentByCampaign.get(campaign.id) ?? 0,
        workCount: data.workItems.filter(
          (item) => item.campaign_id === campaign.id,
        ).length,
        leadCount: campaignLeads.length,
        pipelineValue: campaignPipeline(campaignLeads),
        revenue: campaignRevenue(campaign, data.revenueEvents),
      };
    }),
    leadsAwaitingFirstTouch: brief.leadsAwaitingFirstTouch,
    inboxNeedsReview: brief.inboxNeedsReview,
    latestScan: brief.latestScan,
    hasVoiceDna: brief.hasVoiceDna,
    agentId: brief.agentId,
    analyticsRows: brief.analyticsRows,
  });

  // The panels below are this seat's; these counts were the whole workspace's,
  // and nothing said so. A seat with one blocked post sat under "Scheduled 40"
  // and read as healthy. They are two rows now, each saying whose numbers it
  // is showing.
  const seatLeads = data.leads.filter(
    (lead) => !brief.clientId || lead.client_id === brief.clientId,
  );
  const seatMetrics = [
    {
      label: "Paid campaigns",
      value: seatCampaigns.filter((campaign) =>
        ["planning", "active"].includes(campaign.status),
      ).length,
      href: "/campaigns",
    },
    {
      label: "Open work",
      value: openWork.filter((item) =>
        seatCampaigns.some((campaign) => campaign.id === item.campaign_id),
      ).length,
      href: "/work",
    },
    { label: "Content pieces", value: brief.contentCount, href: "/generated" },
    { label: "Scheduled", value: brief.postCount, href: "/calendar" },
    { label: "Needs review", value: brief.inboxNeedsReview, href: "/inbox" },
    // Two numbers, not one with a switching label. Pipeline is what might
    // close; revenue is what has.
    {
      label: "Pipeline",
      value: formatMoney(campaignPipeline(seatLeads)),
      href: "/pipeline",
    },
    {
      label: "Revenue",
      value: formatMoney(
        seatCampaigns.reduce(
          (sum, campaign) => sum + campaignRevenue(campaign, data.revenueEvents),
          0,
        ),
      ),
      href: "/money",
    },
  ];

  const workspaceMetrics = [
    { label: "Clients", value: data.clients, href: "/clients" },
    { label: "Seats", value: data.agents, href: "/agents" },
    { label: "Paid campaigns", value: activeCampaigns.length, href: "/campaigns" },
    { label: "Content pieces", value: data.content, href: "/generated" },
    { label: "Scheduled", value: data.scheduledPosts, href: "/calendar" },
    { label: "Needs review", value: data.inboxNeedsReview, href: "/inbox" },
    { label: "Pipeline", value: formatMoney(pipelineValue), href: "/pipeline" },
    { label: "Revenue", value: formatMoney(revenueTotal), href: "/money" },
  ];
  return (
    <div className="space-y-8">
      <PageHeader
        title="Core Command"
        description="Executive command watches the four Core agents and keeps the agency operating system moving."
      >
        <ButtonLink href={link(ORCHESTRATOR_AGENT.href)} variant="outline">
          <OrchestratorIcon className="mr-1 h-4 w-4" />
          Train orchestrator
        </ButtonLink>
        <ButtonLink href={link("/inbox")} variant="outline">
          <MessageSquare className="mr-1 h-4 w-4" />
          Review inbox
        </ButtonLink>
        <ButtonLink href={link("/campaigns")}>
          <Target className="mr-1 h-4 w-4" />
          Paid campaigns
        </ButtonLink>
      </PageHeader>

      {!data.opsSchemaReady && <OpsSchemaNotice />}
      {!data.coreSchemaReady && (
        <OpsSchemaNotice feature="Core agent training" />
      )}

      {/* What to do next, before what there is. A count is not an
          instruction: "3 scheduled posts" does not say that one of them
          cannot publish. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            Operating brief
            {brief.agentName && (
              <Badge variant="secondary">{brief.agentName}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {actions.length === 0
              ? "Nothing is blocked and nothing is waiting on you for this seat."
              : `${actions.length} thing${actions.length === 1 ? "" : "s"} to deal with, most costly first.`}
          </CardDescription>
        </CardHeader>
        {actions.length > 0 && (
          <CardContent className="space-y-2">
            {actions.map((action) => (
              <div
                key={action.key}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between",
                  action.urgency === "critical" &&
                    "border-destructive/40 bg-destructive/5",
                  action.urgency === "high" && "border-amber-300 bg-amber-50/60",
                )}
              >
                <p className="min-w-0">{action.headline}</p>
                <ButtonLink
                  href={link(action.href)}
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                >
                  {action.actionLabel}
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </ButtonLink>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* What is set up, from stored data rather than a hardcoded checklist,
          so "ready" means the thing actually works today. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Seat readiness
          </CardTitle>
          <CardDescription>
            {readinessCount.ready} of {readinessCount.total} ready
            {readinessCount.blocked > 0
              ? ` · ${readinessCount.blocked} blocked`
              : ""}
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {readiness.map((item) => (
              <div key={item.key} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{item.label}</p>
                  <Badge
                    variant={
                      item.state === "ready"
                        ? "default"
                        : item.state === "blocked"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {item.state === "ready"
                      ? "Ready"
                      : item.state === "blocked"
                        ? "Blocked"
                        : "Partial"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.detail}
                </p>
                <Link
                  href={link(item.href)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {item.actionLabel}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-4">
        {CORE_AGENTS.map((agent) => {
          const Icon = agent.icon;
          const training = data.trainingByAgent.get(agent.key);
          const memoryCount = data.memoryByAgent.get(agent.key) ?? 0;
          return (
            <Link key={agent.key} href={agent.href} className="group">
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-destructive">
                      {agent.segment}
                    </p>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle>{agent.label}</CardTitle>
                    <CardDescription className="mt-3 text-sm leading-6">
                      {agent.summary}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {agent.systems.map((system) => (
                      <div
                        key={system}
                        className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
                      >
                        {system}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t pt-4 text-sm">
                    {/* A saved-but-empty row is not a trained agent. */}
                    <Badge
                      variant={
                        coreTrainingState(training, memoryCount) === "trained"
                          ? "default"
                          : "outline"
                      }
                    >
                      {coreTrainingLabel(training, memoryCount)}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-muted-foreground group-hover:text-foreground">
                      Open
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Operating Snapshot</CardTitle>
          <CardDescription>
            This seat first, then the workspace it sits in — the same numbers
            mean different things at each scale.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <MetricRow
            title={
              brief.agentName
                ? `${brief.agentName}'s seat`
                : "The current seat"
            }
            metrics={seatMetrics}
            link={link}
          />
          <MetricRow
            title="Across every client"
            metrics={workspaceMetrics}
            link={link}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Paid Campaigns</CardTitle>
            <CardDescription>
              Campaigns remain the execution center for client marketing work.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.campaigns.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No paid campaigns yet. Create one when you are ready to plan
                budget, channels, leads, and revenue attribution.
              </div>
            ) : (
              data.campaigns.slice(0, 5).map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  className="block rounded-lg border p-4 transition-colors hover:border-primary/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{campaign.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {campaign.goal ?? "No goal entered yet"}
                      </p>
                    </div>
                    <Badge variant="outline">{campaign.status}</Badge>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next Work</CardTitle>
            <CardDescription>
              Open tasks across strategy, content, publishing, analytics, and
              client communication.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {openWork.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No open work is due. Intelligence, campaigns, or client notes
                can create the next task.
              </div>
            ) : (
              openWork.slice(0, 6).map((item) => (
                <Link
                  key={item.id}
                  href="/work"
                  className="block rounded-lg border p-4 transition-colors hover:border-primary/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.assignee_name ?? "Unassigned"}
                      </p>
                    </div>
                    <Badge variant="outline">{item.status}</Badge>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
