"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import {
  parseAnalyticsCsv,
  syntheticPostId,
  type ParsedAnalyticsRow,
} from "@/lib/analytics-csv";
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


/** Only platforms the app already understands can be imported against. */
const IMPORTABLE_PLATFORMS = new Set([
  "instagram",
  "facebook",
  "youtube",
  "tiktok",
  "x",
  "linkedin",
]);

const MAX_CSV_BYTES = 5 * 1024 * 1024;
const MAX_CSV_ROWS = 5000;

/**
 * Scored the same way the API importer scores its rows, so a CSV-imported post
 * and a fetched one sort against each other correctly. Anything else would
 * make Performance Intelligence rank by where the data came from.
 */
function scoreRow(row: ParsedAnalyticsRow) {
  const engagement = row.likes + row.comments + row.shares + row.saves;
  const denominator = Math.max(row.reach, row.impressions, row.views, 1);
  return {
    engagement_score: engagement,
    performance_score: Math.min(
      100,
      Math.round((engagement / denominator) * 1000),
    ),
  };
}

export async function importAnalyticsCsvAction(formData: FormData) {
  const { user, supabase } = await requireUser();

  const agentId = String(formData.get("agent_id") ?? "").trim();
  const platform = String(formData.get("platform") ?? "").trim().toLowerCase();
  const file = formData.get("file");
  const returnAgent = String(formData.get("return_agent_id") ?? "").trim() || null;
  const returnClient = String(formData.get("return_client") ?? "").trim() || null;

  const back = (params: Record<string, string>) =>
    redirect(
      seatScopedHref(
        `/analytics?${new URLSearchParams(params).toString()}`,
        returnAgent,
        returnClient,
      ),
    );

  if (!agentId) back({ csv: "error", reason: "Choose which seat this history belongs to." });
  if (!IMPORTABLE_PLATFORMS.has(platform)) {
    back({ csv: "error", reason: "Choose which platform this export came from." });
  }
  if (!(file instanceof File) || file.size === 0) {
    back({ csv: "error", reason: "Choose a CSV file to upload." });
  }

  const upload = file as File;
  if (upload.size > MAX_CSV_BYTES) {
    back({
      csv: "error",
      reason: `That file is ${(upload.size / 1024 / 1024).toFixed(1)}MB. Split exports larger than 5MB and import them one at a time.`,
    });
  }

  // Ownership is checked here rather than relied on downstream: the agent has
  // to be one of this user's before anything is written against it.
  const { data: agent } = await supabase
    .from("marketing_os_writing_agents")
    .select("id")
    .eq("id", agentId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!agent) back({ csv: "error", reason: "That seat does not belong to this workspace." });

  const parsed = parseAnalyticsCsv(await upload.text());

  if (parsed.rows.length === 0) {
    const first = parsed.errors[0]?.reason ?? "No rows could be read from that file.";
    back({ csv: "error", reason: first });
  }
  if (parsed.rows.length > MAX_CSV_ROWS) {
    back({
      csv: "error",
      reason: `That file has ${parsed.rows.length.toLocaleString()} usable rows. Import at most ${MAX_CSV_ROWS.toLocaleString()} at a time.`,
    });
  }

  const requestedAt = new Date().toISOString();
  const payload = parsed.rows.map((row) => {
    const posted = new Date(row.postedAt);
    return {
      agent_id: agentId,
      owner_id: user.id,
      platform,
      // A row the export did not identify still needs a stable id, or a second
      // import of a corrected file would duplicate every post rather than
      // update it.
      post_id: row.postId ?? syntheticPostId(row),
      title: row.caption,
      caption: row.caption,
      media_type: row.mediaType,
      posted_time: row.postedAt,
      fetched_at: requestedAt,
      date: row.postedAt.slice(0, 10),
      hour: posted.getUTCHours(),
      day_of_week: posted.toLocaleDateString("en-US", {
        weekday: "long",
        timeZone: "UTC",
      }),
      views: row.views,
      impressions: row.impressions,
      reach: row.reach,
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
      saves: row.saves,
      ...scoreRow(row),
      raw_metrics: { source: "csv_import", line: row.line },
    };
  });

  const { error } = await supabase
    .from("marketing_os_platform_analytics")
    .upsert(payload, { onConflict: "owner_id,platform,post_id" });

  const failure = error
    ? (error.message ?? "The import could not be saved.")
    : null;

  // Recorded like an API import, so the Analytics page explains a CSV import
  // the same way it explains a fetched one — and a refresh does not lose it.
  await opsTable(supabase, "marketing_os_analytics_backfill_runs").insert({
    owner_id: user.id,
    agent_id: agentId,
    platform,
    lookback_days: 0,
    status: failure ? "failed" : "succeeded",
    accounts_processed: 1,
    rows_stored: failure ? 0 : payload.length,
    errors: parsed.errors.length + (failure ? 1 : 0),
    detail: [
      {
        platform,
        username: `CSV import · ${upload.name}`,
        rows: failure ? 0 : payload.length,
        status: failure ? "failed" : "imported",
        ...(failure ? { error: failure } : {}),
      },
      // Skipped rows are listed rather than counted, because "12 rows were
      // skipped" gives nobody a way to fix the file.
      ...parsed.errors.slice(0, 20).map((issue) => ({
        platform,
        username: `Line ${issue.line}`,
        rows: 0,
        status: "failed" as const,
        error: issue.reason,
      })),
    ],
    error_message: failure,
    requested_at: requestedAt,
    finished_at: new Date().toISOString(),
  });

  if (failure) back({ csv: "error", reason: failure });

  revalidatePath("/analytics");
  revalidatePath("/dashboard");
  revalidatePath("/performance");

  back({
    csv: "success",
    rows: String(payload.length),
    skipped: String(parsed.errors.length),
  });
}
