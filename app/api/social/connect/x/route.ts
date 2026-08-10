import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";
import { LOGIN_DISABLED } from "@/lib/auth-mode";
import { getSiteOrigin } from "@/lib/site-url";

export const runtime = "nodejs";

const DEFAULT_X_AUTH_URL = "https://twitter.com/i/oauth2/authorize";
const X_READ_SCOPES = ["tweet.read", "users.read"];
const X_REFRESH_SCOPES = ["offline.access"];
const X_WRITE_SCOPES = ["tweet.write", "media.write"];

function getXScopes() {
  const includeRefreshScope = process.env.X_ENABLE_REFRESH !== "0";
  const includeWriteScopes = process.env.X_ENABLE_POSTING !== "0";
  return [
    ...X_READ_SCOPES,
    ...(includeRefreshScope ? X_REFRESH_SCOPES : []),
    ...(includeWriteScopes ? X_WRITE_SCOPES : []),
  ];
}

function getXAuthUrl() {
  return process.env.X_AUTHORIZE_URL?.trim() || DEFAULT_X_AUTH_URL;
}

function canonicalRedirect(request: Request, origin: string) {
  if (process.env.VERCEL_ENV !== "production") return null;

  const incoming = new URL(request.url);
  const incomingOrigin = `${incoming.protocol}//${incoming.host}`;
  if (incomingOrigin === origin) return null;

  return NextResponse.redirect(`${origin}${incoming.pathname}${incoming.search}`);
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function redirectToAgent(origin: string, agentId: string, reason: string) {
  return NextResponse.redirect(
    `${origin}/agents/${agentId}?tab=connections&connect=${reason}`,
  );
}

function clientIdHint(value: string | undefined) {
  if (!value) return null;
  if (value.length <= 10) return `${value.slice(0, 2)}...${value.slice(-2)}`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
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
          "Create or open a Writing Agent before connecting X.",
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

  const clientId = process.env.X_CLIENT_ID?.trim();
  if (!clientId) {
    return redirectToAgent(origin, agentId, "not_configured");
  }

  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(
    crypto.createHash("sha256").update(codeVerifier).digest(),
  );
  const state = base64url(crypto.randomBytes(16));
  const redirectUri = `${origin}/api/social/callback/x`;
  const scopes = getXScopes();

  const cookieStore = await cookies();
  cookieStore.set(
    "marketing_os_x_pkce",
    JSON.stringify({ codeVerifier, state, agentId, uid: user.id }),
    {
      httpOnly: true,
      secure: origin.startsWith("https://"),
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    },
  );

  const authUrl = new URL(getXAuthUrl());
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes.join(" "));
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  if (url.searchParams.get("debug") === "1") {
    return NextResponse.json({
      ok: true,
      origin,
      incoming_origin: new URL(request.url).origin,
      redirect_uri: redirectUri,
      scopes,
      has_x_client_id: Boolean(clientId),
      x_client_id_hint: clientIdHint(clientId),
      has_x_client_secret: Boolean(process.env.X_CLIENT_SECRET?.trim()),
      x_enable_refresh: process.env.X_ENABLE_REFRESH !== "0",
      x_enable_posting: process.env.X_ENABLE_POSTING !== "0",
      authorize_url: authUrl.toString(),
      next_step:
        "In X Developer Portal, OAuth 2.0 Client ID must match this hint, the callback URL must exactly match redirect_uri, and permissions must cover the listed scopes.",
    });
  }

  return NextResponse.redirect(authUrl.toString());
}
