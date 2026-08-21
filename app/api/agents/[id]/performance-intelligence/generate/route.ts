import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth";
import { loadDnaInput } from "@/lib/ai/generate";
import { runPerformanceIntelligence, tierPosts, type ScoredPost } from "@/lib/ai/performance-intelligence";
import { isOpsSchemaMissing, opsTable } from "@/lib/marketing-os/operations";
import { UNTRAINED_AGENT_ERROR, hasVoiceDna } from "@/lib/agent-readiness";

export const runtime = "nodejs";
export const maxDuration = 120;

const LOOKBACK_DAYS = 90;

export async function POST(
  _request: Request,
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
    .select("id, name")
    .eq("id", agentId)
    .maybeSingle();
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (!(await hasVoiceDna(supabase, agentId))) {
    return NextResponse.json({ error: UNTRAINED_AGENT_ERROR }, { status: 400 });
  }

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const analyticsResult = await supabase
    .from("marketing_os_platform_analytics")
    .select("platform, caption, performance_score")
    .eq("agent_id", agentId)
    .gte("date", since)
    .order("performance_score", { ascending: false })
    .limit(200);

  const posts = (analyticsResult.data ?? []) as ScoredPost[];

  if (posts.length < 4) {
    return NextResponse.json(
      {
        error:
          "Not enough published, measured content yet to find a pattern (need at least 4 posts with analytics in the last 90 days).",
      },
      { status: 400 },
    );
  }

  const tiers = tierPosts(posts);
  const dna = await loadDnaInput(supabase, agentId);

  try {
    const report = await runPerformanceIntelligence(dna, tiers);

    const { data: inserted, error } = await opsTable(
      supabase,
      "marketing_os_performance_intelligence_reports",
    )
      .insert({
        owner_id: user.id,
        agent_id: agentId,
        post_count: posts.length,
        top_tier_pattern: report.top_tier_pattern,
        bottom_tier_pattern: report.bottom_tier_pattern,
        best_hooks: report.best_hooks,
        best_ctas: report.best_ctas,
        best_formats: report.best_formats,
        recommendations: report.recommendations,
        summary: report.summary,
      })
      .select(
        "id, post_count, top_tier_pattern, bottom_tier_pattern, best_hooks, best_ctas, best_formats, recommendations, summary, created_at",
      )
      .single();

    if (isOpsSchemaMissing(error)) {
      return NextResponse.json(
        { error: "Performance Intelligence needs migration 0031 applied first." },
        { status: 409 },
      );
    }
    if (error || !inserted) {
      return NextResponse.json(
        { error: error?.message ?? "Could not save the report" },
        { status: 500 },
      );
    }

    revalidatePath("/performance");

    return NextResponse.json({ ok: true, result: inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Performance analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
