import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: agentId } = await params;
  const context = await getAuthContext();

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { supabase } = context;
  const [agentResult, voiceResult] = await Promise.all([
    supabase
      .from("marketing_os_writing_agents")
      .select("id, status, last_analyzed_at")
      .eq("id", agentId)
      .maybeSingle(),
    supabase
      .from("marketing_os_voice_profiles")
      .select("agent_id, summary, updated_at")
      .eq("agent_id", agentId)
      .maybeSingle(),
  ]);

  if (agentResult.error) {
    return NextResponse.json(
      { error: agentResult.error.message },
      { status: 500 },
    );
  }

  if (!agentResult.data) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (voiceResult.error) {
    return NextResponse.json(
      { error: voiceResult.error.message },
      { status: 500 },
    );
  }

  const hasVoiceDna = Boolean(voiceResult.data);

  return NextResponse.json({
    ok: true,
    status: agentResult.data.status,
    lastAnalyzedAt: agentResult.data.last_analyzed_at,
    hasVoiceDna,
    completed: agentResult.data.status === "ready" && hasVoiceDna,
  });
}
