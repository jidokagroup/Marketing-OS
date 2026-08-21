"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { readJsonResponse } from "@/lib/client-response";

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
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onGenerate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/outreach/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const json = await readJsonResponse<{
        ok?: boolean;
        attempt?: { verification?: { verdict?: string; issues?: string[] } };
      }>(res);
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Could not draft the message");
        return;
      }
      const verdict = json.attempt?.verification?.verdict;
      if (verdict === "rejected") {
        toast.warning("Drafted, but the check rejected it — open the lead to see why.");
      } else if (verdict === "revised") {
        toast.success("Drafted and revised by the verification pass.");
      } else {
        toast.success("Drafted and approved.");
      }
      router.refresh();
    } catch {
      toast.error("Network error while drafting");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={onGenerate} disabled={busy} size="sm" variant="outline">
      <Send className="mr-1 h-3.5 w-3.5" />
      {busy ? "Drafting…" : `Draft ${CHANNEL_LABELS[channel] ?? channel} #${attemptNo}`}
    </Button>
  );
}
