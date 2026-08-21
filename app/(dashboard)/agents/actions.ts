"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { AGENT_EXISTS_FOR_CLIENT_ERROR, existingAgentForClient } from "@/lib/agent-per-client";

export type FormState = { error: string } | null;

export async function createAgentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, supabase } = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim() || null;
  const platform = String(formData.get("platform") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) {
    return { error: "Agent name is required." };
  }
  if (!clientId) {
    return { error: "Choose a client so this agent only uses that client's data." };
  }

  if (await existingAgentForClient(supabase, user.id, clientId)) {
    return { error: AGENT_EXISTS_FOR_CLIENT_ERROR };
  }

  const { data, error } = await supabase
    .from("marketing_os_writing_agents")
    .insert({
      owner_id: user.id,
      client_id: clientId,
      name,
      industry,
      platform,
      notes,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not create agent." };
  }

  revalidatePath("/agents");
  // Continue the wizard on the agent's page (upload → analyze).
  redirect(`/agents/${data.id}?new=1`);
}

export async function deleteAgentAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await supabase.from("marketing_os_writing_agents").delete().eq("id", id);
    revalidatePath("/agents");
  }
  redirect("/agents");
}
