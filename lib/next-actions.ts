/**
 * What this seat should do next, ranked by what it costs to leave undone.
 *
 * Core Command counted things. A count is not an instruction: "3 scheduled
 * posts" does not say that one of them cannot publish, and the person reading
 * it has to open the Scheduler to find out. Each of these names the specific
 * situation and links to the page that resolves it.
 *
 * Pure: the caller fetches, this ranks.
 */

import { getPlatformDefinition } from "@/lib/social/platforms";
import type { LifecycleView } from "@/lib/scheduler-lifecycle";
import { scanState, type ScanReport } from "@/lib/intelligence-scan";

export type ActionUrgency = "critical" | "high" | "normal";

export type NextAction = {
  key: string;
  /** The situation, specific enough to act on without opening the page. */
  headline: string;
  href: string;
  actionLabel: string;
  urgency: ActionUrgency;
};

export type NextActionsInput = {
  /** Scheduled posts for this seat, already run through postLifecycle. */
  posts: {
    id: string;
    title: string | null;
    platform: string;
    lifecycle: LifecycleView;
  }[];
  campaigns: {
    id: string;
    name: string;
    stage: string;
    generatedCount: number;
    workCount: number;
    leadCount: number;
    pipelineValue: number;
    revenue: number;
  }[];
  /** Pipeline leads with no touch recorded yet. */
  leadsAwaitingFirstTouch: number;
  inboxNeedsReview: number;
  latestScan: ScanReport | null;
  /** Whether this seat's agent has Voice DNA. */
  hasVoiceDna: boolean;
  agentId: string | null;
  analyticsRows: number;
};

const URGENCY_RANK: Record<ActionUrgency, number> = {
  critical: 0,
  high: 1,
  normal: 2,
};

export function nextBestActions(input: NextActionsInput): NextAction[] {
  const actions: NextAction[] = [];

  // Untrained is the root blocker: it refuses generation, ad copy and the
  // moderator, so everything below it would be advice the seat cannot take.
  if (input.agentId && !input.hasVoiceDna) {
    actions.push({
      key: "voice-dna",
      headline:
        "This seat's agent has no Voice DNA, so it cannot generate anything yet.",
      href: `/agents/${input.agentId}?tab=knowledge`,
      actionLabel: "Train the agent",
      urgency: "critical",
    });
  }

  actions.push(...postActions(input.posts));

  if (input.inboxNeedsReview > 0) {
    actions.push({
      key: "inbox",
      headline: `${input.inboxNeedsReview} inbox thread${input.inboxNeedsReview === 1 ? "" : "s"} ${input.inboxNeedsReview === 1 ? "is" : "are"} waiting on a human reply.`,
      href: "/inbox",
      actionLabel: "Review inbox",
      urgency: "high",
    });
  }

  actions.push(...campaignActions(input.campaigns));

  if (input.leadsAwaitingFirstTouch > 0) {
    actions.push({
      key: "leads",
      headline: `${input.leadsAwaitingFirstTouch} pipeline lead${input.leadsAwaitingFirstTouch === 1 ? "" : "s"} ${input.leadsAwaitingFirstTouch === 1 ? "has" : "have"} no first touch drafted.`,
      href: "/pipeline",
      actionLabel: "Open pipeline",
      urgency: "high",
    });
  }

  const scan = scanState(input.latestScan);
  if (scan === "stranded" || scan === "failed") {
    actions.push({
      key: "scan",
      headline:
        scan === "stranded"
          ? "The last competitor scan stopped without finishing."
          : "The last competitor scan failed.",
      href: "/intelligence",
      actionLabel: "Retry the scan",
      urgency: "normal",
    });
  } else if (scan === "pending") {
    actions.push({
      key: "scan",
      headline: "A competitor scan is running — results replace the baseline when it lands.",
      href: "/intelligence",
      actionLabel: "Check status",
      urgency: "normal",
    });
  }

  if (input.analyticsRows === 0) {
    actions.push({
      key: "analytics",
      headline:
        "No measured posts imported for this seat, so best-time guidance is still generic.",
      href: "/analytics",
      actionLabel: "Pull past data",
      urgency: "normal",
    });
  }

  return actions.sort(
    (a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency],
  );
}

function postActions(posts: NextActionsInput["posts"]): NextAction[] {
  const actions: NextAction[] = [];

  const failed = posts.filter((post) => post.lifecycle.state === "failed");
  if (failed.length > 0) {
    actions.push({
      key: "posts-failed",
      headline: describePosts(failed, "failed to publish"),
      href: "/scheduler",
      actionLabel: "Open Scheduler",
      urgency: "critical",
    });
  }

  const blocked = posts.filter((post) =>
    ["needs_media", "needs_caption", "blocked_connection"].includes(
      post.lifecycle.state,
    ),
  );
  if (blocked.length > 0) {
    actions.push({
      key: "posts-blocked",
      headline: describePosts(blocked, "cannot publish as it stands"),
      href: "/scheduler",
      actionLabel: "Fix the post",
      urgency: "high",
    });
  }

  const ready = posts.filter(
    (post) => post.lifecycle.state === "ready_to_schedule",
  );
  if (ready.length > 0) {
    actions.push({
      key: "posts-ready",
      headline: `${ready.length} post${ready.length === 1 ? "" : "s"} ${ready.length === 1 ? "is" : "are"} complete and waiting to be scheduled.`,
      href: "/scheduler",
      actionLabel: "Schedule",
      urgency: "normal",
    });
  }

  return actions;
}

/**
 * One post is named; several are counted. "Crystal's Instagram post needs
 * media" is actionable in a way that "4 posts are blocked" is not.
 */
function describePosts(
  posts: NextActionsInput["posts"],
  verb: string,
): string {
  const [first] = posts;
  const platform =
    getPlatformDefinition(first.platform)?.label ?? first.platform;

  if (posts.length === 1) {
    return `A scheduled ${platform} post, "${first.title || "untitled"}", ${verb}: ${first.lifecycle.detail}`;
  }
  return `${posts.length} scheduled posts ${verb}, starting with the ${platform} post "${first.title || "untitled"}": ${first.lifecycle.detail}`;
}

function campaignActions(
  campaigns: NextActionsInput["campaigns"],
): NextAction[] {
  const actions: NextAction[] = [];

  const noCreative = campaigns.filter(
    (campaign) => campaign.generatedCount === 0 && campaign.stage !== "complete",
  );
  if (noCreative.length > 0) {
    const [first] = noCreative;
    actions.push({
      key: "campaign-creative",
      headline:
        noCreative.length === 1
          ? `"${first.name}" is at the ${first.stage} stage with no content generated for it.`
          : `${noCreative.length} campaigns have no content generated yet, starting with "${first.name}".`,
      href: `/campaigns/${first.id}`,
      actionLabel: "Generate content",
      urgency: "high",
    });
  }

  // Pipeline without revenue is the campaign's whole reason to exist, so it is
  // stated as the gap it is rather than as two unrelated figures.
  const openPipeline = campaigns.filter(
    (campaign) => campaign.pipelineValue > 0 && campaign.revenue === 0,
  );
  if (openPipeline.length > 0) {
    const [first] = openPipeline;
    actions.push({
      key: "campaign-pipeline",
      headline: `"${first.name}" has ${first.leadCount} lead${first.leadCount === 1 ? "" : "s"} and ${formatMoney(first.pipelineValue)} in pipeline, with no revenue attributed yet.`,
      href: `/campaigns/${first.id}`,
      actionLabel: "Open campaign",
      urgency: "normal",
    });
  }

  return actions;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
