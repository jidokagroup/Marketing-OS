import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Brain,
  CalendarClock,
  Inbox,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { deleteClientAction } from "./actions";

export const metadata = { title: "Clients · Jidoka Marketing Team OS" };

export default async function ClientsPage() {
  const { supabase } = await requireUser();

  const [
    { data: clients },
    { data: agents },
    { data: generated },
    { data: posts },
    { data: accounts },
  ] =
    await Promise.all([
      supabase
        .from("marketing_os_clients")
        .select("id, name, industry, notes, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("marketing_os_writing_agents")
        .select("id, client_id, name, status, last_analyzed_at")
        .order("created_at", { ascending: false }),
      supabase.from("marketing_os_generated_content").select("id, agent_id"),
      supabase
        .from("marketing_os_scheduled_posts")
        .select("id, agent_id, status, comment_dm_enabled"),
      supabase.from("marketing_os_social_accounts").select("agent_id, status"),
    ]);

  const agentsByClient = new Map<string, NonNullable<typeof agents>>();
  for (const agent of agents ?? []) {
    if (!agent.client_id) continue;
    const list = agentsByClient.get(agent.client_id) ?? [];
    list.push(agent);
    agentsByClient.set(agent.client_id, list);
  }
  const generatedByAgent = new Map<string, number>();
  for (const item of generated ?? []) {
    generatedByAgent.set(item.agent_id, (generatedByAgent.get(item.agent_id) ?? 0) + 1);
  }
  const postsByAgent = new Map<string, number>();
  const inboxByAgent = new Map<string, number>();
  for (const post of posts ?? []) {
    postsByAgent.set(post.agent_id, (postsByAgent.get(post.agent_id) ?? 0) + 1);
    if (post.comment_dm_enabled) {
      inboxByAgent.set(post.agent_id, (inboxByAgent.get(post.agent_id) ?? 0) + 1);
    }
  }
  const connectedAgents = new Set(
    (accounts ?? [])
      .filter((account) => account.status === "active")
      .map((account) => account.agent_id),
  );

  return (
    <div>
      <PageHeader title="Clients" description="The brands and creators you write for.">
        <ButtonLink href="/clients/new">
          <Plus className="mr-1 h-4 w-4" /> New Client
        </ButtonLink>
      </PageHeader>

      {!clients || clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Add a client to group the Client Content Agents you build for them."
          actionLabel="Add your first client"
          actionHref="/clients/new"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => {
            const clientAgents = agentsByClient.get(c.id) ?? [];
            const generatedCount = clientAgents.reduce(
              (sum, agent) => sum + (generatedByAgent.get(agent.id) ?? 0),
              0,
            );
            const postCount = clientAgents.reduce(
              (sum, agent) => sum + (postsByAgent.get(agent.id) ?? 0),
              0,
            );
            const inboxCount = clientAgents.reduce(
              (sum, agent) => sum + (inboxByAgent.get(agent.id) ?? 0),
              0,
            );
            const connectedAgentCount = clientAgents.filter((agent) =>
              connectedAgents.has(agent.id),
            ).length;
            return (
            <Card key={c.id}>
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/clients/${c.id}`} className="font-semibold hover:underline">
                    {c.name}
                  </Link>
                  {c.industry && <Badge variant="secondary">{c.industry}</Badge>}
                </div>
                {c.notes && (
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {c.notes}
                  </p>
                )}

                <div className="grid gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Bot className="h-3.5 w-3.5" />
                    {clientAgents.length} Client Content Agent{clientAgents.length === 1 ? "" : "s"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" />
                    {connectedAgentCount} agent
                    {connectedAgentCount === 1 ? "" : "s"} with connected accounts
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5" />
                    {generatedCount} generated piece{generatedCount === 1 ? "" : "s"}
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {postCount} scheduled item{postCount === 1 ? "" : "s"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Inbox className="h-3.5 w-3.5" />
                    {inboxCount} Inbox review item{inboxCount === 1 ? "" : "s"}
                  </div>
                </div>

                {clientAgents.length > 0 && (
                  <div className="space-y-1 rounded-md bg-muted/30 p-3">
                    {clientAgents.slice(0, 3).map((agent) => (
                      <Link
                        key={agent.id}
                        href={`/agents/${agent.id}`}
                        className="flex items-center justify-between gap-2 text-sm hover:text-primary"
                      >
                        <span className="truncate">{agent.name}</span>
                        <Badge variant={agent.status === "ready" ? "default" : "outline"}>
                          {agent.status}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <ButtonLink href={`/clients/${c.id}`} variant="outline" size="sm">
                    View client
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </ButtonLink>
                  <ButtonLink href={`/clients/${c.id}#inbox`} variant="outline" size="sm">
                    <Inbox className="mr-1 h-3.5 w-3.5" />
                    Inbox
                  </ButtonLink>
                  <ButtonLink href={`/clients/${c.id}#brand-brain`} variant="outline" size="sm">
                    <Brain className="mr-1 h-3.5 w-3.5" />
                    Brand Brain
                  </ButtonLink>
                  <ButtonLink
                    href={`/agents/new?client_id=${c.id}`}
                    variant="outline"
                    size="sm"
                  >
                    Create Client Content Agent
                  </ButtonLink>
                </div>

                <form action={deleteClientAction} className="pt-1">
                  <input type="hidden" name="id" value={c.id} />
                  <ConfirmSubmitButton
                    message={`Remove ${c.name}? This cannot be undone.`}
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                  </ConfirmSubmitButton>
                </form>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
