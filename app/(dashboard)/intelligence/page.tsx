import {
  ArrowRight,
  Globe2,
  Radar,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
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
  "Simple one-problem posts are easier to save and share than broad advice lists.",
  "Expert POV performs well when it challenges generic advice without attacking anyone.",
  "Customer-story frameworks work best when claims stay specific, clear, and proof-based.",
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

function jsonArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) =>
        typeof item === "string" ? item : JSON.stringify(item),
      )
    : [];
}

// content_opportunities is either a legacy plain array or, for newer scans,
// an object shaped { items, positioning }.
function readOpportunities(value: unknown) {
  if (Array.isArray(value)) {
    return {
      items: jsonArray(value),
      positioning: [],
      content_gaps: [],
      hook_library: [],
      offer_tracker: [],
      comment_themes: [],
      opportunity_signals: [],
    };
  }
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
    };
  }
  return {
    items: [],
    positioning: [],
    content_gaps: [],
    hook_library: [],
    offer_tracker: [],
    comment_themes: [],
    opportunity_signals: [],
  };
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

export default async function IntelligencePage() {
  const { user, supabase } = await requireUser();

  const [
    { data: latestReport },
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
      .select("id, name, industry")
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
  const topics = latestReport
    ? jsonArray(latestReport.trending_topics)
    : BASELINE_TOPICS;
  const hooks = latestReport ? jsonArray(latestReport.hooks) : BASELINE_HOOKS;
  const opportunities = readOpportunities(latestReport?.content_opportunities);
  const trends = latestReport && opportunities.items.length
    ? opportunities.items
    : BASELINE_TRENDS;
  const positioning = opportunities.positioning.length
    ? opportunities.positioning
    : BASELINE_POSITIONING;
  const contentGaps = opportunities.content_gaps.length
    ? opportunities.content_gaps
    : BASELINE_CONTENT_GAPS;
  const hookLibrary = opportunities.hook_library.length
    ? opportunities.hook_library
    : hooks.length
      ? hooks
      : BASELINE_HOOK_LIBRARY;
  const offerTracker = opportunities.offer_tracker.length
    ? opportunities.offer_tracker
    : BASELINE_OFFER_TRACKER;
  const commentThemes = opportunities.comment_themes.length
    ? opportunities.comment_themes
    : BASELINE_COMMENT_THEMES;
  const opportunitySignals = opportunities.opportunity_signals.length
    ? opportunities.opportunity_signals
    : BASELINE_OPPORTUNITY_SIGNALS;
  const positioningSource = opportunities.positioning.length
    ? "Latest saved scan"
    : "Marketing baseline";
  const audios = latestReport ? jsonArray(latestReport.audios) : [];
  const recommendedPosts = BASELINE_RECOMMENDED_POSTS;
  const competitorWins = BASELINE_COMPETITOR_WINS;
  const recommendations = latestReport
    ? readRecommendations(latestReport.recommendations)
    : [];
  const recommendationsToShow = recommendations.length
    ? recommendations
    : BASELINE_RECOMMENDATIONS;
  const recommendationsSource = recommendations.length
    ? "Latest saved scan"
    : "Marketing baseline";
  const reportSource = latestReport ? "Latest saved scan" : "Baseline guidance";
  const competitorAccounts = latestReport?.competitor_accounts ?? [];
  const marketScore = directionalScore({
    trendCount: topics.length,
    hookCount: hookLibrary.length,
    gapCount: contentGaps.length,
    offerCount: offerTracker.length,
    commentCount: commentThemes.length,
    opportunityCount: opportunitySignals.length,
    watchlistCount: competitorAccounts.length,
  });
  const contentGapScore = Math.min(
    95,
    45 + Math.min(contentGaps.length, 6) * 7 + Math.min(competitorAccounts.length, 10) * 1.5,
  );
  const generateHref = latestAgent?.id
    ? `/agents/${latestAgent.id}?tab=generate`
    : "/agents";
  const allClients = clients ?? [];
  const focusedClient =
    allClients.find((client) => client.name === latestReport?.industry) ?? null;
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
    items: string[];
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
      description: "Offers, lead magnets, and conversion paths detected across the watchlist.",
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
      description: "What's working broadly in the space, independent of any one client's scan.",
      items: competitorWins,
      source: "Marketing baseline",
    },
    {
      key: "audios",
      label: "Audios",
      description: "Trending audio signals from connected platforms.",
      items: audios.length
        ? audios
        : ["Connect Instagram and YouTube to collect live audio trends. TikTok is paused while API setup is in progress."],
      source: audios.length ? reportSource : "Setup required",
    },
    {
      key: "posts",
      label: "Recommended posts",
      description: "Ready-to-adapt post concepts based on the current baseline.",
      items: recommendedPosts,
      source: "Marketing baseline",
    },
    {
      key: "positioning",
      label: "Positioning",
      description: `How ${focusedClient?.name ?? "this client"} should stand apart from the competitors on the watchlist.`,
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
        <OpsSchemaNotice title="Intelligence actions need migration 0016" />
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
            {latestReport?.status === "queued" || latestReport?.status === "running"
              ? "Competitor scan in progress…"
              : latestReport?.scanned_at
                ? `Last scan ${new Date(latestReport.scanned_at).toLocaleString()}`
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
            <ScanStatusBanner
              status={latestReport?.status}
              errorMessage={latestReport?.error_message}
            />
          </div>
          {latestReport?.summary && (
            <p className="mt-3 text-xs text-muted-foreground">
              Latest scan
              {latestReport.scanned_at
                ? ` (${new Date(latestReport.scanned_at).toLocaleString()})`
                : ""}
              : {latestReport.summary}
            </p>
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
              Directional read from topics, hooks, gaps, offers, comments, and
              the competitor watchlist.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-semibold">{marketScore}</span>
              <Badge variant="secondary">{scoreLabel(marketScore)}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              Content Gap Score
            </CardTitle>
            <CardDescription>
              How much white space competitors leave open for this client.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-semibold">
                {Math.round(contentGapScore)}
              </span>
              <Badge variant="secondary">{scoreLabel(contentGapScore)}</Badge>
            </div>
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
                        <p className="text-foreground">{item}</p>
                      </div>
                      <InsightActions
                        title={category.label}
                        item={item}
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
