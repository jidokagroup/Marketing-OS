"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { wallTimeToInstant, workspaceTimeZone } from "@/lib/timezone";
import { matchGeneratedByTitle } from "@/lib/scheduler";
import { publishBlockers } from "@/lib/social/platforms";

export async function scheduleAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const when = String(formData.get("scheduled_time") ?? "");
  if (!id || !when) return;

  // A datetime-local field carries a wall time with no zone. Parsing it here
  // with `new Date` would read it in the host's zone — UTC on Netlify — and
  // schedule the post hours away from the time the user picked.
  const scheduledAt = wallTimeToInstant(when, await workspaceTimeZone());
  if (!scheduledAt) return;

  const { data: post } = await supabase
    .from("marketing_os_scheduled_posts")
    .select("social_account_id, platform, content_type, caption, media_path")
    .eq("id", id)
    .maybeSingle();

  // A post the publisher would reject stays a draft with the reason on it,
  // rather than sitting in the queue as "Scheduled" until it fails unattended.
  const blockers = post ? publishBlockers(post) : ["Post not found."];

  await supabase
    .from("marketing_os_scheduled_posts")
    .update({
      scheduled_time: scheduledAt.toISOString(),
      status: blockers.length === 0 ? "scheduled" : "draft",
      error: blockers.length === 0 ? null : blockers.join(" "),
    })
    .eq("id", id);
  revalidatePath("/scheduler");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/generated");
}

export async function unscheduleAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase
    .from("marketing_os_scheduled_posts")
    .update({ status: "draft", scheduled_time: null })
    .eq("id", id);
  revalidatePath("/scheduler");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/generated");
}

/** Re-run the TITLE match (useful after generating content post-upload). */
export async function rematchAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { data: post } = await supabase
    .from("marketing_os_scheduled_posts")
    .select("id, agent_id, title")
    .eq("id", id)
    .maybeSingle();
  if (!post?.title) return;

  const match = await matchGeneratedByTitle(supabase, post.agent_id, post.title);
  await supabase
    .from("marketing_os_scheduled_posts")
    .update({
      generated_content_id: match?.generated_content_id ?? null,
      caption: match?.caption ?? null,
      script: match?.script ?? null,
    })
    .eq("id", id);
  revalidatePath("/scheduler");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/generated");
}

export async function updateCaptionAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const caption = String(formData.get("caption") ?? "").trim();
  if (!id) return;

  await supabase
    .from("marketing_os_scheduled_posts")
    .update({ caption: caption || null })
    .eq("id", id);
  revalidatePath("/scheduler");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/generated");
}

export async function updateCommentDmFlowAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const commentDmEnabled = formData.get("comment_dm_enabled") === "on";
  const commentAutoReply = String(formData.get("comment_auto_reply") ?? "").trim();
  const dmSequence = String(formData.get("dm_sequence") ?? "").trim();

  const { data: post } = await supabase
    .from("marketing_os_scheduled_posts")
    .select("platform")
    .eq("id", id)
    .maybeSingle();
  if (post?.platform !== "instagram") return;

  await supabase
    .from("marketing_os_scheduled_posts")
    .update({
      comment_dm_enabled: commentDmEnabled,
      comment_auto_reply: commentAutoReply || null,
      dm_sequence: dmSequence || null,
    })
    .eq("id", id);

  revalidatePath("/scheduler");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/clients");
}

export async function duplicatePostAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { data: post } = await supabase
    .from("marketing_os_scheduled_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!post) return;

  await supabase.from("marketing_os_scheduled_posts").insert({
    agent_id: post.agent_id,
    owner_id: user.id,
    generated_content_id: post.generated_content_id,
    social_account_id: post.social_account_id,
    platform: post.platform,
    title: `Copy of ${post.title || "scheduled post"}`,
    caption: post.caption,
    script: post.script,
    media_url: post.media_url,
    media_path: post.media_path,
    content_type: post.content_type,
    status: "draft",
    scheduled_time: null,
    best_posting_window: post.best_posting_window,
    ideal_days: post.ideal_days,
    confidence_score: post.confidence_score,
    schedule_reason: post.schedule_reason,
    comment_dm_enabled: post.comment_dm_enabled,
    comment_auto_reply: post.comment_auto_reply,
    dm_sequence: post.dm_sequence,
    source_import: post.source_import,
    media_file_name: post.media_file_name,
  });

  revalidatePath("/scheduler");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/generated");
}

export async function deletePostAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { data: post, error: postError } = await supabase
    .from("marketing_os_scheduled_posts")
    .select("media_path")
    .eq("id", id)
    .maybeSingle();
  if (postError) throw new Error(postError.message);

  if (post?.media_path) {
    const { count, error: countError } = await supabase
      .from("marketing_os_scheduled_posts")
      .select("id", { count: "exact", head: true })
      .eq("media_path", post.media_path)
      .neq("id", id);
    if (countError) throw new Error(countError.message);

    if (!count) {
      await supabase.storage.from("marketing-os-media").remove([post.media_path]);
    }
  }
  const { error: deleteError } = await supabase
    .from("marketing_os_scheduled_posts")
    .delete()
    .eq("id", id);
  if (deleteError) throw new Error(deleteError.message);

  revalidatePath("/scheduler");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/generated");
}


/**
 * Queues one platform for another attempt.
 *
 * Scoped to a single row on purpose. The sibling rows for the same piece are
 * separate publications that already succeeded, and a group-level retry would
 * post their content a second time — which is the outcome the whole publish
 * path is built to avoid. A row that already carries an external id is left
 * alone for the same reason.
 */
export async function retryPlatformAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const { data: post } = await supabase
    .from("marketing_os_scheduled_posts")
    .select("id, status, external_post_id, scheduled_time")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  // Not ours, already out, or not in a state a retry applies to.
  if (!post || post.external_post_id || post.status !== "failed") return;

  await supabase
    .from("marketing_os_scheduled_posts")
    .update({
      status: "scheduled",
      error: null,
      error_code: null,
      internal_error: null,
      // Attempts are deliberately reset: a person choosing to retry is new
      // information, and the automatic cap exists to stop the publisher
      // looping unattended, not to stop someone trying again.
      attempts: 0,
      // Due immediately rather than at the original time, which has passed.
      scheduled_time: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_id", user.id);

  revalidatePath("/scheduler");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}
