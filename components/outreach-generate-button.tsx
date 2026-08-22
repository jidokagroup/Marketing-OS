"use client";

import { Send } from "lucide-react";

import { AsyncActionButton } from "@/components/async-action-button";

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  instagram_dm: "Instagram DM",
};

export function OutreachGenerateButton({
  leadId,
  channel,
  attemptNo,
}: {
  leadId: string;
  channel: string;
  attemptNo: number;
}) {
  const label = CHANNEL_LABELS[channel] ?? channel;

  return (
    <AsyncActionButton<{
      ok?: boolean;
      attempt?: { verification?: { verdict?: string } };
    }>
      endpoint={`/api/leads/${leadId}/outreach/generate`}
      body={{ channel }}
      idleLabel={`Draft ${label} #${attemptNo}`}
      runningLabel="Drafting…"
      runningHint="Writing the touch and running the verification pass…"
      describeSuccess={(json) => {
        const verdict = json.attempt?.verification?.verdict;
        if (verdict === "rejected") {
          return "Drafted, but the check rejected it — read the issues below before sending.";
        }
        if (verdict === "revised") {
          return "Drafted and revised by the verification pass.";
        }
        return "Drafted and approved. Nothing has been sent.";
      }}
      fallbackError="Could not draft the message."
      icon={<Send className="mr-1 h-3.5 w-3.5" />}
      variant="outline"
    />
  );
}
