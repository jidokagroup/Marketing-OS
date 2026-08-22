"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { readJsonResponse } from "@/lib/client-response";
import { cn } from "@/lib/utils";

export type AsyncActionState = "idle" | "running" | "succeeded" | "failed";

/**
 * One button for every job that calls a route and takes a while.
 *
 * These jobs used to report only through a toast, which is the one place a
 * result cannot be read twice — so a run that finished while the user was
 * looking elsewhere was indistinguishable from one that never reported at
 * all. The outcome stays on the page until the next run replaces it, the
 * button says what is happening while it happens, and it cannot be pressed
 * twice into the same job.
 */
export function AsyncActionButton<
  T extends Record<string, unknown> & { ok?: boolean },
>({
  endpoint,
  body,
  idleLabel,
  runningLabel,
  runningHint,
  describeSuccess,
  fallbackError,
  icon,
  confirm,
  disabled = false,
  disabledReason,
  size = "sm",
  variant = "default",
  align = "start",
}: {
  endpoint: string;
  body?: unknown;
  idleLabel: string;
  runningLabel: string;
  /** Shown beside the button while the job runs. */
  runningHint: string;
  /** Turns the route's JSON into the sentence a person reads afterwards. */
  describeSuccess: (json: T) => string;
  fallbackError: string;
  icon?: ReactNode;
  /** Asked before starting, for jobs with outward effects. */
  confirm?: string;
  disabled?: boolean;
  /** Why the button is unavailable, shown in place of a result. */
  disabledReason?: string;
  size?: React.ComponentProps<typeof Button>["size"];
  variant?: React.ComponentProps<typeof Button>["variant"];
  align?: "start" | "end";
}) {
  const router = useRouter();
  const [state, setState] = useState<AsyncActionState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onRun() {
    if (confirm && !window.confirm(confirm)) return;

    setState("running");
    setMessage(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        ...(body === undefined
          ? {}
          : {
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            }),
      });
      const json = await readJsonResponse<T>(res);

      if (!res.ok || !json.ok) {
        const failure = json.error ?? fallbackError;
        setState("failed");
        setMessage(failure);
        toast.error(failure);
        return;
      }

      const success = describeSuccess(json);
      setState("succeeded");
      setMessage(success);
      toast.success(success);
      router.refresh();
    } catch {
      const failure = "Network error — nothing was changed. Try again.";
      setState("failed");
      setMessage(failure);
      toast.error(failure);
    }
  }

  const running = state === "running";
  const status = running
    ? runningHint
    : disabled
      ? disabledReason
      : state === "idle"
        ? null
        : message;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        align === "end" ? "justify-end" : "",
      )}
    >
      {status && (
        <span
          role="status"
          aria-live="polite"
          className={cn(
            "text-xs",
            state === "failed" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {status}
        </span>
      )}
      <Button
        onClick={onRun}
        disabled={running || disabled}
        size={size}
        variant={variant}
      >
        {icon}
        {running ? runningLabel : idleLabel}
      </Button>
    </div>
  );
}
