import { createServiceClient } from "../../lib/supabase/service-client";
import type { GenerationRequest, DnaInput } from "../../lib/ai/generate";

/**
 * Content generation worker.
 *
 * Netlify runs any function whose name ends in `-background` asynchronously:
 * the invocation is acked with 202 immediately and the handler then gets a
 * multi-minute budget. `/api/agents/[id]/generate` used to do retrieval + a
 * Claude call + QC scoring inline inside a synchronous Netlify Function --
 * `export const maxDuration = 60` in that route is a Next.js/Vercel
 * convention, but Netlify's actual platform ceiling for a regular function
 * is far lower regardless of what the code declares, so a heavy request
 * (many channels, a full blog post, a full email) got killed by the
 * platform itself before Claude could even respond. This is the only place
 * in this deployment where that generation can safely run to completion.
 *
 * Invoked directly by the route with `{ contentId }`.
 */

const MATCH_COUNT = 3;
const RETRIEVAL_TIMEOUT_MS = 4_000;

type ScriptMatch = { id: string; content: string };

type ContentRow = {
  id: string;
  agent_id: string;
  owner_id: string;
  title: string | null;
  topic: string | null;
  goal: string | null;
  platform: string | null;
  audience: string | null;
  offer: string | null;
  cta: string | null;
  length: string | null;
  notes: string | null;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  const timer = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("retrieval timed out")), ms);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout));
}

function jsonArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
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
  db: ReturnType<typeof createServiceClient>,
  ownerId: string,
) {
  const { data } = await db
    .from("marketing_os_social_intelligence_reports")
    .select("summary, trending_topics, hooks, audios, content_opportunities, scanned_at")
    .eq("owner_id", ownerId)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return "";

  const parts = [
    data.summary && `Latest intelligence summary: ${data.summary}`,
    jsonArray(data.trending_topics).length &&
      `Trending topics: ${jsonArray(data.trending_topics).join(" | ")}`,
    jsonArray(data.hooks).length && `Hooks to adapt: ${jsonArray(data.hooks).join(" | ")}`,
    readOpportunities(data.content_opportunities).length &&
      `Opportunities: ${readOpportunities(data.content_opportunities).join(" | ")}`,
    jsonArray(data.audios).length && `Audio/trend notes: ${jsonArray(data.audios).join(" | ")}`,
  ].filter(Boolean);

  return parts.length
    ? `\nLatest Intelligence Context (${data.scanned_at ?? "latest scan"}):\n${parts.join("\n")}`
    : "";
}

async function runOne(db: ReturnType<typeof createServiceClient>, row: ContentRow) {
  await db
    .from("marketing_os_generated_content")
    .update({ status: "running" })
    .eq("id", row.id);

  try {
    const {
      embedQuery,
      toVectorLiteral,
    } = await import("../../lib/ai/embeddings");
    const { runFallbackGeneration, runGeneration } = await import("../../lib/ai/generate");
    const { buildBrandBrainBrief } = await import("../../lib/brand-brain");
    const { CLAUDE_MODEL } = await import("../../lib/ai/anthropic");

    const req: GenerationRequest = {
      topic: row.topic ?? "",
      title: row.title ?? row.topic ?? undefined,
      goal: row.goal ?? undefined,
      platform: row.platform ?? undefined,
      audience: row.audience ?? undefined,
      offer: row.offer ?? undefined,
      cta: row.cta ?? undefined,
      length: row.length ?? undefined,
      notes: row.notes ?? undefined,
    };

    // 1) Retrieve the closest matching scripts via pgvector, then fall back
    // to recent chunks so generation still works if embeddings are unavailable.
    const queryText = [req.topic, req.goal, req.notes].filter(Boolean).join(" — ");
    let matches: ScriptMatch[] = [];
    try {
      const { data } = await withTimeout(
        embedQuery(queryText).then((queryEmbedding) =>
          db.rpc("marketing_os_match_scripts", {
            p_agent_id: row.agent_id,
            p_query_embedding: toVectorLiteral(queryEmbedding),
            p_match_count: MATCH_COUNT,
          }),
        ),
        RETRIEVAL_TIMEOUT_MS,
      );
      matches = ((data ?? []) as ScriptMatch[]).filter((match) => Boolean(match.content?.trim()));
    } catch (error) {
      console.warn(
        "Generation retrieval fallback used:",
        error instanceof Error ? error.message : error,
      );
    }
    if (matches.length === 0) {
      const { data: recentScripts } = await db
        .from("marketing_os_uploaded_scripts")
        .select("id, content")
        .eq("agent_id", row.agent_id)
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
      db.from("marketing_os_voice_profiles").select("*").eq("agent_id", row.agent_id).maybeSingle(),
      db.from("marketing_os_belief_profiles").select("*").eq("agent_id", row.agent_id).maybeSingle(),
      db.from("marketing_os_hook_libraries").select("*").eq("agent_id", row.agent_id).maybeSingle(),
      db.from("marketing_os_story_frameworks").select("*").eq("agent_id", row.agent_id).maybeSingle(),
      db.from("marketing_os_phrase_libraries").select("*").eq("agent_id", row.agent_id).maybeSingle(),
      db.from("marketing_os_knowledge_graphs").select("*").eq("agent_id", row.agent_id).maybeSingle(),
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
    const { data: brain } = await db
      .from("marketing_os_brand_brains")
      .select("*")
      .eq("agent_id", row.agent_id)
      .maybeSingle();
    const intelligenceBrief = await latestIntelligenceBrief(db, row.owner_id);
    const brandBrief = [buildBrandBrainBrief(brain ?? null), intelligenceBrief]
      .filter(Boolean)
      .join("\n");

    // 3) Generate + QC (with one auto-rewrite below threshold). No request
    // deadline here -- this is the whole point of running in the background.
    let result;
    try {
      result = await runGeneration(req, dna, exemplars, brandBrief);
    } catch (error) {
      console.warn(
        "Generation failed, using fallback content:",
        error instanceof Error ? error.message : error,
      );
      result = runFallbackGeneration(req, dna, exemplars);
    }

    // 4) Persist.
    await db
      .from("marketing_os_generated_content")
      .update({
        status: "complete",
        error_message: null,
        primary_script: result.content.primary_script,
        alternate_hooks: result.content.alternate_hooks,
        alternate_ctas: result.content.alternate_ctas,
        long_version: result.content.long_version,
        blog_cta: result.content.blog_cta,
        blog_keywords: result.content.blog_keywords,
        blog_link_suggestions: result.content.blog_link_suggestions,
        sales_version: result.content.sales_version,
        email_cta: result.content.email_cta,
        retrieved_script_ids: retrievedIds,
        overall_score: result.score.overall,
        below_threshold: result.belowThreshold,
        attempts: result.attempts,
        model: CLAUDE_MODEL,
      })
      .eq("id", row.id);

    await db.from("marketing_os_quality_scores").insert({
      generated_content_id: row.id,
      owner_id: row.owner_id,
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

    return { id: row.id, ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "generation failed";
    await db
      .from("marketing_os_generated_content")
      .update({ status: "failed", error_message: reason })
      .eq("id", row.id);
    return { id: row.id, ok: false, error: reason };
  }
}

export default async function handler(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let contentId: string | undefined;
  try {
    const body = (await request.json()) as { contentId?: string };
    contentId = body?.contentId;
  } catch {
    // no body
  }
  if (!contentId) {
    return new Response(JSON.stringify({ ok: false, error: "contentId is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  let db: ReturnType<typeof createServiceClient>;
  try {
    db = createServiceClient();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "worker startup failed";
    return new Response(JSON.stringify({ ok: false, error: reason }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const { data: row, error } = await db
    .from("marketing_os_generated_content")
    .select(
      "id, agent_id, owner_id, title, topic, goal, platform, audience, offer, cta, length, notes",
    )
    .eq("id", contentId)
    .maybeSingle();

  if (error || !row) {
    return new Response(
      JSON.stringify({ ok: false, error: error?.message ?? "content row not found" }),
      { status: 404, headers: { "content-type": "application/json" } },
    );
  }

  const result = await runOne(db, row as ContentRow);

  return new Response(JSON.stringify({ ok: true, result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
