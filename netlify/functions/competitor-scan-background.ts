import type { ScanClient } from "../../lib/ai/competitor-scan";
import { createServiceClient } from "../../lib/supabase/service-client";

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
    .select("name, industry, notes")
    .eq("id", report.client_id)
    .maybeSingle();
  return (data as ScanClient) ?? null;
}

async function runOne(db: ReturnType<typeof createServiceClient>, report: ReportRow) {
  const websites = report.competitor_accounts ?? [];
  if (!websites.length) {
    await db
      .from("marketing_os_social_intelligence_reports")
      .update({
        status: "complete",
        summary: "Watchlist is empty. Add competitor websites and save to run a scan.",
      })
      .eq("id", report.id);
    return { id: report.id, ok: true, skipped: "empty_watchlist" };
  }

  await db
    .from("marketing_os_social_intelligence_reports")
    .update({ status: "running" })
    .eq("id", report.id);

  try {
    const client = await loadClient(db, report);
    // Imported lazily: if the scan module fails to load in the bundled function
    // (a missing transitive dep, a bad env var at module scope) that surfaces
    // here as a catchable error we can write to the row, instead of killing the
    // invocation with nothing but a platform log entry.
    const { runCompetitorScan } = await import("../../lib/ai/competitor-scan");

    // Real platform data first (Instagram Business Discovery + YouTube Data
    // API), then a web-search pass for TikTok, which has no commercial API.
    // Both degrade to empty rather than failing the scan.
    const { loadCompetitorExecutionData } = await import(
      "../../lib/social/competitor-execution"
    );
    const execution = await loadCompetitorExecutionData(db, report.owner_id, websites);

    let executionBrief = execution.brief;
    if (execution.tiktokHandles.length) {
      const { researchTikTokAccounts } = await import("../../lib/ai/web-research");
      const clientContext = client
        ? `CLIENT: ${client.name}${client.industry ? ` — ${client.industry}` : ""}`
        : "CLIENT: a marketing client.";
      executionBrief += await researchTikTokAccounts(
        execution.tiktokHandles,
        clientContext,
      );
    }

    const scan = await runCompetitorScan({
      client,
      websites,
      executionBrief,
      executionGaps: execution.gaps,
    });

    await db
      .from("marketing_os_social_intelligence_reports")
      .update({
        status: "complete",
        error_message: null,
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

    return { id: report.id, ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "scan failed";
    // Baseline guidance is already on the row, so the page stays useful; we
    // only record why the live scan did not replace it.
    await db
      .from("marketing_os_social_intelligence_reports")
      .update({
        status: "failed",
        error_message: reason,
        summary:
          `The live competitor scan could not complete (${reason}). ` +
          "Baseline guidance is shown below — save the watchlist again to retry.",
      })
      .eq("id", report.id);

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
