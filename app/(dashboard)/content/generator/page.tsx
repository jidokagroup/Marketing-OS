import {
  ArrowRight,
  CalendarClock,
  Globe2,
  Lightbulb,
  MessageSquareText,
  Radar,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { CONTENT_CHANNEL_OPTIONS } from "@/lib/core-agents";
import { requireUser } from "@/lib/auth";
import {
  asRows,
  isOpsSchemaMissing,
  opsTable,
  titleCase,
} from "@/lib/marketing-os/operations";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateCompetitorIdeasAction } from "./actions";

export const metadata = {
  title: "Market + Competitor Analysis · Jidoka Marketing Team OS",
};
export const maxDuration = 60;

type ClientOption = {
  id: string;
  name: string;
  industry: string | null;
};

type AgentOption = {
  id: string;
  name: string;
  client_id: string | null;
};

type CompetitorAccount = {
  id: string;
  client_id: string | null;
  agent_id: string | null;
  platform: string;
  handle: string;
  profile_url: string | null;
  display_name: string | null;
};

type IntelligenceReport = {
  id: string;
  agent_id: string | null;
  industry: string;
  platforms: string[] | null;
  competitor_accounts: string[] | null;
  trending_topics: unknown;
  hooks: unknown;
  audios: unknown;
  content_opportunities: unknown;
  summary: string | null;
  scanned_at: string;
};

type ReportIdea = {
  title: string;
  description: string;
  channel: string;
  format: string;
  funnel_stage: string;
  generator_prompt: string;
  scheduler_suggestion: string;
};

function jsonArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) =>
        typeof item === "string" ? item : JSON.stringify(item),
      )
    : [];
}

function reportPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      items: jsonArray(value),
      positioning: [],
      competitor_patterns: [],
      content_gaps: [],
      hook_library: [],
      offer_tracker: [],
      comment_themes: [],
      opportunity_signals: [],
      generated_ideas: [],
      scheduler_suggestions: [],
      limitations: [],
    };
  }

  const record = value as Record<string, unknown>;
  return {
    items: jsonArray(record.items),
    positioning: jsonArray(record.positioning),
    competitor_patterns: jsonArray(record.competitor_patterns),
    content_gaps: jsonArray(record.content_gaps),
    hook_library: jsonArray(record.hook_library),
    offer_tracker: jsonArray(record.offer_tracker),
    comment_themes: jsonArray(record.comment_themes),
    opportunity_signals: jsonArray(record.opportunity_signals),
    generated_ideas: Array.isArray(record.generated_ideas)
      ? (record.generated_ideas.filter(
          (item) => item && typeof item === "object",
        ) as ReportIdea[])
      : [],
    scheduler_suggestions: jsonArray(record.scheduler_suggestions),
    limitations: jsonArray(record.limitations),
  };
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "No report yet";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function defaultWatchlist(
  competitors: CompetitorAccount[],
  report: IntelligenceReport | null,
) {
  if (competitors.length) {
    return competitors
      .slice(0, 10)
      .map((account) => {
        const value = account.profile_url ?? account.handle;
        return `${titleCase(account.platform)}: ${value}`;
      })
      .join("\n");
  }
  return (report?.competitor_accounts ?? []).slice(0, 10).join("\n");
}

function agentGenerateHref(agentId: string, idea: ReportIdea, reportId: string) {
  const params = new URLSearchParams({
    tab: "generate",
    title: idea.title,
    topic: idea.generator_prompt || idea.description || idea.title,
    goal: "Turn competitor intelligence into on-brand content",
    platforms: idea.channel,
    notes: `Source report ${reportId}. Scheduler suggestion: ${idea.scheduler_suggestion}`,
  });
  return `/agents/${agentId}?${params.toString()}`;
}

function schedulerHref(
  agentId: string | null | undefined,
  idea: ReportIdea,
  clientId: string,
) {
  const params = new URLSearchParams({
    title: idea.title,
  });
  if (agentId) params.set("agent_id", agentId);
  if (clientId) params.set("client", clientId);
  return `/scheduler?${params.toString()}`;
}

function signalGenerateHref({
  agentId,
  reportId,
  title,
  signal,
  channel,
}: {
  agentId: string | null | undefined;
  reportId: string;
  title: string;
  signal: string;
  channel?: string;
}) {
  if (!agentId) return "/agents";
  const params = new URLSearchParams({
    tab: "generate",
    title: title.slice(0, 90),
    topic: signal,
    goal: "Turn this market signal into an original content package",
    notes: `Source report ${reportId}. Use this as inspiration only; do not copy competitors.`,
  });
  if (channel) params.set("platforms", channel);
  return `/agents/${agentId}?${params.toString()}`;
}

function directionalScore({
  trendCount,
  hookCount,
  gapCount,
  offerCount,
  commentCount,
  opportunityCount,
  watchlistCount,
}: {
  trendCount: number;
  hookCount: number;
  gapCount: number;
  offerCount: number;
  commentCount: number;
  opportunityCount: number;
  watchlistCount: number;
}) {
  const raw =
    34 +
    Math.min(trendCount, 6) * 5 +
    Math.min(hookCount, 8) * 3 +
    Math.min(gapCount, 6) * 4 +
    Math.min(offerCount, 6) * 3 +
    Math.min(commentCount, 6) * 3 +
    Math.min(opportunityCount, 6) * 4 +
    Math.min(watchlistCount, 10) * 2;
  return Math.min(96, raw);
}

function scoreLabel(score: number) {
  if (score >= 82) return "strong";
  if (score >= 68) return "promising";
  if (score >= 50) return "needs more data";
  return "early signal";
}

export default async function ContentGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; client?: string; agent_id?: string }>;
}) {
  const { report: reportId, client: rawClient = "", agent_id: requestedAgentId = "" } =
    await searchParams;
  const { user, supabase } = await requireUser();

  const [{ data: clients }, { data: agents }] = await Promise.all([
    supabase
      .from("marketing_os_clients")
      .select("id, name, industry")
      .eq("owner_id", user.id)
      .order("name"),
    supabase
      .from("marketing_os_writing_agents")
      .select("id, name, client_id")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false }),
  ]);

  const clientList = (clients ?? []) as ClientOption[];
  const allAgentList = (agents ?? []) as AgentOption[];
  const requestedAgent = requestedAgentId
    ? allAgentList.find((agent) => agent.id === requestedAgentId)
    : null;
  const scopedClientId =
    rawClient === "all"
      ? ""
      : rawClient || requestedAgent?.client_id || allAgentList[0]?.client_id || "";
  const agentList = scopedClientId
    ? allAgentList.filter((agent) => agent.client_id === scopedClientId)
    : allAgentList;
  const scopedAgentIds = agentList.map((agent) => agent.id);

  const reportQuery = supabase
    .from("marketing_os_social_intelligence_reports")
    .select(
      "id, agent_id, industry, platforms, competitor_accounts, trending_topics, hooks, audios, content_opportunities, summary, scanned_at",
    )
    .eq("owner_id", user.id);
  const scopedReportQuery =
    scopedClientId && scopedAgentIds.length > 0
      ? reportQuery.in("agent_id", scopedAgentIds)
      : reportQuery;
  let competitorsQuery = opsTable(supabase, "marketing_os_competitor_accounts")
    .select("id, client_id, agent_id, platform, handle, profile_url, display_name")
    .eq("owner_id", user.id)
    .eq("scan_enabled", true)
    .order("updated_at", { ascending: false })
    .limit(10);
  let ideasQuery = opsTable(supabase, "marketing_os_content_ideas")
    .select("id, title, description, platform, format, status, created_at")
    .eq("owner_id", user.id)
    .eq("source", "content_generator_competitor_scan")
    .order("created_at", { ascending: false })
    .limit(6);

  if (scopedClientId) {
    competitorsQuery = competitorsQuery.eq("client_id", scopedClientId);
    ideasQuery = ideasQuery.eq("client_id", scopedClientId);
  }

  const [
    reportResult,
    competitorsResult,
    ideasResult,
  ] = await Promise.all([
    scopedClientId && scopedAgentIds.length === 0
      ? Promise.resolve({ data: null, error: null })
      : reportId
        ? scopedReportQuery.eq("id", reportId).maybeSingle()
        : scopedReportQuery
            .order("scanned_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
    competitorsQuery,
    ideasQuery,
  ]);

  const schemaMissing =
    isOpsSchemaMissing(reportResult.error) ||
    isOpsSchemaMissing(competitorsResult.error) ||
    isOpsSchemaMissing(ideasResult.error);
  const latestReport = (reportResult.data as IntelligenceReport | null) ?? null;
  const payload = reportPayload(latestReport?.content_opportunities);
  const trendItems = jsonArray(latestReport?.trending_topics);
  const hooks = jsonArray(latestReport?.hooks);
  const contentGaps = payload.content_gaps;
  const hookLibrary = payload.hook_library.length ? payload.hook_library : hooks;
  const offerTracker = payload.offer_tracker;
  const commentThemes = payload.comment_themes;
  const opportunitySignals = payload.opportunity_signals.length
    ? payload.opportunity_signals
    : payload.items;
  const ideas = payload.generated_ideas;
  const competitors = schemaMissing
    ? []
    : ((competitorsResult.data ?? []) as CompetitorAccount[]);
  const defaultAgentId =
    (requestedAgent && agentList.some((agent) => agent.id === requestedAgent.id)
      ? requestedAgent.id
      : "") ||
    latestReport?.agent_id ||
    agentList[0]?.id ||
    "";
  const defaultPlatforms =
    latestReport?.platforms?.length ? latestReport.platforms : ["instagram"];
  const watchlistCount =
    competitors.length || latestReport?.competitor_accounts?.length || 0;
  const marketScore = directionalScore({
    trendCount: trendItems.length,
    hookCount: hookLibrary.length,
    gapCount: contentGaps.length,
    offerCount: offerTracker.length,
    commentCount: commentThemes.length,
    opportunityCount: opportunitySignals.length,
    watchlistCount,
  });
  const contentGapScore = Math.min(
    95,
    45 + Math.min(contentGaps.length, 6) * 7 + Math.min(watchlistCount, 10) * 1.5,
  );
  const savedIdeas = isOpsSchemaMissing(ideasResult.error)
    ? []
    : asRows<{
        id: string;
        title: string;
        description: string | null;
        platform: string | null;
        format: string | null;
        status: string;
      }>(ideasResult.data);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Market + Competitor Analysis"
        description="Turn competitor and influencer watchlists into client-agent-ready content ideas, then move the best ones into Smart Scheduler."
      >
        <ButtonLink
          href={scopedClientId ? `/generated?client=${scopedClientId}` : "/generated"}
          variant="outline"
        >
          Generated library
        </ButtonLink>
        <ButtonLink
          href={
            scopedClientId
              ? `/scheduler?client=${scopedClientId}${defaultAgentId ? `&agent_id=${defaultAgentId}` : ""}`
              : "/scheduler"
          }
        >
          Smart Scheduler
          <ArrowRight className="ml-1 h-4 w-4" />
        </ButtonLink>
      </PageHeader>

      {schemaMissing && (
        <Card className="border-amber-300 bg-amber-50/60 text-amber-950">
          <CardHeader>
            <CardTitle>Market + Competitor Analysis needs Marketing OS tables</CardTitle>
            <CardDescription className="text-amber-900/80">
              Apply the Marketing OS Supabase migrations through 0016 so
              competitor accounts, intelligence reports, and content ideas can
              save correctly.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Generate ideas from competitor watchlist</CardTitle>
              <CardDescription>
                Add 5-10 competitor or influencer accounts. The client agent
                uses Brand Brain to turn the scan into original ideas.
              </CardDescription>
            </div>
            <Badge variant="outline">
              Chrome connector: not installed
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form action={generateCompetitorIdeasAction} className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client_id">Client</Label>
                <select
                  id="client_id"
                  name="client_id"
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  defaultValue={scopedClientId}
                >
                  <option value="">General agency content</option>
                  {clientList.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                      {client.industry ? ` · ${client.industry}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent_id">Client agent</Label>
                <select
                  id="agent_id"
                  name="agent_id"
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  defaultValue={defaultAgentId}
                >
                  <option value="">Use latest available agent</option>
                  {agentList.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Channels</Label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {CONTENT_CHANNEL_OPTIONS.map((channel) => (
                  <label
                    key={channel.key}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors has-checked:border-primary has-checked:bg-muted/60"
                  >
                    <input
                      type="checkbox"
                      name="channels"
                      value={channel.key}
                      defaultChecked={defaultPlatforms.includes(channel.key)}
                      className="h-4 w-4"
                    />
                    <span>{channel.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="competitor_accounts">
                Competitors and influencers
              </Label>
              <Textarea
                id="competitor_accounts"
                name="competitor_accounts"
                rows={7}
                placeholder={
                  "Instagram: @competitor\nTikTok: @industrycreator\nhttps://www.linkedin.com/company/example\nhttps://www.youtube.com/@example\nNewsletter: https://example.substack.com\nPodcast: https://open.spotify.com/show/example"
                }
                defaultValue={defaultWatchlist(competitors, latestReport)}
              />
              <p className="text-xs text-muted-foreground">
                Supports websites, Instagram, TikTok, YouTube, X, LinkedIn,
                Facebook, podcasts, and newsletters. Uses public pages and
                connected sources available to the app; logged-in session scans
                need a browser connector.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="goal">Content goal</Label>
                <Input
                  id="goal"
                  name="goal"
                  placeholder="e.g. Build consult demand from high-intent comments"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer">Offer or CTA focus</Label>
                <Input
                  id="offer"
                  name="offer"
                  placeholder="e.g. Audit call, lead magnet, booking link"
                />
              </div>
            </div>

            <PendingSubmitButton
              pendingLabel="Generating ideas..."
              pendingHint="Jidoka is reading available public pages, applying Brand Brain, and saving the report."
            >
              Generate Ideas
            </PendingSubmitButton>
          </form>
        </CardContent>
      </Card>

      {!latestReport ? (
        <EmptyState
          icon={Sparkles}
          title="No generator report yet"
          description="Add competitor or influencer accounts, choose channels, and generate the first trend report."
        />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Weekly Market Intelligence Brief</CardTitle>
                  <CardDescription>
                    {formatDateTime(latestReport.scanned_at)} ·{" "}
                    {latestReport.industry}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(latestReport.platforms ?? []).map((platform) => (
                    <Badge key={platform} variant="secondary">
                      {titleCase(platform)}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {latestReport.summary && (
                <p className="text-sm leading-6 text-muted-foreground">
                  {latestReport.summary}
                </p>
              )}
              {payload.limitations.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                  {payload.limitations[0]}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Opportunity Score
                </CardTitle>
                <CardDescription>
                  Directional score from watchlist depth, topics, hooks, gaps,
                  offers, and comment signals.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-semibold">{marketScore}</span>
                  <Badge variant="secondary">{scoreLabel(marketScore)}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Use this to decide whether the signal is ready to become a
                  content package or needs more source data first.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  Content Gap Score
                </CardTitle>
                <CardDescription>
                  How much white space the scan found for the selected client.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-semibold">
                    {Math.round(contentGapScore)}
                  </span>
                  <Badge variant="secondary">{scoreLabel(contentGapScore)}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Higher means competitors are creating useful context, but the
                  client still has room to own a clearer angle.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-muted-foreground" />
                  Competitor Watchlist
                </CardTitle>
                <CardDescription>
                  Sources currently feeding the market scan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-semibold">{watchlistCount}</div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Websites, social profiles, podcasts, and newsletters can all
                  feed this scan when public or connected data is available.
                </p>
                <ButtonLink href="#competitor_accounts" size="sm" variant="outline" className="mt-4">
                  Update watchlist
                </ButtonLink>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ReportList
              title="Trend signals"
              icon={Radar}
              items={trendItems}
              reportId={latestReport.id}
              agentId={latestReport.agent_id}
              channel={defaultPlatforms[0]}
            />
            <ReportList
              title="Hook Library"
              icon={Sparkles}
              items={hookLibrary}
              reportId={latestReport.id}
              agentId={latestReport.agent_id}
              channel={defaultPlatforms[0]}
            />
            <ReportList
              title="Competitor patterns"
              icon={Globe2}
              items={payload.competitor_patterns}
              reportId={latestReport.id}
              agentId={latestReport.agent_id}
              channel={defaultPlatforms[0]}
            />
            <ReportList
              title="Content Gaps"
              icon={Target}
              items={contentGaps}
              reportId={latestReport.id}
              agentId={latestReport.agent_id}
              channel={defaultPlatforms[0]}
            />
            <ReportList
              title="Offer Tracker"
              icon={Target}
              items={offerTracker}
              reportId={latestReport.id}
              agentId={latestReport.agent_id}
              channel={defaultPlatforms[0]}
            />
            <ReportList
              title="Comment Themes"
              icon={MessageSquareText}
              items={commentThemes}
              reportId={latestReport.id}
              agentId={latestReport.agent_id}
              channel={defaultPlatforms[0]}
            />
            <ReportList
              title="Opportunity Signals"
              icon={TrendingUp}
              items={opportunitySignals}
              reportId={latestReport.id}
              agentId={latestReport.agent_id}
              channel={defaultPlatforms[0]}
            />
            <ReportList
              title="Brand Brain angles"
              icon={Lightbulb}
              items={payload.positioning}
              reportId={latestReport.id}
              agentId={latestReport.agent_id}
              channel={defaultPlatforms[0]}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>On-brand ideas</CardTitle>
              <CardDescription>
                These are saved to Ideas and can be opened in the client agent
                before scheduling.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ideas.length === 0 ? (
                <EmptyState
                  icon={Lightbulb}
                  title="No ideas in this report"
                  description="Run Generate Ideas again with a fuller watchlist or a selected client agent."
                />
              ) : (
                <div className="space-y-3">
                  {ideas.map((idea, index) => (
                    <div key={`${idea.title}-${index}`} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{idea.title}</h3>
                            <Badge variant="secondary">
                              {titleCase(idea.channel)}
                            </Badge>
                            <Badge variant="outline">{idea.format}</Badge>
                          </div>
                          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                            {idea.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {idea.scheduler_suggestion}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {latestReport.agent_id ? (
                            <ButtonLink
                              href={agentGenerateHref(
                                latestReport.agent_id,
                                idea,
                                latestReport.id,
                              )}
                              size="sm"
                            >
                              Open in client agent
                            </ButtonLink>
                          ) : (
                            <ButtonLink href="/agents" size="sm">
                              Choose agent
                            </ButtonLink>
                          )}
                          <ButtonLink
                            href={schedulerHref(
                              latestReport.agent_id,
                              idea,
                              scopedClientId,
                            )}
                            size="sm"
                            variant="outline"
                          >
                            <CalendarClock className="mr-1 h-4 w-4" />
                            Scheduler
                          </ButtonLink>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recently saved from generator</CardTitle>
              <CardDescription>
                Content ideas created by this workflow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {savedIdeas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No saved generator ideas yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {savedIdeas.map((idea) => (
                    <div
                      key={idea.id}
                      className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">{idea.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {[idea.platform, idea.format, titleCase(idea.status)]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <ButtonLink
                        href={
                          scopedClientId
                            ? `/content/ideas?client=${scopedClientId}`
                            : "/content/ideas"
                        }
                        size="sm"
                        variant="outline"
                      >
                        Ideas backlog
                      </ButtonLink>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ReportList({
  title,
  items,
  icon: Icon,
  reportId,
  agentId,
  channel,
}: {
  title: string;
  items: string[];
  icon: React.ComponentType<{ className?: string }>;
  reportId: string;
  agentId: string | null;
  channel?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items yet.</p>
        ) : (
          <ul className="space-y-2 text-sm text-muted-foreground">
            {items.map((item, index) => (
              <li key={`${title}-${index}`} className="rounded-md border p-3">
                <p>{item}</p>
                <ButtonLink
                  href={signalGenerateHref({
                    agentId,
                    reportId,
                    title,
                    signal: item,
                    channel,
                  })}
                  size="xs"
                  variant="outline"
                  className="mt-3"
                >
                  Turn into content package
                </ButtonLink>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
