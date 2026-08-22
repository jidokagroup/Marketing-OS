/**
 * One piece of content, across the platforms it was published to.
 *
 * The scheduler stores a row per platform, which is the right shape for
 * publishing — each platform succeeds or fails on its own — but the wrong
 * shape for reading. Three rows meant three statuses, so a post that reached
 * Instagram and Facebook and was refused by YouTube looked like a success, a
 * success and a failure, with nothing saying they were the same post or that
 * two thirds of it had gone out.
 *
 * This rolls those rows up. The rollup is deliberately pessimistic about
 * wording and precise about counts: it never reports a publication as
 * published while any platform is still outstanding, and never as failed while
 * any platform succeeded.
 */

import { postLifecycle, type LifecycleView, type LifecyclePost } from "@/lib/scheduler-lifecycle";
import { getPlatformDefinition } from "@/lib/social/platforms";

export type GroupablePost = LifecyclePost & {
  id: string;
  title: string | null;
  agent_id: string;
  generated_content_id?: string | null;
  external_post_id?: string | null;
  attempts?: number | null;
};

export type PublicationState =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "partial"
  | "failed"
  | "blocked";

export type PublicationGroup<T extends GroupablePost = GroupablePost> = {
  key: string;
  title: string;
  state: PublicationState;
  /** What to say about the publication as a whole. */
  summary: string;
  members: { post: T; lifecycle: LifecycleView; platformLabel: string }[];
  /** Members that could be retried without touching what already succeeded. */
  retryable: T[];
};

/**
 * Rows belong together when they came from the same generated piece. Failing
 * that, a title within one agent is the only honest signal available — two
 * unrelated posts sharing a title on one seat is a naming collision, not a
 * correctness problem, and grouping them is still better than three
 * disconnected rows.
 */
export function groupKeyFor(post: GroupablePost): string {
  if (post.generated_content_id) return `content:${post.generated_content_id}`;
  return `title:${post.agent_id}:${(post.title ?? "").trim().toLowerCase()}`;
}

const STATE_SUMMARY: Record<PublicationState, (counts: Counts) => string> = {
  published: (c) => `Published to all ${c.total} platform${c.total === 1 ? "" : "s"}.`,
  partial: (c) =>
    `Published to ${c.published} of ${c.total} platforms. ${c.failed} didn't go through — the rest are unaffected.`,
  failed: (c) =>
    c.total === 1
      ? "This didn't go through."
      : `None of the ${c.total} platforms accepted this.`,
  publishing: () => "Going out now.",
  scheduled: (c) => `Queued for ${c.total} platform${c.total === 1 ? "" : "s"}.`,
  blocked: (c) =>
    `${c.blocked} of ${c.total} platform${c.total === 1 ? "" : "s"} can't publish this yet.`,
  draft: () => "Not scheduled yet.",
};

type Counts = {
  total: number;
  published: number;
  failed: number;
  publishing: number;
  scheduled: number;
  blocked: number;
};

export function publicationGroups<T extends GroupablePost>(
  posts: T[],
  publishReadyPlatforms: Iterable<string>,
): PublicationGroup<T>[] {
  const ready = [...publishReadyPlatforms];
  const byKey = new Map<string, PublicationGroup<T>["members"]>();
  const order: string[] = [];

  for (const post of posts) {
    const key = groupKeyFor(post);
    if (!byKey.has(key)) {
      byKey.set(key, []);
      order.push(key);
    }
    byKey.get(key)!.push({
      post,
      lifecycle: postLifecycle(post, ready),
      platformLabel: getPlatformDefinition(post.platform)?.label ?? post.platform,
    });
  }

  return order.map((key) => {
    const members = byKey.get(key)!;
    const counts = tally(members);
    const state = rollUp(counts);

    return {
      key,
      title: members[0].post.title?.trim() || "Untitled post",
      state,
      summary: STATE_SUMMARY[state](counts),
      members,
      // Only what actually failed, and only where the platform could take it.
      // Offering "retry" on a post blocked for missing media sends someone to
      // press a button that cannot work.
      retryable: members
        .filter((member) => member.lifecycle.state === "failed")
        .map((member) => member.post),
    };
  });
}

function tally(members: PublicationGroup["members"]): Counts {
  const counts: Counts = {
    total: members.length,
    published: 0,
    failed: 0,
    publishing: 0,
    scheduled: 0,
    blocked: 0,
  };

  for (const { lifecycle } of members) {
    if (lifecycle.state === "posted") counts.published += 1;
    else if (lifecycle.state === "failed") counts.failed += 1;
    else if (lifecycle.state === "publishing") counts.publishing += 1;
    else if (lifecycle.state === "scheduled") counts.scheduled += 1;
    else if (
      ["needs_media", "needs_caption", "blocked_connection", "manual_only"].includes(
        lifecycle.state,
      )
    ) {
      counts.blocked += 1;
    }
  }
  return counts;
}

/**
 * The order here is the whole point.
 *
 * Anything still moving outranks a finished verdict, because calling a
 * publication "published" while a platform is mid-flight is a claim that has
 * not been earned yet. Below that, a mix of success and failure is `partial`
 * rather than either — which is the state the old per-row view could not
 * express at all.
 */
function rollUp(counts: Counts): PublicationState {
  if (counts.total === 0) return "draft";
  if (counts.publishing > 0) return "publishing";
  if (counts.published === counts.total) return "published";
  if (counts.failed === counts.total) return "failed";
  if (counts.published > 0 && counts.failed > 0) return "partial";
  if (counts.published > 0 || counts.failed > 0) {
    // Some finished, some are still queued or blocked: still in progress.
    return counts.failed > 0 && counts.scheduled === 0 && counts.published === 0
      ? "failed"
      : "partial";
  }
  if (counts.blocked > 0 && counts.scheduled === 0) return "blocked";
  if (counts.scheduled > 0) return "scheduled";
  return "draft";
}
