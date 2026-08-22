/**
 * What state a scheduled post is really in.
 *
 * The stored `status` column answers only part of the question. A row can say
 * "scheduled" while missing the media the publisher requires, or sit on a
 * platform whose publishing credentials this deployment does not have — both
 * of which look identical to a post that is genuinely queued to go out. This
 * derives the state a person needs: what it is, why, and what to do next.
 *
 * Nothing here writes: it reads the row and the platform's readiness, so the
 * Scheduler and the Calendar describe the same post the same way.
 */

import { getPlatformDefinition, publishBlockers } from "@/lib/social/platforms";

export type PostLifecycleState =
  | "posted"
  | "publishing"
  | "failed"
  | "blocked_connection"
  | "needs_media"
  | "needs_caption"
  | "manual_only"
  | "scheduled"
  | "ready_to_schedule"
  | "draft";

export type LifecycleView = {
  state: PostLifecycleState;
  label: string;
  /** One sentence: what this means, and what unblocks it. */
  detail: string;
  tone: "default" | "secondary" | "outline" | "destructive";
  /** Whether the publisher would take this post if its time came up now. */
  canAutoPublish: boolean;
};

export type LifecyclePost = {
  status: string;
  platform: string;
  content_type: string;
  caption?: string | null;
  media_path?: string | null;
  social_account_id?: string | null;
  scheduled_time?: string | null;
  error?: string | null;
};

export function postLifecycle(
  post: LifecyclePost,
  /** Platforms this deployment holds publishing credentials for. */
  publishReadyPlatforms: Iterable<string>,
): LifecycleView {
  const label = getPlatformDefinition(post.platform)?.label ?? post.platform;
  const ready = new Set(publishReadyPlatforms);

  if (post.status === "posted") {
    return {
      state: "posted",
      label: "Posted",
      detail: `Published to ${label}.`,
      tone: "default",
      canAutoPublish: false,
    };
  }

  if (post.status === "posting") {
    return {
      state: "publishing",
      label: "Publishing",
      detail: `Being sent to ${label} now.`,
      tone: "secondary",
      canAutoPublish: false,
    };
  }

  if (post.status === "failed") {
    return {
      state: "failed",
      label: "Failed",
      detail:
        post.error ??
        `${label} rejected this post. Fix the cause and schedule it again.`,
      tone: "destructive",
      canAutoPublish: false,
    };
  }

  const blockers = publishBlockers(post);

  // A platform with no publishing credentials in this deployment cannot take
  // any post, however complete the post itself is — so it outranks the
  // per-post blockers, which would otherwise send the user to attach media
  // that still would not make it publishable.
  if (blockers.length === 0 && !ready.has(post.platform)) {
    return {
      state: "blocked_connection",
      label: "Blocked",
      detail: `${label} publishing is not enabled for this deployment. The account is connected, but the API credentials are missing or the API is turned off, so this cannot auto-publish yet.`,
      tone: "destructive",
      canAutoPublish: false,
    };
  }

  const blocked = classifyBlockers(blockers, label);
  if (blocked) return blocked;

  if (post.status === "scheduled") {
    return {
      state: "scheduled",
      label: "Scheduled",
      detail: `Queued to publish to ${label} at its scheduled time.`,
      tone: "default",
      canAutoPublish: true,
    };
  }

  if (post.scheduled_time) {
    return {
      state: "ready_to_schedule",
      label: "Ready to schedule",
      detail: `Nothing is missing. Schedule it to hand this to ${label}.`,
      tone: "secondary",
      canAutoPublish: true,
    };
  }

  return {
    state: "draft",
    label: "Draft",
    detail: "Give this a time to move it into the publishing queue.",
    tone: "outline",
    canAutoPublish: true,
  };
}

function classifyBlockers(
  blockers: string[],
  label: string,
): LifecycleView | null {
  if (blockers.length === 0) return null;

  const text = blockers.join(" ");

  if (/not live yet/i.test(text)) {
    return {
      state: "manual_only",
      label: "Manual only",
      detail: `${text} Keep the time on it as a reminder and post it yourself.`,
      tone: "outline",
      canAutoPublish: false,
    };
  }

  if (/no connected/i.test(text)) {
    return {
      state: "blocked_connection",
      label: "Blocked",
      detail: `${text} Connect the account on the agent's Connections tab.`,
      tone: "destructive",
      canAutoPublish: false,
    };
  }

  if (/media/i.test(text)) {
    return {
      state: "needs_media",
      label: "Needs media",
      detail: `${text} ${label} will not accept this post without it.`,
      tone: "destructive",
      canAutoPublish: false,
    };
  }

  return {
    state: "needs_caption",
    label: "Needs caption",
    detail: text,
    tone: "destructive",
    canAutoPublish: false,
  };
}
