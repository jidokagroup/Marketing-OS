function siteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    ""
  ).replace(/\/$/, "");
}

/**
 * Safety net for the competitor scan queue.
 *
 * `saveCompetitorsAction` normally triggers the background worker itself. If
 * that trigger fails (cold start, redeploy mid-save, transient network error)
 * the report would sit at `queued` forever. This sweep re-invokes the worker
 * with no body, which drains anything still queued — plus rows stuck in
 * `running` long enough to be considered lost.
 */
export default async function handler() {
  const origin = siteOrigin();
  const secret = process.env.CRON_SECRET;

  if (!origin || !secret) {
    return new Response(
      JSON.stringify({
        ok: false,
        skipped: !origin ? "missing_site_url" : "missing_cron_secret",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  const response = await fetch(`${origin}/.netlify/functions/competitor-scan-background`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}

export const config = {
  schedule: "*/5 * * * *",
};
