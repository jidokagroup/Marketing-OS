/**
 * What the current seat can and cannot safely do today.
 *
 * Every part of this already existed somewhere — a badge on the agent page, a
 * checklist on Analytics, a notice in Settings — which meant the only way to
 * learn whether a client was ready to operate was to visit six pages and hold
 * the answer in your head. This assembles it from the same stored data those
 * pages read, so it cannot drift from them, and points each unfinished item at
 * the page that finishes it.
 *
 * Pure: the caller fetches, this decides.
 */

import { coreTrainingState, type CoreTrainingFields } from "@/lib/core-training";
import { getPlatformDefinition } from "@/lib/social/platforms";

export type ReadinessState = "ready" | "partial" | "blocked";

export type ReadinessItem = {
  key: string;
  label: string;
  state: ReadinessState;
  /** What is true right now, in one sentence. */
  detail: string;
  /** The page that changes it. */
  href: string;
  actionLabel: string;
};

export type SeatReadinessInput = {
  agentId: string | null;
  clientId: string | null;
  agentName: string | null;
  /** Voice DNA analysed for this seat's agent. */
  hasVoiceDna: boolean;
  /** Connected social accounts belonging to this seat. */
  connectedPlatforms: string[];
  /** Platforms this deployment can actually publish to. */
  publishReadyPlatforms: string[];
  /** Core training rows, keyed by agent key. */
  coreTraining: { row: CoreTrainingFields | null; memoryCount: number }[];
  /** Analytics rows stored for this seat. */
  analyticsRows: number;
  /** Scheduled posts for this seat that could publish as they stand. */
  publishableposts: number;
  /** Scheduled posts for this seat that are blocked. */
  blockedPosts: number;
  /** Whether the Inbox Moderator is on for this seat. */
  moderatorEnabled: boolean;
  /** Threads waiting on a human for this seat. */
  inboxNeedsReview: number;
  /** Billing status, or null when billing is not configured for the app. */
  billingStatus: string | null;
};

export function seatReadiness(input: SeatReadinessInput): ReadinessItem[] {
  const agentHref = input.agentId ? `/agents/${input.agentId}` : "/agents";
  const items: ReadinessItem[] = [];

  items.push(voiceDnaItem(input, agentHref));
  items.push(connectionsItem(input, agentHref));
  items.push(publishingItem(input));
  items.push(coreItem(input));
  items.push(analyticsItem(input));
  items.push(inboxItem(input));

  if (input.billingStatus !== null) items.push(billingItem(input));

  return items;
}

function voiceDnaItem(
  input: SeatReadinessInput,
  agentHref: string,
): ReadinessItem {
  if (!input.agentId) {
    return {
      key: "voice",
      label: "Voice DNA",
      state: "blocked",
      detail: "This seat has no writing agent yet, so nothing can be generated for it.",
      href: "/clients",
      actionLabel: "Add the agent",
    };
  }
  return input.hasVoiceDna
    ? {
        key: "voice",
        label: "Voice DNA",
        state: "ready",
        detail: `${input.agentName ?? "This agent"} is analysed and can write in the client's voice.`,
        href: `${agentHref}?tab=dna`,
        actionLabel: "Review",
      }
    : {
        key: "voice",
        label: "Voice DNA",
        state: "blocked",
        detail:
          "No Voice DNA yet. Generation, paid ad copy and the Inbox Moderator are all refused until this agent is analysed.",
        href: `${agentHref}?tab=knowledge`,
        actionLabel: "Train the agent",
      };
}

function connectionsItem(
  input: SeatReadinessInput,
  agentHref: string,
): ReadinessItem {
  const count = input.connectedPlatforms.length;
  if (count === 0) {
    return {
      key: "connections",
      label: "Connected accounts",
      state: "blocked",
      detail: "No accounts connected to this seat, so nothing can be published or measured.",
      href: `${agentHref}?tab=connections`,
      actionLabel: "Connect an account",
    };
  }

  const names = input.connectedPlatforms
    .map((platform) => getPlatformDefinition(platform)?.label ?? platform)
    .join(", ");
  return {
    key: "connections",
    label: "Connected accounts",
    state: "ready",
    detail: `${count} connected: ${names}.`,
    href: `${agentHref}?tab=connections`,
    actionLabel: "Manage",
  };
}

function publishingItem(input: SeatReadinessInput): ReadinessItem {
  // Connected is not publishable: the deployment also needs the credentials.
  const publishable = input.connectedPlatforms.filter((platform) =>
    input.publishReadyPlatforms.includes(platform),
  );
  const manualOnly = input.connectedPlatforms.filter(
    (platform) => !input.publishReadyPlatforms.includes(platform),
  );

  if (input.connectedPlatforms.length === 0) {
    return {
      key: "publishing",
      label: "Auto-publishing",
      state: "blocked",
      detail: "Nothing to publish with until an account is connected.",
      href: "/scheduler",
      actionLabel: "Open Scheduler",
    };
  }

  if (publishable.length === 0) {
    return {
      key: "publishing",
      label: "Auto-publishing",
      state: "blocked",
      detail: `Connected, but none of these platforms can auto-publish from this deployment: ${manualOnly
        .map((platform) => getPlatformDefinition(platform)?.label ?? platform)
        .join(", ")}. Posts have to go out by hand.`,
      href: "/scheduler",
      actionLabel: "Review queue",
    };
  }

  const label = publishable
    .map((platform) => getPlatformDefinition(platform)?.label ?? platform)
    .join(", ");
  return {
    key: "publishing",
    label: "Auto-publishing",
    state: manualOnly.length > 0 ? "partial" : "ready",
    detail:
      manualOnly.length > 0
        ? `${label} can auto-publish. ${manualOnly.length} other connected platform${manualOnly.length === 1 ? "" : "s"} still need manual posting.`
        : `${label} can auto-publish.`,
    href: "/scheduler",
    actionLabel: "Open Scheduler",
  };
}

function coreItem(input: SeatReadinessInput): ReadinessItem {
  const states = input.coreTraining.map((entry) =>
    coreTrainingState(entry.row, entry.memoryCount),
  );
  const trained = states.filter((state) => state === "trained").length;
  const started = states.filter((state) => state !== "not_started").length;

  if (states.length === 0 || started === 0) {
    return {
      key: "core",
      label: "Core training",
      state: "blocked",
      detail: "No Core agent has been trained, so the orchestrator is answering from nothing.",
      href: "/core/orchestrator",
      actionLabel: "Start training",
    };
  }
  return {
    key: "core",
    label: "Core training",
    state: trained === states.length ? "ready" : "partial",
    detail: `${trained} of ${states.length} Core agents fully trained.`,
    href: "/core/orchestrator",
    actionLabel: trained === states.length ? "Review" : "Finish training",
  };
}

function analyticsItem(input: SeatReadinessInput): ReadinessItem {
  if (input.analyticsRows === 0) {
    return {
      key: "analytics",
      label: "Analytics",
      state: "blocked",
      detail:
        "No measured posts for this seat. Best-time guidance and Performance Intelligence both need history first.",
      href: "/analytics",
      actionLabel: "Pull past data",
    };
  }
  return {
    key: "analytics",
    label: "Analytics",
    state: "ready",
    detail: `${input.analyticsRows.toLocaleString()} measured post${input.analyticsRows === 1 ? "" : "s"} imported for this seat.`,
    href: "/analytics",
    actionLabel: "Open Analytics",
  };
}

function inboxItem(input: SeatReadinessInput): ReadinessItem {
  if (input.inboxNeedsReview > 0) {
    return {
      key: "inbox",
      label: "Inbox",
      state: "partial",
      detail: `${input.inboxNeedsReview} thread${input.inboxNeedsReview === 1 ? "" : "s"} waiting on a human.`,
      href: "/inbox",
      actionLabel: "Review now",
    };
  }
  return {
    key: "inbox",
    label: "Inbox",
    state: input.moderatorEnabled ? "ready" : "partial",
    detail: input.moderatorEnabled
      ? "Nothing waiting, and the moderator is drafting replies for this seat."
      : "Nothing waiting. The Inbox Moderator is off, so replies are drafted by hand.",
    href: input.moderatorEnabled ? "/inbox" : "/settings?tab=automations",
    actionLabel: input.moderatorEnabled ? "Open Inbox" : "Turn it on",
  };
}

function billingItem(input: SeatReadinessInput): ReadinessItem {
  const status = input.billingStatus ?? "";
  const healthy = status === "active" || status === "trialing";
  return {
    key: "billing",
    label: "Billing",
    state: healthy ? "ready" : "blocked",
    detail: healthy
      ? `Subscription is ${status}.`
      : status
        ? `Subscription is ${status}. Publishing and generation keep working, but the account needs attention.`
        : "No subscription on this workspace yet.",
    href: "/settings?tab=billing",
    actionLabel: healthy ? "Manage" : "Fix billing",
  };
}

/** One line for the top of the panel. */
export function readinessSummary(items: ReadinessItem[]) {
  const blocked = items.filter((item) => item.state === "blocked").length;
  const ready = items.filter((item) => item.state === "ready").length;
  return { ready, blocked, total: items.length };
}
