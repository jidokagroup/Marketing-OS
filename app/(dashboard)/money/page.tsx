import { Wallet } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { campaignRevenue, campaignRoi, formatRoi } from "@/lib/campaign-money";
import {
  asRows,
  formatDate,
  formatMoney,
  isOpsSchemaMissing,
  opsTable,
  titleCase,
  type CampaignRow,
  type ClientOption,
  type RevenueEventRow,
} from "@/lib/marketing-os/operations";
import { EmptyState } from "@/components/empty-state";
import { OpsSchemaNotice } from "@/components/ops-schema-notice";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Money · Jidoka Marketing Team OS" };

export default async function MoneyPage() {
  const { user, supabase } = await requireUser();

  const campaignsResult = await opsTable(supabase, "marketing_os_campaigns")
    .select(
      "id, owner_id, client_id, name, campaign_type, status, stage, health, priority, goal, primary_kpi, target_audience, owner_name, budget, actual_spend, expected_revenue, attributed_revenue, lead_goal, leads_count, start_date, end_date, notes, created_at, updated_at",
    )
    .eq("owner_id", user.id)
    .order("actual_spend", { ascending: false });
  const schemaMissing = isOpsSchemaMissing(campaignsResult.error);

  const [revenueResult, clientsResult] = await Promise.all([
    schemaMissing
      ? Promise.resolve({ data: null })
      : opsTable(supabase, "marketing_os_revenue_events")
          .select("id, campaign_id, client_id, amount, event_type, occurred_at, attributed_content_id, notes")
          .eq("owner_id", user.id)
          .order("occurred_at", { ascending: false })
          .limit(50),
    supabase.from("marketing_os_clients").select("id, name, industry").eq("owner_id", user.id),
  ]);

  const campaigns = schemaMissing ? [] : asRows<CampaignRow>(campaignsResult.data);
  const revenue = schemaMissing
    ? []
    : asRows<
        RevenueEventRow & { attributed_content_id: string | null; notes: string | null }
      >(revenueResult.data);
  const clients = (clientsResult.data ?? []) as ClientOption[];
  const clientById = new Map(clients.map((item) => [item.id, item]));
  const campaignById = new Map(campaigns.map((item) => [item.id, item]));

  const totalBudget = campaigns.reduce((sum, c) => sum + Number(c.budget || 0), 0);
  const totalSpend = campaigns.reduce((sum, c) => sum + Number(c.actual_spend || 0), 0);
  const totalExpected = campaigns.reduce((sum, c) => sum + Number(c.expected_revenue || 0), 0);
  // Per campaign, from the same helper the campaign page uses, so the two
  // cannot report different revenue for the same record.
  const revenueByCampaign = new Map(
    campaigns.map((campaign) => [campaign.id, campaignRevenue(campaign, revenue)]),
  );
  const totalAttributed = campaigns.reduce(
    (sum, c) => sum + (revenueByCampaign.get(c.id) ?? 0),
    0,
  );
  const realizedRevenue = revenue
    .filter((event) => !["refund"].includes(event.event_type))
    .reduce((sum, event) => sum + Number(event.amount || 0), 0);
  const refunded = revenue
    .filter((event) => event.event_type === "refund")
    .reduce((sum, event) => sum + Number(event.amount || 0), 0);
  const netRevenue = realizedRevenue - refunded;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Money"
        description="Budget, spend, and the revenue actually attributed back to the content and campaigns that produced it."
      />

      {schemaMissing && <OpsSchemaNotice title="Money needs migration 0016" />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Spend</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(totalSpend)}</p>
            <p className="text-xs text-muted-foreground">of {formatMoney(totalBudget)} budgeted</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Attributed revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(totalAttributed)}</p>
            <p className="text-xs text-muted-foreground">of {formatMoney(totalExpected)} expected</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net realized revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(netRevenue)}</p>
            <p className="text-xs text-muted-foreground">
              {formatMoney(realizedRevenue)} recorded, {formatMoney(refunded)} refunded
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Blended ROI</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatRoi(totalSpend > 0 ? totalAttributed / totalSpend : null)}</p>
            <p className="text-xs text-muted-foreground">attributed revenue ÷ spend</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaigns by spend</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No campaigns yet"
              description="Once a campaign records budget and spend, its return shows up here next to what it was expected to earn."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Spend</TableHead>
                  <TableHead>Attributed</TableHead>
                  <TableHead>ROI</TableHead>
                  <TableHead>Health</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => {
                  const client = campaign.client_id ? clientById.get(campaign.client_id) : null;
                  return (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.name}</TableCell>
                      <TableCell className="text-muted-foreground">{client?.name ?? "—"}</TableCell>
                      <TableCell>{formatMoney(campaign.actual_spend)}</TableCell>
                      <TableCell>
                        {formatMoney(revenueByCampaign.get(campaign.id) ?? 0)}
                      </TableCell>
                      <TableCell>
                        {formatRoi(
                          campaignRoi(
                            campaign,
                            revenueByCampaign.get(campaign.id) ?? 0,
                          ),
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={campaign.health === "on_track" ? "default" : "outline"}>
                          {titleCase(campaign.health)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent revenue events</CardTitle>
        </CardHeader>
        <CardContent>
          {revenue.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Revenue events recorded from campaigns will appear here, each traced to the campaign or content that earned it.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenue.map((event) => {
                  const campaign = event.campaign_id ? campaignById.get(event.campaign_id) : null;
                  const client = event.client_id ? clientById.get(event.client_id) : null;
                  return (
                    <TableRow key={event.id}>
                      <TableCell className="text-muted-foreground">{formatDate(event.occurred_at)}</TableCell>
                      <TableCell>
                        <Badge variant={event.event_type === "refund" ? "destructive" : "outline"}>
                          {titleCase(event.event_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>{campaign?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{client?.name ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(event.amount)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
