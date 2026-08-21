import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { runModeratorPassForAgent } from "@/lib/ai/inbox-moderator";
import { asRows, opsTable } from "@/lib/marketing-os/operations";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

type ModeratorSetting = {
  owner_id: string;
  agent_id: string;
  enabled: boolean;
  auto_approve_low_risk: boolean;
};

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const settingsResult = await opsTable(admin, "marketing_os_inbox_moderator_settings")
    .select("owner_id, agent_id, enabled, auto_approve_low_risk")
    .eq("enabled", true);
  const settings = asRows<ModeratorSetting>(settingsResult.data);

  let drafted = 0;
  let flagged = 0;
  const errors: string[] = [];

  for (const setting of settings) {
    try {
      const result = await runModeratorPassForAgent(
        admin,
        setting.owner_id,
        setting.agent_id,
        setting.auto_approve_low_risk,
      );
      drafted += result.drafted;
      flagged += result.flagged;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Failed for agent ${setting.agent_id}`);
    }
  }

  return NextResponse.json({ ok: true, agents: settings.length, drafted, flagged, errors });
}

export const POST = GET;
