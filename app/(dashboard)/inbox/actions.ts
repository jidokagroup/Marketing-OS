"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { opsTable } from "@/lib/marketing-os/operations";

function textValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function actionForStatus(status: string) {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "posted") return "posted";
  return "resolved";
}

export async function updateInboxThreadStatusAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const id = textValue(formData, "id");
  const status = textValue(formData, "status");
  if (!id || !status) return;
  const reply = textValue(formData, "reply");
  const messageId = textValue(formData, "message_id");

  await opsTable(supabase, "marketing_os_inbox_threads")
    .update({ status })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (messageId && reply) {
    await opsTable(supabase, "marketing_os_inbox_messages")
      .update({
        body: reply,
        status: status === "posted" ? "posted" : "approved",
      })
      .eq("id", messageId)
      .eq("owner_id", user.id);
  } else if (reply) {
    await opsTable(supabase, "marketing_os_inbox_messages").insert({
      owner_id: user.id,
      thread_id: id,
      role: "assistant",
      message_type: "public_reply",
      body: reply,
      ai_generated: true,
      status: status === "posted" ? "posted" : "approved",
    });
  }

  await opsTable(supabase, "marketing_os_inbox_reviews").insert({
    owner_id: user.id,
    thread_id: id,
    reviewer_id: user.id,
    action: actionForStatus(status),
    edited_body: reply,
    note: textValue(formData, "note"),
  });

  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  const campaignId = textValue(formData, "campaign_id");
  if (campaignId) revalidatePath(`/campaigns/${campaignId}`);
}
