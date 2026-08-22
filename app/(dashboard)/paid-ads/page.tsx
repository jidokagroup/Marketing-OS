import { Megaphone } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { asRows, isOpsSchemaMissing, opsTable } from "@/lib/marketing-os/operations";
import { trainedAgentIds } from "@/lib/agent-readiness";
import type { PaidAdCopyData, SourcePostData } from "@/lib/schemas/paid-ads";
import { EmptyState } from "@/components/empty-state";
import { OpsSchemaNotice } from "@/components/ops-schema-notice";
import { PageHeader } from "@/components/page-header";
import { PaidAdsGenerateButton } from "@/components/paid-ads-generate-button";
import { UntrainedAgentNotice } from "@/components/untrained-agent-notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Paid Ads Generator · Jidoka Marketing Team OS" };

type PaidAdCopyRow = {
  id: string;
  agent_id: string;
  source_posts: SourcePostData[];
  ads: PaidAdCopyData;
  created_at: string;
};

const NETWORKS: { key: keyof PaidAdCopyData; label: string }[] = [
  { key: "meta", label: "Meta" },
  { key: "google", label: "Google" },
  { key: "tiktok", label: "TikTok" },
  { key: "linkedin", label: "LinkedIn" },
];

function AdCopyCard({ result }: { result: PaidAdCopyRow }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Generated {new Date(result.created_at).toLocaleString()}
        </CardTitle>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {result.source_posts.slice(0, 3).map((post, i) => (
            <Badge key={i} variant="outline" className="font-normal">
              {post.platform} · score {post.performance_score}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {NETWORKS.map(({ key, label }) => {
          const ad = result.ads[key] as Record<string, string | string[]>;
          if (!ad) return null;
          return (
            <div key={key} className="rounded-lg border p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <div className="space-y-1.5 text-sm">
                {Object.entries(ad).map(([field, value]) => (
                  <p key={field}>
                    <span className="text-muted-foreground">{field.replace(/_/g, " ")}: </span>
                    {Array.isArray(value) ? value.join(" · ") : value}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default async function PaidAdsPage() {
  const { user, supabase } = await requireUser();

  const { data: agents } = await supabase
    .from("marketing_os_writing_agents")
    .select("id, name, status")
    .order("created_at", { ascending: false });
  const agentList = agents ?? [];

  const trained = await trainedAgentIds(supabase, agentList.map((a) => a.id));

  const resultsResult =
    agentList.length > 0
      ? await opsTable(supabase, "marketing_os_paid_ad_copy")
          .select("id, agent_id, source_posts, ads, created_at")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50)
      : { data: null, error: null };
  const schemaMissing = isOpsSchemaMissing(resultsResult.error);
  const results = schemaMissing ? [] : asRows<PaidAdCopyRow>(resultsResult.data);
  const resultsByAgent = new Map<string, PaidAdCopyRow[]>();
  for (const result of results) {
    const bucket = resultsByAgent.get(result.agent_id) ?? [];
    bucket.push(result);
    resultsByAgent.set(result.agent_id, bucket);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paid Ads Generator"
        description="Turns each client's best-performing organic posts from the last 30 days into ad copy for Meta, Google, TikTok, and LinkedIn. Reading spend and ROAS is a separate, not-yet-built surface — this only writes copy."
      />

      {schemaMissing && <OpsSchemaNotice feature="The Paid Ads Generator" />}

      {agentList.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No writing agents yet"
          description="Create a Writing Agent and publish some content through the Scheduler first — the generator writes from what has already performed."
        />
      ) : (
        <div className="space-y-8">
          {agentList.map((agent) => {
            const agentResults = resultsByAgent.get(agent.id) ?? [];
            return (
              <section key={agent.id} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">{agent.name}</h2>
                  {trained.has(agent.id) && <PaidAdsGenerateButton agentId={agent.id} />}
                </div>
                {!trained.has(agent.id) && (
                  <UntrainedAgentNotice agentId={agent.id} what="Ad copy" />
                )}
                {agentResults.length === 0 ? (
                  trained.has(agent.id) ? (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      No ad copy generated yet for {agent.name}.
                    </p>
                  ) : null
                ) : (
                  <div className="space-y-3">
                    {agentResults.map((result) => (
                      <AdCopyCard key={result.id} result={result} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
