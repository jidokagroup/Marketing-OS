"use client";

import { Megaphone } from "lucide-react";

import { AsyncActionButton } from "@/components/async-action-button";

export function PaidAdsGenerateButton({ agentId }: { agentId: string }) {
  return (
    <AsyncActionButton<{ ok?: boolean; variants?: number }>
      endpoint={`/api/agents/${agentId}/paid-ads/generate`}
      idleLabel="Generate from top posts"
      runningLabel="Generating…"
      runningHint="Reading the last 30 days of top posts and writing ad copy…"
      describeSuccess={(json) =>
        json.variants
          ? `Wrote ${json.variants} ad variant${json.variants === 1 ? "" : "s"} from the last 30 days.`
          : "Ad copy generated from the last 30 days."
      }
      fallbackError="Could not generate ad copy."
      icon={<Megaphone className="mr-1 h-4 w-4" />}
    />
  );
}
