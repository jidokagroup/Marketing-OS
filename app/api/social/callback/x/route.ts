import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";
import { LOGIN_DISABLED } from "@/lib/auth-mode";
import { encryptToken } from "@/lib/crypto";
import { getSiteOrigin } from "@/lib/site-url";

export const runtime = "nodejs";

const X_REQUEST_TIMEOUT_MS = 10000;
const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const X_USER_URL =
  "https://api.x.com/2/users/me?user.fields=profile_image_url,username,name";

function redirectToAgent(origin: string, agentId: string, reason: string) {
  return NextResponse.redirect(
    `${origin}/agents/${agentId}?tab=connections&connect=${reason}`,
  );
}

function redirectToAgents(origin: string, reason: string, message?: string) {
  const params = new URLSearchParams({ connect: reason });
  if (message) params.set("reason", message.slice(0, 420));
  return NextResponse.redirect(`${origin}/agents?${params.toString()}`);
}

function redirectToAgentWithMessage(
  origin: string,
  agentId: string,
  reason: string,
  message?: string,
) {
  const params = new URLSearchParams({ tab: "connections", connect: reason });
  if (message) params.set("reason", message.slice(0, 420));
  return NextResponse.redirect(`${origin}/agents/${agentId}?${params.toString()}`);
}

async function readJson(res: Response) {
  const text = await res.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error_description: text.slice(0, 420) };
  }
}

async function fetchX(input: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), X_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "X took too long to respond. Check the X app callback URL and try connecting again.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function errorMessage(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const data = value as Record<string, unknown>;
  const candidates = [
    data.error_description,
    data.detail,
    data.title,
    data.error,
    data.message,
  ];
  const message = candidates.find((item) => typeof item === "string");
  if (!message) return fallback;

  const text = String(message);
  const normalized = text.toLowerCase();
  if (
    normalized.includes("developer app") &&
    normalized.includes("attached to a project")
  ) {
    return "X rejected this token because the developer App is not attached to an X Project. Move or create the App inside an X Project, copy that App's OAuth 2.0 Client ID/Secret to Vercel, then reconnect.";
  }

  return text;
}

export async function GET(request: Request) {
  const origin = getSiteOrigin(request);
  return handleXCallback(request, origin).catch((error) => {
    const message = error instanceof Error ? error.message : "X connection failed";
    return redirectToAgents(origin, "error", message);
  });
}

async function handleXCallback(request: Request, origin: string) {
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.redirect(
      `${origin}${LOGIN_DISABLED ? "/dashboard?connect=session_error" : "/login"}`,
    );
  }
  const { user, supabase } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return redirectToAgents(origin, "error", errorParam);
  }
  if (!code || !state) {
    return redirectToAgents(origin, "error", "X did not return an authorization code.");
  }

  const cookieStore = await cookies();
  const pkceRaw = cookieStore.get("marketing_os_x_pkce")?.value;
  if (!pkceRaw) {
    return redirectToAgents(
      origin,
      "session_error",
      "X login session expired. Start the connection again from Jidoka Marketing Team OS.",
    );
  }

  let pkce: {
    codeVerifier: string;
    state: string;
    agentId: string;
    uid: string;
  };
  try {
    pkce = JSON.parse(pkceRaw);
  } catch {
    return redirectToAgents(origin, "error", "Could not read the X login session.");
  }
  cookieStore.delete("marketing_os_x_pkce");

  if (pkce.state !== state || pkce.uid !== user.id) {
    return redirectToAgentWithMessage(
      origin,
      pkce.agentId,
      "error",
      "X login session did not match this Jidoka Marketing Team OS agent.",
    );
  }

  const { data: agent } = await supabase
    .from("marketing_os_writing_agents")
    .select("id")
    .eq("id", pkce.agentId)
    .maybeSingle();
  if (!agent) {
    return redirectToAgentWithMessage(
      origin,
      pkce.agentId,
      "error",
      "This Client Content Agent could not be found.",
    );
  }

  try {
    const clientId = process.env.X_CLIENT_ID?.trim() ?? "";
    const clientSecret = process.env.X_CLIENT_SECRET?.trim() ?? "";
    if (!clientId) {
      return redirectToAgentWithMessage(
        origin,
        pkce.agentId,
        "not_configured",
        "X_CLIENT_ID is required before connecting X.",
      );
    }

    const redirectUri = `${origin}/api/social/callback/x`;
    const tokenHeaders: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: pkce.codeVerifier,
    });

    if (clientSecret) {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      tokenHeaders.Authorization = `Basic ${basicAuth}`;
    } else {
      tokenBody.set("client_id", clientId);
    }

    const tokenRes = await fetchX(X_TOKEN_URL, {
      method: "POST",
      headers: tokenHeaders,
      body: tokenBody,
    });
    const tokenData = await readJson(tokenRes);
    if (
      !tokenRes.ok ||
      typeof tokenData.access_token !== "string" ||
      !tokenData.access_token
    ) {
      throw new Error(errorMessage(tokenData, "X token exchange failed"));
    }
    const accessToken = tokenData.access_token;
    const refreshToken =
      typeof tokenData.refresh_token === "string" ? tokenData.refresh_token : "";

    const userRes = await fetchX(X_USER_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = await readJson(userRes);
    if (!userRes.ok || !userData.data || typeof userData.data !== "object") {
      throw new Error(errorMessage(userData, "X profile lookup failed"));
    }
    const xUser = userData.data as Record<string, unknown>;
    const tokenPayload = refreshToken ? `${accessToken}||${refreshToken}` : accessToken;

    const row = {
      agent_id: pkce.agentId,
      owner_id: user.id,
      platform: "x",
      external_account_id: typeof xUser.id === "string" ? xUser.id : null,
      username:
        typeof xUser.username === "string"
          ? xUser.username
          : typeof xUser.name === "string"
            ? xUser.name
            : null,
      profile_picture_url:
        typeof xUser.profile_image_url === "string"
          ? xUser.profile_image_url
          : null,
      access_token_encrypted: encryptToken(accessToken),
      page_token_encrypted: encryptToken(tokenPayload),
      token_expires_at: tokenData.expires_in
        ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
        : null,
      status: "active",
      connected_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("marketing_os_social_accounts")
      .select("id")
      .eq("agent_id", pkce.agentId)
      .eq("platform", "x")
      .maybeSingle();
    const { error } = existing
      ? await supabase
          .from("marketing_os_social_accounts")
          .update(row)
          .eq("id", existing.id)
      : await supabase.from("marketing_os_social_accounts").insert(row);
    if (error) throw error;

    return redirectToAgent(origin, pkce.agentId, "success");
  } catch (err) {
    const message = err instanceof Error ? err.message : "x_connect_failed";
    return redirectToAgentWithMessage(origin, pkce.agentId, "error", message);
  }
}
