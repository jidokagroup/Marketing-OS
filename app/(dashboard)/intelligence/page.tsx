import { ArrowRight, Radar, RefreshCw } from "lucide-react";

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
import { Button, ButtonLink } from "@/components/ui/button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

function jsonArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) =>
        typeof item === "string" ? item : JSON.stringify(item),
      )
    : [];
}

// content_opportunities is either a legacy plain array or, for newer scans,
// an object shaped { items, positioning }.
function readOpportunities(value: unknown): { items: string[]; positioning: string[] } {
  if (Array.isArray(value)) return { items: jsonArray(value), positioning: [] };
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return {
      items: jsonArray(record.items),
      positioning: jsonArray(record.positioning),
    };
  }
  return { items: [], positioning: [] };
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
  const positioningSource = opportunities.positioning.length
    ? "Latest saved scan"
    : "Marketing baseline";
  const audios = latestReport ? jsonArray(latestReport.audios) : [];
  const recommendedPosts = BASELINE_RECOMMENDED_POSTS;
  const competitorWins = BASELINE_COMPETITOR_WINS;
  const reportSource = latestReport ? "Latest saved scan" : "Baseline guidance";
  const competitorAccounts = latestReport?.competitor_accounts ?? [];
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
            {latestReport?.scanned_at
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
            ideas are for. Saving runs a fresh scan: Jidoka Marketing Team OS reads each site
            and generates new topics, hooks, and content opportunities below.
            This can take up to a minute.
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
              pendingLabel="Scanning competitors…"
              pendingHint="The competitor scan agent is reading each website and writing the report. This can take up to a minute — keep this page open."
            >
              Save & scan competitors
            </PendingSubmitButton>
          </form>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <InsightCard
          title="Trending topics"
          items={topics}
          source={reportSource}
          href={generateHref}
          opsReady={opsReady}
          reportId={latestReport?.id}
          clientId={focusedClient?.id}
          campaignId={latestCampaign?.id}
        />
        <InsightCard
          title="Hooks to adapt"
          items={hooks}
          source={reportSource}
          href={generateHref}
          opsReady={opsReady}
          reportId={latestReport?.id}
          clientId={focusedClient?.id}
          campaignId={latestCampaign?.id}
        />
        <InsightCard
          title="Content formats"
          items={trends}
          source={reportSource}
          href={generateHref}
          opsReady={opsReady}
          reportId={latestReport?.id}
          clientId={focusedClient?.id}
          campaignId={latestCampaign?.id}
        />
        <InsightCard
          title="Competitor wins"
          items={competitorWins}
          source="Marketing baseline"
          href={generateHref}
          opsReady={opsReady}
          reportId={latestReport?.id}
          clientId={focusedClient?.id}
          campaignId={latestCampaign?.id}
        />
        <InsightCard
          title="Audios"
          source={audios.length ? reportSource : "Setup required"}
          items={
            audios.length
              ? audios
              : ["Connect Instagram and YouTube to collect live audio trends. TikTok is paused while API setup is in progress."]
          }
          href={generateHref}
          opsReady={opsReady}
          reportId={latestReport?.id}
          clientId={focusedClient?.id}
          campaignId={latestCampaign?.id}
        />
        <InsightCard
          title="Recommended posts"
          items={recommendedPosts}
          source={reportSource}
          href={generateHref}
          opsReady={opsReady}
          reportId={latestReport?.id}
          clientId={focusedClient?.id}
          campaignId={latestCampaign?.id}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Radar className="h-4 w-4" />
              Positioning
            </CardTitle>
            <Badge variant="outline">{positioningSource}</Badge>
          </div>
          <CardDescription>
            How {focusedClient?.name ?? "this client"} should stand apart from
            the competitors on the watchlist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 text-sm text-muted-foreground lg:grid-cols-2">
            {positioning.map((item, index) => (
              <li key={`positioning-${index}`} className="rounded-md border p-4">
                <p>{item}</p>
                <InsightActions
                  title="Positioning"
                  item={item}
                  source={positioningSource}
                  href={generateHref}
                  opsReady={opsReady}
                  reportId={latestReport?.id}
                  clientId={focusedClient?.id}
                  campaignId={latestCampaign?.id}
                />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function InsightCard({
  title,
  items,
  source,
  href,
  opsReady,
  reportId,
  clientId,
  campaignId,
}: {
  title: string;
  items: string[];
  source: string;
  href: string;
  opsReady: boolean;
  reportId?: string;
  clientId?: string;
  campaignId?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <Badge variant="outline">{source}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="rounded-md border p-3">
              <p>{item}</p>
              <InsightActions
                title={title}
                item={item}
                source={source}
                href={href}
                opsReady={opsReady}
                reportId={reportId}
                clientId={clientId}
                campaignId={campaignId}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
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
  const generateHref = `${href}${href.includes("?") ? "&" : "?"}topic=${encodeURIComponent(item)}`;
  const actions = [
    { label: "Create campaign", action: createCampaignFromInsightAction },
    { label: "Create idea", action: createContentIdeaFromInsightAction },
    { label: "Add to brief", action: addInsightToBriefAction },
    { label: "Create task", action: createTaskFromInsightAction },
    { label: "Assign to team", action: assignInsightToTeamAction },
    { label: "Save", action: saveInsightForLaterAction },
    { label: "Dismiss", action: dismissInsightAction },
  ];

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <ButtonLink href={generateHref} size="xs" variant="outline">
        Generate content
      </ButtonLink>
      {actions.map((action) =>
        opsReady ? (
          <form key={action.label} action={action.action}>
            <InsightHiddenFields
              title={insightTitle}
              body={item}
              type={title}
              source={source}
              reportId={reportId}
              clientId={clientId}
              campaignId={campaignId}
            />
            <Button
              type="submit"
              size="xs"
              variant={action.label === "Dismiss" ? "ghost" : "outline"}
            >
              {action.label}
            </Button>
          </form>
        ) : (
          <Button key={action.label} type="button" size="xs" variant="outline" disabled>
            {action.label}
          </Button>
        ),
      )}
    </div>
  );
}

function InsightHiddenFields({
  title,
  body,
  type,
  source,
  reportId,
  clientId,
  campaignId,
}: {
  title: string;
  body: string;
  type: string;
  source: string;
  reportId?: string;
  clientId?: string;
  campaignId?: string;
}) {
  return (
    <>
      <input type="hidden" name="insight_title" value={title} />
      <input type="hidden" name="insight_body" value={body} />
      <input type="hidden" name="insight_type" value={type} />
      <input type="hidden" name="insight_source" value={source} />
      <input type="hidden" name="report_id" value={reportId ?? ""} />
      <input type="hidden" name="client_id" value={clientId ?? ""} />
      <input type="hidden" name="campaign_id" value={campaignId ?? ""} />
      <input type="hidden" name="assignee_name" value="Marketing team" />
    </>
  );
}
