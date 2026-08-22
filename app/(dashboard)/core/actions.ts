"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { CORE_AGENT_BY_KEY, type CoreAgentKey } from "@/lib/core-agents";
import { isOpsSchemaMissing, opsTable } from "@/lib/marketing-os/operations";

function textValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function trainingPayload(formData: FormData, keys: string[]) {
  return Object.fromEntries(
    keys.map((key) => [key, textValue(formData, key) ?? ""]),
  );
}

export async function saveCoreAgentTrainingAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const agentKey = textValue(formData, "agent_key") as CoreAgentKey | null;
  const agent = agentKey ? CORE_AGENT_BY_KEY.get(agentKey) : null;
  if (!agent) return;

  const { error } = await opsTable(supabase, "marketing_os_core_agent_training")
    .upsert(
      {
        owner_id: user.id,
        organization_id: user.id,
        agent_key: agent.key,
        user_facing_name: agent.label,
        segment: agent.segment,
        systems: agent.systems,
        training_data: trainingPayload(
          formData,
          agent.trainingFields.map((field) => field.key),
        ),
        operating_rules: textValue(formData, "operating_rules"),
        approval_rules: textValue(formData, "approval_rules"),
        handoff_rules: textValue(formData, "handoff_rules"),
        data_sources: textValue(formData, "data_sources"),
        status: "active",
      },
      { onConflict: "owner_id,agent_key" },
    )
    .select("id")
    .maybeSingle();

  // Saving used to end in silence whatever happened, which is how an agent
  // could look saved and stay empty.
  if (error) {
    const reason = isOpsSchemaMissing(error)
      ? "The Core training table is missing — apply migration 0017."
      : error.message ?? "Unknown error";
    console.error("[core] training save failed", error);
    redirect(
      `${agent.href}?saved=error&reason=${encodeURIComponent(reason)}`,
    );
  }

  revalidatePath("/dashboard");
  revalidatePath(agent.href);
  revalidatePath("/core/orchestrator");
  revalidatePath("/settings");
  redirect(`${agent.href}?saved=1`);
}
