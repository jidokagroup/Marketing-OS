import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";
import {
  asRow,
  isOpsSchemaMissing,
  opsTable,
} from "@/lib/marketing-os/operations";

export const runtime = "nodejs";

type ChatBody = {
  thread_id?: string | null;
  question?: string;
  answer?: string;
  pathname?: string;
  action_href?: string;
  action_label?: string;
  disconnected?: string[];
};

type MemoryAnswer = {
  text: string;
  href?: string;
  actionLabel?: string;
};

type MemoryCandidate = {
  title: string;
  body: string;
  owner?: string | null;
  systems?: string[];
  href: string;
  actionLabel: string;
};

type TrainingRow = {
  training_data: Record<string, unknown> | null;
  operating_rules: string | null;
  approval_rules: string | null;
  handoff_rules: string | null;
  data_sources: string | null;
};

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

function keywords(value: string) {
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "how",
    "what",
    "when",
    "where",
    "why",
    "can",
    "you",
    "our",
    "this",
    "that",
    "from",
    "into",
    "about",
    "does",
    "should",
  ]);
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stop.has(word));
}

function scoreCandidate(questionWords: string[], candidate: MemoryCandidate) {
  const haystack = `${candidate.title} ${candidate.body}`.toLowerCase();
  return questionWords.reduce(
    (score, word) => score + (haystack.includes(word) ? 1 : 0),
    0,
  );
}

function classifyIntent(question: string) {
  const q = question.toLowerCase();
  if (q.includes("connect") || q.includes("oauth") || q.includes("account")) {
    return "connections";
  }
  if (q.includes("schedule") || q.includes("calendar")) return "scheduler";
  if (q.includes("content") || q.includes("script") || q.includes("caption")) {
    return "content";
  }
  if (q.includes("campaign") || q.includes("lead") || q.includes("crm")) {
    return "growth-revenue";
  }
  if (q.includes("client") || q.includes("delivery") || q.includes("support")) {
    return "client-delivery";
  }
  if (q.includes("report") || q.includes("analytics") || q.includes("sop")) {
    return "success-intelligence";
  }
  if (q.includes("billing") || q.includes("team") || q.includes("legal")) {
    return "business-operations";
  }
  return "orchestrator";
}

function intentLabel(intent: string) {
  const labels: Record<string, string> = {
    connections: "Connections",
    scheduler: "Smart Scheduler",
    content: "Content",
    "growth-revenue": "Growth & Revenue",
    "client-delivery": "Client Delivery",
    "success-intelligence": "Success & Intelligence",
    "business-operations": "Business Operations",
    orchestrator: "Orchestrator",
  };
  return labels[intent] ?? intent;
}

function needsDeveloperRequest(question: string) {
  const q = question.toLowerCase();
  return [
    "bug",
    "broken",
    "crash",
    "error",
    "doesn't work",
    "does not work",
    "cannot",
    "can't",
    "backend",
    "database",
    "supabase",
    "deploy",
    "netlify",
  ].some((term) => q.includes(term));
}

function formatSteps(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item, index) => {
      if (item && typeof item === "object" && "body" in item) {
        return `${index + 1}. ${String(item.body)}`;
      }
      return `${index + 1}. ${String(item)}`;
    })
    .join("\n");
}

function trainingValue(training: TrainingRow | null, key: string) {
  const value = training?.training_data?.[key];
  return cleanText(value);
}

async function getOrchestratorTraining(
  supabase: unknown,
  ownerId: string,
): Promise<TrainingRow | null> {
  const result = await opsTable(supabase, "marketing_os_core_agent_training")
    .select(
      "training_data, operating_rules, approval_rules, handoff_rules, data_sources",
    )
    .eq("owner_id", ownerId)
    .eq("agent_key", "orchestrator")
    .maybeSingle();

  if (isOpsSchemaMissing(result.error)) return null;
  return asRow<TrainingRow>(result.data);
}

function formatOrchestratorTrainingNote(
  training: TrainingRow | null,
  intent: string,
) {
  if (!training) return "";
  const notes = [
    trainingValue(training, "answer_style"),
    trainingValue(training, "routing_rules"),
    trainingValue(training, "memory_rules"),
    trainingValue(training, "escalation_rules"),
    cleanText(training.operating_rules),
    cleanText(training.approval_rules),
    cleanText(training.handoff_rules),
  ].filter(Boolean);

  if (notes.length === 0) return "";

  return `Orchestrator training applied: routed toward ${intentLabel(
    intent,
  )} using saved tone, routing, memory, approval, and escalation rules.`;
}

async function buildMemoryAnswer(
  supabase: unknown,
  ownerId: string,
  question: string,
): Promise<MemoryAnswer | null> {
  const [memoryResult, playbookResult] = await Promise.all([
    opsTable(supabase, "marketing_os_memory_records")
      .select("record_type, title, information, memory_owner, affected_business_systems")
      .eq("owner_id", ownerId)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(60),
    opsTable(supabase, "marketing_os_playbooks")
      .select("title, category, summary, steps, extracted_text, status")
      .eq("owner_id", ownerId)
      .in("status", ["active", "draft"])
      .order("updated_at", { ascending: false })
      .limit(30),
  ]);

  if (isOpsSchemaMissing(memoryResult.error) && isOpsSchemaMissing(playbookResult.error)) {
    return null;
  }

  const candidates: MemoryCandidate[] = [];
  if (!isOpsSchemaMissing(memoryResult.error) && Array.isArray(memoryResult.data)) {
    for (const record of memoryResult.data as {
      record_type?: string;
      title?: string;
      information?: string;
      memory_owner?: string | null;
      affected_business_systems?: string[];
    }[]) {
      candidates.push({
        title: record.title ?? "Saved memory",
        body: record.information ?? "",
        owner: record.memory_owner,
        systems: record.affected_business_systems ?? [],
        href: record.record_type === "Playbook" ? "/playbooks" : "/dashboard",
        actionLabel: record.record_type === "Playbook" ? "Open Playbooks" : "Open Core Command",
      });
    }
  }

  if (!isOpsSchemaMissing(playbookResult.error) && Array.isArray(playbookResult.data)) {
    for (const playbook of playbookResult.data as {
      title?: string;
      category?: string;
      summary?: string | null;
      steps?: unknown;
      extracted_text?: string | null;
    }[]) {
      candidates.push({
        title: playbook.title ?? "Saved playbook",
        body: [
          playbook.category ? `Category: ${playbook.category}` : "",
          playbook.summary ?? "",
          formatSteps(playbook.steps),
          playbook.extracted_text ?? "",
        ]
          .filter(Boolean)
          .join("\n"),
        owner: "JIDOKA Core Orchestrator",
        systems: [],
        href: "/playbooks",
        actionLabel: "Open Playbooks",
      });
    }
  }

  if (candidates.length === 0) return null;

  const q = question.toLowerCase();
  const asksForPlaybook =
    q.includes("playbook") ||
    q.includes("sop") ||
    q.includes("process") ||
    q.includes("workflow") ||
    q.includes("handoff") ||
    q.includes("standard");
  const questionWords = keywords(question);
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(questionWords, candidate),
    }))
    .sort((a, b) => b.score - a.score);
  const relevant = ranked.filter((item) => item.score > 0).slice(0, 2);
  const selected = relevant.length ? relevant : asksForPlaybook ? ranked.slice(0, 2) : [];
  if (!selected.length) return null;

  const primary = selected[0].candidate;
  const supporting = selected
    .map(({ candidate }) => `• ${candidate.title}: ${truncate(candidate.body, 420)}`)
    .join("\n");
  const owner = primary.owner ? ` I would route this through ${primary.owner}.` : "";
  const systems = primary.systems?.length
    ? ` Relevant systems: ${primary.systems.slice(0, 4).join(", ")}.`
    : "";

  return {
    text: `Based on saved Core memory, here is what applies:\n${supporting}${owner}${systems}`,
    href: primary.href,
    actionLabel: primary.actionLabel,
  };
}

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user, supabase } = context;
  const body = (await request.json().catch(() => ({}))) as ChatBody;
  const question = cleanText(body.question);
  const providedAnswer = cleanText(body.answer);
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const intent = classifyIntent(question);
  const [memoryAnswer, orchestratorTraining] = await Promise.all([
    buildMemoryAnswer(supabase, user.id, question),
    getOrchestratorTraining(supabase, user.id),
  ]);
  const orchestratorTrainingNote = formatOrchestratorTrainingNote(
    orchestratorTraining,
    intent,
  );
  const finalAnswer =
    memoryAnswer?.text
      ? [memoryAnswer.text, orchestratorTrainingNote]
          .filter(Boolean)
          .join("\n\n")
      : providedAnswer ??
        (orchestratorTrainingNote
          ? `${orchestratorTrainingNote}\n\nI can route this through JIDOKA Core. Ask about a specific playbook, workflow, client, campaign, scheduler, or account connection.`
          : "I can route this through JIDOKA Core. Start in Core Command or ask about a specific playbook, workflow, client, campaign, scheduler, or account connection.");
  const actionHref = memoryAnswer?.href ?? cleanText(body.action_href);
  const actionLabel = memoryAnswer?.actionLabel ?? cleanText(body.action_label);
  let threadId = cleanText(body.thread_id);

  try {
    if (!threadId) {
      const created = await opsTable(supabase, "marketing_os_core_chat_threads")
        .insert({
          owner_id: user.id,
          organization_id: user.id,
          title: question.slice(0, 80),
          page_path: cleanText(body.pathname),
          agent_context: intent,
          status: needsDeveloperRequest(question) ? "escalated" : "active",
        })
        .select("id")
        .single();
      if (isOpsSchemaMissing(created.error)) {
        return NextResponse.json({ persisted: false, reason: "migration_pending" });
      }
      threadId = (created.data as { id?: string } | null)?.id ?? null;
    }

    if (!threadId) {
      return NextResponse.json({ persisted: false, reason: "thread_missing" });
    }

    const metadata = {
      action_href: actionHref,
      action_label: actionLabel,
      disconnected: Array.isArray(body.disconnected) ? body.disconnected : [],
    };

    const inserted = await opsTable(supabase, "marketing_os_core_chat_messages").insert([
      {
        owner_id: user.id,
        organization_id: user.id,
        thread_id: threadId,
        role: "user",
        body: question,
        page_path: cleanText(body.pathname),
        intent,
        route_to_agent: intent,
        metadata,
      },
      {
        owner_id: user.id,
        organization_id: user.id,
        thread_id: threadId,
        role: "assistant",
        body: finalAnswer,
        page_path: cleanText(body.pathname),
        intent,
        route_to_agent: intent,
        metadata,
      },
    ]);

    if (isOpsSchemaMissing(inserted.error)) {
      return NextResponse.json({ persisted: false, reason: "migration_pending" });
    }

    let developerRequestId: string | null = null;
    if (needsDeveloperRequest(question)) {
      const requestResult = await opsTable(
        supabase,
        "marketing_os_developer_requests",
      )
        .insert({
          owner_id: user.id,
          organization_id: user.id,
          subject: `[JIDOKA Refinement] Medium — Help chat issue/request`,
          priority: "medium",
          affected_agent: intent,
          affected_business_systems: [],
          current_behavior: question,
          expected_behavior: finalAnswer,
          business_impact:
            "Created from the in-app orchestrator chat. Email delivery is not configured, so this remains queued for external submission.",
          evidence: `Page: ${cleanText(body.pathname) ?? "unknown"}`,
          proposed_solution:
            "Review the saved chat transcript and determine whether code, configuration, or user guidance is required.",
          status: "Awaiting External Submission",
          created_from_thread_id: threadId,
        })
        .select("id")
        .maybeSingle();
      developerRequestId =
        (requestResult.data as { id?: string } | null)?.id ?? null;
    }

    return NextResponse.json({
      persisted: true,
      thread_id: threadId,
      route_to_agent: intent,
      developer_request_id: developerRequestId,
      answer: finalAnswer,
      action_href: actionHref,
      action_label: actionLabel,
    });
  } catch (error) {
    return NextResponse.json(
      {
        persisted: false,
        error: error instanceof Error ? error.message : "Could not save chat",
      },
      { status: 200 },
    );
  }
}
