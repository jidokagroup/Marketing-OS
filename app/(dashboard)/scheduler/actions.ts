"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { matchGeneratedByTitle } from "@/lib/scheduler";
import {
  getPlatformDefinition,
  isAutoPublishableContent,
} from "@/lib/social/platforms";

export async function scheduleAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const when = String(formData.get("scheduled_time") ?? "");
  if (!id || !when) return;

  const { data: post } = await supabase
    .from("marketing_os_scheduled_posts")
    .select("social_account_id, platform, content_type")
    .eq("id", id)
    .maybeSingle();
  const autoPublishable = post
    ? isAutoPublishableContent(post.platform, post.content_type)
    : false;

  await supabase
    .from("marketing_os_scheduled_posts")
    .update({
      scheduled_time: new Date(when).toISOString(),
      status: post?.social_account_id && autoPublishable ? "scheduled" : "draft",
      error:
        post?.social_account_id && !autoPublishable
          ? `${getPlatformDefinition(post.platform)?.label ?? post.platform} ${post.content_type} auto-publishing is not live yet.`
          : null,
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
