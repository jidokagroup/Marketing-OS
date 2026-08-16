"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Live status for an in-flight competitor scan.
 *
 * The scan runs in a background worker, so the page that submitted it has no
 * result to render. This polls for one: while the newest report is `queued` or
 * `running` it refreshes the server component every few seconds, then stops as
 * soon as the row reaches a terminal state.
 */

// A typical scan lands well inside this; the bar is paced against it so it
// reads as real progress rather than an indeterminate spinner.
const EXPECTED_SECONDS = 150;
// Past this the scan is almost certainly stuck rather than slow, so say so
// instead of animating forever.
const STUCK_SECONDS = 420;

export function ScanStatusBanner({
  status,
  errorMessage,
  startedAt,
}: {
  status: string | null | undefined;
  errorMessage?: string | null;
  startedAt?: string | null;
}) {
  const router = useRouter();
  const pending = status === "queued" || status === "running";

  // Seeded from the row's own timestamp so the bar survives a refresh or a
  // reopened tab instead of restarting at zero each mount.
  const [waited, setWaited] = useState(() => elapsedSince(startedAt));

  useEffect(() => {
    if (!pending) return;

    const tick = setInterval(() => {
      setWaited((seconds) => seconds + 5);
      router.refresh();
    }, 5000);

    return () => clearInterval(tick);
  }, [pending, router]);

  if (status === "failed") {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        <span className="font-medium">Scan did not complete.</span>{" "}
        {errorMessage ?? "Save the watchlist again to retry."} Baseline guidance is shown below.
      </div>
    );
  }

  if (!pending) return null;

  const stuck = waited >= STUCK_SECONDS;
  // Approaches but never reaches 100 while running, so a full bar always means
  // finished rather than "probably finished".
  const percent = Math.min(95, Math.round((waited / EXPECTED_SECONDS) * 100));

  return (
    <div
      role="status"
      aria-live="polite"
      className={`space-y-2 rounded-md border px-3 py-2 text-xs ${
        stuck
          ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
          : "border-primary/25 bg-primary/5 text-muted-foreground"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 rounded-full ${
            stuck ? "bg-amber-500" : "animate-pulse bg-primary motion-reduce:animate-none"
          }`}
        />
        <span>
          <span className={`font-medium ${stuck ? "" : "text-foreground"}`}>
            {stuck
              ? "This scan is taking longer than expected."
              : status === "running"
                ? "Scanning competitors…"
                : "Scan queued…"}
          </span>{" "}
          {stuck
            ? "It may be stuck. Save the watchlist again to retry — baseline guidance stays available below in the meantime."
            : "Reading each site and writing the report. You can leave this page; results appear automatically."}
        </span>
      </div>

      {!stuck && (
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
          <span className="shrink-0 tabular-nums">{formatElapsed(waited)}</span>
        </div>
      )}
    </div>
  );
}

function elapsedSince(startedAt: string | null | undefined): number {
  if (!startedAt) return 0;
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return 0;
  return Math.max(0, Math.round((Date.now() - started) / 1000));
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}
