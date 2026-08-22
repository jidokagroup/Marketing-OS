import Link from "next/link";
import { Target } from "lucide-react";

import { requireUser } from "@/lib/auth";
import {
  asRows,
  formatDate,
  formatMoney,
  isOpsSchemaMissing,
  opsTable,
  progressPercent,
  titleCase,
  type CampaignRow,
  type ClientOption,
} from "@/lib/marketing-os/operations";
import { EmptyState } from "@/components/empty-state";
import { ErrorNotice } from "@/components/error-notice";
import { OpsSchemaNotice } from "@/components/ops-schema-notice";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createCampaignAction } from "./actions";

export const metadata = { title: "Paid Ad Campaigns · Jidoka Marketing Team OS" };

export default async function CampaignsPage() {
  const { user, supabase } = await requireUser();
  const [{ data: clients }, campaignsResult] = await Promise.all([
    supabase
      .from("marketing_os_clients")
      .select("id, name, industry")
      .eq("owner_id", user.id)
      .order("name"),
    opsTable(supabase, "marketing_os_campaigns")
      .select(
        "id, owner_id, client_id, name, campaign_type, status, stage, health, priority, goal, primary_kpi, target_audience, owner_name, budget, actual_spend, expected_revenue, attributed_revenue, lead_goal, leads_count, start_date, end_date, notes, created_at, updated_at",
      )
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false }),
  ]);

  const schemaMissing = isOpsSchemaMissing(campaignsResult.error);
  const campaigns = schemaMissing
    ? []
    : asRows<CampaignRow>(campaignsResult.data);
  const clientRows = (clients ?? []) as ClientOption[];
  const clientById = new Map(clientRows.map((client) => [client.id, client]));
  const active = campaigns.filter((campaign) =>
    ["planning", "active"].includes(campaign.status),
  );
  const revenue = campaigns.reduce(
    (sum, campaign) => sum + Number(campaign.attributed_revenue ?? 0),
    0,
  );
  const budget = campaigns.reduce(
    (sum, campaign) => sum + Number(campaign.budget ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paid Ad Campaigns"
        description="Plan and run paid client acquisition campaigns with budgets, channels, work, leads, revenue, and insights connected."
      />

      {schemaMissing && <OpsSchemaNotice />}
      {/* This printed the database's own message straight onto the page. */}
      {!schemaMissing && campaignsResult.error && (
        <ErrorNotice error={campaignsResult.error} action="load campaigns" />
      )}

      {!schemaMissing && (
        <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardHeader>
              <CardTitle>Create paid ad campaign</CardTitle>
              <CardDescription>
                Start with the strategy, dates, owner, budget, and success
                metric. More detail lives inside the campaign brief.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createCampaignAction} className="space-y-3">
                <Input name="name" placeholder="Campaign name" required />
                <select
                  name="client_id"
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  defaultValue=""
                >
                  <option value="">No client / internal campaign</option>
                  {clientRows.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                      {client.industry ? ` · ${client.industry}` : ""}
                    </option>
                  ))}
                </select>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input name="campaign_type" placeholder="Campaign type" />
                  <Input name="owner_name" placeholder="Owner" />
                </div>
                <Textarea
                  name="goal"
                  placeholder="Goal, audience, and outcome"
                  rows={3}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input name="primary_kpi" placeholder="Primary KPI" />
                  <Input name="target_audience" placeholder="Target audience" />
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input name="budget" type="number" min="0" placeholder="Budget" />
                  <Input
                    name="expected_revenue"
                    type="number"
                    min="0"
                    placeholder="Revenue goal"
                  />
                  <Input
                    name="lead_goal"
                    type="number"
                    min="0"
                    placeholder="Lead goal"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input name="start_date" type="date" aria-label="Start date" />
                  <Input name="end_date" type="date" aria-label="End date" />
                </div>
                <Button type="submit" className="w-full">
                  Create paid ad campaign
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  Active paid campaigns
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold tabular-nums">
                {active.length}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  Budget
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold tabular-nums">
                {formatMoney(budget)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  Revenue
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold tabular-nums">
                {formatMoney(revenue)}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!schemaMissing && campaigns.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No campaigns yet"
          description="Create the first paid campaign to connect strategy, work, content, publishing, leads, revenue, and insights."
        />
      ) : (
        !schemaMissing && (
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const client = campaign.client_id
                ? clientById.get(campaign.client_id)
                : null;
              const stages = [
                "strategy",
                "work",
                "content",
                "approval",
                "publishing",
                "leads",
                "revenue",
                "insights",
                "improvement",
              ];
              const percent = progressPercent(
                stages.indexOf(campaign.stage) + 1,
                stages.length,
              );
              return (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  className="block rounded-lg border p-4 transition-colors hover:border-primary/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{campaign.name}</h2>
                        <Badge variant="outline">{titleCase(campaign.status)}</Badge>
                        <Badge variant="secondary">{titleCase(campaign.stage)}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {client?.name ?? "Internal"} · {campaign.primary_kpi ?? "No KPI yet"}
                      </p>
                      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                        {campaign.goal ?? "Open the campaign to add the strategy brief."}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium">{formatMoney(campaign.budget)}</p>
                      <p className="text-muted-foreground">
                        {formatDate(campaign.start_date)} →{" "}
                        {formatDate(campaign.end_date)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
