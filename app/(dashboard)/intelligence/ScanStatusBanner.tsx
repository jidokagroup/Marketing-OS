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
export function ScanStatusBanner({
  status,
  errorMessage,
}: {
  status: string | null | undefined;
  errorMessage?: string | null;
}) {
  const router = useRouter();
  const pending = status === "queued" || status === "running";
  const [waited, setWaited] = useState(0);

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

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-muted-foreground"
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
      />
      <span>
        <span className="font-medium text-foreground">
          {status === "running" ? "Scanning competitors…" : "Scan queued…"}
        </span>{" "}
        Reading each site and writing the report. This usually takes a minute or two
        {waited >= 150 ? " — still working, it will appear here when it lands" : ""}. You can
        leave this page; results appear automatically.
      </span>
    </div>
  );
}
