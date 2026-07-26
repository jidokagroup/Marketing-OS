import { Plus, Bot, ArrowRight, Plug, Sparkles, Fingerprint } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { AgentStatusBadge } from "@/components/agent-status-badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { AgentStatus } from "@/lib/supabase/types";

export const metadata = { title: "Client Content Agents · Jidoka Marketing Team OS" };

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string; reason?: string }>;
}) {
  const { connect, reason } = await searchParams;
  const { supabase } = await requireUser();

  const [{ data: agents }, { data: accounts }] =
    await Promise.all([
      supabase
        .from("marketing_os_writing_agents")
        .select("id, name, industry, platform, status, last_analyzed_at, clients:marketing_os_clients(name)")
        .order("created_at", { ascending: false }),
      supabase.from("marketing_os_social_accounts").select("agent_id, status"),
    ]);

  const activeConnections = new Map<string, number>();
  for (const account of accounts ?? []) {
    if (account.status !== "active") continue;
    activeConnections.set(
      account.agent_id,
      (activeConnections.get(account.agent_id) ?? 0) + 1,
    );
  }

  return (
    <div>
      <PageHeader
        title="Client Content Agents"
        description="Client-specific agents that replicate a creator's voice."
      >
        <ButtonLink href="/agents/new">
          <Plus className="mr-1 h-4 w-4" /> New Agent
        </ButtonLink>
      </PageHeader>

      <ConnectionNotice status={connect} reason={reason} />

      {!agents || agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No Client Content Agents yet"
          description="Create an agent, upload the creator's content, and run Voice Intelligence Analysis."
          actionLabel="Create your first agent"
          actionHref="/agents/new"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => {
            const client = a.clients as unknown as { name: string } | null;
            const connectionCount = activeConnections.get(a.id) ?? 0;
            const nextStep =
              a.status !== "ready"
                ? "Upload files and run analysis"
                : connectionCount === 0
                    ? "Connect accounts"
                    : "Generate or schedule content";
            const progressSteps = [
              a.status === "ready",
              connectionCount > 0,
            ];
            const progress = Math.round(
              (progressSteps.filter(Boolean).length / progressSteps.length) * 100,
            );
            const actionHref =
              a.status !== "ready"
                ? `/agents/${a.id}?tab=assets`
                : connectionCount === 0
                    ? `/agents/${a.id}?tab=connections`
                    : `/agents/${a.id}?tab=generate`;
            const actionLabel =
              a.status !== "ready"
                ? "Open assets"
                : connectionCount === 0
                    ? "Open connections"
                    : "Generate content";
            return (
              <Card key={a.id} className="h-full">
                <CardContent className="space-y-4 pt-6">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold">{a.name}</h3>
                      <AgentStatusBadge status={a.status as AgentStatus} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {client?.name && (
                        <Badge variant="outline">{client.name}</Badge>
                      )}
                      {a.industry && <Badge variant="secondary">{a.industry}</Badge>}
                      {a.platform && <Badge variant="secondary">{a.platform}</Badge>}
                    </div>

                    <div className="rounded-md bg-muted/30 p-3 text-sm">
                      <p className="font-medium">Next: {nextStep}</p>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Setup progress</span>
                        <span>{progress}%</span>
                      </div>
                      <Progress value={progress} className="mt-2" />
                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Fingerprint className="h-3.5 w-3.5" />
                          {a.status === "ready" ? "Voice and knowledge ready" : "Needs analysis"}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Plug className="h-3.5 w-3.5" />
                          {connectionCount} connected account{connectionCount === 1 ? "" : "s"}
                        </span>
                        <span>
                          Last analysis:{" "}
                          {a.last_analyzed_at
                            ? new Date(a.last_analyzed_at).toLocaleDateString()
                            : "not yet"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <ButtonLink href={actionHref} size="sm">
                        {actionLabel}
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </ButtonLink>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <ButtonLink href={`/agents/${a.id}?tab=assets`} variant="link" size="xs" className="h-auto p-0">
                          Workspace
                        </ButtonLink>
                        <ButtonLink href={`/agents/${a.id}?tab=generate`} variant="link" size="xs" className="h-auto p-0">
                          <Sparkles className="mr-1 h-3 w-3" />
                          Generate
                        </ButtonLink>
                      </div>
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

function ConnectionNotice({
  status,
  reason,
}: {
  status?: string;
  reason?: string;
}) {
  if (!status) return null;

  const title =
    status === "session_error"
      ? "Connection session expired"
      : status === "not_configured"
        ? "Connection needs API setup"
        : status === "success"
          ? "Account connected"
          : "Connection failed";
  const message =
    reason ??
    (status === "session_error"
      ? "Start the connection again from the agent's Connections tab."
      : status === "not_configured"
        ? "Add the required platform keys in Vercel, redeploy, then try again."
        : status === "success"
          ? "The account was connected successfully."
          : "Open the agent's Connections tab and try again.");

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-medium">{title}</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}
