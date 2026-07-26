import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";
import { LOGIN_DISABLED } from "@/lib/auth-mode";
import { isMetaOAuthConfigured, getMetaOAuthUrl } from "@/lib/social/meta";
import { getPlatformDefinition } from "@/lib/social/platforms";
import { getSiteOrigin } from "@/lib/site-url";

export const runtime = "nodejs";

function canonicalRedirect(request: Request, origin: string) {
  if (process.env.VERCEL_ENV !== "production") return null;

  const incoming = new URL(request.url);
  const incomingOrigin = `${incoming.protocol}//${incoming.host}`;
  if (incomingOrigin === origin) return null;

  return NextResponse.redirect(`${origin}${incoming.pathname}${incoming.search}`);
}

function redirectWithMessage(origin: string, reason: string) {
  const params = new URLSearchParams({
    connect: "error",
    reason,
  });
  return NextResponse.redirect(`${origin}/agents?${params.toString()}`);
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
  const platform = url.searchParams.get("platform") ?? "instagram";
  const platformDefinition = getPlatformDefinition(platform);

  if (!agentId) {
    const { data: firstAgent } = await supabase
      .from("marketing_os_writing_agents")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!firstAgent?.id) {
      return redirectWithMessage(
        origin,
        "Create or open a Client Content Agent before connecting social accounts.",
      );
    }

    agentId = firstAgent.id;
  }
  if (platformDefinition?.disabled) {
    return NextResponse.redirect(
      `${origin}/agents/${agentId}?connect=api_setup`,
    );
  }
  if (platformDefinition && !platformDefinition.connectable) {
    return NextResponse.redirect(
      `${origin}/agents/${agentId}?tab=connections&connect=coming_soon`,
    );
  }

  if (platform === "instagram" || platform === "facebook") {
    if (!isMetaOAuthConfigured()) {
      return NextResponse.redirect(
        `${origin}/agents/${agentId}?tab=connections&connect=not_configured`,
      );
    }
    const redirectUri = `${origin}/api/social/callback`;
    const state = Buffer.from(
      JSON.stringify({ agent_id: agentId, platform, uid: user.id }),
    ).toString("base64url");
    return NextResponse.redirect(getMetaOAuthUrl(state, redirectUri));
  }

  if (platform === "youtube") {
    return NextResponse.redirect(
      `${origin}/api/social/youtube/connect?agent_id=${encodeURIComponent(agentId)}`,
    );
  }

  if (platform === "x") {
    return NextResponse.redirect(
      `${origin}/api/social/connect/x?agent_id=${encodeURIComponent(agentId)}`,
    );
  }

  if (platform === "mailchimp") {
    return NextResponse.redirect(
      `${origin}/api/social/mailchimp/connect?agent_id=${encodeURIComponent(agentId)}`,
    );
  }

  // Other platforms not yet wired.
  return NextResponse.redirect(
    `${origin}/agents/${agentId}?tab=connections&connect=coming_soon`,
  );
}
