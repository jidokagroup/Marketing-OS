import Link from "next/link";
import {
  Bot,
  CalendarDays,
  Clapperboard,
  FolderOpen,
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

export default async function ContentPage() {
  const { user, supabase } = await requireUser();
  const [
    { count: generatedCount },
    { count: scheduledCount },
    { count: assetCount },
    ideaResult,
  ] = await Promise.all([
    supabase
      .from("marketing_os_generated_content")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id),
    supabase
      .from("marketing_os_scheduled_posts")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id),
    supabase
      .from("marketing_os_uploaded_assets")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id),
    opsTable(supabase, "marketing_os_content_ideas")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id),
  ]);

  const generatorHref = "/content/generator";
  const ideaCount = isOpsSchemaMissing(ideaResult.error)
    ? 0
    : (ideaResult.count ?? 0);

  const sections = [
    {
      title: "Content Generator",
      description:
        "Scan competitor and influencer watchlists, turn trends into on-brand ideas, and open the best ones in a client agent.",
      href: generatorHref,
      icon: Sparkles,
      metric: generatedCount ?? 0,
      metricLabel: "generated",
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
      href: "/scheduler",
      icon: CalendarDays,
      metric: scheduledCount ?? 0,
      metricLabel: "scheduled",
    },
    {
      title: "Content Calendar",
      description:
        "View the next 12 months, select days, and edit captions, dates, and times.",
      href: "/calendar",
      icon: CalendarDays,
      metric: scheduledCount ?? 0,
      metricLabel: "items",
    },
    {
      title: "Assets Log",
      description:
        "Review uploaded assets and extracted memory used by client-specific agents.",
      href: "/content/assets",
      icon: FolderOpen,
      metric: assetCount ?? 0,
      metricLabel: "assets",
    },
    {
      title: "Ideas",
      description:
        "Turn Intelligence findings and manual notes into campaign-ready content ideas.",
      href: "/content/ideas",
      icon: Lightbulb,
      metric: ideaCount,
      metricLabel: "ideas",
    },
    {
      title: "Client Agents",
      description:
        "Create and train the writing agents that hold each client's Brand Brain and voice memory.",
      href: "/agents",
      icon: Bot,
      metric: null,
      metricLabel: "agents",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
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
