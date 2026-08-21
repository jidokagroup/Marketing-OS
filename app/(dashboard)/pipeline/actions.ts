"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { opsTable } from "@/lib/marketing-os/operations";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

/**
 * Add a prospect to the acquisition pipeline.
 *
 * Deliberately captures evidence, LinkedIn and the source URL, which the
 * campaign lead form does not: those are what the outreach generator
 * personalizes from. Without them it has nothing specific to open on, which
 * is the exact failure the prompt is written to avoid.
 */
export async function createPipelineLeadAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const leadName = text(formData, "lead_name");
  const clientId = text(formData, "client_id");
  if (!leadName || !clientId) return;

  await opsTable(supabase, "marketing_os_leads").insert({
    owner_id: user.id,
    organization_id: user.id,
    client_id: clientId,
    lead_name: leadName,
    company: text(formData, "company"),
    email: text(formData, "email"),
    linkedin_url: text(formData, "linkedin_url"),
    source_channel: text(formData, "source_channel"),
    source_url: text(formData, "source_url"),
    evidence: text(formData, "evidence"),
    estimated_value: Number(formData.get("estimated_value") ?? 0) || 0,
    status: "new",
    outreach_stage: "Daily Queue",
  });

  revalidatePath("/pipeline");
}

/** Approve, send, or skip one drafted touch. */
export async function updateAttemptStatusAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const id = text(formData, "id");
  const status = text(formData, "status");
  const leadId = text(formData, "lead_id");
  if (!id || !status) return;

  await opsTable(supabase, "marketing_os_acquisition_attempts")
    .update({
      body: text(formData, "body") ?? undefined,
      status,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("owner_id", user.id);

  revalidatePath("/pipeline");
  if (leadId) revalidatePath(`/pipeline/${leadId}`);
}

/** Record a reply, which stops the sequence — a real conversation has started. */
export async function recordReplyAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const leadId = text(formData, "lead_id");
  const body = text(formData, "body");
  if (!leadId || !body) return;

  await opsTable(supabase, "marketing_os_acquisition_replies").insert({
    owner_id: user.id,
    lead_id: leadId,
    attempt_id: text(formData, "attempt_id"),
    channel: text(formData, "channel") ?? "email",
    body,
  });

  // A reply ends the automated ladder: the Aurumverse sequence hands off to a
  // human the moment someone answers, and continuing to drip after a reply is
  // the single most damaging thing a sequence can do.
  await opsTable(supabase, "marketing_os_leads")
    .update({ outreach_stage: "Renurture", next_attempt_at: null, status: "qualified" })
    .eq("id", leadId)
    .eq("owner_id", user.id);

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${leadId}`);
}
