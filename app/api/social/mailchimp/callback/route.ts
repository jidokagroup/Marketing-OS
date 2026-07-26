import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";
import { LOGIN_DISABLED } from "@/lib/auth-mode";
import { decryptToken, encryptToken } from "@/lib/crypto";
import {
  exchangeMailchimpCodeForToken,
  fetchMailchimpAccountProfile,
  fetchMailchimpMetadata,
} from "@/lib/social/mailchimp";
import { getSiteOrigin } from "@/lib/site-url";

export const runtime = "nodejs";

type PendingMailchimpOAuth = {
  agentId: string;
  uid: string;
  state: string;
};

function redirectToAgent(
  origin: string,
  agentId: string,
  connect: string,
  reason?: string,
) {
  const params = new URLSearchParams({ tab: "connections", connect });
  if (reason) params.set("reason", reason.slice(0, 220));
  return NextResponse.redirect(`${origin}/agents/${agentId}?${params.toString()}`);
}

function redirectToAgents(origin: string, connect: string, reason?: string) {
  const params = new URLSearchParams({ connect });
  if (reason) params.set("reason", reason.slice(0, 220));
  return NextResponse.redirect(`${origin}/agents?${params.toString()}`);
}

function parsePending(raw: string | undefined) {
  if (!raw) return null;
  try {
    return JSON.parse(decryptToken(raw)) as PendingMailchimpOAuth;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const origin = getSiteOrigin(request);
  return handleMailchimpCallback(request, origin).catch((error) => {
    const message =
      error instanceof Error ? error.message : "Mailchimp connection failed.";
    return redirectToAgents(origin, "error", message);
  });
}

async function handleMailchimpCallback(request: Request, origin: string) {
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

  const cookieStore = await cookies();
  const pending = parsePending(cookieStore.get("marketing_os_mailchimp_oauth")?.value);
  if (!pending || pending.uid !== user.id) {
    return redirectToAgents(
      origin,
      "session_error",
      "Mailchimp login expired. Start the connection again.",
    );
  }
  cookieStore.delete("marketing_os_mailchimp_oauth");

  if (errorParam) {
    return redirectToAgent(origin, pending.agentId, "error", errorParam);
  }
  if (!code) {
    return redirectToAgent(
      origin,
      pending.agentId,
      "error",
      "Mailchimp did not return an authorization code.",
    );
  }
  if (state && state !== pending.state) {
    return redirectToAgent(
      origin,
      pending.agentId,
      "error",
      "Mailchimp login session did not match this Jidoka Marketing Team OS agent.",
    );
  }

  const { data: agent } = await supabase
    .from("marketing_os_writing_agents")
    .select("id")
    .eq("id", pending.agentId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!agent) {
    return redirectToAgents(origin, "error", "This Client Content Agent could not be found.");
  }

  const redirectUri = `${origin}/api/social/mailchimp/callback`;
  const accessToken = await exchangeMailchimpCodeForToken({ code, redirectUri });
  const metadata = await fetchMailchimpMetadata(accessToken);
  const profile = await fetchMailchimpAccountProfile({
    accessToken,
    dc: metadata.dc,
  });
  const username = profile.accountName ?? metadata.login ?? "Mailchimp account";
  const externalId = profile.accountId ?? metadata.userId ?? metadata.dc;
  const accountPayload = {
    dc: metadata.dc,
    api_endpoint: `https://${metadata.dc}.api.mailchimp.com/3.0/`,
    account_id: profile.accountId,
    account_name: profile.accountName,
    email: profile.email,
    metadata: metadata.raw,
  };

  const row = {
    agent_id: pending.agentId,
    owner_id: user.id,
    platform: "mailchimp",
    external_account_id: externalId,
    username,
    profile_picture_url: null,
    access_token_encrypted: encryptToken(accessToken),
    page_id: metadata.dc,
    page_token_encrypted: encryptToken(JSON.stringify(accountPayload)),
    token_expires_at: null,
    status: "active",
    connected_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("marketing_os_social_accounts")
    .select("id")
    .eq("agent_id", pending.agentId)
    .eq("platform", "mailchimp")
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("marketing_os_social_accounts")
        .update(row)
        .eq("id", existing.id)
    : await supabase.from("marketing_os_social_accounts").insert(row);
  if (error) throw error;

  return redirectToAgent(origin, pending.agentId, "success");
}
