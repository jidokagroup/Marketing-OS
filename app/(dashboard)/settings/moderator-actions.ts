"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { opsTable } from "@/lib/marketing-os/operations";

export async function setModeratorSettingAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const agentId = String(formData.get("agent_id") ?? "").trim();
  if (!agentId) return;

  const enabled = formData.get("enabled") === "on";
  const autoApproveLowRisk = formData.get("auto_approve_low_risk") === "on";

  await opsTable(supabase, "marketing_os_inbox_moderator_settings").upsert(
    {
      owner_id: user.id,
      agent_id: agentId,
      enabled,
      auto_approve_low_risk: autoApproveLowRisk,
    },
    { onConflict: "owner_id,agent_id" },
  );

  revalidatePath("/settings");
  revalidatePath("/inbox");
}
