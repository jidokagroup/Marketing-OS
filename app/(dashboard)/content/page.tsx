import Link from "next/link";
import {
  Bot,
  CalendarDays,
  Clapperboard,
  FolderOpen,
  Globe2,
  Lightbulb,
  Sparkles,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import { isOpsSchemaMissing, opsTable } from "@/lib/marketing-os/operations";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Content · Jidoka Marketing Team OS" };

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; agent_id?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const { client: rawClient = "", agent_id: requestedAgentId = "" } =
    await searchParams;

  const [{ data: agents }, { data: clients }] = await Promise.all([
    supabase
      .from("marketing_os_writing_agents")
      .select("id, name, client_id")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("marketing_os_clients")
      .select("id, name")
      .eq("owner_id", user.id)
      .order("name"),
  ]);

  const agentList = agents ?? [];
  const requestedAgent = requestedAgentId
    ? agentList.find((agent) => agent.id === requestedAgentId)
    : null;
  const scopedClientId =
    rawClient === "all"
      ? ""
      : rawClient || requestedAgent?.client_id || agentList[0]?.client_id || "";
  const scopedClient = scopedClientId
    ? (clients ?? []).find((item) => item.id === scopedClientId)
    : null;
  const scopedAgents = scopedClientId
    ? agentList.filter((agent) => agent.client_id === scopedClientId)
    : agentList;
  const scopedAgentIds = scopedAgents.map((agent) => agent.id);
  const requestedAgentInScope = Boolean(
    requestedAgent && scopedAgents.some((agent) => agent.id === requestedAgent.id),
  );
  const activeAgent =
    (requestedAgentInScope ? requestedAgent : null) ?? scopedAgents[0] ?? null;
  const activeAgentParam =
    requestedAgentInScope && requestedAgent ? requestedAgent.id : "";
  const metricAgentIds = activeAgentParam ? [activeAgentParam] : scopedAgentIds;

  const scopedQuery = new URLSearchParams();
  if (scopedClientId) scopedQuery.set("client", scopedClientId);
  if (activeAgentParam) scopedQuery.set("agent_id", activeAgentParam);
  const scopedQueryString = scopedQuery.toString();
  const scopedSuffix = scopedQueryString ? `?${scopedQueryString}` : "";
  const schedulerParams = new URLSearchParams(scopedQuery);
  const schedulerSuffix = schedulerParams.toString()
    ? `?${schedulerParams.toString()}`
    : "";

  let generatedQuery = supabase
    .from("marketing_os_generated_content")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  let scheduledQuery = supabase
    .from("marketing_os_scheduled_posts")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  let assetQuery = supabase
    .from("marketing_os_uploaded_assets")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  let ideaQuery = opsTable(supabase, "marketing_os_content_ideas")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  if (scopedClientId) {
    generatedQuery = generatedQuery.in("agent_id", metricAgentIds);
    scheduledQuery = scheduledQuery.in("agent_id", metricAgentIds);
    assetQuery = assetQuery.in("agent_id", metricAgentIds);
    ideaQuery = ideaQuery.eq("client_id", scopedClientId);
  }

  const [
    generatedResult,
    scheduledResult,
    assetResult,
    ideaResult,
  ] =
    scopedClientId && metricAgentIds.length === 0
      ? await Promise.all([
          Promise.resolve({ count: 0 }),
          Promise.resolve({ count: 0 }),
          Promise.resolve({ count: 0 }),
          ideaQuery,
        ])
      : await Promise.all([
          generatedQuery,
          scheduledQuery,
          assetQuery,
          ideaQuery,
        ]);

  const generatorHref = activeAgent?.id
    ? `/agents/${activeAgent.id}?tab=generate`
    : scopedClientId
      ? `/agents/new?client_id=${scopedClientId}`
      : "/agents";
  const ideaCount = isOpsSchemaMissing(ideaResult.error)
    ? 0
    : (ideaResult.count ?? 0);
  const generatedCount = generatedResult.count ?? 0;
  const scheduledCount = scheduledResult.count ?? 0;
  const assetCount = assetResult.count ?? 0;

  const sections = [
    {
      title: "Content Generator",
      description:
        "Generate channel-ready content using each client agent's Brand Brain, Voice DNA, and the latest Market Intelligence context.",
      href: generatorHref,
      icon: Sparkles,
      metric: generatedCount ?? 0,
      metricLabel: "generated",
    },
    {
      title: "Market + Competitor Analysis",
      description:
        "Paste competitor websites and public social URLs to surface top hooks, topics, content patterns, and ideas for the selected client.",
      href: `/content/generator${scopedSuffix}`,
      icon: Globe2,
      metric: ideaCount,
      metricLabel: "ideas",
    },
    {
      title: "Film Scripts",
      description:
        "Batch-generate filming sessions and scripts across proven short-form formats.",
      href: "/film-session",
      icon: Clapperboard,
      metric: null,
      metricLabel: "sessions",
    },
    {
      title: "Smart Scheduler",
      description:
        "Create posts, bulk import CSVs, attach media, set comment-to-DM flows, and queue drafts.",
      href: `/scheduler${schedulerSuffix}`,
      icon: CalendarDays,
      metric: scheduledCount ?? 0,
      metricLabel: "scheduled",
    },
    {
      title: "Content Calendar",
      description:
        "View the next 12 months, select days, and edit captions, dates, and times.",
      href: `/calendar${scopedSuffix}`,
      icon: CalendarDays,
      metric: scheduledCount ?? 0,
      metricLabel: "items",
    },
    {
      title: "Assets Log",
      description:
        "Review uploaded assets and extracted memory used by client-specific agents.",
      href: `/content/assets${scopedSuffix}`,
      icon: FolderOpen,
      metric: assetCount ?? 0,
      metricLabel: "assets",
    },
    {
      title: "Ideas",
      description:
        "Turn Market Intelligence findings and manual notes into campaign-ready content ideas.",
      href: `/content/ideas${scopedSuffix}`,
      icon: Lightbulb,
      metric: ideaCount,
      metricLabel: "ideas",
    },
    {
      title: "Client Agents",
      description:
        "Create and train the writing agents that hold each client's Brand Brain and voice memory.",
      href: scopedClientId ? `/agents?client=${scopedClientId}` : "/agents",
      icon: Bot,
      metric: null,
      metricLabel: "agents",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={scopedClient ? `${scopedClient.name} Content` : "Content"}
        description="Create, script, schedule, and store content without splitting the workflow across disconnected tools."
      >
        <ButtonLink href={generatorHref}>Generate content</ButtonLink>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.title} href={section.href}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>{section.title}</CardTitle>
                    <CardDescription className="mt-2 leading-6">
                      {section.description}
                    </CardDescription>
                  </div>
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                {section.metric != null && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      <span className="text-lg font-semibold tabular-nums text-foreground">
                        {section.metric}
                      </span>{" "}
                      {section.metricLabel}
                    </p>
                  </CardContent>
                )}
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
