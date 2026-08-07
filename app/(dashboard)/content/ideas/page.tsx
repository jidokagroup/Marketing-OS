import { Lightbulb } from "lucide-react";

import { requireUser } from "@/lib/auth";
import {
  asRows,
  isOpsSchemaMissing,
  opsTable,
  titleCase,
  type CampaignRow,
  type ClientOption,
  type ContentIdeaRow,
} from "@/lib/marketing-os/operations";
import { EmptyState } from "@/components/empty-state";
import { OpsSchemaNotice } from "@/components/ops-schema-notice";
import { PageHeader } from "@/components/page-header";
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
import { Textarea } from "@/components/ui/textarea";
import {
  createContentIdeaAction,
  updateContentIdeaStatusAction,
} from "./actions";

export const metadata = { title: "Content Ideas · Jidoka Marketing Team OS" };

type AgentOption = {
  id: string;
  name: string;
  client_id: string | null;
};

export default async function ContentIdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client = "" } = await searchParams;
  const { user, supabase } = await requireUser();
  const scopedClientId = client && client !== "all" ? client : "";
  let ideasQuery = opsTable(supabase, "marketing_os_content_ideas")
    .select("id, campaign_id, client_id, agent_id, title, description, source, format, platform, funnel_stage, status, created_at, updated_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  let campaignsQuery = opsTable(supabase, "marketing_os_campaigns")
    .select(
      "id, owner_id, client_id, name, campaign_type, status, stage, health, priority, goal, primary_kpi, target_audience, owner_name, budget, actual_spend, expected_revenue, attributed_revenue, lead_goal, leads_count, start_date, end_date, notes, created_at, updated_at",
    )
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });
  let agentsQuery = supabase
    .from("marketing_os_writing_agents")
    .select("id, name, client_id")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (scopedClientId) {
    ideasQuery = ideasQuery.eq("client_id", scopedClientId);
    campaignsQuery = campaignsQuery.eq("client_id", scopedClientId);
    agentsQuery = agentsQuery.eq("client_id", scopedClientId);
  }

  const [ideasResult, campaignsResult, clientsResult, agentsResult] =
    await Promise.all([
      ideasQuery,
      campaignsQuery,
      supabase
        .from("marketing_os_clients")
        .select("id, name, industry")
        .eq("owner_id", user.id)
        .order("name"),
      agentsQuery,
    ]);

  const schemaMissing = isOpsSchemaMissing(ideasResult.error);
  const ideas = schemaMissing ? [] : asRows<ContentIdeaRow>(ideasResult.data);
  const campaigns = schemaMissing
    ? []
    : asRows<CampaignRow>(campaignsResult.data);
  const clients = (clientsResult.data ?? []) as ClientOption[];
  const agents = (agentsResult.data ?? []) as AgentOption[];
  const campaignById = new Map(campaigns.map((item) => [item.id, item]));
  const clientById = new Map(clients.map((item) => [item.id, item]));
  const agentById = new Map(agents.map((item) => [item.id, item]));
  const latestAgentId = agents[0]?.id;

  return (
    <div className="space-y-6">
      <PageHeader
        title={scopedClientId ? "Client Ideas" : "Ideas"}
        description="Capture content ideas from strategy, intelligence, client notes, and team observations before generation."
      />

      {schemaMissing && <OpsSchemaNotice />}

      {!schemaMissing && (
        <Card>
          <CardHeader>
            <CardTitle>Create idea</CardTitle>
            <CardDescription>
              Attach an idea to a campaign so it can move into generation,
              approval, publishing, and performance review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={createContentIdeaAction}
              className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]"
            >
              <Input name="title" placeholder="Idea title" required />
              <select
                name="campaign_id"
                defaultValue=""
                className="flex h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">No campaign</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
              <select
                name="agent_id"
                defaultValue={latestAgentId ?? ""}
                className="flex h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">No agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
              <Button type="submit">Add idea</Button>
              <Textarea
                name="description"
                placeholder="What should be made and why?"
                className="lg:col-span-2"
              />
              <select
                name="client_id"
                defaultValue={scopedClientId}
                className="flex h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">No client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <Input name="source" placeholder="Source" defaultValue="manual" />
              <Input name="format" placeholder="Format" />
              <Input name="platform" placeholder="Platform" />
              <select
                name="funnel_stage"
                className="flex h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
              >
                {["awareness", "consideration", "conversion", "retention"].map(
                  (item) => (
                    <option key={item} value={item}>
                      {titleCase(item)}
                    </option>
                  ),
                )}
              </select>
            </form>
          </CardContent>
        </Card>
      )}

      {!schemaMissing && ideas.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No ideas captured"
          description="Save ideas from Intelligence or create one here to begin the content workflow."
        />
      ) : (
        !schemaMissing && (
          <div className="grid gap-4 lg:grid-cols-2">
            {ideas.map((idea) => {
              const campaign = idea.campaign_id
                ? campaignById.get(idea.campaign_id)
                : null;
              const client = idea.client_id
                ? clientById.get(idea.client_id)
                : null;
              const agent = idea.agent_id ? agentById.get(idea.agent_id) : null;
              const generateHref = idea.agent_id
                ? `/agents/${idea.agent_id}?tab=generate`
                : latestAgentId
                  ? `/agents/${latestAgentId}?tab=generate`
                  : "/agents";
              return (
                <Card key={idea.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle>{idea.title}</CardTitle>
                        <CardDescription>
                          {campaign?.name ?? client?.name ?? "General"} ·{" "}
                          {agent?.name ?? "No agent"} · {idea.source}
                        </CardDescription>
                      </div>
                      <Badge>{titleCase(idea.status)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {idea.description && (
                      <p className="text-sm text-muted-foreground">
                        {idea.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {idea.platform && (
                        <Badge variant="outline">{idea.platform}</Badge>
                      )}
                      {idea.format && (
                        <Badge variant="outline">{idea.format}</Badge>
                      )}
                      <Badge variant="secondary">
                        {titleCase(idea.funnel_stage)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ButtonLink href={generateHref} size="sm">
                        Generate
                      </ButtonLink>
                      {campaign && (
                        <ButtonLink
                          href={`/campaigns/${campaign.id}`}
                          size="sm"
                          variant="outline"
                        >
                          Campaign
                        </ButtonLink>
                      )}
                      {["briefed", "generating", "drafted", "approved", "dismissed"].map(
                        (status) => (
                          <form
                            key={status}
                            action={updateContentIdeaStatusAction}
                          >
                            <input type="hidden" name="id" value={idea.id} />
                            <input
                              type="hidden"
                              name="campaign_id"
                              value={idea.campaign_id ?? ""}
                            />
                            <input type="hidden" name="status" value={status} />
                            <Button
                              type="submit"
                              size="xs"
                              variant={
                                idea.status === status ? "default" : "outline"
                              }
                            >
                              {titleCase(status)}
                            </Button>
                          </form>
                        ),
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
