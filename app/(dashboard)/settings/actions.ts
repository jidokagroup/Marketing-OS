"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { normalizeEmailProvider, getEmailProviderDefinition } from "@/lib/email-providers";
import { opsTable } from "@/lib/marketing-os/operations";

function textValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function saveEmailProviderSettingsAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const provider = normalizeEmailProvider(textValue(formData, "provider"));
  const definition = getEmailProviderDefinition(provider);
  const customProviderName = textValue(formData, "custom_provider_name");
  const status = textValue(formData, "status") ?? "needs_setup";

  await opsTable(supabase, "marketing_os_email_provider_settings").upsert(
    {
      owner_id: user.id,
      organization_id: user.id,
      provider,
      provider_label:
        provider === "custom_api" && customProviderName
          ? customProviderName
          : definition.label,
      status,
      from_name: textValue(formData, "from_name"),
      from_email: textValue(formData, "from_email"),
      reply_to_email: textValue(formData, "reply_to_email"),
      custom_provider_name: customProviderName,
      notes: textValue(formData, "notes"),
      config: {
        connection: definition.connection,
        best_for: definition.bestFor,
        requested_provider: customProviderName,
      },
    },
    { onConflict: "owner_id" },
  );

  revalidatePath("/settings");
  revalidatePath("/scheduler");
  revalidatePath("/analytics");
}
