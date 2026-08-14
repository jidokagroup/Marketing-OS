import { createServiceClient } from "../../lib/supabase/service-client";

/**
 * Diagnostics for the competitor scan worker.
 *
 * The worker is a background function, so Netlify acks it with 202 and throws
 * away its response — a startup crash is invisible unless you read the platform
 * log. This endpoint is deliberately *synchronous* and runs the same startup
 * steps (env, Supabase connectivity, the queued-rows query, loading the scan
 * module) so a single authenticated request explains why scans are not running.
 *
 * It never returns secret values, only whether each one is present.
 */

type Check = { ok: boolean; detail?: string };

function present(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.length > 0;
}

export default async function handler(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const env = {
    CRON_SECRET: present("CRON_SECRET"),
    SUPABASE_SERVICE_ROLE_KEY: present("SUPABASE_SERVICE_ROLE_KEY"),
    NEXT_PUBLIC_SUPABASE_URL: present("NEXT_PUBLIC_SUPABASE_URL"),
    SUPABASE_URL: present("SUPABASE_URL"),
    ANTHROPIC_API_KEY: present("ANTHROPIC_API_KEY"),
    site_origin:
      process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || "",
  };

  const checks: Record<string, Check> = {};

  // 1. Can the scan module load in the bundled function at all?
  try {
    const mod = await import("../../lib/ai/competitor-scan");
    checks.scan_module = {
      ok: typeof mod.runCompetitorScan === "function",
      detail: typeof mod.runCompetitorScan === "function" ? "loaded" : "export missing",
    };
  } catch (error) {
    checks.scan_module = {
      ok: false,
      detail: error instanceof Error ? error.message : "import failed",
    };
  }

  // 2. Can we build the service-role client and reach the table?
  let queued: number | null = null;
  let statuses: Record<string, number> = {};

  {
    try {
      const db = createServiceClient();
      const { data, error } = await db
        .from("marketing_os_social_intelligence_reports")
        .select("status")
        .order("requested_at", { ascending: false })
        .limit(50);

      if (error) {
        checks.supabase = { ok: false, detail: `query failed: ${error.message}` };
      } else {
        checks.supabase = { ok: true, detail: `read ${data?.length ?? 0} rows` };
        statuses = (data ?? []).reduce<Record<string, number>>((acc, row) => {
          const s = String((row as { status?: string }).status ?? "unknown");
          acc[s] = (acc[s] ?? 0) + 1;
          return acc;
        }, {});
        queued = statuses.queued ?? 0;
      }
    } catch (error) {
      checks.supabase = {
        ok: false,
        detail: error instanceof Error ? error.message : "client failed",
      };
    }
  }

  const ok = Object.values(checks).every((check) => check.ok);

  return new Response(
    JSON.stringify({ ok, env, checks, queued, statuses }, null, 2),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
