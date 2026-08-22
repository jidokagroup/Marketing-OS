import Link from "next/link";
import { BarChart3, CheckCircle2, DollarSign, Eye, Heart, Sparkles, TrendingUp } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { activeSeat } from "@/lib/seat";
import { PLATFORM_LABELS } from "@/lib/social/platforms";
import {
  getEmailProviderDefinition,
  normalizeEmailProvider,
} from "@/lib/email-providers";
import {
  asRow,
  asRows,
  formatMoney,
  isOpsSchemaMissing,
  opsTable,
  type CampaignRow,
  type LeadRow,
  type RevenueEventRow,
} from "@/lib/marketing-os/operations";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { OpsSchemaNotice } from "@/components/ops-schema-notice";
import {
  AnalyticsCharts,
  type TimePoint,
  type EngagementSlice,
  type HourPoint,
} from "@/components/analytics-charts";
import {
  AnalyticsExtendedSections,
  type XAnalyticsTotals,
} from "@/components/analytics-extended-sections";
import { AnalyticsPlatformFilter } from "@/components/analytics-platform-filter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { PLATFORM_DEFINITIONS, getPlatformDefinition } from "@/lib/social/platforms";
import { backfillAnalyticsAction } from "./actions";

export const metadata = { title: "Analytics · Jidoka Marketing Team OS" };

const BACKFILL_SUPPORTED_PLATFORMS = new Set(["instagram", "facebook", "youtube", "x"]);

type PlatformOption = { key: string; label: string };
type BackfillPlatformOption = PlatformOption & {
  disabled?: boolean;
  reason?: string;
};
type AnalyticsPlatformStatus = {
  key: string;
  label: string;
  icon: (typeof PLATFORM_DEFINITIONS)[number]["icon"];
  connected: boolean;
  hasData: boolean;
  disabled: boolean;
  note: string;
};
type AttributionData = {
  schemaReady: boolean;
  campaigns: CampaignRow[];
  leads: LeadRow[];
  revenue: RevenueEventRow[];
};

function platformLabel(platform: string) {
  return getPlatformDefinition(platform)?.label ?? platform;
}

function LinkChecklistItem({
  item,
}: {
  item: { label: string; done: boolean; href: string };
}) {
  const className = "flex min-w-0 gap-2 hover:text-foreground";
  const content = (
    <>
      <CheckCircle2
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          item.done ? "text-emerald-500" : "text-muted-foreground"
        }`}
      />
      <span>{item.label}</span>
    </>
  );

  if (item.href.startsWith("/api/")) {
    return (
      <a href={item.href} className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link href={item.href} className={className}>
      {content}
    </Link>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    platform?: string;
    backfill?: string;
    agent_id?: string;
    client?: string;
  }>;
}) {
  const { user, supabase } = await requireUser();
  const {
    platform = "all",
    backfill,
    agent_id: agentParam,
    client: clientParam,
  } = await searchParams;
  // The Analytics import redirects back here, so the seat has to be carried
  // in and out or the header lands on a different client.
  const seat = await activeSeat({ agent_id: agentParam, client: clientParam });
  const attribution = await getAttributionData(supabase, user.id);

  const [
    { data: rows },
    { data: latestAgent },
    { data: accounts },
    { count: scheduledCount },
    emailProviderResult,
    backfillRunResult,
  ] =
    await Promise.all([
      supabase
        .from("marketing_os_platform_analytics")
        .select(
          "date, hour, platform, title, views, reach, likes, comments, shares, saves, engagement_score, performance_score",
        )
        .order("date", { ascending: true })
        .limit(2000),
      supabase
        .from("marketing_os_writing_agents")
        .select("id")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("marketing_os_social_accounts").select("platform, status"),
      supabase.from("marketing_os_scheduled_posts").select("id", { count: "exact", head: true }),
      opsTable(supabase, "marketing_os_email_provider_settings")
        .select("provider, provider_label, status")
        .eq("owner_id", user.id)
        .maybeSingle(),
      opsTable(supabase, "marketing_os_analytics_backfill_runs")
        .select(
          "platform, lookback_days, status, accounts_processed, rows_stored, errors, detail, error_message, finished_at",
        )
        .eq("owner_id", user.id)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const allData = rows ?? [];
  const emailProviderSettings = isOpsSchemaMissing(emailProviderResult.error)
    ? null
    : asRow<{ provider: string; provider_label: string | null; status: string }>(
        emailProviderResult.data,
      );
  const selectedEmailProvider = normalizeEmailProvider(
    emailProviderSettings?.provider,
  );
  const selectedEmailProviderLabel =
    emailProviderSettings?.provider_label ??
    getEmailProviderDefinition(selectedEmailProvider).label;
  const connectedPlatforms = new Set<string>(
    (accounts ?? [])
      .filter((account) => account.status === "active")
      .map((account) => account.platform),
  );
  if (
    selectedEmailProvider !== "mailchimp" &&
    emailProviderSettings?.status === "connected"
  ) {
    connectedPlatforms.add("mailchimp");
  }
  const analyticsPlatforms = new Set<string>(
    allData.map((row) => row.platform).filter(Boolean),
  );
  const definedPlatformKeys = new Set<string>(
    PLATFORM_DEFINITIONS.map((item) => item.key),
  );
  const extraPlatformOptions = Array.from(analyticsPlatforms)
    .filter((item) => !definedPlatformKeys.has(item))
    .sort()
    .map((item) => ({ key: item, label: platformLabel(item) }));
  const platformOptions: PlatformOption[] = [
    { key: "all", label: "All platforms" },
    ...PLATFORM_DEFINITIONS.map((item) => ({ key: item.key, label: item.label })),
    ...extraPlatformOptions,
  ];
  const selectedPlatform = platformOptions.some((item) => item.key === platform)
    ? platform
    : "all";
  const data =
    selectedPlatform === "all"
      ? allData
      : allData.filter((row) => row.platform === selectedPlatform);
  const connectedCount = (accounts ?? []).filter(
    (account) => account.status === "active",
  ).length;
  const backfillSupportedConnectedCount = PLATFORM_DEFINITIONS.filter(
    (item) => BACKFILL_SUPPORTED_PLATFORMS.has(item.key) && connectedPlatforms.has(item.key),
  ).length;
  const backfillPlatformOptions: BackfillPlatformOption[] = [
    { key: "all", label: "All supported connected platforms" },
    ...PLATFORM_DEFINITIONS.map((item) => {
      const supportsBackfill = BACKFILL_SUPPORTED_PLATFORMS.has(item.key);
      const connected = connectedPlatforms.has(item.key);
      return {
        key: item.key,
        label: item.label,
        disabled: item.disabled || !supportsBackfill || !connected,
        reason: item.disabled
          ? "API setup paused"
          : !supportsBackfill
            ? "backfill not live yet"
            : !connected
              ? "connect first"
              : undefined,
      };
    }),
  ];
  const platformStatuses: AnalyticsPlatformStatus[] = PLATFORM_DEFINITIONS.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
    connected: connectedPlatforms.has(item.key),
    hasData: analyticsPlatforms.has(item.key),
    disabled: Boolean(item.disabled),
    note: item.note,
  }));
  const connectHref = latestAgent?.id
    ? `/api/social/connect?agent_id=${latestAgent.id}&platform=instagram`
    : "/agents";
  const xRows = allData.filter((row) => row.platform === "x");
  const xTotals: XAnalyticsTotals | null = xRows.length
    ? xRows.reduce(
        (totals, row) => ({
          impressions: totals.impressions + (row.views ?? 0),
          likes: totals.likes + (row.likes ?? 0),
          replies: totals.replies + (row.comments ?? 0),
          reposts: totals.reposts + (row.shares ?? 0),
        }),
        { impressions: 0, likes: 0, replies: 0, reposts: 0 },
      )
    : null;
  const emailPlatform = (accounts ?? []).some(
    (account) => account.platform === "mailchimp" && account.status === "active",
  )
    ? selectedEmailProviderLabel
    : selectedEmailProvider !== "mailchimp" && emailProviderSettings?.status === "connected"
      ? selectedEmailProviderLabel
    : null;
  // The recorded run outlives the redirect, so the result is still there after
  // a refresh — and it carries a per-account outcome, which is the part that
  // says why an account that looks connected imported nothing.
  const lastBackfill = isOpsSchemaMissing(backfillRunResult.error)
    ? null
    : asRow<BackfillRunRow>(backfillRunResult.data);
  const backfillNotice = lastBackfill
    ? { run: lastBackfill, justRan: backfill === "success" || backfill === "error" }
    : null;

  if (data.length === 0) {
    const checklist = [
      {
        label: "Connect at least one account",
        done: connectedCount > 0,
        href: connectHref,
      },
      {
        label: "Schedule or publish content",
        done: (scheduledCount ?? 0) > 0,
        href: "/scheduler",
      },
      {
        label: "Let metrics import after posts are live",
        done: false,
        href: "/analytics",
      },
      {
        label: "Use best times in Scheduler and Market Intelligence",
        done: false,
        href: "/intelligence",
      },
    ];
    return (
      <div className="space-y-6">
        <PageHeader
          title="Analytics"
          description="Reach, engagement, and best posting times across your connected platforms."
        />
        {backfillNotice && <BackfillNotice {...backfillNotice} />}
        <EmptyState
          icon={BarChart3}
          title="No analytics yet"
          description="Analytics starts after an account is connected and content has been published. The setup checklist below shows what is missing."
          actionLabel="Connect an account"
          actionHref={connectHref}
        />
        <AnalyticsBackfillPanel
          platform={selectedPlatform}
          platforms={backfillPlatformOptions}
          disabled={backfillSupportedConnectedCount === 0}
          seat={seat}
        />
        <PlatformOverview platforms={platformStatuses} />
        <AnalyticsPlatformFilter platform={selectedPlatform} options={platformOptions} />
        <CampaignAttributionPanel attribution={attribution} />
        <Card>
          <CardHeader>
            <CardTitle>Analytics setup checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-3">
                  <LinkChecklistItem item={item} />
                  <Badge variant={item.done ? "default" : "outline"}>
                    {item.done ? "Done" : "Next"}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <AnalyticsExtendedSections xTotals={xTotals} emailPlatform={emailPlatform} />
      </div>
    );
  }

  // Aggregate.
  let reach = 0,
    views = 0,
    likes = 0,
    comments = 0,
    shares = 0,
    saves = 0,
    perfSum = 0;
  const dateMap = new Map<string, { reach: number; engagement: number }>();
  const hourAgg = new Map<number, { sum: number; n: number }>();

  for (const r of data) {
    reach += r.reach ?? 0;
    views += r.views ?? 0;
    likes += r.likes ?? 0;
    comments += r.comments ?? 0;
    shares += r.shares ?? 0;
    saves += r.saves ?? 0;
    perfSum += r.performance_score ?? 0;

    const eng = (r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0) + (r.saves ?? 0);
    if (r.date) {
      const cur = dateMap.get(r.date) ?? { reach: 0, engagement: 0 };
      cur.reach += r.reach ?? 0;
      cur.engagement += eng;
      dateMap.set(r.date, cur);
    }
    if (r.hour != null) {
      const h = hourAgg.get(r.hour) ?? { sum: 0, n: 0 };
      h.sum += r.engagement_score ?? eng;
      h.n += 1;
      hourAgg.set(r.hour, h);
    }
  }

  const overTime: TimePoint[] = [...dateMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({
      date: date.slice(5),
      reach: v.reach,
      engagement: v.engagement,
    }));

  const engagement: EngagementSlice[] = [
    { name: "Likes", value: likes },
    { name: "Comments", value: comments },
    { name: "Shares", value: shares },
    { name: "Saves", value: saves },
  ];

  const byHour: HourPoint[] = [...hourAgg.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, v]) => ({
      hour: `${hour}:00`,
      engagement: Math.round(v.sum / v.n),
    }));
  const bestHour = byHour
    .slice()
    .sort((a, b) => b.engagement - a.engagement)[0];
  const titleAgg = new Map<string, number>();
  for (const row of data) {
    const key = row.title || "Untitled post";
    titleAgg.set(key, (titleAgg.get(key) ?? 0) + (row.engagement_score ?? 0));
  }
  const topContent = [...titleAgg.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const totalEngagement = likes + comments + shares + saves;
  const stats = [
    { label: "Total reach", value: reach.toLocaleString(), icon: TrendingUp },
    { label: "Total views", value: views.toLocaleString(), icon: Eye },
    { label: "Engagement", value: totalEngagement.toLocaleString(), icon: Heart },
    {
      label: "Avg performance",
      value: Math.round(perfSum / data.length).toString(),
      icon: Sparkles,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="Reach, engagement, and best posting times across your connected platforms."
      >
        <ButtonLink href="/scheduler" variant="outline">
          Use timing in Scheduler
        </ButtonLink>
        <ButtonLink href="/intelligence" variant="outline">
          Open Market Intelligence
        </ButtonLink>
      </PageHeader>

      {backfillNotice && <BackfillNotice {...backfillNotice} />}

      <AnalyticsBackfillPanel
        platform={selectedPlatform}
        platforms={backfillPlatformOptions}
        disabled={backfillSupportedConnectedCount === 0}
        seat={seat}
      />

      <PlatformOverview platforms={platformStatuses} />

      <AnalyticsPlatformFilter platform={selectedPlatform} options={platformOptions} />

      <CampaignAttributionPanel attribution={attribution} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">{s.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Best posting time</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold">{bestHour?.hour ?? "Not enough data"}</p>
            <p className="text-sm text-muted-foreground">
              Based on the highest average engagement score in connected analytics.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topContent.map(([title, score]) => (
                <div key={title} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{title}</span>
                  <Badge variant="secondary">{Math.round(score)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <AnalyticsCharts overTime={overTime} engagement={engagement} byHour={byHour} />

      <AnalyticsExtendedSections xTotals={xTotals} emailPlatform={emailPlatform} />
    </div>
  );
}

async function getAttributionData(
  supabase: unknown,
  ownerId: string,
): Promise<AttributionData> {
  const [campaignsResult, leadsResult, revenueResult] = await Promise.all([
    opsTable(supabase, "marketing_os_campaigns")
      .select(
        "id, owner_id, client_id, name, campaign_type, status, stage, health, priority, goal, primary_kpi, target_audience, owner_name, budget, actual_spend, expected_revenue, attributed_revenue, lead_goal, leads_count, start_date, end_date, notes, created_at, updated_at",
      )
      .eq("owner_id", ownerId)
      .order("attributed_revenue", { ascending: false }),
    opsTable(supabase, "marketing_os_leads")
      .select("id, campaign_id, client_id, lead_name, email, status, estimated_value, actual_value, created_at")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false }),
    opsTable(supabase, "marketing_os_revenue_events")
      .select("id, campaign_id, client_id, amount, event_type, occurred_at")
      .eq("owner_id", ownerId)
      .order("occurred_at", { ascending: false }),
  ]);

  const schemaReady = !isOpsSchemaMissing(campaignsResult.error);
  return {
    schemaReady,
    campaigns: schemaReady ? asRows<CampaignRow>(campaignsResult.data) : [],
    leads: schemaReady ? asRows<LeadRow>(leadsResult.data) : [],
    revenue: schemaReady ? asRows<RevenueEventRow>(revenueResult.data) : [],
  };
}

function CampaignAttributionPanel({
  attribution,
}: {
  attribution: AttributionData;
}) {
  if (!attribution.schemaReady) {
    return <OpsSchemaNotice title="Campaign attribution needs migration 0016" />;
  }

  const manualRevenue = attribution.revenue.reduce(
    (sum, item) => sum + Number(item.amount ?? 0),
    0,
  );
  const campaignRevenue = attribution.campaigns.reduce(
    (sum, item) => sum + Number(item.attributed_revenue ?? 0),
    0,
  );
  const pipeline = attribution.leads.reduce(
    (sum, item) => sum + Number(item.actual_value || item.estimated_value || 0),
    0,
  );
  const topCampaigns = attribution.campaigns
    .slice()
    .sort(
      (a, b) =>
        Number(b.attributed_revenue ?? 0) - Number(a.attributed_revenue ?? 0),
    )
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Revenue attribution
        </CardTitle>
        <CardDescription>
          Leads and revenue roll up by campaign so performance decisions can
          move back into strategy and playbooks.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <MiniMetric label="Leads" value={attribution.leads.length.toString()} />
          <MiniMetric
            label="Pipeline"
            value={formatMoney(pipeline)}
          />
          <MiniMetric
            label="Revenue"
            value={formatMoney(campaignRevenue + manualRevenue)}
          />
        </div>
        <div className="space-y-2">
          {topCampaigns.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Create campaigns and log leads or revenue to see attribution.
            </p>
          ) : (
            topCampaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition-colors hover:border-primary/50"
              >
                <span className="min-w-0 truncate font-medium">
                  {campaign.name}
                </span>
                <Badge variant="secondary">
                  {formatMoney(campaign.attributed_revenue)}
                </Badge>
              </Link>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

type BackfillRunRow = {
  platform: string;
  lookback_days: number;
  status: string;
  accounts_processed: number;
  rows_stored: number;
  errors: number;
  detail: BackfillAccountDetail[] | null;
  error_message: string | null;
  finished_at: string | null;
};

type BackfillAccountDetail = {
  platform: string;
  username: string | null;
  rows: number;
  status: string;
  error?: string;
};

const BACKFILL_ACCOUNT_LABEL: Record<string, string> = {
  imported: "imported",
  no_data: "nothing new in this window",
  no_token: "token unreadable",
  failed: "failed",
};

function BackfillNotice({
  run,
  justRan,
}: {
  run: BackfillRunRow;
  justRan: boolean;
}) {
  const failed = run.status === "failed" || run.errors > 0;
  const detail = Array.isArray(run.detail) ? run.detail : [];

  return (
    <div
      className={
        failed
          ? "rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          : "rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
      }
    >
      <p className="font-medium">
        {justRan ? "Analytics backfill finished" : "Last analytics backfill"}
        {run.finished_at ? "" : " — still running"}
      </p>
      <p className="mt-1">
        Pulled the past {run.lookback_days} days across{" "}
        {run.accounts_processed.toLocaleString()} connected account
        {run.accounts_processed === 1 ? "" : "s"} and stored{" "}
        {run.rows_stored.toLocaleString()} row
        {run.rows_stored === 1 ? "" : "s"}.
      </p>
      {run.error_message && <p className="mt-1">{run.error_message}</p>}

      {/* Per account, because "0 rows overall" is the least useful thing this
          could tell someone with four platforms connected. */}
      {detail.length > 0 && (
        <ul className="mt-3 space-y-1">
          {detail.map((item, index) => (
            <li key={index}>
              <span className="font-medium">
                {PLATFORM_LABELS[item.platform as keyof typeof PLATFORM_LABELS] ??
                  item.platform}
                {item.username ? ` (${item.username})` : ""}
              </span>
              {": "}
              {item.status === "imported"
                ? `${item.rows.toLocaleString()} row${item.rows === 1 ? "" : "s"} imported`
                : (BACKFILL_ACCOUNT_LABEL[item.status] ?? item.status)}
              {item.error ? ` — ${item.error}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AnalyticsBackfillPanel({
  platform,
  platforms,
  disabled,
  seat,
}: {
  platform: string;
  platforms: BackfillPlatformOption[];
  disabled: boolean;
  seat: { agentId: string | null; clientId: string | null };
}) {
  const defaultPlatform = platforms.some((item) => item.key === platform && !item.disabled)
    ? platform
    : "all";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backfill past analytics</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={backfillAnalyticsAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          {/* Carried for the redirect only. The import stays owner-wide,
              because this page shows every seat's analytics and scoping the
              import but not the page would quietly disagree with itself. */}
          {seat.agentId && (
            <input type="hidden" name="return_agent_id" value={seat.agentId} />
          )}
          {seat.clientId && (
            <input type="hidden" name="return_client" value={seat.clientId} />
          )}
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Lookback window</span>
            <select
              name="days"
              defaultValue="90"
              className="flex h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="30">Past 30 days</option>
              <option value="90">Past 90 days</option>
              <option value="180">Past 180 days</option>
              <option value="365">Past year</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Platform</span>
            <select
              name="platform"
              defaultValue={defaultPlatform}
              className="flex h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {platforms.map((item) => (
                <option key={item.key} value={item.key} disabled={item.disabled}>
                  {item.label}
                  {item.reason ? ` - ${item.reason}` : ""}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={disabled}>
            Pull past data
          </Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Backfill imports historical posts from connected Instagram, Facebook,
          YouTube, and X accounts. Email provider and TikTok analytics are
          listed here, but historical imports for those platforms are not live yet.
        </p>
      </CardContent>
    </Card>
  );
}

function PlatformOverview({ platforms }: { platforms: AnalyticsPlatformStatus[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Platforms</CardTitle>
        <CardDescription>
          Every platform Jidoka Marketing Team OS tracks or prepares for analytics.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {platforms.map((platform) => {
            const Icon = platform.icon;
            const status = platform.disabled
              ? "Paused"
              : platform.connected && platform.hasData
                ? "Connected + data"
                : platform.connected
                  ? "Connected"
                  : "Not connected";
            const dotClass = platform.disabled
              ? "bg-muted-foreground"
              : platform.connected
                ? "bg-emerald-500"
                : "bg-red-500";

            return (
              <div key={platform.key} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-medium">{platform.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {platform.disabled
                          ? "API setup paused"
                          : platform.hasData
                            ? "Analytics imported"
                            : "Awaiting analytics"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                    {status}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
