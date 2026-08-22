"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/error-notice";

/**
 * Catches anything a dashboard route throws.
 *
 * Without this, an exception in a server component rendered Next's own error
 * page — which tells a paying customer nothing, and tells us nothing either,
 * because nobody was recording what was thrown. That is how an "internal
 * error" on a route can be reported without anyone being able to say what it
 * was.
 *
 * Next hands the digest rather than the message to the client, so the message
 * itself stays server-side where it belongs; the digest is what ties this
 * screen to the server log entry.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The one place this is worth recording from the browser: it captures
    // client-side render failures, which never reach the server log.
    console.error("[dashboard] route error", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl py-10">
      <ErrorNotice error={error} action="load this page">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={reset}>
            Try again
          </Button>
          {error.digest && (
            // The only technical string worth showing: it is what lets support
            // find this exact failure, and it reveals nothing about the system.
            <span className="text-xs opacity-70">Reference {error.digest}</span>
          )}
        </div>
      </ErrorNotice>
    </div>
  );
}
