"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { currentWeekStart, opsTable } from "@/lib/marketing-os/operations";

function textValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function numberValue(formData: FormData, key: string, fallback = 0) {
  const value = Number(formData.get(key) ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

export async function saveTeamCapacityAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const id = textValue(formData, "id");
  const memberName = textValue(formData, "member_name");
  if (!memberName) return;

  const planned = numberValue(formData, "planned_hours", 40);
  const allocated = numberValue(formData, "allocated_hours", 0);
  const status =
    allocated > planned
      ? "over_capacity"
      : allocated >= planned * 0.85
        ? "near_capacity"
        : "available";

  const row = {
    owner_id: user.id,
    organization_id: user.id,
    member_id: textValue(formData, "member_id"),
    member_name: memberName,
    email: textValue(formData, "email"),
    role: textValue(formData, "role") ?? "strategist",
    week_start: textValue(formData, "week_start") ?? currentWeekStart(),
    planned_hours: planned,
    allocated_hours: allocated,
    status,
    notes: textValue(formData, "notes"),
  };

  if (id) {
    await opsTable(supabase, "marketing_os_team_capacity")
      .update(row)
      .eq("id", id)
      .eq("owner_id", user.id);
  } else {
    await opsTable(supabase, "marketing_os_team_capacity")
      .upsert(row, { onConflict: "owner_id,email,week_start" })
      .select("id")
      .maybeSingle();
  }

  revalidatePath("/team");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
