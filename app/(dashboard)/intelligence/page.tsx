import {
  ArrowRight,
  ExternalLink,
  Globe2,
  Radar,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import {
  scanState,
  type ScanState,
} from "@/lib/intelligence-scan";
import { formatInstant, workspaceTimeZone } from "@/lib/timezone";
import {
  asRows,
  isOpsSchemaMissing,
  opsTable,
} from "@/lib/marketing-os/operations";
import { PLATFORM_DEFINITIONS } from "@/lib/social/platforms";
import { PageHeader } from "@/components/page-header";
import { OpsSchemaNotice } from "@/components/ops-schema-notice";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { ScanStatusBanner } from "./ScanStatusBanner";
import type { ScanStage, ScanStatus } from "@/lib/intelligence/stages";
import { InsightMoreActions } from "./InsightMoreActions";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addInsightToBriefAction,
  assignInsightToTeamAction,
  createCampaignFromInsightAction,
  createContentIdeaFromInsightAction,
  createTaskFromInsightAction,
  dismissInsightAction,
  saveCompetitorsAction,
  saveInsightForLaterAction,
} from "./actions";

export const metadata = { title: "Market Intelligence · Jidoka Marketing Team OS" };
// The save action runs a live competitor scan (site fetch + Claude call).
export const maxDuration = 60;

type InsightCampaign = {
  id: string;
  name: string;
  client_id: string | null;
};

const BASELINE_TOPICS = [
  "Problem-aware education posts",
  "Customer objection breakdowns",
  "Founder or practitioner point-of-view clips",
  "Before-and-after process stories",
  "Offer education with clear proof points",
];

const BASELINE_HOOKS = [
  "Most brands explain this backwards.",
  "If your audience keeps asking this, make it a post.",
  "Here is the part competitors skip.",
  "Three signs your customer is ready for the next step.",
];

const BASELINE_TRENDS = [
  "Short teaching clips with one visual framework",
  "Carousel myth breakdowns",
  "Comment keyword to DM lead magnets",
  "Expert POV responses to trending industry claims",
];

const BASELINE_RECOMMENDED_POSTS = [
  "Carousel: 5 signs your audience is ready for the offer",
  "Reel: The one question customers ask before they buy",
  "Caption: Why the common advice is incomplete",
  "Lead magnet post: Comment GUIDE for the next-step checklist",
];

const BASELINE_COMPETITOR_WINS = [
  "Add competitor websites and save to see how they actually execute — format mix, editing style, voiceover vs. music, trending audio.",
];

const BASELINE_POSITIONING = [
  "Own the specific problem competitors mention but rarely explain step by step.",
  "Translate expert work into plain English while competitors stay generic.",
  "Lead with real POV content where competitors rely on stock-style posts.",
  "Use education-first proof to build trust where competitors overpromise.",
];

const BASELINE_CONTENT_GAPS = [
  "Competitors explain the problem, but not the practical decision framework buyers can use next.",
  "Competitors mention outcomes, but rarely show the process, tradeoffs, or proof behind them.",
  "The client should answer buying objections earlier with education-first content.",
  "There is room for simpler next-step content that turns attention into a qualified conversation.",
];

const BASELINE_HOOK_LIBRARY = [
  "Reel: Most people are solving the visible problem, not the real one.",
  "Carousel: Save this before you choose your next step.",
  "YouTube: The mistake that makes this problem more expensive than it needs to be.",
  "Email: If this keeps coming up, it is probably not a people problem.",
  "Blog: A practical guide to deciding what to fix first.",
];

const BASELINE_OFFER_TRACKER = [
  "Diagnostic or assessment that clarifies whether the buyer has the problem.",
  "Comment keyword resource connected to a DM sequence.",
  "Audit call framed around one specific pain point.",
  "Checklist or framework that helps the buyer choose the next step.",
];

const BASELINE_COMMENT_THEMES = [
  "How do I know if this applies to me?",
  "What should I fix first?",
  "How long does this take?",
  "What does this cost?",
  "Can you send me the resource?",
];

const BASELINE_OPPORTUNITY_SIGNALS = [
  "High relevance, medium saturation: turn the main objection into a weekly series.",
  "High save/share potential: package the decision framework as a carousel or lead magnet.",
  "Medium velocity: start with short video, then expand into email and blog.",
  "High conversion intent: pair comment keywords with a DM sequence and booking CTA.",
];

type ScanRecommendation = { focus: string; move: string; why: string };

const BASELINE_RECOMMENDATIONS: ScanRecommendation[] = [
  {
    focus: "Content gaps",
    move: "Brief the team to close the clearest gap competitors leave open first.",
    why: "Content gaps are the fastest way to stand out before adding anything new.",
  },
  {
    focus: "Offer tracker",
    move: "Check the current offer against what competitors are actively promoting.",
    why: "An offer that already matches demand converts faster than a new one.",
  },
  {
    focus: "Comment themes",
    move: "Turn the most common objection into next week's education topic.",
    why: "Objections repeated in comments are proof of what the audience needs answered.",
  },
];

function readRecommendations(value: unknown): ScanRecommendation[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object",
    )
    .map((item) => ({
      focus: String(item.focus ?? "").trim(),
      move: String(item.move ?? "").trim(),
      why: String(item.why ?? "").trim(),
    }))
    .filter((item) => item.focus && item.move && item.why);
}

type Insight = { insight: string; source_url: string | null };

/**
 * Read one insight list.
 *
 * Scans now store `{ insight, source_url }` so each item links back to the
 * competitor page it came from. Older rows stored plain strings, which still
 * render — just without a source link.
 */
function jsonArray(value: unknown): Insight[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): Insight => {
      if (typeof item === "string") return { insight: item, source_url: null };
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const text = typeof record.insight === "string" ? record.insight : "";
        const url = typeof record.source_url === "string" ? record.source_url : null;
        return { insight: text || JSON.stringify(item), source_url: url };
      }
      return { insight: String(item), source_url: null };
    })
    .filter((item) => item.insight.trim().length > 0);
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// content_opportunities is either a legacy plain array or, for newer scans,
// an object carrying every category plus the scan's own scores.
function readOpportunities(value: unknown) {
  const empty = {
    items: [] as Insight[],
    positioning: [] as Insight[],
    content_gaps: [] as Insight[],
    hook_library: [] as Insight[],
    offer_tracker: [] as Insight[],
    comment_themes: [] as Insight[],
    opportunity_signals: [] as Insight[],
    competitor_wins: [] as Insight[],
    recommended_posts: [] as Insight[],
    opportunity_score: null as number | null,
    content_gap_score: null as number | null,
  };

  if (Array.isArray(value)) return { ...empty, items: jsonArray(value) };
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return {
      items: jsonArray(record.items),
      positioning: jsonArray(record.positioning),
      content_gaps: jsonArray(record.content_gaps),
      hook_library: jsonArray(record.hook_library),
      offer_tracker: jsonArray(record.offer_tracker),
      comment_themes: jsonArray(record.comment_themes),
      opportunity_signals: jsonArray(record.opportunity_signals),
      competitor_wins: jsonArray(record.competitor_wins),
      recommended_posts: jsonArray(record.recommended_posts),
      opportunity_score: readNumber(record.opportunity_score),
      content_gap_score: readNumber(record.content_gap_score),
    };
  }
  return empty;
}

function scoreLabel(score: number) {
  if (score >= 82) return "strong";
  if (score >= 68) return "promising";
  if (score >= 50) return "needs more data";
  return "early signal";
}

/** Host + trimmed path, so a source link reads as a place rather than a URL. */
function sourceLabel(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, "");
    const host = parsed.hostname.replace(/^www\./, "");
    return path && path !== "/" ? `${host}${path}` : host;
  } catch {
    return url;
  }
}

type ScanHistoryRow = {
  id: string;
  status: string;
  summary: string | null;
  error_message: string | null;
  requested_at: string;
  scanned_at: string | null;
};

const SCAN_STATE_LABEL: Record<ScanState, string> = {
  none: "No scan",
  pending: "Running",
  stranded: "Did not finish",
  failed: "Failed",
  complete: "Completed",
};

export default async function IntelligencePage() {
  const { user, supabase } = await requireUser();

  const [
    { data: latestReport },
    { data: scanHistory },
    { data: accounts },
    { data: latestAgent },
    { data: clients },
    campaignsResult,
  ] = await Promise.all([
    supabase
      .from("marketing_os_social_intelligence_reports")
      .select("*")
      .eq("owner_id", user.id)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Recent runs, so a scan that is running now is visibly a different thing
    // from the one that failed last week — which the page could not previously
    // distinguish.
    supabase
      .from("marketing_os_social_intelligence_reports")
      .select("id, status, summary, error_message, requested_at, scanned_at")
      .eq("owner_id", user.id)
      .order("scanned_at", { ascending: false })
      .limit(6),
    supabase
      .from("marketing_os_social_accounts")
      .select("platform, status")
      .eq("owner_id", user.id),
    supabase
      .from("marketing_os_writing_agents")
      .select("id")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("marketing_os_clients")
      .select("id, name, industry, trending_audio_notes")
      .eq("owner_id", user.id)
      .order("name"),
    opsTable(supabase, "marketing_os_campaigns")
      .select("id, name, client_id")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(25),
  ]);

  const connected = new Set(
    (accounts ?? [])
      .filter((account) => account.status === "active")
      .map((account) => account.platform),
  );
  const platforms = PLATFORM_DEFINITIONS.filter((platform) => platform.scheduler);
  const asInsights = (items: string[]) =>
    items.map((text) => ({ insight: text, source_url: null }));
  const topics = latestReport
    ? jsonArray(latestReport.trending_topics)
    : asInsights(BASELINE_TOPICS);
  const hooks = latestReport ? jsonArray(latestReport.hooks) : asInsights(BASELINE_HOOKS);
  const opportunities = readOpportunities(latestReport?.content_opportunities);
  const trends = latestReport && opportunities.items.length
    ? opportunities.items
    : asInsights(BASELINE_TRENDS);
  const positioning = opportunities.positioning.length
    ? opportunities.positioning
    : asInsights(BASELINE_POSITIONING);
  const contentGaps = opportunities.content_gaps.length
    ? opportunities.content_gaps
    : asInsights(BASELINE_CONTENT_GAPS);
  const hookLibrary = opportunities.hook_library.length
    ? opportunities.hook_library
    : hooks.length
      ? hooks
      : asInsights(BASELINE_HOOK_LIBRARY);
  const offerTracker = opportunities.offer_tracker.length
    ? opportunities.offer_tracker
    : asInsights(BASELINE_OFFER_TRACKER);
  const commentThemes = opportunities.comment_themes.length
    ? opportunities.comment_themes
    : asInsights(BASELINE_COMMENT_THEMES);
  const opportunitySignals = opportunities.opportunity_signals.length
    ? opportunities.opportunity_signals
    : asInsights(BASELINE_OPPORTUNITY_SIGNALS);
  const positioningSource = opportunities.positioning.length
    ? "Latest saved scan"
    : "Marketing baseline";
  const recommendedPosts = opportunities.recommended_posts.length
    ? opportunities.recommended_posts
    : asInsights(BASELINE_RECOMMENDED_POSTS);
  const recommendedPostsSource = opportunities.recommended_posts.length
    ? "Latest saved scan"
    : "Marketing baseline";
  const competitorWins = opportunities.competitor_wins.length
    ? opportunities.competitor_wins
    : asInsights(BASELINE_COMPETITOR_WINS);
  const competitorWinsSource = opportunities.competitor_wins.length
    ? "Latest saved scan"
    : "Marketing baseline";
  const recommendations = latestReport
    ? readRecommendations(latestReport.recommendations)
    : [];
  const recommendationsToShow = recommendations.length
    ? recommendations
    : BASELINE_RECOMMENDATIONS;
  const recommendationsSource = recommendations.length
    ? "Latest saved scan"
    : "Marketing baseline";
  // The row records whether its content came from a real scan or from the
  // baseline written at queue time; saying "Latest saved scan" over baseline
  // guidance is the difference between intelligence and a placeholder.
  const scanIsLive =
    (latestReport?.trending_topics as { source?: string } | null)?.source ===
      "website_competitor_scan" ||
    latestReport?.status === "complete";
  const reportSource = !latestReport
    ? "Baseline guidance"
    : scanIsLive
      ? "Latest saved scan"
      : "Baseline guidance (scan not finished)";
  const scanStatus = scanState(latestReport);
  const history = (scanHistory ?? []) as ScanHistoryRow[];
  const timeZone = await workspaceTimeZone();
  const competitorAccounts = latestReport?.competitor_accounts ?? [];
  // The scan judges both scores itself against the competitors it actually
  // read. The old formula only counted how many items came back, so it landed
  // on the same number every run no matter what the scan found.
  const marketScore = opportunities.opportunity_score;
  const contentGapScore = opportunities.content_gap_score;
  const generateHref = latestAgent?.id
    ? `/agents/${latestAgent.id}?tab=generate`
    : "/agents";
  const allClients = clients ?? [];
  const focusedClient =
    allClients.find((client) => client.name === latestReport?.industry) ?? null;
  // One note per line, so a multi-line jot renders as separate cards.
  const audioNotes = asInsights(
    (focusedClient?.trending_audio_notes ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );
  const opsReady = !isOpsSchemaMissing(campaignsResult.error);
  const campaigns = opsReady
    ? asRows<InsightCampaign>(campaignsResult.data)
    : [];
  const latestCampaign = campaigns.find((campaign) =>
    focusedClient ? campaign.client_id === focusedClient.id : true,
  );

  const insightContext = {
    href: generateHref,
    opsReady,
    reportId: latestReport?.id,
    clientId: focusedClient?.id,
    campaignId: latestCampaign?.id,
  };

  const categories: {
    key: string;
    label: string;
    description: string;
    items: Insight[];
    source: string;
  }[] = [
    {
      key: "trending",
      label: "Trending topics",
      description: "Topics your audience is currently engaging with, pulled from the competitor watchlist.",
      items: topics,
      source: reportSource,
    },
    {
      key: "hooks",
      label: "Hooks to adapt",
      description: "Scroll-stopping opening lines you can adapt for your own posts.",
      items: hookLibrary,
      source: reportSource,
    },
    {
      key: "gaps",
      label: "Content gaps",
      description: "Where competitors leave an audience need unaddressed — room for this client to lead.",
      items: contentGaps,
      source: reportSource,
    },
    {
      key: "offers",
      label: "Offer tracker",
      description:
        "What competitors are actively selling and how they ask for the sale — their lead magnets, free tools, consults, and booking paths. Use it to decide what to match, what to beat, and what to deliberately not compete on.",
      items: offerTracker,
      source: reportSource,
    },
    {
      key: "comments",
      label: "Comment themes",
      description: "Recurring questions and objections showing up in the space.",
      items: commentThemes,
      source: reportSource,
    },
    {
      key: "opportunity",
      label: "Opportunity signals",
      description: "Directional reads on velocity, shareability, and saturation for each angle.",
      items: opportunitySignals,
      source: reportSource,
    },
    {
      key: "formats",
      label: "Content formats",
      description: "Formats and angles competitors use well, or leave open.",
      items: trends,
      source: reportSource,
    },
    {
      key: "wins",
      label: "Competitor wins",
      description:
        "How these competitors execute, not what they talk about — format mix, editing and production style, voiceover vs. music, on-screen text, and trending audio.",
      items: competitorWins,
      source: competitorWinsSource,
    },
    {
      key: "audios",
      label: "Audios",
      description:
        "Audio you noted from the apps. No platform API exposes competitor trending audio, so this is whatever the strategist recorded on the client above.",
      items: audioNotes.length
        ? audioNotes
        : asInsights([
            "No trending audio notes yet — add them on the Client card above and they'll feed into the next scan.",
          ]),
      source: audioNotes.length ? "Strategist notes" : "Not recorded",
    },
    {
      key: "posts",
      label: "Recommended posts",
      description: "Ready-to-brief post concepts drawn from this scan's findings.",
      items: recommendedPosts,
      source: recommendedPostsSource,
    },
    {
      key: "positioning",
      label: "Positioning",
      description: `How ${focusedClient?.name ?? "this client"} should stand apart from these competitors while staying competitive on what buyers actually care about.`,
      items: positioning,
      source: positioningSource,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Market Intelligence"
        description="Weekly competitor scan for topics, hooks, audios, and trends across connected marketing platforms."
      >
        <ButtonLink href={generateHref}>
          Generate content from brief
          <ArrowRight className="ml-1 h-4 w-4" />
        </ButtonLink>
      </PageHeader>

      {!opsReady && (
        <OpsSchemaNotice feature="Saving intelligence to ideas and campaigns" />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Weekly scan setup</CardTitle>
          <CardDescription>
            Jidoka Marketing Team OS scans the same connected platforms once a week and summarizes
            what top competitor content suggests for new ideas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="flex flex-wrap gap-2">
            {platforms.map((platform) => (
              <Badge
                key={platform.key}
                variant={
                  platform.disabled
                    ? "outline"
                    : connected.has(platform.key)
                      ? "default"
                      : "destructive"
                }
              >
                {platform.label}:{" "}
                {platform.disabled
                  ? "API setup"
                  : connected.has(platform.key)
                    ? "connected"
                    : "not connected"}
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
            {/* A row left `queued` by a worker that never reported back is not
                a scan in progress, and saying so left users waiting on work
                that had already stopped. */}
            {scanStatus === "pending"
              ? "Competitor scan in progress…"
              : scanStatus === "stranded"
                ? "Last scan did not finish — save the watchlist again to retry"
                : latestReport?.scanned_at
                  ? `Last scan ${formatInstant(latestReport.scanned_at, timeZone)}`
                  : "Live scan starts after platform APIs are connected"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Competitor websites to monitor</CardTitle>
          <CardDescription>
            Add competitor websites, one per line, and pick which client the
            ideas are for. Saving queues a fresh scan: Jidoka Marketing Team OS reads each
            site and generates new topics, hooks, and content opportunities below.
            The scan runs in the background and appears here when it finishes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id="competitor-scan-form"
            action={saveCompetitorsAction}
            className="space-y-3"
          >
            <Textarea
              name="competitor_websites"
              rows={4}
              defaultValue={competitorAccounts.join("\n")}
              placeholder={"https://www.clevelandclinic.org\nhttps://drhyman.com\nhttps://www.mindbodygreen.com"}
            />
            <PendingSubmitButton
              pendingLabel="Saving watchlist…"
              pendingHint="Queueing the competitor scan."
            >
              Save & scan competitors
            </PendingSubmitButton>
          </form>
          <div className="mt-3">
            {/* The scan records its own stage and source counts now, so this
                reports what happened rather than inferring it from a clock.
                A row the worker abandoned is shown as failed either way. */}
            <ScanStatusBanner
              progress={{
                status:
                  scanStatus === "stranded"
                    ? "failed"
                    : ((latestReport?.status ?? "complete") as ScanStatus),
                current_stage:
                  (latestReport?.current_stage as ScanStage | null) ?? null,
                sources_total: latestReport?.sources_total ?? 0,
                sources_completed: latestReport?.sources_completed ?? 0,
                sources_failed: latestReport?.sources_failed ?? 0,
                last_completed_step:
                  (latestReport?.last_completed_step as ScanStage | null) ?? null,
                retry_count: latestReport?.retry_count ?? 0,
                started_at: latestReport?.started_at ?? latestReport?.requested_at,
                completed_at: latestReport?.completed_at ?? null,
              }}
            />
          </div>
          {latestReport?.summary && (
            <p className="mt-3 text-xs text-muted-foreground">
              Latest scan
              {latestReport.scanned_at
                ? ` (${formatInstant(latestReport.scanned_at, timeZone)})`
                : ""}
              : {latestReport.summary}
            </p>
          )}

          {/* Without this, a failure from a previous run and the run happening
              now were the same undated sentence. */}
          {history.length > 1 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Scan history ({history.length})
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {history.map((run) => {
                  const state = scanState(run);
                  return (
                    <li key={run.id} className="flex flex-wrap gap-2">
                      <span className="font-medium text-foreground">
                        {SCAN_STATE_LABEL[state]}
                      </span>
                      <span>
                        {formatInstant(run.scanned_at ?? run.requested_at, timeZone)}
                      </span>
                      {run.error_message && <span>— {run.error_message}</span>}
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Client</CardTitle>
          <CardDescription>
            {focusedClient
              ? `The latest scan was generated for ${focusedClient.name}. Pick a different client, then Save & scan competitors to refocus the ideas.`
              : "Pick which client the topic ideas are for, then Save & scan competitors."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <select
            id="client_id"
            name="client_id"
            form="competitor-scan-form"
            defaultValue={focusedClient?.id ?? ""}
            className="flex h-9 w-full max-w-sm rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">General marketing</option>
            {allClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
                {client.industry ? ` · ${client.industry}` : ""}
              </option>
            ))}
          </select>

          <div className="mt-4 space-y-2">
            <label htmlFor="trending_audio_notes" className="text-sm font-medium">
              Trending audio notes
            </label>
            <Textarea
              id="trending_audio_notes"
              name="trending_audio_notes"
              form="competitor-scan-form"
              rows={3}
              defaultValue={focusedClient?.trending_audio_notes ?? ""}
              placeholder={
                "e.g. Reels: sped-up 'Tell Me Why' clip on before/after posts\n" +
                "TikTok: whispered-voiceover trend on myth-busting videos"
              }
            />
            <p className="text-xs text-muted-foreground">
              No platform exposes competitor trending audio — TikTok removed it from
              Creative Center, and Instagram&apos;s audio API only covers publishing. Note
              what you actually see in the app and the scan will use it instead of
              guessing. Saved with the client and reused on every scan.
            </p>
          </div>
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
              The scan&apos;s own read on how much room this client has against
              the competitors it read. Moves with each scan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {marketScore == null ? (
              <p className="text-sm text-muted-foreground">
                Save a competitor watchlist to get a score for this client.
              </p>
            ) : (
              <div className="flex items-end gap-2">
                <span className="text-4xl font-semibold">{marketScore}</span>
                <Badge variant="secondary">{scoreLabel(marketScore)}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              Content Gap Score
            </CardTitle>
            <CardDescription>
              How large and addressable the gaps competitors leave open are,
              judged by the scan itself.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {contentGapScore == null ? (
              <p className="text-sm text-muted-foreground">
                Save a competitor watchlist to get a score for this client.
              </p>
            ) : (
              <div className="flex items-end gap-2">
                <span className="text-4xl font-semibold">{contentGapScore}</span>
                <Badge variant="secondary">{scoreLabel(contentGapScore)}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-muted-foreground" />
              Competitor Watchlist
            </CardTitle>
            <CardDescription>
              Public websites currently feeding the weekly brief.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold">{competitorAccounts.length}</div>
            <p className="mt-3 text-sm text-muted-foreground">
              Add social URLs, newsletters, podcasts, and broader watchlist
              sources above, then Save &amp; scan competitors.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Recommended next moves
            </CardTitle>
            <Badge variant="outline">{recommendationsSource}</Badge>
          </div>
          <CardDescription>
            The top {recommendationsToShow.length} decisions to brief this week, synthesized
            across every category below. These are directions to hand off, not finished posts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 lg:grid-cols-3">
            {recommendationsToShow.map((item, index) => (
              <li key={`rec-${index}`} className="rounded-lg border p-4">
                <Badge variant="secondary" className="mb-2">
                  {index + 1}. {item.focus}
                </Badge>
                <p className="text-sm font-medium">{item.move}</p>
                <p className="mt-2 text-sm text-muted-foreground">{item.why}</p>
                <InsightActions
                  title={`Recommendation: ${item.focus}`}
                  item={item.move}
                  source={recommendationsSource}
                  {...insightContext}
                />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radar className="h-4 w-4" />
            Insight categories
          </CardTitle>
          <CardDescription>
            Pick a category to see its details. Each one pulls from the same
            scan; the split is just to make one thing readable at a time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={categories[0].key}>
            <TabsList
              variant="line"
              className="h-auto flex-wrap justify-start gap-1"
            >
              {categories.map((category) => (
                <TabsTrigger
                  key={category.key}
                  value={category.key}
                  className="flex-none gap-1.5 px-2.5 py-1.5"
                >
                  {category.label}
                  <Badge variant="secondary" className="ml-0.5">
                    {category.items.length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {categories.map((category) => (
              <TabsContent key={category.key} value={category.key} className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {category.description}
                  </p>
                  <Badge variant="outline" className="shrink-0">
                    {category.source}
                  </Badge>
                </div>
                <ul className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  {category.items.map((item, index) => (
                    <li
                      key={`${category.key}-${index}`}
                      className="rounded-md border p-3"
                    >
                      <div className="flex gap-2">
                        <span className="shrink-0 font-medium text-muted-foreground">
                          {index + 1}.
                        </span>
                        <div className="space-y-1.5">
                          <p className="text-foreground">{item.insight}</p>
                          {item.source_url && (
                            <a
                              href={item.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {sourceLabel(item.source_url)}
                            </a>
                          )}
                        </div>
                      </div>
                      <InsightActions
                        title={category.label}
                        item={item.insight}
                        source={category.source}
                        {...insightContext}
                      />
                    </li>
                  ))}
                </ul>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function InsightActions({
  title,
  item,
  source,
  href,
  opsReady,
  reportId,
  clientId,
  campaignId,
}: {
  title: string;
  item: string;
  source: string;
  href: string;
  opsReady: boolean;
  reportId?: string;
  clientId?: string;
  campaignId?: string;
}) {
  const insightTitle = `${title}: ${item.slice(0, 72)}`;
  const [hrefBase, hrefQuery] = href.split("?");
  const generateParams = new URLSearchParams(hrefQuery);
  generateParams.set("title", insightTitle.slice(0, 90));
  generateParams.set("topic", item);
  generateParams.set("goal", "Turn this market signal into an original content package");
  generateParams.set(
    "notes",
    `Source: ${title} (${source})${reportId ? `, report ${reportId}` : ""}. Use as inspiration only — do not copy competitors.`,
  );
  const generateHref = `${hrefBase}?${generateParams.toString()}`;
  const actions = [
    { label: "Create campaign", action: createCampaignFromInsightAction },
    { label: "Create idea", action: createContentIdeaFromInsightAction },
    { label: "Add to brief", action: addInsightToBriefAction },
    { label: "Create task", action: createTaskFromInsightAction },
    { label: "Assign to team", action: assignInsightToTeamAction },
    { label: "Save", action: saveInsightForLaterAction },
    { label: "Dismiss", action: dismissInsightAction, destructive: true },
  ];

  return (
    <div className="mt-3 flex items-center gap-2">
      <ButtonLink href={generateHref} size="xs" variant="outline">
        Turn into content package
      </ButtonLink>
      <InsightMoreActions
        actions={actions}
        opsReady={opsReady}
        hiddenFields={{
          title: insightTitle,
          body: item,
          type: title,
          source,
          reportId,
          clientId,
          campaignId,
        }}
      />
    </div>
  );
}
