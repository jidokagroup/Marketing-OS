"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { readJsonResponse } from "@/lib/client-response";

type AnalysisStatusResponse = Record<string, unknown> & {
  completed?: boolean;
  hasVoiceDna?: boolean;
  status?: string;
};

export function AnalyzeButton({
  agentId,
  disabled,
  label = "Run Voice Intelligence Analysis",
}: {
  agentId: string;
  disabled?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [pending, startTransition] = useTransition();

  function refreshAgent() {
    startTransition(() => router.refresh());
  }

  async function analysisWasSaved() {
    try {
      const statusRes = await fetch(`/api/agents/${agentId}/analysis-status`, {
        cache: "no-store",
      });
      const statusJson =
        await readJsonResponse<AnalysisStatusResponse>(statusRes);

      return Boolean(
        statusRes.ok &&
          (statusJson.completed ||
            statusJson.hasVoiceDna ||
            statusJson.status === "ready"),
      );
    } catch {
      return false;
    }
  }

  async function recoverIfAnalysisSaved() {
    const saved = await analysisWasSaved();
    if (!saved) return false;

    toast.success("Analysis complete");
    refreshAgent();
    return true;
  }

  async function analyze() {
    setRunning(true);
    toast.info("Analyzing voice — this can take a minute…");
    try {
      const res = await fetch(`/api/agents/${agentId}/analyze`, {
        method: "POST",
      });
      const json = await readJsonResponse(res);

      if (!res.ok || json.error) {
        if (await recoverIfAnalysisSaved()) return;
        toast.error(json.error ?? "Analysis failed");
        return;
      }

      toast.success("Analysis complete");
      refreshAgent();
    } catch {
      if (await recoverIfAnalysisSaved()) return;
      toast.error("Network error during analysis");
    } finally {
      setRunning(false);
    }
  }

  const busy = running || pending;
  return (
    <Button onClick={analyze} disabled={disabled || busy}>
      {busy ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="mr-1 h-4 w-4" />
      )}
      {busy ? "Analyzing…" : label}
    </Button>
  );
}
