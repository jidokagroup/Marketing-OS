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

  async function onRun() {
    setBusy(true);
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
        toast.error(json.error ?? "Could not run the moderator");
        return;
      }
      if (!json.drafted) {
        toast.info("Nothing new to draft — every open thread already has a reply.");
      } else {
        toast.success(
          `Drafted ${json.drafted} repl${json.drafted === 1 ? "y" : "ies"}, ${json.flagged ?? 0} flagged for you.`,
        );
      }
      router.refresh();
    } catch {
      toast.error("Network error while running the moderator");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={onRun} disabled={busy} variant="outline" size="sm">
      <Bot className="mr-1 h-4 w-4" />
      {busy ? "Running…" : "Run now"}
    </Button>
  );
}
