"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";

/**
 * Live status for an in-flight content generation.
 *
 * Generation runs in a background worker, so the row this page reads has no
 * content yet while it's queued/running. This polls for it: while pending it
 * refreshes the server component every few seconds, then stops as soon as
 * the row reaches a terminal state.
 */
export function GenerationStatusBanner({
  status,
  errorMessage,
  retryHref,
}: {
  status: string | null | undefined;
  errorMessage?: string | null;
  retryHref?: string;
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
      <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        <p>
          <span className="font-medium">Generation did not complete.</span>{" "}
          {errorMessage ?? "Something went wrong. Try generating again."}
        </p>
        {retryHref && (
          <ButtonLink href={retryHref} size="sm" variant="outline" className="mt-3">
            Try again
          </ButtonLink>
        )}
      </div>
    );
  }

  if (!pending) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 flex items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-muted-foreground"
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
      />
      <span>
        <span className="font-medium text-foreground">
          {status === "running" ? "Generating…" : "Queued…"}
        </span>{" "}
        Matching voice examples and drafting now. This usually takes under a minute
        {waited >= 90 ? " — still working, it will appear here when it lands" : ""}. You can
        leave this page; the result appears automatically.
      </span>
    </div>
  );
}
