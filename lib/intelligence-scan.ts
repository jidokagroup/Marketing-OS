/**
 * Whether an intelligence scan is still plausibly running.
 *
 * A scan is handed to a background worker and the row is left `queued` until
 * that worker updates it. If the worker never starts — an unreachable trigger,
 * a cold start that timed out, a crash — nothing ever moves the row off
 * `queued`, and the page reported "scan in progress" indefinitely for work
 * that had already stopped. Netlify caps a background function at fifteen
 * minutes, so past that the worker cannot still be running.
 */

export const SCAN_STUCK_SECONDS = 900;

export type ScanReport = {
  status?: string | null;
  requested_at?: string | null;
  scanned_at?: string | null;
  error_message?: string | null;
};

export type ScanState = "none" | "pending" | "stranded" | "failed" | "complete";

export function scanState(report: ScanReport | null | undefined): ScanState {
  if (!report) return "none";
  if (report.status === "failed") return "failed";
  if (report.status !== "queued" && report.status !== "running") return "complete";

  const requested = new Date(report.requested_at ?? "").getTime();
  if (Number.isNaN(requested)) return "pending";
  return Date.now() - requested > SCAN_STUCK_SECONDS * 1000
    ? "stranded"
    : "pending";
}

export const STRANDED_SCAN_MESSAGE =
  "The scan worker stopped without reporting a result. Save the watchlist again to retry.";
