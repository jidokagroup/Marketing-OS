import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

import { requireUser } from "@/lib/auth";
import {
  CORE_AGENT_BY_KEY,
  CORE_AGENTS,
  type CoreAgentKey,
} from "@/lib/core-agents";
import {
  asRow,
  isOpsSchemaMissing,
  opsTable,
  titleCase,
} from "@/lib/marketing-os/operations";
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
import { Textarea } from "@/components/ui/textarea";
import { saveCoreAgentTrainingAction } from "../actions";

export function generateStaticParams() {
  return CORE_AGENTS.map((agent) => ({ agent: agent.key }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ agent: string }>;
}) {
  const { agent: key } = await params;
  const agent = CORE_AGENT_BY_KEY.get(key as CoreAgentKey);
  return {
    title: agent
      ? `${agent.label} · Jidoka Marketing Team OS`
      : "Core Agent · Jidoka Marketing Team OS",
  };
}

type TrainingRow = {
  id: string;
  training_data: Record<string, unknown> | null;
  operating_rules: string | null;
  approval_rules: string | null;
  handoff_rules: string | null;
  data_sources: string | null;
  updated_at: string;
  status: string;
};

function fieldValue(
  training: TrainingRow | null,
  key: string,
) {
  const value = training?.training_data?.[key];
  return typeof value === "string" ? value : "";
}

export default async function CoreAgentTrainingPage({
  params,
}: {
  params: Promise<{ agent: string }>;
}) {
  const { agent: key } = await params;
  const agent = CORE_AGENT_BY_KEY.get(key as CoreAgentKey);
  if (!agent) notFound();

  const { user, supabase } = await requireUser();
  const trainingResult = await opsTable(
    supabase,
    "marketing_os_core_agent_training",
  )
    .select(
      "id, training_data, operating_rules, approval_rules, handoff_rules, data_sources, updated_at, status",
    )
    .eq("owner_id", user.id)
    .eq("agent_key", agent.key)
    .maybeSingle();
  const schemaMissing = isOpsSchemaMissing(trainingResult.error);
  const training = schemaMissing
    ? null
    : asRow<TrainingRow>(trainingResult.data);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Core Command
      </Link>

      <PageHeader title={agent.label} description={agent.summary}>
        <Badge variant="secondary">{agent.segment}</Badge>
      </PageHeader>

      {schemaMissing && (
        <OpsSchemaNotice title="Core agent training needs migration 0017" />
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {agent.systems.map((system) => (
          <div key={system} className="rounded-lg border bg-muted/20 p-3 text-sm">
            {system}
          </div>
        ))}
      </div>

      {!schemaMissing && (
        <form action={saveCoreAgentTrainingAction} className="space-y-6">
          <input type="hidden" name="agent_key" value={agent.key} />

          <Card>
            <CardHeader>
              <CardTitle>Agent training</CardTitle>
              <CardDescription>
                These notes teach {agent.label} how your agency actually works.
                Keep them specific, operational, and approval-aware.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              {agent.trainingFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <label
                    htmlFor={field.key}
                    className="text-sm font-medium text-foreground"
                  >
                    {field.label}
                  </label>
                  <Textarea
                    id={field.key}
                    name={field.key}
                    defaultValue={fieldValue(training, field.key)}
                    placeholder={field.placeholder}
                    rows={6}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Governance and handoffs</CardTitle>
              <CardDescription>
                Tell the agent what it can do, when it needs approval, and how
                it should coordinate with the rest of JIDOKA Core.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="operating_rules" className="text-sm font-medium">
                  Operating rules
                </label>
                <Textarea
                  id="operating_rules"
                  name="operating_rules"
                  defaultValue={training?.operating_rules ?? ""}
                  rows={5}
                  placeholder="Preferences, working rhythm, internal standards, and how this agent should make recommendations."
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="approval_rules" className="text-sm font-medium">
                  Approval rules
                </label>
                <Textarea
                  id="approval_rules"
                  name="approval_rules"
                  defaultValue={training?.approval_rules ?? ""}
                  rows={5}
                  placeholder="What requires approval before the agent acts, sends, publishes, spends, changes, or escalates."
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="handoff_rules" className="text-sm font-medium">
                  Handoff rules
                </label>
                <Textarea
                  id="handoff_rules"
                  name="handoff_rules"
                  defaultValue={training?.handoff_rules ?? ""}
                  rows={5}
                  placeholder="How this agent should coordinate with Executive Command and the other three agents."
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="data_sources" className="text-sm font-medium">
                  Data sources
                </label>
                <Textarea
                  id="data_sources"
                  name="data_sources"
                  defaultValue={training?.data_sources ?? ""}
                  rows={5}
                  placeholder="CRM, analytics, files, connected accounts, dashboards, SOPs, or other source-of-truth notes."
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">
              <Save className="mr-1 h-4 w-4" />
              Save training
            </Button>
            {training && (
              <p className="text-sm text-muted-foreground">
                Status: {titleCase(training.status)} · Last saved{" "}
                {new Date(training.updated_at).toLocaleString()}
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
