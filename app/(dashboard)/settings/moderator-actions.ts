"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { isOpsSchemaMissing, opsTable } from "@/lib/marketing-os/operations";

export async function setModeratorSettingAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const agentId = String(formData.get("agent_id") ?? "").trim();
  if (!agentId) return;

  // Unchecked boxes are not submitted at all, so absence means false.
  const enabled = formData.get("enabled") === "on";
  const autoApproveLowRisk = formData.get("auto_approve_low_risk") === "on";

  const { error } = await opsTable(
    supabase,
    "marketing_os_inbox_moderator_settings",
  ).upsert(
    {
      owner_id: user.id,
      agent_id: agentId,
      enabled,
      auto_approve_low_risk: autoApproveLowRisk,
    },
    { onConflict: "owner_id,agent_id" },
  );

  // Previously this result was discarded, so a failed save looked exactly like
  // a successful one: the page re-rendered from unchanged data and the
  // checkbox appeared to revert with nothing explaining why.
  if (error) {
    const reason = isOpsSchemaMissing(error)
      ? "The Inbox Moderator table is missing — apply migration 0031."
      : error.message ?? "Unknown error";
    console.error("[moderator] save failed", error);
    redirect(
      `/settings?tab=automations&moderator=error&reason=${encodeURIComponent(reason)}`,
    );
  }

  revalidatePath("/settings");
  revalidatePath("/inbox");
  redirect("/settings?tab=automations&moderator=saved");
}
