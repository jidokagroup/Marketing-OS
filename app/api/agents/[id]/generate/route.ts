import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth";
import { embedQuery, toVectorLiteral } from "@/lib/ai/embeddings";
import { runGeneration, type GenerationRequest, type DnaInput } from "@/lib/ai/generate";
import { CLAUDE_MODEL } from "@/lib/ai/anthropic";
import { buildBrandBrainBrief } from "@/lib/brand-brain";
import { CONTENT_CHANNEL_LABELS } from "@/lib/core-agents";
import { opsTable } from "@/lib/marketing-os/operations";
import type { BrandBrain } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MATCH_COUNT = 6;
const GENERATION_TIMEOUT_MS = 52_000;

type ScriptMatch = {
  id: string;
  content: string;
};

function cleanPlatformList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => String(item).trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function channelLabel(key: string) {
  return CONTENT_CHANNEL_LABELS[key] ?? key.replace(/_/g, " ");
}

class GenerationTimeoutError extends Error {
  constructor() {
    super(
      "Content generation timed out before it could finish. Try fewer channels or shorter notes, then generate again.",
    );
    this.name = "GenerationTimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  const timer = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new GenerationTimeoutError()), timeoutMs);
  });

  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout));
}

function jsonArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) =>
        typeof item === "string" ? item : JSON.stringify(item),
      )
    : [];
}

function readOpportunities(value: unknown) {
  if (Array.isArray(value)) return jsonArray(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return [...jsonArray(record.items), ...jsonArray(record.positioning)];
  }
  return [];
}

async function latestIntelligenceBrief(
  supabase: unknown,
  ownerId: string,
) {
  const { data } = await opsTable(
    supabase,
    "marketing_os_social_intelligence_reports",
  )
    .select(
      "summary, trending_topics, hooks, audios, content_opportunities, scanned_at",
    )
    .eq("owner_id", ownerId)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const report = data as
    | {
        summary?: string | null;
        trending_topics?: unknown;
        hooks?: unknown;
        audios?: unknown;
        content_opportunities?: unknown;
        scanned_at?: string | null;
      }
    | null;
  if (!report) return "";

  const parts = [
    report.summary && `Latest intelligence summary: ${report.summary}`,
    jsonArray(report.trending_topics).length &&
      `Trending topics: ${jsonArray(report.trending_topics).join(" | ")}`,
    jsonArray(report.hooks).length &&
      `Hooks to adapt: ${jsonArray(report.hooks).join(" | ")}`,
    readOpportunities(report.content_opportunities).length &&
      `Opportunities: ${readOpportunities(report.content_opportunities).join(" | ")}`,
    jsonArray(report.audios).length &&
      `Audio/trend notes: ${jsonArray(report.audios).join(" | ")}`,
  ].filter(Boolean);

  return parts.length
    ? `\nLatest Intelligence Context (${report.scanned_at ?? "latest scan"}):\n${parts.join("\n")}`
    : "";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: agentId } = await params;
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user, supabase } = context;

  const { data: agent } = await supabase
    .from("marketing_os_writing_agents")
    .select("id, status")
    .eq("id", agentId)
    .maybeSingle();
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<
    GenerationRequest & { platforms?: string[] }
  >;
  const topic = String(body.topic ?? "").trim();
  if (!topic) {
    return NextResponse.json({ error: "Topic is required" }, { status: 400 });
  }
  const platforms = cleanPlatformList(body.platforms);
  const platformLabel =
    platforms.length > 0
      ? platforms.map(channelLabel).join(", ")
      : body.platform?.trim() || undefined;
  const req: GenerationRequest = {
    topic,
    title: body.title?.trim() || topic,
    goal: body.goal?.trim() || undefined,
    platform: platformLabel,
    audience: body.audience?.trim() || undefined,
    offer: body.offer?.trim() || undefined,
    cta: body.cta?.trim() || undefined,
    length: body.length?.trim() || undefined,
    notes: body.notes?.trim() || undefined,
  };

  // Require an analyzed agent (Voice DNA present).
  const { data: voice } = await supabase
    .from("marketing_os_voice_profiles")
    .select("agent_id")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (!voice) {
    return NextResponse.json(
      { error: "Analyze this agent before generating content." },
      { status: 400 },
    );
  }

  try {
    // 1) Retrieve the closest matching scripts via pgvector, then fall back to
    // recent chunks so generation still works if embeddings are unavailable.
    const queryText = [req.topic, req.goal, req.notes].filter(Boolean).join(" — ");
    let matches: ScriptMatch[] = [];

    try {
      const queryEmbedding = await embedQuery(queryText);
      const { data } = await supabase.rpc("marketing_os_match_scripts", {
        p_agent_id: agentId,
        p_query_embedding: toVectorLiteral(queryEmbedding),
        p_match_count: MATCH_COUNT,
      });
      matches = ((data ?? []) as ScriptMatch[]).filter((match) =>
        Boolean(match.content?.trim()),
      );
    } catch (error) {
      console.warn(
        "Generation retrieval fallback used:",
        error instanceof Error ? error.message : error,
      );
    }

    if (matches.length === 0) {
      const { data: recentScripts } = await supabase
        .from("marketing_os_uploaded_scripts")
        .select("id, content")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(MATCH_COUNT);
      matches = ((recentScripts ?? []) as ScriptMatch[]).filter((match) =>
        Boolean(match.content?.trim()),
      );
    }

    const exemplars = matches.map((m) => m.content);
    const retrievedIds = matches.map((m) => m.id);

    // 2) Load DNA profiles.
    const [v, b, h, s, p, k] = await Promise.all([
      supabase.from("marketing_os_voice_profiles").select("*").eq("agent_id", agentId).maybeSingle(),
      supabase.from("marketing_os_belief_profiles").select("*").eq("agent_id", agentId).maybeSingle(),
      supabase.from("marketing_os_hook_libraries").select("*").eq("agent_id", agentId).maybeSingle(),
      supabase.from("marketing_os_story_frameworks").select("*").eq("agent_id", agentId).maybeSingle(),
      supabase.from("marketing_os_phrase_libraries").select("*").eq("agent_id", agentId).maybeSingle(),
      supabase.from("marketing_os_knowledge_graphs").select("*").eq("agent_id", agentId).maybeSingle(),
    ]);
    const dna: DnaInput = {
      voice: v.data as unknown as DnaInput["voice"],
      belief: b.data as unknown as DnaInput["belief"],
      hooks: h.data as unknown as DnaInput["hooks"],
      story: s.data as unknown as DnaInput["story"],
      phrase: p.data as unknown as DnaInput["phrase"],
      knowledge: k.data as unknown as DnaInput["knowledge"],
    };

    // 2b) Load the per-agent authoritative business facts.
    const { data: brain } = await supabase
      .from("marketing_os_brand_brains")
      .select("*")
      .eq("agent_id", agentId)
      .maybeSingle();
    const intelligenceBrief = await latestIntelligenceBrief(supabase, user.id);
    const brandBrief = [
      buildBrandBrainBrief((brain as BrandBrain) ?? null),
      intelligenceBrief,
    ]
      .filter(Boolean)
      .join("\n");

    // 3) Generate + QC (with one auto-rewrite below threshold).
    const result = await withTimeout(
      runGeneration(req, dna, exemplars, brandBrief),
      GENERATION_TIMEOUT_MS,
    );

    // 4) Persist.
    const { data: inserted, error: insertError } = await supabase
      .from("marketing_os_generated_content")
      .insert({
        agent_id: agentId,
        owner_id: user.id,
        title: req.title ?? req.topic,
        topic: req.topic,
        goal: req.goal ?? null,
        platform: platformLabel ?? null,
        audience: req.audience ?? null,
        offer: req.offer ?? null,
        cta: req.cta ?? null,
        length: req.length ?? null,
        notes: req.notes ?? null,
        primary_script: result.content.primary_script,
        alternate_hooks: result.content.alternate_hooks,
        alternate_ctas: result.content.alternate_ctas,
        short_version: result.content.short_version,
        long_version: result.content.long_version,
        organic_version: result.content.organic_version,
        sales_version: result.content.sales_version,
        retrieved_script_ids: retrievedIds,
        overall_score: result.score.overall,
        below_threshold: result.belowThreshold,
        attempts: result.attempts,
        model: CLAUDE_MODEL,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? "Could not save content");
    }

    const { error: scoreError } = await supabase.from("marketing_os_quality_scores").insert({
      generated_content_id: inserted.id,
      owner_id: user.id,
      voice_match: result.score.voice_match,
      syntax_match: result.score.syntax_match,
      hook_match: result.score.hook_match,
      story_match: result.score.story_match,
      belief_match: result.score.belief_match,
      emotional_match: result.score.emotional_match,
      phrase_match: result.score.phrase_match,
      brand_accuracy: result.score.brand_accuracy,
      knowledge_accuracy: result.score.knowledge_accuracy,
      overall: result.score.overall,
      attempt: result.attempts,
      rationale: result.score.rationale,
    });
    if (scoreError) throw new Error(scoreError.message);

    revalidatePath("/generated");
    revalidatePath("/dashboard");

    return NextResponse.json({ id: inserted.id, overall: result.score.overall });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    const status = err instanceof GenerationTimeoutError ? 504 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
