"use client";

import { Sparkles } from "lucide-react";

import { AsyncActionButton } from "@/components/async-action-button";

export function PerformanceIntelligenceGenerateButton({
  agentId,
  measuredPosts,
  requiredPosts,
}: {
  agentId: string;
  measuredPosts: number;
  requiredPosts: number;
}) {
  // The route refuses below this, so offering the button would only produce a
  // failure the user had no way to see coming.
  const short = requiredPosts - measuredPosts;

  return (
    <AsyncActionButton<{ ok?: boolean; post_count?: number }>
      endpoint={`/api/agents/${agentId}/performance-intelligence/generate`}
      idleLabel="Run analysis"
      runningLabel="Analyzing…"
      runningHint="Tiering measured posts and reading what separates them…"
      describeSuccess={(json) =>
        json.post_count
          ? `Analysis updated from ${json.post_count} measured posts.`
          : "Performance analysis updated."
      }
      fallbackError="Could not run the analysis."
      icon={<Sparkles className="mr-1 h-4 w-4" />}
      disabled={short > 0}
      disabledReason={
        short > 0
          ? `${short} more measured post${short === 1 ? "" : "s"} needed`
          : undefined
      }
      align="end"
    />
  );
}
