"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { opsTable } from "@/lib/marketing-os/operations";

function textValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function createPlaybookAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const title = textValue(formData, "title");
  if (!title) return;

  const steps = String(formData.get("steps") ?? "")
    .split(/\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((body, index) => ({ order: index + 1, body }));

  await opsTable(supabase, "marketing_os_playbooks").insert({
    owner_id: user.id,
    organization_id: user.id,
    title,
    category: textValue(formData, "category") ?? "campaign",
    status: textValue(formData, "status") ?? "draft",
    summary: textValue(formData, "summary"),
    steps,
    owner_name: textValue(formData, "owner_name"),
    last_reviewed_at: textValue(formData, "last_reviewed_at"),
  });

  revalidatePath("/playbooks");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function updatePlaybookAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const id = textValue(formData, "id");
  const title = textValue(formData, "title");
  if (!id || !title) return;

  const steps = String(formData.get("steps") ?? "")
    .split(/\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((body, index) => ({ order: index + 1, body }));

  await opsTable(supabase, "marketing_os_playbooks")
    .update({
      title,
      category: textValue(formData, "category") ?? "campaign",
      summary: textValue(formData, "summary"),
      steps,
      owner_name: textValue(formData, "owner_name"),
      last_reviewed_at: textValue(formData, "last_reviewed_at"),
      status: textValue(formData, "status") ?? "draft",
    })
    .eq("id", id)
    .eq("owner_id", user.id);

  revalidatePath("/playbooks");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function updatePlaybookStatusAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const id = textValue(formData, "id");
  const status = textValue(formData, "status");
  if (!id || !status) return;

  await opsTable(supabase, "marketing_os_playbooks")
    .update({
      status,
      last_reviewed_at:
        status === "active" ? new Date().toISOString() : textValue(formData, "last_reviewed_at"),
    })
    .eq("id", id)
    .eq("owner_id", user.id);

  revalidatePath("/playbooks");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
