import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/crypto";
import {
  isMetaConfigured,
  publishToFacebook,
  publishToInstagram,
} from "@/lib/social/meta";
import {
  getPlatformDefinition,
  isAutoPublishableContent,
} from "@/lib/social/platforms";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isMetaConfigured()) {
    return NextResponse.json({ ok: true, skipped: "meta_not_configured" });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Due posts across all users. Only platforms/content types with a live
  // publisher should be marked scheduled, but this also cleans up older rows.
  const { data: due } = await admin
    .from("marketing_os_scheduled_posts")
    .select(
      "id, agent_id, owner_id, platform, caption, media_path, content_type, social_account_id",
    )
    .eq("status", "scheduled")
    .lte("scheduled_time", nowIso)
    .limit(25);

  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const post of due ?? []) {
    try {
      await admin.from("marketing_os_scheduled_posts").update({ status: "posting" }).eq("id", post.id);

      if (!isAutoPublishableContent(post.platform, post.content_type)) {
        const label = getPlatformDefinition(post.platform)?.label ?? post.platform;
        throw new Error(
          `${label} ${post.content_type} auto-publishing is not live yet. Keep this as a draft or publish manually.`,
        );
      }

      // Resolve the account to post with.
      let accountQuery = admin
        .from("marketing_os_social_accounts")
        .select("id, page_token_encrypted, external_account_id, page_id, status")
        .eq("agent_id", post.agent_id)
        .eq("status", "active");
      accountQuery = post.social_account_id
        ? accountQuery.eq("id", post.social_account_id)
        : accountQuery.eq("platform", post.platform);
      const { data: account } = await accountQuery.limit(1).maybeSingle();

      if (!account?.page_token_encrypted || !account.external_account_id) {
        throw new Error("No active connected account for this post");
      }
      if (!post.media_path) throw new Error("No media attached");

      // Signed, fetchable URL for Meta to ingest.
      const { data: signed } = await admin.storage.from("marketing-os-media")
        .createSignedUrl(post.media_path, 1800);
      if (!signed?.signedUrl) throw new Error("Could not sign media URL");

      const pageToken = decryptToken(account.page_token_encrypted);
      const mediaId =
        post.platform === "instagram"
          ? await publishToInstagram({
              igUserId: account.external_account_id,
              pageToken,
              caption: post.caption ?? "",
              mediaUrl: signed.signedUrl,
              contentType: post.content_type,
            })
          : await publishToFacebook({
              pageId: account.page_id ?? account.external_account_id,
              pageToken,
              caption: post.caption ?? "",
              mediaUrl: signed.signedUrl,
              contentType: post.content_type,
            });

      await admin
        .from("marketing_os_scheduled_posts")
        .update({
          status: "posted",
          posted_at: new Date().toISOString(),
          external_post_id: mediaId,
          social_account_id: account.id,
          error: null,
        })
        .eq("id", post.id);
      results.push({ id: post.id, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "publish failed";
      await admin
        .from("marketing_os_scheduled_posts")
        .update({ status: "failed", error: message })
        .eq("id", post.id);
      results.push({ id: post.id, ok: false, error: message });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
