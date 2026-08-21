import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth";
import { loadDnaInput } from "@/lib/ai/generate";
import { buildSourcePosts, lookbackDate, runPaidAdGeneration } from "@/lib/ai/paid-ads";
import { isOpsSchemaMissing, opsTable } from "@/lib/marketing-os/operations";
import { UNTRAINED_AGENT_ERROR, hasVoiceDna } from "@/lib/agent-readiness";

export const runtime = "nodejs";
export const maxDuration = 120;

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

  const analyticsResult = await supabase
    .from("marketing_os_platform_analytics")
    .select("platform, post_id, caption, performance_score")
    .eq("agent_id", agentId)
    .gte("date", lookbackDate())
    .order("performance_score", { ascending: false })
    .limit(20);

  const rows = (analyticsResult.data ?? []) as {
    platform: string;
    post_id: string | null;
    caption: string | null;
    performance_score: number;
  }[];

  if (rows.length === 0) {
    return NextResponse.json(
      {
        error:
          "No performance data in the last 30 days yet. Connect and publish through the Scheduler first, so there is something to rank.",
      },
      { status: 400 },
    );
  }

  const sourcePosts = buildSourcePosts(rows, 5);
  const dna = await loadDnaInput(supabase, agentId);

  try {
    const ads = await runPaidAdGeneration(dna, sourcePosts);

    const { data: inserted, error } = await opsTable(supabase, "marketing_os_paid_ad_copy")
      .insert({
        owner_id: user.id,
        agent_id: agentId,
        source_posts: sourcePosts,
        ads,
      })
      .select("id, source_posts, ads, created_at")
      .single();

    if (isOpsSchemaMissing(error)) {
      return NextResponse.json(
        { error: "Paid Ads Generator needs migration 0031 applied first." },
        { status: 409 },
      );
    }
    if (error || !inserted) {
      return NextResponse.json(
        { error: error?.message ?? "Could not save generated ad copy" },
        { status: 500 },
      );
    }

    revalidatePath("/paid-ads");

    return NextResponse.json({ ok: true, result: inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ad copy generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
