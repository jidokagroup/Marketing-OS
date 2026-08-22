/**
 * The Market Intelligence scan, as a sequence of resumable stages.
 *
 * A scan used to be one function call: fetch every competitor's platform data,
 * run a web-search pass, then ask one model call for thirteen sections of
 * analysis inside an 8,000-token ceiling. Two failure modes followed from that
 * shape. The whole thing shared one timeout, so ten minutes of successful
 * fetching was thrown away when the last step ran long; and one response
 * carrying thirteen arrays hit the token ceiling mid-array, leaving JSON that
 * could not be parsed and a scan that had produced nothing.
 *
 * Splitting it into stages fixes both, because each stage persists what it
 * produced before the next one starts. A stage that fails is retried on its
 * own, against work already banked, and a stage that fails permanently costs
 * its own section rather than the report.
 *
 * This module is deliberately pure — it decides order, progress and wording,
 * and the worker does the doing.
 */

export const SCAN_STAGES = [
  "queued",
  "fetching",
  "normalizing",
  "analyzing",
  "aggregating",
  "generating_recommendations",
] as const;

export type ScanStage = (typeof SCAN_STAGES)[number];

/** Where a scan can come to rest. */
export const TERMINAL_STATES = ["complete", "partial", "failed", "cancelled"] as const;
export type TerminalState = (typeof TERMINAL_STATES)[number];

export type ScanStatus = ScanStage | TerminalState;

export type ScanProgress = {
  status: ScanStatus;
  current_stage?: ScanStage | null;
  sources_total?: number | null;
  sources_completed?: number | null;
  sources_failed?: number | null;
  last_completed_step?: ScanStage | null;
  retry_count?: number | null;
  started_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
};

export function isTerminal(status: string): status is TerminalState {
  return (TERMINAL_STATES as readonly string[]).includes(status);
}

export function stageIndex(stage: ScanStage): number {
  return SCAN_STAGES.indexOf(stage);
}

/** The stage that runs after this one, or null when analysis is finished. */
export function nextStage(stage: ScanStage): ScanStage | null {
  return SCAN_STAGES[stageIndex(stage) + 1] ?? null;
}

/**
 * How far along a scan is, 0-100.
 *
 * Stages are weighted rather than counted, because `analyzing` is where nearly
 * all of the time goes and a bar that sat at 50% for four minutes would be
 * read as a hang. Within `analyzing` the bar tracks sources actually finished,
 * so it keeps moving while the work does.
 */
const STAGE_WEIGHTS: Record<ScanStage, number> = {
  queued: 2,
  fetching: 18,
  normalizing: 10,
  analyzing: 50,
  aggregating: 8,
  generating_recommendations: 12,
};

export function percentComplete(progress: ScanProgress): number {
  if (progress.status === "complete") return 100;
  if (progress.status === "cancelled" || progress.status === "failed") return 100;

  const stage = (progress.current_stage ??
    (isTerminal(progress.status) ? null : (progress.status as ScanStage))) as
    | ScanStage
    | null;
  if (!stage) return progress.status === "partial" ? 100 : 0;

  let done = 0;
  for (const candidate of SCAN_STAGES) {
    if (stageIndex(candidate) >= stageIndex(stage)) break;
    done += STAGE_WEIGHTS[candidate];
  }

  // Inside `analyzing`, credit the sources that have finished so the bar moves
  // with the work rather than jumping at the end.
  const total = progress.sources_total ?? 0;
  if (stage === "analyzing" && total > 0) {
    const handled =
      (progress.sources_completed ?? 0) + (progress.sources_failed ?? 0);
    done += STAGE_WEIGHTS.analyzing * Math.min(1, handled / total);
  }

  // Never show 100 while work remains: a full bar that keeps spinning is the
  // thing that makes people refresh and assume it broke.
  return Math.max(1, Math.min(99, Math.round(done)));
}

/**
 * What to tell the person waiting.
 *
 * Deliberately says what is happening rather than which function is running.
 * The internal stage name and any provider error stay in the scan's own log.
 */
export function customerStatus(progress: ScanProgress): {
  headline: string;
  detail: string;
  tone: "working" | "done" | "warning" | "error";
} {
  const total = progress.sources_total ?? 0;
  const handled =
    (progress.sources_completed ?? 0) + (progress.sources_failed ?? 0);

  switch (progress.status) {
    case "complete":
      return {
        headline: "Scan complete",
        detail:
          total > 0
            ? `Analyzed ${total} source${total === 1 ? "" : "s"}.`
            : "Your intelligence report is up to date.",
        tone: "done",
      };

    case "partial":
      return {
        headline: "Report ready, with gaps",
        detail: `Some sources could not be analyzed. Your report was completed using the remaining ${progress.sources_completed ?? 0} of ${total}.`,
        tone: "warning",
      };

    case "failed":
      return {
        headline: "We couldn't complete this scan",
        detail: progress.last_completed_step
          ? "You can retry from the last completed step — the work already done is kept."
          : "Nothing was analyzed. Retry when you're ready.",
        tone: "error",
      };

    case "cancelled":
      return {
        headline: "Scan cancelled",
        detail: "Nothing was changed. Start a new scan whenever you like.",
        tone: "warning",
      };

    case "queued":
      return {
        headline: "Scan queued",
        detail: "Starting shortly.",
        tone: "working",
      };

    case "fetching":
      return {
        headline: total > 0 ? `Reading ${total} source${total === 1 ? "" : "s"}` : "Reading sources",
        detail: "Collecting competitor pages and platform data.",
        tone: "working",
      };

    case "normalizing":
      return {
        headline: "Organizing what we found",
        detail: "Tidying the collected data before analysis.",
        tone: "working",
      };

    case "analyzing":
      return {
        headline:
          total > 0
            ? `Analyzing ${Math.min(handled + 1, total)} of ${total} sources`
            : "Analyzing competitor messaging",
        detail: "Reading how each competitor positions, hooks and sells.",
        tone: "working",
      };

    case "aggregating":
      return {
        headline: "Building trend summary",
        detail: "Finding the patterns across every source.",
        tone: "working",
      };

    case "generating_recommendations":
      return {
        headline: "Writing recommendations",
        detail: "Turning the findings into moves for this week.",
        tone: "working",
      };

    default:
      return {
        headline: "Scan in progress",
        detail: "This usually takes a few minutes.",
        tone: "working",
      };
  }
}

/**
 * Where a retry should pick up.
 *
 * Resuming from the stage after the last one that finished is the whole point
 * of staging: a scan that died writing recommendations should not re-fetch
 * eighteen competitor sites to try again.
 */
export function resumeFrom(progress: ScanProgress): ScanStage {
  const last = progress.last_completed_step;
  if (!last) return "fetching";
  return nextStage(last) ?? "generating_recommendations";
}

/** Whether a scan can still be cancelled without leaving a half-written report. */
export function canCancel(status: string): boolean {
  return !isTerminal(status);
}

/** Whether offering a retry makes sense. */
export function canRetry(status: string): boolean {
  return status === "failed" || status === "partial" || status === "cancelled";
}
