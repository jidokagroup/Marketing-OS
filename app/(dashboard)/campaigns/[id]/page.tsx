import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  FolderOpen,
  Lightbulb,
  ListChecks,
  Send,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import { SeatSync } from "@/components/seat-context";
import {
  WORKFLOW_STAGES,
  asRow,
  asRows,
  formatDate,
  formatMoney,
  isOpsSchemaMissing,
  opsTable,
  titleCase,
  type CampaignRow,
  type ContentIdeaRow,
  type LeadRow,
  type RevenueEventRow,
  type WorkItemRow,
} from "@/lib/marketing-os/operations";
import { OpsSchemaNotice } from "@/components/ops-schema-notice";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  advanceCampaignStageAction,
  createCampaignLeadAction,
  createCampaignWorkAction,
  createRevenueEventAction,
  saveCampaignBriefAction,
  updateCampaignAction,
} from "../actions";

type BriefRow = {
  strategy_summary: string | null;
  audience: string | null;
  offer: string | null;
  positioning: string | null;
  core_message: string | null;
  channels: string[];
  content_pillars: unknown;
  competitor_notes: string | null;
  approval_requirements: string | null;
  measurement_plan: string | null;
};

type GeneratedRow = {
  id: string;
  title: string | null;
  topic: string | null;
  platform: string | null;
  overall_score: number | null;
  created_at: string;
};

type ScheduledRow = {
  id: string;
  title: string | null;
  platform: string;
  status: string;
  scheduled_time: string | null;
};

type ApprovalRow = {
  id: string;
  status: string;
  reviewer_email: string | null;
  reviewer_name: string | null;
  due_at: string | null;
  created_at: string;
};

type AssetRow = {
  id: string;
  title: string | null;
  file_name: string;
  media_type: string;
  created_at: string;
};

type ExperimentRow = {
  id: string;
  name: string;
  hypothesis: string | null;
  status: string;
  metric: string | null;
  result_value: number | null;
  decision: string | null;
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, supabase } = await requireUser();

  const campaignResult = await opsTable(supabase, "marketing_os_campaigns")
    .select(
      "id, owner_id, client_id, name, campaign_type, status, stage, health, priority, goal, primary_kpi, target_audience, owner_name, budget, actual_spend, expected_revenue, attributed_revenue, lead_goal, leads_count, start_date, end_date, notes, created_at, updated_at",
    )
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (isOpsSchemaMissing(campaignResult.error)) {
    return (
      <div className="space-y-6">
        <Link
          href="/campaigns"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          All campaigns
        </Link>
        <OpsSchemaNotice />
      </div>
    );
  }

  const campaign = asRow<CampaignRow>(campaignResult.data);
  if (!campaign) notFound();

  const [
    clientResult,
    briefResult,
    workResult,
    ideasResult,
    generatedResult,
    scheduledResult,
    approvalsResult,
    assetsResult,
    leadsResult,
    revenueResult,
    experimentsResult,
    latestAgentResult,
  ] = await Promise.all([
    campaign.client_id
      ? supabase
          .from("marketing_os_clients")
          .select("id, name, industry")
          .eq("id", campaign.client_id)
          .eq("owner_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    opsTable(supabase, "marketing_os_campaign_briefs")
      .select("*")
      .eq("campaign_id", id)
      .eq("owner_id", user.id)
      .maybeSingle(),
    opsTable(supabase, "marketing_os_work_items")
      .select("id, campaign_id, client_id, title, description, work_type, status, priority, assignee_name, due_at, estimate_hours, actual_hours, created_at, updated_at")
      .eq("campaign_id", id)
      .eq("owner_id", user.id)
      .order("due_at", { ascending: true, nullsFirst: false }),
    opsTable(supabase, "marketing_os_content_ideas")
      .select("id, campaign_id, client_id, agent_id, title, description, source, format, platform, funnel_stage, status, created_at, updated_at")
      .eq("campaign_id", id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    opsTable(supabase, "marketing_os_generated_content")
      .select("id, title, topic, platform, overall_score, created_at")
      .eq("campaign_id", id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    opsTable(supabase, "marketing_os_scheduled_posts")
      .select("id, title, platform, status, scheduled_time")
      .eq("campaign_id", id)
      .eq("owner_id", user.id)
      .order("scheduled_time", { ascending: true, nullsFirst: false }),
    opsTable(supabase, "marketing_os_approval_requests")
      .select("id, status, reviewer_email, reviewer_name, due_at, created_at")
      .eq("campaign_id", id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    opsTable(supabase, "marketing_os_media_assets")
      .select("id, title, file_name, media_type, created_at")
      .eq("campaign_id", id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    opsTable(supabase, "marketing_os_leads")
      .select("id, campaign_id, client_id, lead_name, email, status, estimated_value, actual_value, created_at")
      .eq("campaign_id", id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    opsTable(supabase, "marketing_os_revenue_events")
      .select("id, campaign_id, client_id, amount, event_type, occurred_at")
      .eq("campaign_id", id)
      .eq("owner_id", user.id)
      .order("occurred_at", { ascending: false }),
    opsTable(supabase, "marketing_os_experiments")
      .select("id, name, hypothesis, status, metric, result_value, decision")
      .eq("campaign_id", id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("marketing_os_writing_agents")
      .select("id")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const client = clientResult.data;
  const brief = asRow<BriefRow>(briefResult.data);
  const workItems = asRows<WorkItemRow>(workResult.data);
  const ideas = asRows<ContentIdeaRow>(ideasResult.data);
  const generated = asRows<GeneratedRow>(generatedResult.data);
  const scheduled = asRows<ScheduledRow>(scheduledResult.data);
  const approvals = asRows<ApprovalRow>(approvalsResult.data);
  const assets = asRows<AssetRow>(assetsResult.data);
  const leads = asRows<LeadRow>(leadsResult.data);
  const revenue = asRows<RevenueEventRow>(revenueResult.data);
  const experiments = asRows<ExperimentRow>(experimentsResult.data);
  const generatedHref = latestAgentResult.data?.id
    ? `/agents/${latestAgentResult.data.id}?tab=generate`
    : "/agents";
  const revenueTotal =
    Number(campaign.attributed_revenue ?? 0) +
    revenue.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const leadValue = leads.reduce(
    (sum, item) => sum + Number(item.actual_value || item.estimated_value || 0),
    0,
  );
  const channelsDefault = Array.isArray(brief?.channels)
    ? brief.channels.join(", ")
    : "";
  const pillarsDefault = Array.isArray(brief?.content_pillars)
    ? brief.content_pillars
        .map((item) =>
          item && typeof item === "object" && "name" in item
            ? String(item.name)
            : String(item),
        )
        .join("\n")
    : "";
  const currentStageIndex = Math.max(
    0,
    WORKFLOW_STAGES.indexOf(campaign.stage),
  );
  const nextStage = WORKFLOW_STAGES[currentStageIndex + 1] ?? null;
  const progressPercent =
    ((currentStageIndex + 1) / WORKFLOW_STAGES.length) * 100;

  return (
    <div className="space-y-6">
      {/* Tells the header which seat this campaign belongs to, so the
          selector stops naming a different client than the page shows. */}
      <SeatSync clientId={campaign.client_id} />
      <Link
        href="/campaigns"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        All campaigns
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {campaign.name}
            </h1>
            <Badge>{titleCase(campaign.stage)}</Badge>
            <Badge variant="outline">{titleCase(campaign.status)}</Badge>
            <Badge
              variant={
                campaign.health === "blocked" ? "destructive" : "secondary"
              }
            >
              {titleCase(campaign.health)}
            </Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {client?.name ?? "Internal"} · {campaign.primary_kpi ?? "No KPI"} ·{" "}
            {formatDate(campaign.start_date)} to {formatDate(campaign.end_date)}
          </p>
          {campaign.goal && (
            <p className="max-w-3xl text-sm text-muted-foreground">
              {campaign.goal}
            </p>
          )}
        </div>
        {/* Pipeline and revenue are separate numbers. Falling back to the
            leads' estimated value under a "Revenue" label reported money that
            had not been earned, and disagreed with the Money page. */}
        <div className="grid min-w-64 grid-cols-4 gap-2 text-sm">
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground">Budget</p>
            <p className="font-semibold">{formatMoney(campaign.budget)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground">Leads</p>
            <p className="font-semibold">{leads.length}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground">Pipeline</p>
            <p className="font-semibold">{formatMoney(leadValue)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground">Revenue</p>
            <p className="font-semibold">{formatMoney(revenueTotal)}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Campaign progress
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{titleCase(campaign.stage)}</Badge>
                {nextStage ? (
                  <>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Next: {titleCase(nextStage)}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Final workflow stage
                  </span>
                )}
              </div>
            </div>
            <form
              action={advanceCampaignStageAction}
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <input type="hidden" name="id" value={campaign.id} />
              <select
                name="stage"
                defaultValue={campaign.stage}
                className="flex h-9 min-w-44 rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                aria-label="Campaign stage"
              >
                {WORKFLOW_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {titleCase(stage)}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm">
                Update stage
              </Button>
            </form>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="brief">
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-max">
            <TabsTrigger value="brief">Brief</TabsTrigger>
            <TabsTrigger value="work">Tasks</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="approval">Approvals</TabsTrigger>
            <TabsTrigger value="publishing">Publishing</TabsTrigger>
            <TabsTrigger value="revenue">Leads & Revenue</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="brief" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Campaign strategy brief
              </CardTitle>
              <CardDescription>
                The brief connects market intelligence, positioning, offer,
                channels, approvals, and measurement.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={saveCampaignBriefAction} className="space-y-3">
                <input type="hidden" name="campaign_id" value={campaign.id} />
                <Textarea
                  name="strategy_summary"
                  defaultValue={brief?.strategy_summary ?? ""}
                  placeholder="Strategy summary"
                  rows={4}
                />
                <div className="grid gap-2 md:grid-cols-2">
                  <Textarea
                    name="audience"
                    defaultValue={brief?.audience ?? campaign.target_audience ?? ""}
                    placeholder="Audience"
                  />
                  <Textarea
                    name="offer"
                    defaultValue={brief?.offer ?? ""}
                    placeholder="Offer"
                  />
                </div>
                <Textarea
                  name="positioning"
                  defaultValue={brief?.positioning ?? ""}
                  placeholder="Positioning"
                  rows={3}
                />
                <Textarea
                  name="core_message"
                  defaultValue={brief?.core_message ?? ""}
                  placeholder="Core campaign message"
                  rows={3}
                />
                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    name="channels"
                    defaultValue={channelsDefault}
                    placeholder="Channels, separated by commas"
                  />
                  <Textarea
                    name="content_pillars"
                    defaultValue={pillarsDefault}
                    placeholder="Content pillars, one per line"
                  />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <Textarea
                    name="competitor_notes"
                    defaultValue={brief?.competitor_notes ?? ""}
                    placeholder="Competitor notes"
                  />
                  <Textarea
                    name="approval_requirements"
                    defaultValue={brief?.approval_requirements ?? ""}
                    placeholder="Approval requirements"
                  />
                </div>
                <Textarea
                  name="measurement_plan"
                  defaultValue={brief?.measurement_plan ?? ""}
                  placeholder="Measurement plan"
                  rows={3}
                />
                <Button type="submit">Save brief</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campaign controls</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action={updateCampaignAction}
                className="grid gap-3 md:grid-cols-4"
              >
                <input type="hidden" name="id" value={campaign.id} />
                <select
                  name="status"
                  defaultValue={campaign.status}
                  className="flex h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {["planning", "active", "paused", "completed", "cancelled"].map(
                    (item) => (
                      <option key={item} value={item}>
                        {titleCase(item)}
                      </option>
                    ),
                  )}
                </select>
                <select
                  name="stage"
                  defaultValue={campaign.stage}
                  className="flex h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {WORKFLOW_STAGES.map((item) => (
                    <option key={item} value={item}>
                      {titleCase(item)}
                    </option>
                  ))}
                </select>
                <select
                  name="health"
                  defaultValue={campaign.health}
                  className="flex h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {["on_track", "at_risk", "blocked", "complete"].map((item) => (
                    <option key={item} value={item}>
                      {titleCase(item)}
                    </option>
                  ))}
                </select>
                <select
                  name="priority"
                  defaultValue={campaign.priority}
                  className="flex h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {["low", "medium", "high", "urgent"].map((item) => (
                    <option key={item} value={item}>
                      {titleCase(item)}
                    </option>
                  ))}
                </select>
                <Input name="owner_name" defaultValue={campaign.owner_name ?? ""} placeholder="Owner" />
                <Input name="budget" type="number" defaultValue={campaign.budget} placeholder="Budget" />
                <Input name="actual_spend" type="number" defaultValue={campaign.actual_spend} placeholder="Spend" />
                <Input name="expected_revenue" type="number" defaultValue={campaign.expected_revenue} placeholder="Revenue goal" />
                <Input name="attributed_revenue" type="number" defaultValue={campaign.attributed_revenue} placeholder="Attributed revenue" />
                <Input name="lead_goal" type="number" defaultValue={campaign.lead_goal} placeholder="Lead goal" />
                <Input name="leads_count" type="number" defaultValue={campaign.leads_count} placeholder="Lead count" />
                <Input name="start_date" type="date" defaultValue={campaign.start_date ?? ""} aria-label="Start date" />
                <Input name="end_date" type="date" defaultValue={campaign.end_date ?? ""} aria-label="End date" />
                <Textarea
                  name="goal"
                  defaultValue={campaign.goal ?? ""}
                  placeholder="Goal"
                  className="md:col-span-2"
                />
                <Textarea
                  name="notes"
                  defaultValue={campaign.notes ?? ""}
                  placeholder="Notes"
                  className="md:col-span-2"
                />
                <Button type="submit" className="md:col-span-4">
                  Save campaign controls
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="work" className="mt-6 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardHeader>
              <CardTitle>Create work</CardTitle>
              <CardDescription>
                Add strategy, content, creative, publishing, analytics, or
                client communication work for this campaign.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createCampaignWorkAction} className="space-y-3">
                <input type="hidden" name="campaign_id" value={campaign.id} />
                <input
                  type="hidden"
                  name="client_id"
                  value={campaign.client_id ?? ""}
                />
                <Input name="title" placeholder="Task title" required />
                <Textarea name="description" placeholder="Task details" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <select name="work_type" className="flex h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm">
                    {["strategy", "content", "design", "video", "publishing", "lead_gen", "analytics", "client_comms", "ops"].map((item) => (
                      <option key={item} value={item}>{titleCase(item)}</option>
                    ))}
                  </select>
                  <select name="priority" className="flex h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm">
                    {["low", "medium", "high", "urgent"].map((item) => (
                      <option key={item} value={item}>{titleCase(item)}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input name="assignee_name" placeholder="Assignee" />
                  <Input name="due_at" type="date" aria-label="Due date" />
                  <Input name="estimate_hours" type="number" min="0" step="0.25" placeholder="Hours" />
                </div>
                <Button type="submit" className="w-full">
                  Add work
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Work plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {workItems.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No work has been assigned yet.
                </p>
              ) : (
                workItems.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.assignee_name ?? "Unassigned"} · {formatDate(item.due_at)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">{titleCase(item.work_type)}</Badge>
                        <Badge>{titleCase(item.status)}</Badge>
                      </div>
                    </div>
                    {item.description && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="mt-6 grid gap-4 lg:grid-cols-3">
          <ContentSummaryCard
            icon={Lightbulb}
            title="Ideas"
            href="/content/ideas"
            count={ideas.length}
            items={ideas.map((item) => item.title)}
          />
          <ContentSummaryCard
            icon={Sparkles}
            title="Generated Content"
            href={generatedHref}
            count={generated.length}
            items={generated.map((item) => item.title ?? item.topic ?? "Untitled")}
          />
          <ContentSummaryCard
            icon={FolderOpen}
            title="Assets"
            href="/content/assets"
            count={assets.length}
            items={assets.map((item) => item.title ?? item.file_name)}
          />
        </TabsContent>

        <TabsContent value="approval" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Approval queue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {approvals.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No approval requests are tied to this campaign yet.
                </p>
              ) : (
                approvals.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {item.reviewer_name ?? item.reviewer_email ?? "Reviewer"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Due {formatDate(item.due_at)} · Requested {formatDate(item.created_at)}
                        </p>
                      </div>
                      <Badge>{titleCase(item.status)}</Badge>
                    </div>
                  </div>
                ))
              )}
              <ButtonLink href="/content/approvals" variant="outline">
                Open approvals
              </ButtonLink>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="publishing" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Publishing queue
              </CardTitle>
              <CardDescription>
                Campaign posts can still be managed in the Smart Scheduler and
                Calendar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {scheduled.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No scheduled posts are tied to this campaign yet.
                </p>
              ) : (
                scheduled.map((post) => (
                  <div key={post.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{post.title ?? post.platform}</p>
                        <p className="text-sm text-muted-foreground">
                          {post.platform} · {formatDate(post.scheduled_time)}
                        </p>
                      </div>
                      <Badge>{titleCase(post.status)}</Badge>
                    </div>
                  </div>
                ))
              )}
              <div className="flex gap-2">
                <ButtonLink href="/publishing" variant="outline">
                  Publishing
                </ButtonLink>
                <ButtonLink href="/calendar" variant="outline">
                  <CalendarClock className="mr-1 h-4 w-4" />
                  Calendar
                </ButtonLink>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Log lead</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createCampaignLeadAction} className="space-y-3">
                <input type="hidden" name="campaign_id" value={campaign.id} />
                <input type="hidden" name="client_id" value={campaign.client_id ?? ""} />
                <Input name="lead_name" placeholder="Lead name" />
                <Input name="email" type="email" placeholder="Email" />
                <Input name="company" placeholder="Company" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input name="source_channel" placeholder="Source channel" />
                  <Input name="estimated_value" type="number" min="0" placeholder="Estimated value" />
                </div>
                <Button type="submit" className="w-full">Add lead</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Log revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createRevenueEventAction} className="space-y-3">
                <input type="hidden" name="campaign_id" value={campaign.id} />
                <input type="hidden" name="client_id" value={campaign.client_id ?? ""} />
                <Input name="amount" type="number" min="0" placeholder="Amount" required />
                <select name="event_type" className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm">
                  {["deal_created", "closed_won", "closed_lost", "recurring", "payment", "refund"].map((item) => (
                    <option key={item} value={item}>{titleCase(item)}</option>
                  ))}
                </select>
                <Input name="occurred_at" type="datetime-local" aria-label="Revenue date" />
                <Textarea name="notes" placeholder="Notes" />
                <Button type="submit" className="w-full">Add revenue event</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Leads and revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Leads</h3>
                {leads.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No leads logged.</p>
                ) : (
                  leads.map((lead) => (
                    <div key={lead.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">{lead.lead_name ?? lead.email ?? "Unnamed lead"}</p>
                      <p className="text-muted-foreground">{titleCase(lead.status)} · {formatMoney(lead.actual_value || lead.estimated_value)}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Revenue</h3>
                {revenue.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No revenue events logged.</p>
                ) : (
                  revenue.map((event) => (
                    <div key={event.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">{formatMoney(event.amount)}</p>
                      <p className="text-muted-foreground">{titleCase(event.event_type)} · {formatDate(event.occurred_at)}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Performance readout
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">Generated</p>
                <p className="text-xl font-bold">{generated.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">Scheduled</p>
                <p className="text-xl font-bold">{scheduled.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">Approvals</p>
                <p className="text-xl font-bold">{approvals.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Experiments</CardTitle>
              <CardDescription>
                Use experiment results to improve the next campaign playbook.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {experiments.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No experiments logged for this campaign yet.
                </p>
              ) : (
                experiments.map((experiment) => (
                  <div key={experiment.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{experiment.name}</p>
                      <Badge>{titleCase(experiment.status)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {experiment.hypothesis ?? experiment.metric ?? "No hypothesis entered"}
                    </p>
                    {experiment.decision && (
                      <p className="mt-2 text-sm">{experiment.decision}</p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ContentSummaryCard({
  icon: Icon,
  title,
  href,
  count,
  items,
}: {
  icon: LucideIcon;
  title: string;
  href: string;
  count: number;
  items: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>{count} linked to this campaign</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Nothing linked yet.
          </p>
        ) : (
          items.slice(0, 5).map((item, index) => (
            <p key={`${title}-${index}`} className="rounded-lg border p-3 text-sm">
              {item}
            </p>
          ))
        )}
        <ButtonLink href={href} variant="outline">
          Open {title}
        </ButtonLink>
      </CardContent>
    </Card>
  );
}
