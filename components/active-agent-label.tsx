"use client";

import { usePathname, useSearchParams } from "next/navigation";

export type ActiveAgentOption = {
  id: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
};

function formatAgentLabel(agent: ActiveAgentOption) {
  return `${agent.clientName ? `${agent.clientName}'s Agent` : "Client Agent"}: ${agent.name}`;
}

export function ActiveAgentLabel({
  agents,
}: {
  agents: ActiveAgentOption[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const agentMatch = pathname.match(/^\/agents\/([^/]+)/);
  const clientMatch = pathname.match(/^\/clients\/([^/]+)/);
  const agentId =
    searchParams.get("agent_id") ||
    (agentMatch?.[1] && agentMatch[1] !== "new" ? agentMatch[1] : null);
  const clientId =
    searchParams.get("client") ||
    (clientMatch?.[1] && clientMatch[1] !== "new" ? clientMatch[1] : null);

  const activeAgent = agentId
    ? agents.find((agent) => agent.id === agentId)
    : null;
  if (activeAgent) {
    return <p className="truncate text-sm font-medium">{formatAgentLabel(activeAgent)}</p>;
  }

  if (clientId) {
    const clientAgents = agents.filter((agent) => agent.clientId === clientId);
    if (clientAgents.length === 1) {
      return (
        <p className="truncate text-sm font-medium">
          {formatAgentLabel(clientAgents[0])}
        </p>
      );
    }
    if (clientAgents.length > 1) {
      const clientName = clientAgents[0].clientName ?? "Client";
      return (
        <p className="truncate text-sm font-medium">
          {clientName}&apos;s Agents
        </p>
      );
    }
  }

  const latestAgent = agents[0];
  return (
    <p className="truncate text-sm font-medium">
      {latestAgent ? formatAgentLabel(latestAgent) : "No client agent selected"}
    </p>
  );
}
