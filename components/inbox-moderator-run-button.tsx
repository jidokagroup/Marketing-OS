"use client";

import { Bot } from "lucide-react";

import { AsyncActionButton } from "@/components/async-action-button";

export function InboxModeratorRunButton({ agentId }: { agentId: string }) {
  return (
    <AsyncActionButton<{ ok?: boolean; drafted?: number; flagged?: number; checked?: number }>
      endpoint={`/api/agents/${agentId}/inbox-moderator/run`}
      idleLabel="Run now"
      runningLabel="Running…"
      runningHint="Reading open threads and drafting replies…"
      describeSuccess={(json) => {
        const checked =
          json.checked === undefined
            ? ""
            : ` Checked ${json.checked} thread${json.checked === 1 ? "" : "s"}.`;
        if (!json.drafted) {
          return `Nothing new to draft — every open thread already has a reply.${checked}`;
        }
        return `Drafted ${json.drafted} repl${json.drafted === 1 ? "y" : "ies"}, ${json.flagged ?? 0} flagged for you.${checked}`;
      }}
      fallbackError="Could not run the moderator."
      icon={<Bot className="mr-1 h-4 w-4" />}
      variant="outline"
    />
  );
}
