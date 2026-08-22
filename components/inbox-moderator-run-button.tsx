"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot } from "lucide-react";

import { Button } from "@/components/ui/button";
import { readJsonResponse } from "@/lib/client-response";

export function InboxModeratorRunButton({ agentId }: { agentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // A toast says what happened and then takes it away again. This run calls a
  // model and can take a while, so the outcome also stays on the page until
  // the next run replaces it.
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  async function onRun() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/inbox-moderator/run`, {
        method: "POST",
      });
      const json = await readJsonResponse<{
        ok?: boolean;
        drafted?: number;
        flagged?: number;
      }>(res);
      if (!res.ok || !json.ok) {
        const message = json.error ?? "Could not run the moderator";
        setResult({ ok: false, text: message });
        toast.error(message);
        return;
      }
      const message = json.drafted
        ? `Drafted ${json.drafted} repl${json.drafted === 1 ? "y" : "ies"}, ${json.flagged ?? 0} flagged for you.`
        : "Nothing new to draft — every open thread already has a reply.";
      setResult({ ok: true, text: message });
      if (json.drafted) toast.success(message);
      else toast.info(message);
      router.refresh();
    } catch {
      const message = "Network error while running the moderator";
      setResult({ ok: false, text: message });
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button onClick={onRun} disabled={busy} variant="outline" size="sm">
        <Bot className="mr-1 h-4 w-4" />
        {busy ? "Running…" : "Run now"}
      </Button>
      {busy && (
        <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
          Reading open threads and drafting replies…
        </span>
      )}
      {!busy && result && (
        <span
          role="status"
          aria-live="polite"
          className={result.ok ? "text-xs text-muted-foreground" : "text-xs text-destructive"}
        >
          {result.text}
        </span>
      )}
    </span>
  );
}
