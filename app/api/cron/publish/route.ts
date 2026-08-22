import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { classifyError, internalErrorRecord, toCustomerError } from "@/lib/errors";
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
import {
  encryptedYouTubeTokenUpdate,
  isYouTubeConfigured,
  publishToYouTube,
  refreshYouTubeAccessToken,
} from "@/lib/social/youtube";
import {
  encryptedXTokenUpdate,
  isXConfigured,
  publishToX,
  refreshXAccessToken,
} from "@/lib/social/x";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Past this a post has had a fair run; retrying forever just spins. */
const MAX_PUBLISH_ATTEMPTS = 3;
/** How long a row may sit in `posting` before it is treated as abandoned. */
const STRANDED_POSTING_MS = 10 * 60 * 1000;

/**
 * Rescues rows a dead worker left in `posting`.
 *
 * The outcome is knowable from the row itself: an external id means the
 * platform accepted it before the worker died, so it is published and must
 * never be sent again. No external id means the call did not complete, and it
 * is safe to queue for one more attempt.
 */
async function reclaimStrandedPosts(admin: ReturnType<typeof createAdminClient>) {
  const cutoff = new Date(Date.now() - STRANDED_POSTING_MS).toISOString();
  const { data: stranded } = await admin
    .from("marketing_os_scheduled_posts")
    .select("id, external_post_id, attempts, last_attempted_at")
    .eq("status", "posting")
    .lt("last_attempted_at", cutoff)
    .limit(25);

  for (const post of stranded ?? []) {
    if (post.external_post_id) {
      await admin
        .from("marketing_os_scheduled_posts")
        .update({ status: "posted", error: null, error_code: null })
        .eq("id", post.id);
      continue;
    }

    const exhausted = (post.attempts ?? 0) >= MAX_PUBLISH_ATTEMPTS;
    await admin
      .from("marketing_os_scheduled_posts")
      .update(
        exhausted
          ? {
              status: "failed",
              error: "This didn't go through after several attempts.",
              error_code: "attempts_exhausted",
            }
          : { status: "scheduled" },
      )
      .eq("id", post.id);
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Rows a previous run left mid-flight. Nothing used to reclaim these, so a
  // worker that died between the platform call and the write-back left a post
  // showing "Publishing" forever, with nobody able to say whether it had
  // actually gone out.
  await reclaimStrandedPosts(admin);

  // Due posts across all users. Only platforms/content types with a live
  // publisher should be marked scheduled, but this also cleans up older rows.
  const { data: due } = await admin
    .from("marketing_os_scheduled_posts")
    .select(
      "id, agent_id, owner_id, platform, title, caption, media_path, content_type, social_account_id, external_post_id, attempts",
    )
    .eq("status", "scheduled")
    .lte("scheduled_time", nowIso)
    .limit(25);

  const results: { id: string; ok: boolean; error?: string; skipped?: string }[] = [];

  for (const post of due ?? []) {
    // Already published. A row can reach here after a reclaim that could not
    // prove the outcome; republishing it would post the same content twice.
    if (post.external_post_id) {
      await admin
        .from("marketing_os_scheduled_posts")
        .update({ status: "posted", error: null })
        .eq("id", post.id);
      results.push({ id: post.id, ok: true, skipped: "already_published" });
      continue;
    }

    if ((post.attempts ?? 0) >= MAX_PUBLISH_ATTEMPTS) {
      await admin
        .from("marketing_os_scheduled_posts")
        .update({
          status: "failed",
          error: "This didn't go through after several attempts.",
          error_code: "attempts_exhausted",
        })
        .eq("id", post.id);
      results.push({ id: post.id, ok: false, skipped: "attempts_exhausted" });
      continue;
    }

    // Conditional claim. The old code read the row and then updated it
    // unconditionally, so two overlapping runs both claimed the same post and
    // both published it. Only the run whose update actually matched proceeds.
    const { data: claimed } = await admin
      .from("marketing_os_scheduled_posts")
      .update({
        status: "posting",
        attempts: (post.attempts ?? 0) + 1,
        last_attempted_at: new Date().toISOString(),
      })
      .eq("id", post.id)
      .eq("status", "scheduled")
      .select("id");

    if (!claimed || claimed.length === 0) {
      results.push({ id: post.id, ok: true, skipped: "claimed_by_another_run" });
      continue;
    }

    try {

      if (!isAutoPublishableContent(post.platform, post.content_type)) {
        const label = getPlatformDefinition(post.platform)?.label ?? post.platform;
        throw new Error(
          `${label} ${post.content_type} auto-publishing is not live yet. Keep this as a draft or publish manually.`,
        );
      }

      // Resolve the account to post with.
      let accountQuery = admin
        .from("marketing_os_social_accounts")
        .select("id, access_token_encrypted, page_token_encrypted, external_account_id, page_id, token_expires_at, status")
        .eq("agent_id", post.agent_id)
        .eq("status", "active");
      accountQuery = post.social_account_id
        ? accountQuery.eq("id", post.social_account_id)
        : accountQuery.eq("platform", post.platform);
      const { data: account } = await accountQuery.limit(1).maybeSingle();

      if (!account) {
        throw new Error("No active connected account for this post");
      }
      if (!post.media_path) throw new Error("No media attached");

      // Signed, fetchable URL for Meta to ingest.
      const { data: signed } = await admin.storage.from("marketing-os-media")
        .createSignedUrl(post.media_path, 1800);
      if (!signed?.signedUrl) throw new Error("Could not sign media URL");

      let mediaId: string;
      if (post.platform === "instagram" || post.platform === "facebook") {
        if (!isMetaConfigured()) throw new Error("Meta publishing env vars are not configured.");
        if (!account.page_token_encrypted || !account.external_account_id) {
          throw new Error("No active connected Meta account for this post");
        }

        const pageToken = decryptToken(account.page_token_encrypted);
        mediaId =
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
      } else if (post.platform === "youtube") {
        if (!isYouTubeConfigured()) {
          throw new Error("Google OAuth env vars are not configured for YouTube publishing.");
        }
        const tokenUpdate = await refreshYouTubeAccessToken(account);
        await admin
          .from("marketing_os_social_accounts")
          .update(encryptedYouTubeTokenUpdate(tokenUpdate))
          .eq("id", account.id);
        mediaId = await publishToYouTube({
          accessToken: tokenUpdate.accessToken,
          title: post.title ?? "Scheduled video",
          description: post.caption ?? "",
          mediaUrl: signed.signedUrl,
          privacyStatus: process.env.YOUTUBE_PRIVACY_STATUS ?? "public",
        });
      } else if (post.platform === "x") {
        if (!isXConfigured()) throw new Error("X OAuth env vars are not configured.");
        const tokenUpdate = await refreshXAccessToken(account);
        await admin
          .from("marketing_os_social_accounts")
          .update(encryptedXTokenUpdate(tokenUpdate))
          .eq("id", account.id);
        mediaId = await publishToX({
          accessToken: tokenUpdate.accessToken,
          caption: post.caption || post.title || "",
          mediaUrl: signed.signedUrl,
        });
      } else {
        throw new Error(`${post.platform} auto-publishing is not implemented.`);
      }

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
      const category = classifyError(err);
      const shown = toCustomerError(err, { action: "publish this post" });

      // Two records, deliberately. `error` is the sentence shown next to the
      // post; `internal_error` keeps the provider's own words for diagnosis.
      await admin
        .from("marketing_os_scheduled_posts")
        .update({
          status: "failed",
          error: `${shown.explanation} ${shown.nextAction}`,
          error_code: category,
          internal_error: message,
        })
        .eq("id", post.id);
      console.error(
        "[publish] failed",
        internalErrorRecord(err, { postId: post.id, platform: post.platform }),
      );
      results.push({ id: post.id, ok: false, error: message });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
