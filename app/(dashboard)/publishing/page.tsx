import { Send } from "lucide-react";

import { requireUser } from "@/lib/auth";
import {
  asRows,
  formatDate,
  isOpsSchemaMissing,
  opsTable,
  titleCase,
  type CampaignRow,
} from "@/lib/marketing-os/operations";
import { EmptyState } from "@/components/empty-state";
import { OpsSchemaNotice } from "@/components/ops-schema-notice";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Publishing · Jidoka Marketing Team OS" };

type PublishingPost = {
  id: string;
  campaign_id?: string | null;
  agent_id: string;
  title: string | null;
  platform: string;
  status: string;
  scheduled_time: string | null;
  content_type: string;
  error: string | null;
};

type AgentOption = {
  id: string;
  name: string;
  client_id: string | null;
};

export default async function PublishingPage() {
  const { user, supabase } = await requireUser();
  const postsResult = await opsTable(supabase, "marketing_os_scheduled_posts")
    .select("id, campaign_id, agent_id, title, platform, status, scheduled_time, content_type, error")
    .eq("owner_id", user.id)
    .order("scheduled_time", { ascending: true, nullsFirst: false });
  const schemaMissing = isOpsSchemaMissing(postsResult.error);

  const [fallbackPosts, campaignsResult, agentsResult] = await Promise.all([
    schemaMissing
      ? supabase
          .from("marketing_os_scheduled_posts")
          .select("id, agent_id, title, platform, status, scheduled_time, content_type, error")
          .eq("owner_id", user.id)
          .order("scheduled_time", { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: null }),
    schemaMissing
      ? Promise.resolve({ data: null })
      : opsTable(supabase, "marketing_os_campaigns")
          .select(
            "id, owner_id, client_id, name, campaign_type, status, stage, health, priority, goal, primary_kpi, target_audience, owner_name, budget, actual_spend, expected_revenue, attributed_revenue, lead_goal, leads_count, start_date, end_date, notes, created_at, updated_at",
          )
          .eq("owner_id", user.id),
    supabase
      .from("marketing_os_writing_agents")
      .select("id, name, client_id")
      .eq("owner_id", user.id),
  ]);

  const posts = schemaMissing
    ? ((fallbackPosts.data ?? []) as PublishingPost[])
    : asRows<PublishingPost>(postsResult.data);
  const campaigns = schemaMissing
    ? []
    : asRows<CampaignRow>(campaignsResult.data);
  const agents = (agentsResult.data ?? []) as AgentOption[];
  const campaignById = new Map(campaigns.map((item) => [item.id, item]));
  const agentById = new Map(agents.map((item) => [item.id, item]));
  const counts = {
    draft: posts.filter((post) => post.status === "draft").length,
    scheduled: posts.filter((post) => post.status === "scheduled").length,
    posted: posts.filter((post) => post.status === "posted").length,
    failed: posts.filter((post) => post.status === "failed").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Publishing"
        description="Control drafts, scheduled posts, account issues, and published content from one queue."
      >
        <ButtonLink href="/scheduler">Smart Scheduler</ButtonLink>
        <ButtonLink href="/calendar" variant="outline">
          Calendar
        </ButtonLink>
      </PageHeader>

      {schemaMissing && <OpsSchemaNotice feature="Campaign publishing" />}

      <div className="grid gap-4 sm:grid-cols-4">
        <Metric label="Draft" value={counts.draft} />
        <Metric label="Scheduled" value={counts.scheduled} />
        <Metric label="Posted" value={counts.posted} />
        <Metric label="Failed" value={counts.failed} tone={counts.failed ? "risk" : "normal"} />
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={Send}
          title="No posts in the publishing queue"
          description="Schedule generated content through the Smart Scheduler."
          actionLabel="Open Smart Scheduler"
          actionHref="/scheduler"
        />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const campaign = post.campaign_id
              ? campaignById.get(post.campaign_id)
              : null;
            const agent = agentById.get(post.agent_id);
            return (
              <Card key={post.id}>
                <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {post.title ?? `${titleCase(post.platform)} post`}
                      </p>
                      <Badge
                        variant={
                          post.status === "failed"
                            ? "destructive"
                            : post.status === "posted"
                              ? "default"
                              : "outline"
                        }
                      >
                        {titleCase(post.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {campaign?.name ?? agent?.name ?? "No campaign"} ·{" "}
                      {titleCase(post.platform)} · {titleCase(post.content_type)} ·{" "}
                      {formatDate(post.scheduled_time)}
                    </p>
                    {post.error && (
                      <p className="mt-2 text-sm text-destructive">{post.error}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {campaign && (
                      <ButtonLink href={`/campaigns/${campaign.id}`} variant="outline" size="sm">
                        Campaign
                      </ButtonLink>
                    )}
                    <ButtonLink href="/scheduler" size="sm">
                      Manage
                    </ButtonLink>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: number;
  tone?: "normal" | "risk";
}) {
  return (
    <Card className={tone === "risk" ? "border-destructive/40" : undefined}>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-bold tabular-nums">
        {value}
      </CardContent>
    </Card>
  );
}
