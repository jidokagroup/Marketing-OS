"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import {
  currentWeekStart,
  isOpsSchemaMissing,
  opsTable,
} from "@/lib/marketing-os/operations";
import { safeNextPath } from "@/lib/safe-redirect";

function textValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function numberValue(formData: FormData, key: string, fallback = 0) {
  const value = Number(formData.get(key) ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Where to land after saving, and how to say what happened.
 *
 * This form lives on both /team and /settings, and every outcome used to be a
 * bare `return`: a blank name, a schema error and a successful save all left
 * the user on the same page with the same fields and no way to tell which had
 * happened.
 */
function capacityRedirect(formData: FormData, params: Record<string, string>) {
  const base = safeNextPath(formData.get("return_to")) ?? "/team";
  const [path, query = ""] = base.split("?", 2);
  const search = new URLSearchParams(query);
  for (const [key, value] of Object.entries(params)) search.set(key, value);
  return `${path}?${search.toString()}`;
}

export async function saveTeamCapacityAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const id = textValue(formData, "id");
  const memberName = textValue(formData, "member_name");
  if (!memberName) {
    redirect(
      capacityRedirect(formData, {
        capacity: "error",
        reason: "Enter a name before saving capacity.",
      }),
    );
  }

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

  const { error } = id
    ? await opsTable(supabase, "marketing_os_team_capacity")
        .update(row)
        .eq("id", id)
        .eq("owner_id", user.id)
    : // The unique key includes `email`, and Postgres treats NULLs as
      // distinct, so an upsert keyed on it would quietly insert a second row
      // for every unnamed-email member. Only route through the conflict target
      // when there is actually an email to conflict on.
      row.email
      ? await opsTable(supabase, "marketing_os_team_capacity").upsert(row, {
          onConflict: "owner_id,email,week_start",
        })
      : await opsTable(supabase, "marketing_os_team_capacity").insert(row);

  if (error) {
    const reason = isOpsSchemaMissing(error)
      ? "The team capacity table is missing — apply migration 0016."
      : error.message ?? "Unknown error";
    console.error("[team] capacity save failed", error);
    redirect(capacityRedirect(formData, { capacity: "error", reason }));
  }

  revalidatePath("/team");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect(capacityRedirect(formData, { capacity: "saved" }));
}
