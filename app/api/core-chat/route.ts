import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";
import {
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

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user, supabase } = context;
  const body = (await request.json().catch(() => ({}))) as ChatBody;
  const question = cleanText(body.question);
  const answer = cleanText(body.answer);
  if (!question || !answer) {
    return NextResponse.json({ error: "question and answer are required" }, { status: 400 });
  }

  const intent = classifyIntent(question);
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
      action_href: cleanText(body.action_href),
      action_label: cleanText(body.action_label),
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
        body: answer,
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
          expected_behavior: answer,
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
