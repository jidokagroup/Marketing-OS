import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";
import { LOGIN_DISABLED } from "@/lib/auth-mode";
import { getSiteOrigin } from "@/lib/site-url";

export const runtime = "nodejs";

function redirectToAgent(origin: string, agentId: string, reason: string) {
  return NextResponse.redirect(
    `${origin}/agents/${agentId}?tab=connections&connect=${reason}`,
  );
}

function canonicalRedirect(request: Request, origin: string) {
  if (process.env.VERCEL_ENV !== "production") return null;

  const incoming = new URL(request.url);
  const incomingOrigin = `${incoming.protocol}//${incoming.host}`;
  if (incomingOrigin === origin) return null;

  return NextResponse.redirect(`${origin}${incoming.pathname}${incoming.search}`);
}

export async function GET(request: Request) {
  const origin = getSiteOrigin(request);
  const canonical = canonicalRedirect(request, origin);
  if (canonical) return canonical;

  const context = await getAuthContext();
  if (!context) {
    return NextResponse.redirect(
      `${origin}${LOGIN_DISABLED ? "/dashboard?connect=session_error" : "/login"}`,
    );
  }
  const { user, supabase } = context;

  const url = new URL(request.url);
  let agentId = url.searchParams.get("agent_id") ?? "";
  if (!agentId) {
    const { data: firstAgent } = await supabase
      .from("marketing_os_writing_agents")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!firstAgent?.id) {
      return NextResponse.redirect(
        `${origin}/agents?connect=error&reason=${encodeURIComponent(
          "Create or open a Client Content Agent before connecting YouTube.",
        )}`,
      );
    }

    agentId = firstAgent.id;
  }

  const { data: agent } = await supabase
    .from("marketing_os_writing_agents")
    .select("id")
    .eq("id", agentId)
    .maybeSingle();
  if (!agent) return redirectToAgent(origin, agentId, "error");

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return redirectToAgent(origin, agentId, "not_configured");
  }

  const redirectUri = `${origin}/api/social/youtube/callback`;
  const state = Buffer.from(
    JSON.stringify({ agent_id: agentId, uid: user.id }),
  ).toString("base64url");

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set(
    "scope",
    [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ].join(" "),
  );
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
