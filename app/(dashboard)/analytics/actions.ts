"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { opsTable } from "@/lib/marketing-os/operations";
import { runJidokaAnalyticsFetch } from "@/lib/social/analytics-fetcher";
import { seatScopedHref } from "@/lib/seat-cookie";

const BACKFILL_SUPPORTED_PLATFORMS = new Set(["instagram", "facebook", "youtube", "x"]);

function clampDays(value: FormDataEntryValue | null) {
  const days = Number(value ?? 90);
  if (!Number.isFinite(days)) return 90;
  return Math.max(7, Math.min(Math.round(days), 730));
}

function maxPostsForDays(days: number) {
  if (days <= 30) return 100;
  if (days <= 90) return 200;
  return 500;
}

export async function backfillAnalyticsAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const days = clampDays(formData.get("days"));
  const requestedPlatform = String(formData.get("platform") ?? "all")
    .trim()
    .toLowerCase();
  const platform = BACKFILL_SUPPORTED_PLATFORMS.has(requestedPlatform)
    ? requestedPlatform
    : "all";
  const agentId = String(formData.get("agent_id") ?? "").trim();

  const requestedAt = new Date().toISOString();
  let result;
  let failure: string | null = null;
  try {
    result = await runJidokaAnalyticsFetch({
      ownerId: user.id,
      agentId: agentId || undefined,
      platforms: platform && platform !== "all" ? [platform] : undefined,
      lookbackDays: days,
      maxPostsPerAccount: maxPostsForDays(days),
    });
  } catch (err) {
    failure = err instanceof Error ? err.message : "Analytics import failed.";
    result = { accounts_processed: 0, rows_stored: 0, errors: 1, accounts: [] };
  }

  // The run used to leave no trace: a refresh lost the result, and "0 rows"
  // could not be told apart from "the platform refused". Recording it means
  // the page can explain itself later, per account.
  await opsTable(supabase, "marketing_os_analytics_backfill_runs").insert({
    owner_id: user.id,
    agent_id: agentId || null,
    platform: platform || "all",
    lookback_days: days,
    status: failure ? "failed" : "succeeded",
    accounts_processed: result.accounts_processed,
    rows_stored: result.rows_stored,
    errors: result.errors,
    detail: result.accounts,
    error_message: failure,
    requested_at: requestedAt,
    finished_at: new Date().toISOString(),
  });

  revalidatePath("/analytics");
  revalidatePath("/scheduler");
  revalidatePath("/dashboard");

  const params = new URLSearchParams({
    platform: platform || "all",
    backfill: failure ? "error" : "success",
    days: String(days),
    rows: String(result.rows_stored),
    accounts: String(result.accounts_processed),
    errors: String(result.errors),
  });
  redirect(
    seatScopedHref(
      `/analytics?${params.toString()}`,
      String(formData.get("return_agent_id") ?? "").trim() || null,
      String(formData.get("return_client") ?? "").trim() || null,
    ),
  );
}
