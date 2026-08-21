import { TrendingUp } from "lucide-react";

import { requireUser } from "@/lib/auth";
import {
  asRows,
  formatDate,
  formatMoney,
  isOpsSchemaMissing,
  opsTable,
  titleCase,
  type CampaignRow,
  type ClientOption,
  type LeadRow,
} from "@/lib/marketing-os/operations";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";
import { createPipelineLeadAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OpsSchemaNotice } from "@/components/ops-schema-notice";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Pipeline · Jidoka Marketing Team OS" };

const STAGE_ORDER = [
  "new",
  "qualified",
  "mql",
  "sql",
  "opportunity",
  "customer",
  "lost",
] as const;

function stageBadgeVariant(status: string) {
  if (status === "customer") return "default" as const;
  if (status === "lost") return "destructive" as const;
  if (status === "opportunity" || status === "sql") return "secondary" as const;
  return "outline" as const;
}

export default async function PipelinePage() {
  const { user, supabase } = await requireUser();

  const leadsResult = await opsTable(supabase, "marketing_os_leads")
    .select(
      "id, campaign_id, client_id, lead_name, email, status, source_channel, estimated_value, actual_value, converted_at, created_at, outreach_stage, next_attempt_at",
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  const schemaMissing = isOpsSchemaMissing(leadsResult.error);

  const [campaignsResult, clientsResult] = await Promise.all([
    schemaMissing
      ? Promise.resolve({ data: null })
      : opsTable(supabase, "marketing_os_campaigns")
          .select("id, owner_id, client_id, name, campaign_type, status, stage, health, priority, goal, primary_kpi, target_audience, owner_name, budget, actual_spend, expected_revenue, attributed_revenue, lead_goal, leads_count, start_date, end_date, notes, created_at, updated_at")
          .eq("owner_id", user.id),
    supabase.from("marketing_os_clients").select("id, name, industry").eq("owner_id", user.id),
  ]);

  const leads = schemaMissing
    ? []
    : asRows<
        LeadRow & {
          source_channel: string | null;
          converted_at: string | null;
          outreach_stage: string | null;
          next_attempt_at: string | null;
        }
      >(leadsResult.data);

  // Attempt counts drive the "Draft #N" label, so the button always offers the
  // next touch rather than repeating one that already exists.
  const attemptsResult =
    leads.length > 0
      ? await opsTable(supabase, "marketing_os_acquisition_attempts")
          .select("lead_id, attempt_no, channel, status, verification")
          .eq("owner_id", user.id)
          .in(
            "lead_id",
            leads.map((lead) => lead.id),
          )
      : { data: null, error: null };
  const attempts = isOpsSchemaMissing(attemptsResult.error)
    ? []
    : asRows<{
        lead_id: string;
        attempt_no: number;
        channel: string;
        status: string;
        verification: { verdict?: string; issues?: string[] } | null;
      }>(attemptsResult.data);
  const attemptsByLead = new Map<string, typeof attempts>();
  for (const attempt of attempts) {
    const list = attemptsByLead.get(attempt.lead_id) ?? [];
    list.push(attempt);
    attemptsByLead.set(attempt.lead_id, list);
  }
  const campaigns = schemaMissing ? [] : asRows<CampaignRow>(campaignsResult.data);
  const clients = (clientsResult.data ?? []) as ClientOption[];
  const campaignById = new Map(campaigns.map((item) => [item.id, item]));
  const clientById = new Map(clients.map((item) => [item.id, item]));

  const byStage = new Map<string, typeof leads>();
  for (const stage of STAGE_ORDER) byStage.set(stage, []);
  for (const lead of leads) {
    const bucket = byStage.get(lead.status) ?? byStage.get("new")!;
    bucket.push(lead);
  }

  const openValue = leads
    .filter((lead) => lead.status !== "customer" && lead.status !== "lost")
    .reduce((sum, lead) => sum + Number(lead.estimated_value ?? 0), 0);
  const wonValue = leads
    .filter((lead) => lead.status === "customer")
    .reduce((sum, lead) => sum + Number(lead.actual_value || lead.estimated_value || 0), 0);
  const wonCount = leads.filter((lead) => lead.status === "customer").length;
  const winRate = leads.length ? Math.round((wonCount / leads.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description="Every lead traced from the content, campaign, or acquisition automation that brought it in, through to won or lost."
      />

      {schemaMissing && <OpsSchemaNotice title="Pipeline needs migration 0016" />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open pipeline value</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatMoney(openValue)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Won value</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatMoney(wonValue)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Win rate</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{winRate}%</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add a prospect</CardTitle>
          <p className="text-sm text-muted-foreground">
            Evidence is what the first touch opens on &mdash; something specific they said, posted or
            shipped. Without it the opener is generic, and a generic opener is the message people
            delete.
          </p>
        </CardHeader>
        <CardContent>
          <form action={createPipelineLeadAction} className="grid gap-2 sm:grid-cols-2">
            <Input name="lead_name" placeholder="Name *" required aria-label="Name" />
            <select
              name="client_id"
              required
              aria-label="Client"
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Acquiring for which client? *</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <Input name="company" placeholder="Company" aria-label="Company" />
            <Input name="email" type="email" placeholder="Email" aria-label="Email" />
            <Input name="linkedin_url" placeholder="LinkedIn URL" aria-label="LinkedIn URL" />
            <Input name="source_channel" placeholder="Found via (linkedin, referral…)" aria-label="Source" />
            <Input name="source_url" placeholder="Source URL" aria-label="Source URL" />
            <Input
              name="estimated_value"
              type="number"
              min="0"
              placeholder="Estimated value"
              aria-label="Estimated value"
            />
            <Textarea
              name="evidence"
              rows={2}
              className="sm:col-span-2"
              placeholder="Evidence — what they posted, said, or shipped that makes this relevant"
              aria-label="Evidence"
            />
            <div className="sm:col-span-2">
              <Button type="submit" size="sm">Add prospect</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {leads.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No leads yet"
          description="Leads created by acquisition automations, comment-to-DM flows, or manual entry will show up here, staged from new through won or lost."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-4 xl:grid-cols-7">
          {STAGE_ORDER.map((stage) => {
            const stageLeads = byStage.get(stage) ?? [];
            return (
              <div key={stage} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {titleCase(stage)}
                  </span>
                  <span className="text-xs text-muted-foreground">{stageLeads.length}</span>
                </div>
                <div className="space-y-2">
                  {stageLeads.map((lead) => {
                    const campaign = lead.campaign_id ? campaignById.get(lead.campaign_id) : null;
                    const client = lead.client_id ? clientById.get(lead.client_id) : null;
                    return (
                      <Card key={lead.id} className="shadow-sm">
                        <CardContent className="space-y-1.5 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-tight">
                              {lead.lead_name || lead.email || "Unnamed lead"}
                            </p>
                            <Badge variant={stageBadgeVariant(lead.status)} className="shrink-0">
                              {titleCase(lead.status)}
                            </Badge>
                          </div>
                          {client && (
                            <p className="text-xs text-muted-foreground">{client.name}</p>
                          )}
                          {campaign && (
                            <p className="text-xs text-muted-foreground">via {campaign.name}</p>
                          )}
                          {lead.source_channel && (
                            <p className="text-xs text-muted-foreground">{titleCase(lead.source_channel)}</p>
                          )}
                          <p className="text-sm font-semibold">
                            {formatMoney(lead.status === "customer" ? lead.actual_value : lead.estimated_value)}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDate(lead.created_at)}</p>
                          {(() => {
                            const leadAttempts = attemptsByLead.get(lead.id) ?? [];
                            const held = leadAttempts.filter(
                              (a) => a.verification?.verdict === "rejected",
                            ).length;
                            return (
                              <div className="space-y-1.5 border-t pt-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Badge variant="outline" className="font-normal">
                                    {titleCase(lead.outreach_stage ?? "Daily Queue")}
                                  </Badge>
                                  {held > 0 && (
                                    <Badge variant="destructive">{held} held</Badge>
                                  )}
                                </div>
                                {lead.next_attempt_at && (
                                  <p className="text-xs text-muted-foreground">
                                    Next touch {formatDate(lead.next_attempt_at)}
                                  </p>
                                )}
                                <Link
                                  href={`/pipeline/${lead.id}`}
                                  className="inline-block text-xs font-medium text-primary hover:underline"
                                >
                                  {leadAttempts.length === 0
                                    ? "Start sequence →"
                                    : `${leadAttempts.length} touch${leadAttempts.length === 1 ? "" : "es"} →`}
                                </Link>
                              </div>
                            );
                          })()}
                        </CardContent>
                      </Card>
                    );
                  })}
                  {stageLeads.length === 0 && (
                    <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                      Empty
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
