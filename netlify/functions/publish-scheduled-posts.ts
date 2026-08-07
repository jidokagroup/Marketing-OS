function siteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    ""
  ).replace(/\/$/, "");
}

export default async function handler() {
  const origin = siteOrigin();
  const secret = process.env.CRON_SECRET;

  if (!origin || !secret) {
    return new Response(
      JSON.stringify({
        ok: false,
        skipped: !origin ? "missing_site_url" : "missing_cron_secret",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const response = await fetch(`${origin}/api/cron/publish`, {
    headers: { authorization: `Bearer ${secret}` },
  });
  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}

export const config = {
  schedule: "*/10 * * * *",
};
