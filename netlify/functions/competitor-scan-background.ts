import type { ScanClient } from "../../lib/ai/competitor-scan";
import { createServiceClient } from "../../lib/supabase/service-client";
import { opsTable } from "../../lib/marketing-os/operations";
import {
  percentComplete,
  type ScanProgress,
  type ScanStage,
} from "../../lib/intelligence/stages";

/**
 * Competitor scan worker.
 *
 * Netlify runs any function whose name ends in `-background` asynchronously:
 * the invocation is acked with 202 immediately and the handler then gets a
 * multi-minute budget. That is the only place in this deployment where a scan
 * (several site fetches plus a Claude call that may retry) can safely run —
 * ordinary request handlers are killed long before it finishes.
 *
 * Invoked two ways:
 *   - directly by `saveCompetitorsAction` with `{ reportId }`
 *   - on a schedule with no body, to sweep up rows whose trigger never landed
 */

const SWEEP_LIMIT = 5;
// Rows stuck in `running` longer than this were almost certainly lost with a
// dead worker, so a later sweep is allowed to retry them.
const STALE_RUNNING_MS = 10 * 60 * 1000;
// Past this a row has already had a full retry cycle and is still stuck, so
// retrying again just spins forever and the page shows a permanent spinner.
// Give up and record why, so the user sees an error they can act on. Netlify
// kills a background function at ~15 minutes without running its catch block,
// which is the usual way a row ends up here.
const ABANDON_RUNNING_MS = 25 * 60 * 1000;

type ReportRow = {
  id: string;
  owner_id: string;
  client_id: string | null;
  industry: string | null;
  competitor_accounts: string[] | null;
};

async function loadClient(
  db: ReturnType<typeof createServiceClient>,
  report: ReportRow,
): Promise<ScanClient> {
  if (!report.client_id) {
    return report.industry ? ({ name: report.industry } as ScanClient) : null;
  }
  const { data } = await db
    .from("marketing_os_clients")
    .select("name, industry, notes, trending_audio_notes")
    .eq("id", report.client_id)
    .maybeSingle();
  return (data as ScanClient) ?? null;
}

type ScanDb = ReturnType<typeof createServiceClient>;

/**
 * Internal diagnostics. Never rendered anywhere a customer can see: the row's
 * `error_message` carries the sentence they read, and this carries the reason
 * an engineer needs.
 */
async function logScan(
  db: ScanDb,
  report: ReportRow,
  entry: {
    stage?: ScanStage | "worker";
    provider?: string;
    level?: "info" | "warn" | "error";
    latency_ms?: number;
    retry_count?: number;
    message: string;
    detail?: Record<string, unknown>;
  },
) {
  try {
    await opsTable(db, "marketing_os_intelligence_scan_logs").insert({
      owner_id: report.owner_id,
      report_id: report.id,
      client_id: report.client_id,
      stage: entry.stage ?? null,
      provider: entry.provider ?? null,
      level: entry.level ?? "info",
      latency_ms: entry.latency_ms ?? null,
      retry_count: entry.retry_count ?? 0,
      message: entry.message,
      detail: entry.detail ?? {},
    });
  } catch {
    // Logging must never be the thing that fails a scan.
  }
}

/** Marks where the scan is, so the page can describe it without guessing. */
async function setProgress(
  db: ScanDb,
  report: ReportRow,
  progress: ScanProgress,
) {
  await db
    .from("marketing_os_social_intelligence_reports")
    .update({
      status: progress.status,
      current_stage: progress.current_stage ?? null,
      sources_total: progress.sources_total ?? 0,
      sources_completed: progress.sources_completed ?? 0,
      sources_failed: progress.sources_failed ?? 0,
      last_completed_step: progress.last_completed_step ?? null,
      percent_complete: percentComplete(progress),
    })
    .eq("id", report.id);
}

async function finishStage(
  db: ScanDb,
  report: ReportRow,
  stage: ScanStage,
  status: "succeeded" | "failed",
  extra: { output?: unknown; error_message?: string; error_code?: string } = {},
) {
  await opsTable(db, "marketing_os_intelligence_scan_stages").upsert(
    {
      owner_id: report.owner_id,
      report_id: report.id,
      stage,
      status,
      finished_at: new Date().toISOString(),
      output: (extra.output ?? {}) as Record<string, unknown>,
      error_code: extra.error_code ?? null,
      error_message: extra.error_message ?? null,
    },
    { onConflict: "report_id,stage" },
  );
}

/** What a previous run already banked, so a retry does not redo it. */
async function loadStageOutputs(db: ScanDb, report: ReportRow) {
  const { data } = await opsTable(db, "marketing_os_intelligence_scan_stages")
    .select("stage, status, output")
    .eq("report_id", report.id);

  const outputs = new Map<string, Record<string, unknown>>();
  for (const row of (data ?? []) as {
    stage: string;
    status: string;
    output: Record<string, unknown>;
  }[]) {
    if (row.status === "succeeded") outputs.set(row.stage, row.output ?? {});
  }
  return outputs;
}

async function runOne(db: ScanDb, report: ReportRow) {
  const websites = report.competitor_accounts ?? [];
  if (!websites.length) {
    await db
      .from("marketing_os_social_intelligence_reports")
      .update({
        status: "complete",
        current_stage: null,
        percent_complete: 100,
        completed_at: new Date().toISOString(),
        summary: "Watchlist is empty. Add competitor websites and save to run a scan.",
      })
      .eq("id", report.id);
    return { id: report.id, ok: true, skipped: "empty_watchlist" };
  }

  const banked = await loadStageOutputs(db, report);
  const progress: ScanProgress = {
    status: "fetching",
    current_stage: "fetching",
    sources_total: websites.length,
    sources_completed: 0,
    sources_failed: 0,
    last_completed_step:
      (["aggregating", "analyzing", "normalizing", "fetching"] as ScanStage[]).find(
        (stage) => banked.has(stage),
      ) ?? null,
  };

  await db
    .from("marketing_os_social_intelligence_reports")
    .update({ started_at: new Date().toISOString() })
    .eq("id", report.id);

  // Sections survive a partial run: a group that fails costs its own fields,
  // not the report, and a later retry fills them in without redoing the rest.
  const sections: Record<string, unknown> = {
    ...((banked.get("analyzing")?.sections as Record<string, unknown>) ?? {}),
  };
  const failedGroups: string[] = [];

  try {
    const client = await loadClient(db, report);
    const { buildScanContext, SCAN_SECTION_GROUPS, runScanSectionGroup, runScanSynthesis, cleanScan } =
      await import("../../lib/ai/competitor-scan");

    // ---- fetching -------------------------------------------------------
    progress.status = "fetching";
    progress.current_stage = "fetching";
    await setProgress(db, report, progress);

    const { loadCompetitorExecutionData } = await import(
      "../../lib/social/competitor-execution"
    );
    const execution = await loadCompetitorExecutionData(db, report.owner_id, websites);
    const { fetchSiteExcerpts } = await import("../../lib/ai/competitor-scan");
    const excerpts = await fetchSiteExcerpts(websites);

    const fetchedCount = excerpts.filter(
      (excerpt: { text: string }) => excerpt.text,
    ).length;
    progress.sources_completed = fetchedCount;
    progress.sources_failed = websites.length - fetchedCount;

    // Per-source outcomes, so "7 of 18" is a fact rather than an estimate.
    await opsTable(db, "marketing_os_intelligence_scan_sources").upsert(
      excerpts.map((excerpt: { url: string; text: string }) => ({
        owner_id: report.owner_id,
        report_id: report.id,
        source_url: excerpt.url,
        status: excerpt.text ? "fetched" : "failed",
        error_message: excerpt.text ? null : "The page could not be read.",
      })),
      { onConflict: "report_id,source_url" },
    );
    await finishStage(db, report, "fetching", "succeeded", {
      output: { fetched: fetchedCount },
    });
    progress.last_completed_step = "fetching";
    await logScan(db, report, {
      stage: "fetching",
      message: `fetched ${fetchedCount}/${websites.length} sources`,
    });

    // ---- normalizing ----------------------------------------------------
    progress.status = "normalizing";
    progress.current_stage = "normalizing";
    await setProgress(db, report, progress);

    let executionBrief = execution.brief;
    if (execution.tiktokHandles.length) {
      try {
        const { researchTikTokAccounts } = await import("../../lib/ai/web-research");
        const clientContext = client
          ? `CLIENT: ${client.name}${client.industry ? ` — ${client.industry}` : ""}`
          : "CLIENT: a marketing client.";
        executionBrief += await researchTikTokAccounts(
          execution.tiktokHandles,
          clientContext,
        );
      } catch (error) {
        // TikTok has no commercial API, so this pass is best-effort by nature.
        // Losing it costs some execution colour, never the scan.
        await logScan(db, report, {
          stage: "normalizing",
          level: "warn",
          message: "tiktok research pass failed",
          detail: { reason: error instanceof Error ? error.message : String(error) },
        });
      }
    }

    const context = buildScanContext({
      client,
      websites,
      executionBrief,
      executionGaps: execution.gaps,
      excerpts,
    });
    await finishStage(db, report, "normalizing", "succeeded");
    progress.last_completed_step = "normalizing";

    // ---- analyzing ------------------------------------------------------
    progress.status = "analyzing";
    progress.current_stage = "analyzing";
    await setProgress(db, report, progress);

    for (const group of SCAN_SECTION_GROUPS) {
      // Skip what a previous attempt already produced.
      if (group.fields.every((field) => sections[field])) continue;

      const startedAt = Date.now();
      try {
        const produced = await runScanSectionGroup(group, context);
        Object.assign(sections, produced);
        await logScan(db, report, {
          stage: "analyzing",
          provider: "anthropic",
          latency_ms: Date.now() - startedAt,
          message: `section group ${group.key} produced`,
        });
      } catch (error) {
        failedGroups.push(group.key);
        await logScan(db, report, {
          stage: "analyzing",
          provider: "anthropic",
          level: "error",
          latency_ms: Date.now() - startedAt,
          message: `section group ${group.key} failed`,
          detail: { reason: error instanceof Error ? error.message : String(error) },
        });
      }
      // Banked after every group, so a worker killed mid-analysis loses one
      // group rather than all of them.
      await finishStage(db, report, "analyzing", "succeeded", { output: { sections } });
      await setProgress(db, report, progress);
    }
    progress.last_completed_step = "analyzing";

    // Nothing usable at all is a failure; anything else is a report.
    if (Object.keys(sections).length === 0) {
      throw new Error("no section group could be produced");
    }

    // ---- aggregating ----------------------------------------------------
    progress.status = "aggregating";
    progress.current_stage = "aggregating";
    await setProgress(db, report, progress);
    await finishStage(db, report, "aggregating", "succeeded");
    progress.last_completed_step = "aggregating";

    // ---- generating_recommendations -------------------------------------
    progress.status = "generating_recommendations";
    progress.current_stage = "generating_recommendations";
    await setProgress(db, report, progress);

    let synthesis: Record<string, unknown> = {};
    try {
      synthesis = (await runScanSynthesis(context, sections)) as Record<string, unknown>;
    } catch (error) {
      failedGroups.push("synthesis");
      await logScan(db, report, {
        stage: "generating_recommendations",
        provider: "anthropic",
        level: "error",
        message: "synthesis failed",
        detail: { reason: error instanceof Error ? error.message : String(error) },
      });
    }
    await finishStage(db, report, "generating_recommendations", "succeeded");

    const scan = cleanScan({ ...sections, ...synthesis } as never);
    const partial = failedGroups.length > 0;

    await db
      .from("marketing_os_social_intelligence_reports")
      .update({
        status: partial ? "partial" : "complete",
        current_stage: null,
        percent_complete: 100,
        completed_at: new Date().toISOString(),
        last_completed_step: "generating_recommendations",
        error_message: null,
        error_code: partial ? "sections_incomplete" : null,
        internal_error_message: partial ? `failed groups: ${failedGroups.join(", ")}` : null,
        trending_topics: scan.trending_topics,
        hooks: scan.hooks,
        content_opportunities: {
          items: scan.content_formats,
          positioning: scan.positioning,
          content_gaps: scan.content_gaps,
          hook_library: scan.hook_library,
          offer_tracker: scan.offer_tracker,
          comment_themes: scan.comment_themes,
          opportunity_signals: scan.opportunity_signals,
          competitor_wins: scan.competitor_wins,
          recommended_posts: scan.recommended_posts,
          opportunity_score: scan.opportunity_score,
          content_gap_score: scan.content_gap_score,
          source: "website_competitor_scan",
        },
        recommendations: scan.recommendations,
        summary: scan.summary,
        scanned_at: new Date().toISOString(),
      })
      .eq("id", report.id);

    return { id: report.id, ok: true, partial };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "scan failed";

    // Whatever analysis did succeed is kept on the row, so a failure late in
    // the run still leaves the user with the sections that were produced.
    await db
      .from("marketing_os_social_intelligence_reports")
      .update({
        status: "failed",
        current_stage: null,
        error_code: "scan_failed",
        internal_error_message: reason,
        error_message: null,
        last_completed_step: progress.last_completed_step,
        percent_complete: percentComplete({ ...progress, status: "failed" }),
      })
      .eq("id", report.id);

    await logScan(db, report, {
      stage: progress.current_stage ?? "worker",
      level: "error",
      message: "scan failed",
      detail: { reason, failedGroups },
    });

    return { id: report.id, ok: false, error: reason };
  }
}

export default async function handler(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let reportId: string | undefined;
  try {
    const body = (await request.json()) as { reportId?: string };
    reportId = body?.reportId;
  } catch {
    // No body: this is the scheduled sweep.
  }

  let db: ReturnType<typeof createServiceClient>;
  try {
    db = createServiceClient();
  } catch (error) {
    // Nothing can be written to the row without a client, so report it here.
    const reason = error instanceof Error ? error.message : "worker startup failed";
    return new Response(JSON.stringify({ ok: false, error: reason }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const columns = "id, owner_id, client_id, industry, competitor_accounts";

  let reports: ReportRow[] = [];
  if (reportId) {
    const { data, error } = await db
      .from("marketing_os_social_intelligence_reports")
      .select(columns)
      .eq("id", reportId)
      .maybeSingle();
    if (error) {
      return new Response(JSON.stringify({ ok: false, error: `lookup failed: ${error.message}` }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    if (data) reports = [data as ReportRow];
  } else {
    // Two plain queries rather than a nested `or(...)` filter: the combined
    // form is easy to get subtly wrong, and a rejected filter would return no
    // rows, which is indistinguishable from an empty queue.
    const staleBefore = new Date(Date.now() - STALE_RUNNING_MS).toISOString();
    const abandonBefore = new Date(Date.now() - ABANDON_RUNNING_MS).toISOString();

    // Give up on rows that have already had a retry cycle and are still stuck.
    // Without this they are picked up as "stale" on every sweep forever and the
    // page spins indefinitely with no way for the user to tell it has died.
    await db
      .from("marketing_os_social_intelligence_reports")
      .update({
        status: "failed",
        error_message:
          "The scan worker stopped before finishing (it most likely hit the platform's " +
          "time limit). Save the watchlist again to retry.",
      })
      .eq("status", "running")
      .lt("requested_at", abandonBefore);

    const [queued, stale] = await Promise.all([
      db
        .from("marketing_os_social_intelligence_reports")
        .select(columns)
        .eq("status", "queued")
        .order("requested_at", { ascending: true })
        .limit(SWEEP_LIMIT),
      db
        .from("marketing_os_social_intelligence_reports")
        .select(columns)
        .eq("status", "running")
        .lt("requested_at", staleBefore)
        .gte("requested_at", abandonBefore)
        .order("requested_at", { ascending: true })
        .limit(SWEEP_LIMIT),
    ]);

    if (queued.error || stale.error) {
      const reason = queued.error?.message ?? stale.error?.message ?? "query failed";
      return new Response(JSON.stringify({ ok: false, error: `sweep query failed: ${reason}` }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    reports = [...(queued.data ?? []), ...(stale.data ?? [])].slice(
      0,
      SWEEP_LIMIT,
    ) as ReportRow[];
  }

  const results = [];
  for (const report of reports) {
    try {
      results.push(await runOne(db, report));
    } catch (error) {
      // runOne handles scan failures itself; this catches anything outside it
      // (a Supabase write rejected, for instance) so one bad row cannot take
      // down the rest of the sweep silently.
      const reason = error instanceof Error ? error.message : "worker error";
      await db
        .from("marketing_os_social_intelligence_reports")
        .update({ status: "failed", error_message: `Worker error: ${reason}` })
        .eq("id", report.id);
      results.push({ id: report.id, ok: false, error: reason });
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
