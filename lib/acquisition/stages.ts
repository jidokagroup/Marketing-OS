/**
 * Outreach stage vocabulary and follow-up cadence.
 *
 * Ported from the Jidoka Group site's own outreach pipeline
 * (lib/outreach-stages.ts there), which is the one part of that system that
 * carries no Jidoka specifics and no tenancy assumptions -- it is just the
 * attempt ladder and the wait between attempts, which is real operational
 * knowledge worth keeping rather than re-deriving.
 *
 * The rest of that pipeline did not port: it is single-tenant (no owner_id
 * anywhere) and hardcoded to selling JIDOKA's own offers, whereas here each
 * agency runs acquisition for their own clients, in that client's voice.
 */

export const outreachStages = [
  "Daily Queue",
  "Attempt 1",
  "Attempt 2",
  "Attempt 3",
  "Attempt 4",
  "Attempt 5",
  "Attempt 6",
  "Attempt 7",
  "Attempt 8",
  "Attempt 9",
  "Attempt 10",
  "Renurture",
  "Dead",
] as const;

export type OutreachStage = (typeof outreachStages)[number];

export const stageSet = new Set<string>(outreachStages);

// Raw statuses written by earlier pipeline versions, mapped to the stage the
// workspace treats them as today.
export const legacyStageMap: Record<string, OutreachStage> = {
  "New Lead": "Daily Queue",
  Enriched: "Daily Queue",
  "Message Generated": "Daily Queue",
  "Outreach Sent": "Attempt 1",
  Responded: "Renurture",
  Qualified: "Renurture",
  "Diagnostic Sent": "Renurture",
  "Diagnostic Started": "Renurture",
  "Diagnostic Completed": "Renurture",
  "Discovery Scheduled": "Renurture",
  "Discovery Completed": "Renurture",
  "Proposal Recommended": "Renurture",
  "Proposal Sent": "Renurture",
  Negotiation: "Renurture",
  "Closed Won": "Renurture",
  "Closed Lost": "Dead",
  Nurture: "Renurture",
};

export const nextStageRules: Partial<Record<OutreachStage, { next: OutreachStage; waitDays: number }>> = {
  "Daily Queue": { next: "Attempt 1", waitDays: 1 },
  "Attempt 1": { next: "Attempt 2", waitDays: 3 },
  "Attempt 2": { next: "Attempt 3", waitDays: 3 },
  "Attempt 3": { next: "Attempt 4", waitDays: 4 },
  "Attempt 4": { next: "Attempt 5", waitDays: 4 },
  "Attempt 5": { next: "Attempt 6", waitDays: 4 },
  "Attempt 6": { next: "Attempt 7", waitDays: 4 },
  "Attempt 7": { next: "Attempt 8", waitDays: 5 },
  "Attempt 8": { next: "Attempt 9", waitDays: 5 },
  "Attempt 9": { next: "Attempt 10", waitDays: 5 },
  "Attempt 10": { next: "Renurture", waitDays: 20 },
};

/** A null, unknown, or unmapped status is a Daily Queue lead. */
export function normalizeOutreachStage(status: string | null | undefined): OutreachStage {
  if (status && stageSet.has(status)) return status as OutreachStage;
  return status ? legacyStageMap[status] ?? "Daily Queue" : "Daily Queue";
}

/** Every raw status string that normalizeOutreachStage maps to `stage`. */
export function statusesNormalizingTo(stage: OutreachStage): string[] {
  return [
    stage,
    ...Object.entries(legacyStageMap)
      .filter(([, mapped]) => mapped === stage)
      .map(([legacy]) => legacy),
  ];
}

// Daily Queue is the only stage that cannot be an IN-list (any status the maps
// do not know normalizes there), so SQL matches it as the complement: status
// IS NULL OR status NOT IN this set.
export const knownNonDailyQueueStatuses = outreachStages
  .filter((stage) => stage !== "Daily Queue")
  .flatMap((stage) => statusesNormalizingTo(stage));
