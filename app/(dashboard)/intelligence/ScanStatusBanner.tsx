"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  canRetry,
  customerStatus,
  isTerminal,
  percentComplete,
  type ScanProgress,
} from "@/lib/intelligence/stages";

/**
 * Live status for a competitor scan.
 *
 * This used to infer progress from elapsed time, because a scan was one opaque
 * call and elapsed time was the only signal there was — which is how a scan
 * that had died ten minutes earlier still showed a moving bar. The scan now
 * records which stage it is on and how many sources it has handled, so this
 * reports what is actually happening and stops when the work does.
 *
 * Everything shown here comes from `customerStatus`, which is tested to never
 * emit a stage name, an underscore, or a provider's error.
 */
export function ScanStatusBanner({
  progress,
  onRetry,
}: {
  progress: ScanProgress;
  /** Rendered when a retry would help. */
  onRetry?: React.ReactNode;
}) {
  const router = useRouter();
  const pending = !isTerminal(progress.status);
  const status = customerStatus(progress);
  const percent = percentComplete(progress);

  useEffect(() => {
    if (!pending) return;
    // Poll only while there is something to poll for. The scan writes its own
    // progress, so this is reading a fact rather than animating a guess.
    const tick = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(tick);
  }, [pending, router]);

  if (progress.status === "complete") return null;

  const tone =
    status.tone === "error"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : status.tone === "warning"
        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
        : "border-primary/25 bg-primary/5 text-muted-foreground";

  return (
    <div role="status" aria-live="polite" className={`space-y-2 rounded-md border px-3 py-2 text-xs ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="font-medium">{status.headline}</span> {status.detail}
        </span>
        {canRetry(progress.status) && onRetry}
      </div>

      {pending && (
        <div className="flex items-center gap-2">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Competitor scan progress"
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/15"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="shrink-0 tabular-nums">{percent}%</span>
        </div>
      )}
    </div>
  );
}
