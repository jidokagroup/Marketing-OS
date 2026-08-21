"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Megaphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { readJsonResponse } from "@/lib/client-response";

export function PaidAdsGenerateButton({
  agentId,
  hasVoiceDna,
}: {
  agentId: string;
  hasVoiceDna: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onGenerate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/paid-ads/generate`, {
        method: "POST",
      });
      const json = await readJsonResponse<{ ok?: boolean }>(res);
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Could not generate ad copy");
        return;
      }
      toast.success("Paid ad copy generated from the last 30 days");
      router.refresh();
    } catch {
      toast.error("Network error while generating ad copy");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={onGenerate} disabled={busy || !hasVoiceDna} size="sm">
      <Megaphone className="mr-1 h-4 w-4" />
      {busy ? "Generating…" : "Generate from top posts"}
    </Button>
  );
}
