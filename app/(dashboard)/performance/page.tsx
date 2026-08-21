import { LineChart } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { asRows, isOpsSchemaMissing, opsTable } from "@/lib/marketing-os/operations";
import type { PerformanceIntelligenceReportData } from "@/lib/schemas/performance-intelligence";
import { EmptyState } from "@/components/empty-state";
import { OpsSchemaNotice } from "@/components/ops-schema-notice";
import { PageHeader } from "@/components/page-header";
import { PerformanceIntelligenceGenerateButton } from "@/components/performance-intelligence-generate-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Performance Intelligence · Jidoka Marketing Team OS" };

type ReportRow = PerformanceIntelligenceReportData & {
  id: string;
  agent_id: string;
  post_count: number;
  created_at: string;
};

function ReportCard({ report }: { report: ReportRow }) {
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

      {schemaMissing && <OpsSchemaNotice title="Performance Intelligence needs migration 0031" />}

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
            return (
              <section key={agent.id} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{agent.name}</h2>
                    {report && <Badge variant="secondary">{report.post_count} posts analyzed</Badge>}
                  </div>
                  <PerformanceIntelligenceGenerateButton agentId={agent.id} />
                </div>
                {report ? (
                  <ReportCard report={report} />
                ) : (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No analysis yet for {agent.name}. Needs at least 4 measured posts in the last 90 days.
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
