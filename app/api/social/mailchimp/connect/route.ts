import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";
import { LOGIN_DISABLED } from "@/lib/auth-mode";
import { encryptToken } from "@/lib/crypto";
import {
  getMailchimpOAuthUrl,
  isMailchimpOAuthConfigured,
} from "@/lib/social/mailchimp";
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
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!firstAgent?.id) {
      return NextResponse.redirect(
        `${origin}/agents?connect=error&reason=${encodeURIComponent(
          "Create or open a Client Content Agent before connecting Mailchimp.",
        )}`,
      );
    }

    agentId = firstAgent.id;
  }

  const { data: agent } = await supabase
    .from("marketing_os_writing_agents")
    .select("id")
    .eq("id", agentId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!agent) return redirectToAgent(origin, agentId, "error");

  if (!isMailchimpOAuthConfigured()) {
    return redirectToAgent(origin, agentId, "not_configured");
  }

  const state = crypto.randomBytes(18).toString("base64url");
  const redirectUri = `${origin}/api/social/mailchimp/callback`;
  const cookieStore = await cookies();
  cookieStore.set(
    "marketing_os_mailchimp_oauth",
    encryptToken(JSON.stringify({ agentId, uid: user.id, state })),
    {
      httpOnly: true,
      secure: origin.startsWith("https://"),
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    },
  );

  return NextResponse.redirect(getMailchimpOAuthUrl({ redirectUri, state }));
}
