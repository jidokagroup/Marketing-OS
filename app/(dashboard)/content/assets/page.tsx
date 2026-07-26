import { FolderOpen } from "lucide-react";

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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Assets · Jidoka Marketing Team OS" };

type MediaAsset = {
  id: string;
  campaign_id: string | null;
  title: string | null;
  file_name: string;
  media_type: string;
  platform_fit: string[];
  tags: string[];
  created_at: string;
};

export default async function AssetsPage() {
  const { user, supabase } = await requireUser();
  const [mediaResult, campaignsResult, uploadedResult] = await Promise.all([
    opsTable(supabase, "marketing_os_media_assets")
      .select("id, campaign_id, title, file_name, media_type, platform_fit, tags, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    opsTable(supabase, "marketing_os_campaigns")
      .select(
        "id, owner_id, client_id, name, campaign_type, status, stage, health, priority, goal, primary_kpi, target_audience, owner_name, budget, actual_spend, expected_revenue, attributed_revenue, lead_goal, leads_count, start_date, end_date, notes, created_at, updated_at",
      )
      .eq("owner_id", user.id),
    supabase
      .from("marketing_os_uploaded_assets")
      .select("id, title, kind, status, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const schemaMissing = isOpsSchemaMissing(mediaResult.error);
  const assets = schemaMissing ? [] : asRows<MediaAsset>(mediaResult.data);
  const campaigns = schemaMissing
    ? []
    : asRows<CampaignRow>(campaignsResult.data);
  const campaignById = new Map(campaigns.map((item) => [item.id, item]));
  const uploaded = uploadedResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        description="Manage campaign-ready creative assets, uploads, platform fit, and source materials."
      >
        <ButtonLink href="/agents" variant="outline">
          Upload through agent
        </ButtonLink>
      </PageHeader>

      {schemaMissing && <OpsSchemaNotice />}

      {!schemaMissing && assets.length === 0 && uploaded.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No assets found"
          description="Upload files through a Client Content Agent or attach media to scheduled posts."
          actionLabel="Open Client Content Agents"
          actionHref="/agents"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Campaign media assets</CardTitle>
              <CardDescription>
                Assets linked to campaigns through the operating-system schema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {assets.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No campaign-linked media assets yet.
                </p>
              ) : (
                assets.map((asset) => {
                  const campaign = asset.campaign_id
                    ? campaignById.get(asset.campaign_id)
                    : null;
                  return (
                    <div key={asset.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {asset.title ?? asset.file_name}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {campaign?.name ?? "No campaign"} ·{" "}
                            {formatDate(asset.created_at)}
                          </p>
                        </div>
                        <Badge>{titleCase(asset.media_type)}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(asset.platform_fit ?? []).map((item) => (
                          <Badge key={item} variant="outline">
                            {item}
                          </Badge>
                        ))}
                        {(asset.tags ?? []).map((item) => (
                          <Badge key={item} variant="secondary">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Uploaded source files</CardTitle>
              <CardDescription>
                Existing agent uploads remain available for Brand Brain,
                generation, and analysis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {uploaded.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No uploaded source files found.
                </p>
              ) : (
                uploaded.map((asset) => (
                  <div key={asset.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {asset.title ?? "Untitled upload"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {asset.kind ?? "asset"} · {formatDate(asset.created_at)}
                        </p>
                      </div>
                      <Badge variant="outline">{asset.status}</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
