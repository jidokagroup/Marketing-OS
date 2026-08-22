"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { readJsonResponse } from "@/lib/client-response";

export function PerformanceIntelligenceGenerateButton({
  agentId,
  measuredPosts,
  requiredPosts,
}: {
  agentId: string;
  measuredPosts: number;
  requiredPosts: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // The outcome of a run that takes this long should not vanish with a toast.
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  // The route refuses below this, so offering the button would only produce a
  // failure the user had no way to see coming.
  const short = requiredPosts - measuredPosts;

  async function onGenerate() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/performance-intelligence/generate`, {
        method: "POST",
      });
      const json = await readJsonResponse<{ ok?: boolean }>(res);
      if (!res.ok || !json.ok) {
        const message = json.error ?? "Could not run the analysis";
        setResult({ ok: false, text: message });
        toast.error(message);
        return;
      }
      setResult({ ok: true, text: "Performance analysis updated." });
      toast.success("Performance analysis updated");
      router.refresh();
    } catch {
      const message = "Network error while running the analysis";
      setResult({ ok: false, text: message });
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {short > 0 && (
        <span className="text-xs text-muted-foreground">
          {short} more measured post{short === 1 ? "" : "s"} needed
        </span>
      )}
      {short <= 0 && !busy && result && (
        <span
          role="status"
          aria-live="polite"
          className={
            result.ok ? "text-xs text-muted-foreground" : "text-xs text-destructive"
          }
        >
          {result.text}
        </span>
      )}
      <Button onClick={onGenerate} disabled={busy || short > 0} size="sm">
        <Sparkles className="mr-1 h-4 w-4" />
        {busy ? "Analyzing…" : "Run analysis"}
      </Button>
    </div>
  );
}
