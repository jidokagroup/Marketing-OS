import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getAuthContext } from "@/lib/auth";
import type { Database } from "@/lib/supabase/types";
import { ensureCommentDmInboxDraft } from "@/lib/inbox";
import { matchGeneratedByTitle } from "@/lib/scheduler";
import {
  getPlatformDefinition,
  isAutoPublishableContent,
  isAllowedContentType,
  isSchedulerPlatform,
  SCHEDULER_PLATFORMS,
  type SchedulerPlatform,
} from "@/lib/social/platforms";

export const runtime = "nodejs";

interface CreateBody {
  agent_id?: string;
  title?: string;
  content_type?: string;
  platform?: string;
  platforms?: string[];
  caption?: string;
  media_path?: string;
  media_file_name?: string;
  media_type?: string;
  scheduled_time?: string;
  use_best_time?: boolean;
  comment_dm_enabled?: boolean;
  comment_auto_reply?: string;
  dm_sequence?: string;
  source_import?: string;
}

const DEFAULT_POSTING_WINDOWS: Record<
  SchedulerPlatform,
  { window: string; days: string; reason: string; confidence: number }
> = {
  instagram: {
    window: "Tue-Thu, 8:00-10:00 AM or 6:00-8:00 PM",
    days: "Tuesday, Wednesday, Thursday",
    reason:
      "Uses connected profile peak follower windows and competitor post timing once analytics are available.",
    confidence: 82,
  },
  facebook: {
    window: "Wed-Fri, 9:00-11:00 AM",
    days: "Wednesday, Thursday, Friday",
    reason:
      "Balances page follower activity with similar competitor education post windows.",
    confidence: 76,
  },
  youtube: {
    window: "Thu-Sun, 12:00-3:00 PM",
    days: "Thursday, Saturday, Sunday",
    reason:
      "Optimizes for longer-form discovery windows and weekend research behavior.",
    confidence: 72,
  },
  tiktok: {
    window: "Mon-Thu, 7:00-10:00 PM",
    days: "Monday, Tuesday, Wednesday, Thursday",
    reason:
      "Uses short-form engagement windows; API publishing requires TikTok Content Posting API approval.",
    confidence: 70,
  },
  x: {
    window: "Mon-Fri, 8:00-10:00 AM",
    days: "Weekdays",
    reason:
      "Keeps image-only thought leadership posts near morning conversation peaks.",
    confidence: 68,
  },
  mailchimp: {
    window: "Tue-Thu, 9:00-11:00 AM",
    days: "Tuesday, Wednesday, Thursday",
    reason:
      "Email campaigns perform best during mid-morning inbox review windows; Jidoka Marketing Team OS will refine this with connected provider audience and campaign data.",
    confidence: 74,
  },
};

function uniquePlatforms(body: CreateBody): SchedulerPlatform[] {
  const raw = Array.isArray(body.platforms) && body.platforms.length > 0
    ? body.platforms
    : [body.platform ?? "instagram"];

  const platforms = raw
    .map((platform) => String(platform).trim().toLowerCase())
    .filter(isSchedulerPlatform);

  return [...new Set(platforms)] as SchedulerPlatform[];
}

function cleanText(value: string | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Blog / Article is a manual calendar entry, not a social auto-publish
 * target -- it has no connected account to match, no posting-window
 * recommendation, no Instagram-only comment-DM wiring. Deliberately kept
 * out of SocialPlatform/PLATFORM_DEFINITIONS/SCHEDULER_PLATFORMS so it
 * doesn't ripple into Settings, Intelligence, or Analytics as a fake
 * "connectable" platform. That also keeps the record itself simple --
 * title, caption, cover image, target date -- which is what makes it easy
 * to hand off to Convia's scheduling platform later instead of entangled
 * in machinery built for Jidoka to publish content itself.
 */
async function createBlogEntry({
  supabase,
  userId,
  agentId,
  title,
  body,
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  agentId: string;
  title: string;
  body: CreateBody;
}) {
  const contentType = String(body.content_type ?? "article").trim().toLowerCase();
  if (contentType !== "article") {
    return NextResponse.json(
      { error: "Blog / Article uses the article content type." },
      { status: 400 },
    );
  }

  const match = await matchGeneratedByTitle(supabase, agentId, title);
  const { data, error } = await supabase
    .from("marketing_os_scheduled_posts")
    .insert({
      agent_id: agentId,
      owner_id: userId,
      title,
      content_type: "article",
      platform: "blog",
      social_account_id: null,
      media_path: body.media_path || null,
      media_file_name: cleanText(body.media_file_name),
      scheduled_time: cleanText(body.scheduled_time ?? undefined),
      status: "draft",
      generated_content_id: match?.generated_content_id ?? null,
      caption: cleanText(body.caption) ?? match?.caption ?? null,
      schedule_reason:
        "Blog / Article is a manual entry with no auto-publish -- pair a cover image and target date, then hand off to your CMS or Convia to publish.",
      source_import: cleanText(body.source_import),
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create post" },
      { status: 500 },
    );
  }

  revalidatePath("/scheduler");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/generated");
  revalidatePath("/clients");

  return NextResponse.json({
    ids: [data.id],
    platforms: ["blog"],
    attached: [],
    matched: Boolean(match),
  });
}

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user, supabase } = context;

  const body = (await request.json().catch(() => ({}))) as CreateBody;
  const agentId = String(body.agent_id ?? "");
  const title = String(body.title ?? "").trim();
  if (!agentId || !title) {
    return NextResponse.json(
      { error: "agent_id and title are required" },
      { status: 400 },
    );
  }

  const rawPlatforms = Array.isArray(body.platforms) && body.platforms.length > 0
    ? body.platforms.map((platform) => String(platform).trim().toLowerCase())
    : [String(body.platform ?? "instagram").trim().toLowerCase()];
  if (rawPlatforms.length === 1 && rawPlatforms[0] === "blog") {
    return createBlogEntry({ supabase, userId: user.id, agentId, title, body });
  }

  const contentType = String(body.content_type ?? "video").trim().toLowerCase();
  const platforms = uniquePlatforms(body);
  if (platforms.length === 0) {
    return NextResponse.json(
      { error: "Choose at least one supported platform." },
      { status: 400 },
    );
  }
  const pausedPlatform = platforms.find(
    (platform) => getPlatformDefinition(platform)?.disabled,
  );
  if (pausedPlatform) {
    const definition = getPlatformDefinition(pausedPlatform);
    return NextResponse.json(
      {
        error:
          definition?.disabledReason ??
          `${definition?.label ?? pausedPlatform} is not available yet.`,
      },
      { status: 400 },
    );
  }
  if (platforms.includes("x") && platforms.includes("youtube")) {
    return NextResponse.json(
      { error: "YouTube video posts and X image posts need separate scheduled posts." },
      { status: 400 },
    );
  }
  if (platforms.includes("mailchimp") && platforms.length > 1) {
    return NextResponse.json(
      { error: "Email campaigns need a separate scheduled item from social posts." },
      { status: 400 },
    );
  }
  const invalidPlatform = platforms.find(
    (platform) => !isAllowedContentType(platform, contentType),
  );
  if (invalidPlatform) {
    return NextResponse.json(
      {
        error:
          invalidPlatform === "x"
            ? "X only accepts image/photo uploads in Jidoka Marketing Team OS."
            : invalidPlatform === "youtube"
              ? "YouTube only accepts video uploads in Jidoka Marketing Team OS."
              : invalidPlatform === "mailchimp"
                ? "Email Campaign scheduler items must use the email campaign content type."
            : "That content type is not available for every selected platform.",
      },
      { status: 400 },
    );
  }
  if (platforms.includes("mailchimp") && body.media_path) {
    return NextResponse.json(
      { error: "Email campaigns do not need a media upload." },
      { status: 400 },
    );
  }
  if (platforms.includes("x") && !String(body.media_type ?? "").startsWith("image/")) {
    return NextResponse.json(
      { error: "X posts must upload an image file." },
      { status: 400 },
    );
  }
  if (platforms.includes("youtube") && !String(body.media_type ?? "").startsWith("video/")) {
    return NextResponse.json(
      { error: "YouTube posts must upload a video file." },
      { status: 400 },
    );
  }

  const { data: agent } = await supabase
    .from("marketing_os_writing_agents")
    .select("id, client_id")
    .eq("id", agentId)
    .maybeSingle();
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Title-match against the agent's generated voice content.
  const match = await matchGeneratedByTitle(supabase, agentId, title);
  const { data: accounts } = await supabase
    .from("marketing_os_social_accounts")
    .select("id, platform, status")
    .eq("agent_id", agentId)
    .in("platform", platforms)
    .eq("status", "active");
  const accountByPlatform = new Map(
    (accounts ?? []).map((account) => [account.platform, account.id]),
  );
  const selectedCaption = cleanText(body.caption) ?? match?.caption ?? null;
  const scheduledTime = cleanText(body.scheduled_time ?? undefined);

  const { data: existingPosts } = await supabase
    .from("marketing_os_scheduled_posts")
    .select("id, platform, media_path")
    .eq("agent_id", agentId)
    .eq("title", title)
    .in("platform", platforms)
    .in("status", ["draft", "scheduled"]);

  // A captioned draft with no media (e.g. created from a Film Session script)
  // is a pairing target: attaching this upload's media to it. An existing post
  // that already has media is a true duplicate and is blocked.
  const attachedPlatforms = new Set<string>();
  const blockedPlatforms: string[] = [];
  for (const post of existingPosts ?? []) {
    if (body.media_path && !post.media_path) attachedPlatforms.add(post.platform);
    else blockedPlatforms.push(post.platform);
  }
  if (blockedPlatforms.length) {
    return NextResponse.json(
      {
        error: `This title is already queued for: ${blockedPlatforms.join(", ")}. Change the title or delete the duplicate first.`,
      },
      { status: 409 },
    );
  }

  // Attach the uploaded media to the matching scripted draft(s) by title.
  for (const post of existingPosts ?? []) {
    if (!attachedPlatforms.has(post.platform)) continue;
    const socialAccountId = accountByPlatform.get(post.platform) ?? null;
    const autoPublishable = isAutoPublishableContent(post.platform, contentType);
    await supabase
      .from("marketing_os_scheduled_posts")
      .update({
        media_path: body.media_path || null,
        media_file_name: cleanText(body.media_file_name),
        content_type: contentType,
        scheduled_time: scheduledTime,
        status: scheduledTime && socialAccountId && autoPublishable ? "scheduled" : "draft",
        error:
          scheduledTime && socialAccountId && !autoPublishable
            ? `${getPlatformDefinition(post.platform)?.label ?? post.platform} ${contentType} auto-publishing is not live yet. This item is saved as a draft.`
            : null,
        ...(cleanText(body.caption) ? { caption: cleanText(body.caption) } : {}),
      })
      .eq("id", post.id);
  }

  const newPlatforms = platforms.filter((platform) => !attachedPlatforms.has(platform));
  const rows = newPlatforms.map((platform) => {
    const recommendation = DEFAULT_POSTING_WINDOWS[platform];
    const socialAccountId = accountByPlatform.get(platform) ?? null;
    const autoPublishable = isAutoPublishableContent(platform, contentType);
    return {
      agent_id: agentId,
      owner_id: user.id,
      title,
      content_type: contentType,
      platform,
      social_account_id: socialAccountId,
      media_path: body.media_path || null,
      media_file_name: cleanText(body.media_file_name),
      scheduled_time: scheduledTime,
      status: scheduledTime && socialAccountId && autoPublishable ? "scheduled" : "draft",
      generated_content_id: match?.generated_content_id ?? null,
      caption: selectedCaption,
      script: match?.script ?? null,
      best_posting_window: body.use_best_time
        ? recommendation.window
        : recommendation.window,
      ideal_days: recommendation.days,
      confidence_score: recommendation.confidence,
      schedule_reason: body.use_best_time
        ? autoPublishable || !scheduledTime || !socialAccountId
          ? recommendation.reason
          : `${recommendation.reason} Auto-publishing for ${getPlatformDefinition(platform)?.label ?? platform} ${contentType} is not live yet, so this stays as a draft with timing attached.`
        : autoPublishable || !scheduledTime || !socialAccountId
          ? "Manual time selected. Best-time guidance remains visible for comparison."
          : `Manual time selected. Auto-publishing for ${getPlatformDefinition(platform)?.label ?? platform} ${contentType} is not live yet, so this stays as a draft with timing attached.`,
      error:
        scheduledTime && socialAccountId && !autoPublishable
          ? `${getPlatformDefinition(platform)?.label ?? platform} ${contentType} auto-publishing is not live yet.`
          : null,
      comment_dm_enabled:
        platform === "instagram" ? Boolean(body.comment_dm_enabled) : false,
      comment_auto_reply:
        platform === "instagram" ? cleanText(body.comment_auto_reply) : null,
      dm_sequence: platform === "instagram" ? cleanText(body.dm_sequence) : null,
      source_import: cleanText(body.source_import),
    };
  });

  let posts: {
    id: string;
    owner_id: string;
    agent_id: string;
    social_account_id: string | null;
    platform: string;
    title: string | null;
    caption: string | null;
    comment_dm_enabled: boolean | null;
    comment_auto_reply: string | null;
    dm_sequence: string | null;
  }[] = [];
  if (rows.length > 0) {
    const { data, error } = await supabase
      .from("marketing_os_scheduled_posts")
      .insert(rows)
      .select(
        "id, owner_id, agent_id, social_account_id, platform, title, caption, comment_dm_enabled, comment_auto_reply, dm_sequence",
      );
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Could not create post" },
        { status: 500 },
      );
    }
    posts = data;
  }

  await Promise.all(
    posts
      .filter((post) => post.platform === "instagram" && post.comment_dm_enabled)
      .map((post) =>
        ensureCommentDmInboxDraft({
          supabase,
          post,
          clientId: agent.client_id ?? null,
        }),
      ),
  ).catch((inboxError) => {
    console.warn(
      "[scheduler] could not create inbox review drafts",
      inboxError instanceof Error ? inboxError.message : inboxError,
    );
  });

  revalidatePath("/scheduler");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/generated");
  revalidatePath("/clients");

  return NextResponse.json({
    ids: posts.map((post) => post.id),
    platforms: [...posts.map((post) => post.platform), ...attachedPlatforms],
    attached: [...attachedPlatforms],
    matched: Boolean(match),
    available_platforms: SCHEDULER_PLATFORMS.filter(
      (platform) => !platform.disabled,
    ).map((platform) => platform.key),
  });
}
