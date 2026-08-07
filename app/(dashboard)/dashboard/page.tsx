import Link from "next/link";
import { ArrowRight, MessageSquare, Target } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { CORE_AGENTS } from "@/lib/core-agents";
import { CORE_MODULES } from "@/lib/core-modules";
import {
  asRows,
  formatMoney,
  isOpsSchemaMissing,
  opsTable,
  type CampaignRow,
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

type TrainingRow = {
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
      .select("id, agent_key, updated_at")
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
  };
}

export default async function DashboardPage() {
  const data = await getCommandData();
  const activeCampaigns = data.campaigns.filter((item) =>
    ["planning", "active"].includes(item.status),
  );
  const openWork = data.workItems.filter(
    (item) => !["done", "cancelled"].includes(item.status),
  );
  const revenueTotal =
    data.campaigns.reduce(
      (sum, item) => sum + Number(item.attributed_revenue ?? 0),
      0,
    ) +
    data.revenueEvents.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const pipelineValue = data.leads.reduce(
    (sum, item) => sum + Number(item.actual_value || item.estimated_value || 0),
    0,
  );

  const metrics = [
    { label: "Clients", value: data.clients, href: "/clients" },
    { label: "Paid campaigns", value: activeCampaigns.length, href: "/campaigns" },
    { label: "Open work", value: openWork.length, href: "/work" },
    { label: "Content pieces", value: data.content, href: "/generated" },
    { label: "Scheduled", value: data.scheduledPosts, href: "/calendar" },
    { label: "Needs review", value: data.inboxNeedsReview, href: "/inbox" },
    {
      label: revenueTotal ? "Revenue" : "Pipeline",
      value: formatMoney(revenueTotal || pipelineValue),
      href: "/analytics",
    },
  ];
  const coreSystemModules = CORE_MODULES.filter(
    (module) => !["dashboard", "paid-campaigns"].includes(module.id),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Core Command"
        description="Executive command watches the four Core agents and keeps the agency operating system moving."
      >
        <ButtonLink href="/inbox" variant="outline">
          <MessageSquare className="mr-1 h-4 w-4" />
          Review inbox
        </ButtonLink>
        <ButtonLink href="/campaigns">
          <Target className="mr-1 h-4 w-4" />
          Paid campaigns
        </ButtonLink>
      </PageHeader>

      {!data.opsSchemaReady && <OpsSchemaNotice />}
      {!data.coreSchemaReady && (
        <OpsSchemaNotice title="Core agent training needs migration 0017" />
      )}

      <section className="grid gap-4 xl:grid-cols-4">
        {CORE_AGENTS.map((agent) => {
          const Icon = agent.icon;
          const training = data.trainingByAgent.get(agent.key);
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
                    <Badge variant={training ? "default" : "outline"}>
                      {training ? "Trained" : "Needs training"}
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
            A compact readout of the work currently moving through the OS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {metrics.map((metric) => (
              <Link
                key={metric.label}
                href={metric.href}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Core Systems</CardTitle>
          <CardDescription>
            The full Jidoka Core scaffold mapped into the Marketing OS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {coreSystemModules.map((module) => {
              const Icon = module.icon;
              return (
                <Link
                  key={module.id}
                  href={module.href}
                  className="flex min-h-28 items-start gap-3 rounded-lg border p-3 transition-colors hover:border-primary/50"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{module.label}</span>
                      <Badge
                        variant={
                          module.status === "needs_api" ? "outline" : "secondary"
                        }
                      >
                        {module.status === "needs_api"
                          ? "Needs API"
                          : module.status}
                      </Badge>
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                      {module.summary}
                    </span>
                  </span>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
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
