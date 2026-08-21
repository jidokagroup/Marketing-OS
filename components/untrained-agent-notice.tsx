import { GraduationCap } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";

/**
 * Shown in place of a generate control when an agent has no Voice DNA yet.
 * Everything these modules produce is written in the client's voice, so the
 * useful thing to offer is the way to finish training, not a disabled button
 * with no explanation of what would enable it.
 */
export function UntrainedAgentNotice({
  agentId,
  what,
}: {
  agentId: string;
  what: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Finish training this agent first</p>
          <p className="text-sm text-muted-foreground">
            {what} is written in the client&rsquo;s voice. Upload their content and run
            the Voice DNA analysis, then come back.
          </p>
        </div>
      </div>
      <ButtonLink href={`/agents/${agentId}`} variant="outline" size="sm" className="shrink-0">
        Train agent
      </ButtonLink>
    </div>
  );
}
