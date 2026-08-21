"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { readJsonResponse } from "@/lib/client-response";

export function PerformanceIntelligenceGenerateButton({
  agentId,
}: {
  agentId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onGenerate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/performance-intelligence/generate`, {
        method: "POST",
      });
      const json = await readJsonResponse<{ ok?: boolean }>(res);
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Could not run the analysis");
        return;
      }
      toast.success("Performance analysis updated");
      router.refresh();
    } catch {
      toast.error("Network error while running the analysis");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={onGenerate} disabled={busy} size="sm">
      <Sparkles className="mr-1 h-4 w-4" />
      {busy ? "Analyzing…" : "Run analysis"}
    </Button>
  );
}
