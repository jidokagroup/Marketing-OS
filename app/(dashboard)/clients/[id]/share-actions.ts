"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { opsTable } from "@/lib/marketing-os/operations";

const SCOPES = ["approval", "calendar", "content_library", "analytics"] as const;

function textValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function createShareLinkAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const clientId = textValue(formData, "client_id");
  if (!clientId) return;

  const scope = SCOPES.includes(textValue(formData, "scope") as (typeof SCOPES)[number])
    ? textValue(formData, "scope")
    : "approval";
  const label = textValue(formData, "label");
  const expiresIn = textValue(formData, "expires_in_days");
  const expiresAt = expiresIn
    ? new Date(Date.now() + Number(expiresIn) * 24 * 60 * 60 * 1000).toISOString()
    : null;

  await opsTable(supabase, "marketing_os_client_share_links").insert({
    owner_id: user.id,
    client_id: clientId,
    scope,
    label,
    expires_at: expiresAt,
  });

  revalidatePath(`/clients/${clientId}`);
}

export async function revokeShareLinkAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const id = textValue(formData, "id");
  const clientId = textValue(formData, "client_id");
  if (!id) return;

  await opsTable(supabase, "marketing_os_client_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (clientId) revalidatePath(`/clients/${clientId}`);
}
