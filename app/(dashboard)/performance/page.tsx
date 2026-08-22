import { LineChart } from "lucide-react";


import { requireUser } from "@/lib/auth";
import { asRows, isOpsSchemaMissing, opsTable } from "@/lib/marketing-os/operations";
import { trainedAgentIds } from "@/lib/agent-readiness";
import {
  LOOKBACK_DAYS,
  MINIMUM_MEASURED_POSTS,
  measurementCutoff,
} from "@/lib/performance-intelligence";
import type { PerformanceIntelligenceReportData } from "@/lib/schemas/performance-intelligence";
import { EmptyState } from "@/components/empty-state";
import { OpsSchemaNotice } from "@/components/ops-schema-notice";
import { PageHeader } from "@/components/page-header";
import { PerformanceIntelligenceGenerateButton } from "@/components/performance-intelligence-generate-button";
import { UntrainedAgentNotice } from "@/components/untrained-agent-notice";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InsightMoreActions } from "../intelligence/InsightMoreActions";
import {
  addInsightToBriefAction,
  createCampaignFromInsightAction,
  createContentIdeaFromInsightAction,
} from "../intelligence/actions";
import { saveInsightAsLearningAction } from "../learnings/actions";

export const metadata = { title: "Performance Intelligence · Jidoka Marketing Team OS" };

type ReportRow = PerformanceIntelligenceReportData & {
  id: string;
  agent_id: string;
  post_count: number;
  created_at: string;
};

/**
 * The actions that make a finding into work.
 *
 * Performance Intelligence used to end at the page: a person read what worked,
 * closed the tab, and the next draft was written exactly as before. Each of
 * these carries the finding somewhere it changes an outcome — into the Brand
 * Brain so future drafts obey it, into the generator as a brief, or into the
 * idea and campaign backlogs.
 */
function InsightActionRow({
  agentId,
  agentName,
  heading,
  statement,
  why,
  kind,
  opsReady,
}: {
  agentId: string;
  agentName: string;
  heading: string;
  statement: string;
  why?: string;
  kind: string;
  opsReady: boolean;
}) {
  const insightTitle = `${heading}: ${statement.slice(0, 72)}`;
  const generateParams = new URLSearchParams({
    tab: "generate",
    title: insightTitle.slice(0, 90),
    topic: statement,
    goal: "Write another piece using what the performance analysis found worked",
    notes: `From ${agentName}'s Performance Intelligence analysis — ${heading}.${
      why ? ` ${why}` : ""
    }`,
  });

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <ButtonLink
        href={`/agents/${agentId}?${generateParams.toString()}`}
        size="xs"
        variant="outline"
      >
        Generate more like this
      </ButtonLink>
      <InsightMoreActions
        opsReady={opsReady}
        actions={[
          { label: "Save to Brand Brain", action: saveInsightAsLearningAction },
          { label: "Create idea", action: createContentIdeaFromInsightAction },
          { label: "Create campaign", action: createCampaignFromInsightAction },
          { label: "Add to brief", action: addInsightToBriefAction },
        ]}
        hiddenFields={{
          title: insightTitle,
          body: statement,
          type: heading,
          source: "Performance Intelligence",
        }}
        extraFields={{ agent_id: agentId, kind }}
      />
    </div>
  );
}

function ReportCard({
  report,
  agentName,
  opsReady,
}: {
  report: ReportRow;
  agentName: string;
  opsReady: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Latest analysis</CardTitle>
          <span className="text-xs text-muted-foreground">
            {report.post_count} measured posts, last 90 days · {new Date(report.created_at).toLocaleDateString()}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="rounded-lg bg-muted/40 p-3 text-sm">{report.summary}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What the top tier has in common
            </p>
            <p className="text-sm">{report.top_tier_pattern}</p>
            <InsightActionRow
              agentId={report.agent_id}
              agentName={agentName}
              heading="What the top tier has in common"
              statement={report.top_tier_pattern}
              kind="voice_pattern"
              opsReady={opsReady}
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What the bottom tier has in common
            </p>
            <p className="text-sm">{report.bottom_tier_pattern}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Best hooks</p>
            <ul className="space-y-1 text-sm">
              {report.best_hooks.map((hook, i) => (
                <li key={i} className="rounded border px-2 py-1">{hook}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Best CTAs</p>
            <ul className="space-y-1 text-sm">
              {report.best_ctas.map((cta, i) => (
                <li key={i} className="rounded border px-2 py-1">{cta}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Best formats</p>
            <ul className="space-y-1 text-sm">
              {report.best_formats.map((format, i) => (
                <li key={i} className="rounded border px-2 py-1">{format}</li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recommendations
          </p>
          <div className="space-y-2">
            {report.recommendations.map((rec, i) => (
              <div key={i} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{rec.do}</p>
                <p className="mt-1 text-xs text-muted-foreground">{rec.why}</p>
                <InsightActionRow
                  agentId={report.agent_id}
                  agentName={agentName}
                  heading="Recommendation"
                  statement={rec.do}
                  why={rec.why}
                  kind="other"
                  opsReady={opsReady}
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function PerformancePage() {
  const { user, supabase } = await requireUser();

  const { data: agents } = await supabase
    .from("marketing_os_writing_agents")
    .select("id, name, status")
    .order("created_at", { ascending: false });
  const agentList = agents ?? [];

  const trained = await trainedAgentIds(supabase, agentList.map((a) => a.id));

  // The analysis needs a minimum of measured history, and the page used to
  // offer the button anyway — so the only way to learn there was not enough
  // data was to run it and read a toast that then disappeared. Count first.
  const since = measurementCutoff();
  const { data: measuredRows } = agentList.length
    ? await supabase
        .from("marketing_os_platform_analytics")
        .select("agent_id")
        .in("agent_id", agentList.map((a) => a.id))
        .gte("date", since)
    : { data: null };
  const measuredByAgent = new Map<string, number>();
  for (const row of measuredRows ?? []) {
    measuredByAgent.set(row.agent_id, (measuredByAgent.get(row.agent_id) ?? 0) + 1);
  }

  const reportsResult =
    agentList.length > 0
      ? await opsTable(supabase, "marketing_os_performance_intelligence_reports")
          .select(
            "id, agent_id, post_count, top_tier_pattern, bottom_tier_pattern, best_hooks, best_ctas, best_formats, recommendations, summary, created_at",
          )
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
      : { data: null, error: null };
  const schemaMissing = isOpsSchemaMissing(reportsResult.error);
  const reports = schemaMissing ? [] : asRows<ReportRow>(reportsResult.data);
  const latestByAgent = new Map<string, ReportRow>();
  for (const report of reports) {
    if (!latestByAgent.has(report.agent_id)) latestByAgent.set(report.agent_id, report);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance Intelligence"
        description="The Market Intelligence upsell: a deeper AI read on this creator's own history, not the competitive market. It tiers published, measured content by performance_score and explains what actually separates what worked from what didn't."
      />

      {schemaMissing && <OpsSchemaNotice feature="Performance Intelligence" />}

      {agentList.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title="No writing agents yet"
          description="Create a Writing Agent and publish content through the Scheduler first — this analysis needs measured history to find a pattern in."
        />
      ) : (
        <div className="space-y-8">
          {agentList.map((agent) => {
            const report = latestByAgent.get(agent.id);
            const measured = measuredByAgent.get(agent.id) ?? 0;
            return (
              <section key={agent.id} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{agent.name}</h2>
                    {report && <Badge variant="secondary">{report.post_count} posts analyzed</Badge>}
                  </div>
                  {trained.has(agent.id) && (
                    <PerformanceIntelligenceGenerateButton
                      agentId={agent.id}
                      measuredPosts={measured}
                      requiredPosts={MINIMUM_MEASURED_POSTS}
                    />
                  )}
                </div>
                {!trained.has(agent.id) ? (
                  <UntrainedAgentNotice agentId={agent.id} what="This analysis" />
                ) : report ? (
                  <ReportCard
                    report={report}
                    agentName={agent.name}
                    opsReady={!schemaMissing}
                  />
                ) : (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No analysis yet for {agent.name}. This needs at least{" "}
                    {MINIMUM_MEASURED_POSTS} measured posts in the last{" "}
                    {LOOKBACK_DAYS} days, and there {measured === 1 ? "is" : "are"}{" "}
                    {measured}. Publish through the Scheduler, then pull analytics
                    to close the gap.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
