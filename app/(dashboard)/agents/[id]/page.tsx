import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Trash2, FileText } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { AgentStatusBadge } from "@/components/agent-status-badge";
import { AssetUploader } from "@/components/asset-uploader";
import { AssetLibraryTable } from "@/components/asset-library-table";
import { AnalyzeButton } from "@/components/analyze-button";
import { VoiceDnaPanel, type DnaData } from "@/components/voice-dna-panel";
import { GenerateForm } from "@/components/generate-form";
import { AgentConnections } from "@/components/agent-connections";
import { ScoreBadge } from "@/components/score-badge";
import { EmptyState } from "@/components/empty-state";
import { Fingerprint, Sparkles } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { AgentStatus } from "@/lib/supabase/types";
import { deleteAgentAction } from "../actions";

export default async function AgentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    connect?: string;
    reason?: string;
    title?: string;
    topic?: string;
    goal?: string;
    audience?: string;
    offer?: string;
    cta?: string;
    length?: string;
    notes?: string;
    platforms?: string;
  }>;
}) {
  const { id } = await params;
  const {
    tab,
    connect,
    reason,
    title,
    topic,
    goal,
    audience,
    offer,
    cta,
    length,
    notes,
    platforms,
  } = await searchParams;
  const { supabase } = await requireUser();
  const allowedTabs = new Set([
    "assets",
    "dna",
    "generate",
    "history",
    "connections",
    "knowledge",
  ]);
  const generateDefaults = {
    title,
    topic,
    goal,
    audience,
    offer,
    cta,
    length,
    notes,
    platforms: platforms
      ?.split(/[|,;]/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  };
  const activeTab = tab && allowedTabs.has(tab) ? tab : "assets";

  const { data: agent } = await supabase
    .from("marketing_os_writing_agents")
    .select(
      "id, name, industry, platform, notes, status, last_analyzed_at, clients:marketing_os_clients(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!agent) notFound();

  // Embedded relation; hand-written types lack FK metadata (regenerated later).
  const client = agent.clients as unknown as { name: string } | null;
  const status = agent.status as AgentStatus;

  const { data: assets } = await supabase
    .from("marketing_os_uploaded_assets")
    .select("id, title, kind, status, char_count, error, created_at")
    .eq("agent_id", id)
    .order("created_at", { ascending: false });

  const assetList = assets ?? [];
  const extractedCount = assetList.filter((a) => a.status === "extracted").length;

  // Load DNA profiles (loosely-typed jsonb; cast to the analysis shapes).
  const [voiceP, beliefP, hooksP, storyP, phraseP, knowledgeP] = await Promise.all([
    supabase.from("marketing_os_voice_profiles").select("*").eq("agent_id", id).maybeSingle(),
    supabase.from("marketing_os_belief_profiles").select("*").eq("agent_id", id).maybeSingle(),
    supabase.from("marketing_os_hook_libraries").select("*").eq("agent_id", id).maybeSingle(),
    supabase.from("marketing_os_story_frameworks").select("*").eq("agent_id", id).maybeSingle(),
    supabase.from("marketing_os_phrase_libraries").select("*").eq("agent_id", id).maybeSingle(),
    supabase.from("marketing_os_knowledge_graphs").select("*").eq("agent_id", id).maybeSingle(),
  ]);

  const dna: DnaData = {
    voice: voiceP.data as unknown as DnaData["voice"],
    belief: beliefP.data as unknown as DnaData["belief"],
    hooks: hooksP.data as unknown as DnaData["hooks"],
    story: storyP.data as unknown as DnaData["story"],
    phrase: phraseP.data as unknown as DnaData["phrase"],
    knowledge: knowledgeP.data as unknown as DnaData["knowledge"],
  };
  const hasDna = Boolean(voiceP.data);

  const { data: history } = await supabase
    .from("marketing_os_generated_content")
    .select("id, topic, platform, overall_score, created_at")
    .eq("agent_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  const historyList = history ?? [];

  const { data: accounts } = await supabase
    .from("marketing_os_social_accounts")
    .select("id, platform, username, status")
    .eq("agent_id", id)
    .order("created_at", { ascending: false });
  const accountList = accounts ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Link
          href="/agents"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← All agents
        </Link>
      </div>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{agent.name}</h1>
            <AgentStatusBadge status={status} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {client?.name && <Badge variant="outline">{client.name}</Badge>}
            {agent.industry && <Badge variant="secondary">{agent.industry}</Badge>}
            {agent.platform && <Badge variant="secondary">{agent.platform}</Badge>}
          </div>
          {agent.notes && (
            <p className="max-w-2xl text-sm text-muted-foreground">{agent.notes}</p>
          )}
        </div>
        <form action={deleteAgentAction}>
          <input type="hidden" name="id" value={agent.id} />
          <ConfirmSubmitButton
            message={`Delete ${agent.name}? This cannot be undone.`}
            size="sm"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </ConfirmSubmitButton>
        </form>
      </div>

      <ConnectionNotice status={connect} reason={reason} />

      <Tabs defaultValue={activeTab}>
        <TabsList>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="dna">Brand Voice DNA</TabsTrigger>
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="mt-6 space-y-6">
          {extractedCount > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {extractedCount} asset{extractedCount === 1 ? "" : "s"} ready.{" "}
                {hasDna
                  ? "Re-run to refresh the agent's Voice DNA."
                  : "Run analysis to build this agent's Voice DNA."}
              </p>
              <AnalyzeButton
                agentId={agent.id}
                disabled={status === "analyzing"}
                label={hasDna ? "Re-analyze" : "Run Voice Intelligence Analysis"}
              />
            </div>
          )}

          <AssetUploader agentId={agent.id} />

          {assetList.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No assets yet"
              description="Upload scripts, captions, emails, transcripts, or paste content to build this agent's training material."
            />
          ) : (
            <AssetLibraryTable agentId={agent.id} assets={assetList} hasDna={hasDna} />
          )}
        </TabsContent>
        <TabsContent value="dna" className="mt-6">
          {hasDna ? (
            <VoiceDnaPanel data={dna} />
          ) : (
            <EmptyState
              icon={Fingerprint}
              title="No Brand Voice DNA yet"
              description={
                extractedCount > 0
                  ? "Run Voice Intelligence Analysis from the Assets tab to generate the Writing DNA profile."
                  : "Upload assets first, then run analysis to extract the Writing DNA profile."
              }
            />
          )}
        </TabsContent>
        <TabsContent value="generate" className="mt-6">
          {hasDna ? (
            <GenerateForm agentId={agent.id} defaults={generateDefaults} />
          ) : (
            <EmptyState
              icon={Sparkles}
              title="Analyze first"
              description="Content generation unlocks once this agent has a Voice DNA profile. Upload assets and run analysis."
            />
          )}
        </TabsContent>
        <TabsContent value="history" className="mt-6">
          {historyList.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No generated content yet"
              description="Generated pieces for this agent will appear here with their authenticity scores."
            />
          ) : (
            <div className="space-y-3">
              {historyList.map((item) => (
                <Link key={item.id} href={`/generated/${item.id}`}>
                  <div className="flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:border-primary/50">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {item.topic || "Untitled piece"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.platform || "—"}
                      </p>
                    </div>
                    {item.overall_score != null && (
                      <ScoreBadge score={Number(item.overall_score)} />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="connections" className="mt-6">
          <AgentConnections agentId={agent.id} accounts={accountList} />
        </TabsContent>
        <TabsContent value="knowledge" className="mt-6">
          {dna.knowledge ? (
            <KnowledgeBasePanel knowledge={dna.knowledge} />
          ) : (
            <EmptyState
              icon={BookOpen}
              title="No knowledge base yet"
              description="Run analysis to extract company facts, offers, customers, objections, testimonials, and competitors for this agent."
            />
          )}
        </TabsContent>
      </Tabs>
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

  const isSuccess = status === "success";
  const isWarning = status === "session_error" || status === "not_configured";
  const title = isSuccess
    ? "Account connected"
    : isWarning
      ? "Connection needs attention"
      : "Connection failed";
  const message =
    reason ??
    (isSuccess
      ? "The account was connected and is ready for scheduler matching."
      : status === "not_configured"
        ? "This platform needs API keys before it can connect."
        : status === "session_error"
          ? "The login session expired. Try connecting again from this page."
          : "Try connecting again. If it repeats, check the platform OAuth settings.");

  return (
    <div
      className={`mb-6 rounded-lg border p-4 text-sm ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : isWarning
            ? "border-amber-200 bg-amber-50 text-amber-950"
            : "border-red-200 bg-red-50 text-red-950"
      }`}
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}

function KnowledgeBasePanel({
  knowledge,
}: {
  knowledge: NonNullable<DnaData["knowledge"]>;
}) {
  const sections = [
    {
      title: "Company",
      items: [
        knowledge.company?.mission && `Mission: ${knowledge.company.mission}`,
        knowledge.company?.vision && `Vision: ${knowledge.company.vision}`,
        knowledge.company?.positioning &&
          `Positioning: ${knowledge.company.positioning}`,
        knowledge.company?.values?.length
          ? `Values: ${knowledge.company.values.join(", ")}`
          : null,
      ],
    },
    {
      title: "Offers",
      items: knowledge.products?.map((item) =>
        [item.name, item.description, item.pricing].filter(Boolean).join(" - "),
      ),
    },
    {
      title: "Customers",
      items: knowledge.customers?.map((item) =>
        [
          item.persona,
          item.pain_points?.length
            ? `Pain points: ${item.pain_points.join(", ")}`
            : "",
          item.goals?.length ? `Goals: ${item.goals.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join(" - "),
      ),
    },
    {
      title: "Competitors",
      items: knowledge.competitors?.map((item) =>
        [item.name, item.positioning, item.advantages?.join(", ")]
          .filter(Boolean)
          .join(" - "),
      ),
    },
    {
      title: "Objections",
      items: knowledge.objections?.map((item) =>
        [item.objection, item.response].filter(Boolean).join(" - "),
      ),
    },
    {
      title: "Testimonials",
      items: knowledge.testimonials?.map((item) =>
        [item.summary, item.source].filter(Boolean).join(" - "),
      ),
    },
  ];
  const knownSections = sections.filter((section) =>
    (section.items ?? []).some(Boolean),
  ).length;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Knowledge Base</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {knowledge.summary ||
                "Extracted business knowledge will appear here after analysis."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {knownSections} of {sections.length} knowledge sections have extracted
              details. Add more source files and re-run analysis when the agent needs more context.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((section, index) => (
          <KnowledgeSection
            key={section.title}
            title={section.title}
            items={section.items}
            defaultOpen={index === 0}
          />
        ))}
      </div>
    </div>
  );
}

function KnowledgeSection({
  title,
  items,
  defaultOpen = false,
}: {
  title: string;
  items?: (string | null | undefined)[];
  defaultOpen?: boolean;
}) {
  const cleanItems = (items ?? []).filter((item): item is string => Boolean(item));
  return (
    <details className="rounded-lg border p-4" open={defaultOpen}>
      <summary className="cursor-pointer list-none font-medium">
        {title}
        <span className="ml-2 text-xs text-muted-foreground">
          {cleanItems.length ? `${cleanItems.length} item${cleanItems.length === 1 ? "" : "s"}` : "needs details"}
        </span>
      </summary>
      {cleanItems.length ? (
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {cleanItems.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No details extracted yet.</p>
      )}
    </details>
  );
}
