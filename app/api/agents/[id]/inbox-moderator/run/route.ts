import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth";
import { runModeratorPassForAgent } from "@/lib/ai/inbox-moderator";
import { opsTable } from "@/lib/marketing-os/operations";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Runs one moderator pass on demand, from the Inbox page, rather than
 * waiting for the scheduled sweep in app/api/cron/moderate-inbox. Useful the
 * first time a client turns the moderator on for an agent, and for testing --
 * the cron route runs the identical function on the same schedule as
 * analytics and intelligence.
 */
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
    .select("id")
    .eq("id", agentId)
    .maybeSingle();
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const settingResult = await opsTable(supabase, "marketing_os_inbox_moderator_settings")
    .select("auto_approve_low_risk")
    .eq("owner_id", user.id)
    .eq("agent_id", agentId)
    .maybeSingle();
  const autoApproveLowRisk = Boolean(
    (settingResult.data as { auto_approve_low_risk?: boolean } | null)?.auto_approve_low_risk,
  );

  try {
    const result = await runModeratorPassForAgent(supabase, user.id, agentId, autoApproveLowRisk);
    revalidatePath("/inbox");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Moderator pass failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
