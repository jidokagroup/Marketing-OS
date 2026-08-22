"use client";

import { useState } from "react";

import { setModeratorSettingAction } from "@/app/(dashboard)/settings/moderator-actions";
import { Button } from "@/components/ui/button";

/**
 * Turning the moderator on writes drafts a human still reviews. Turning on
 * auto-approve lets it answer people without anyone reading the reply first,
 * which is a different kind of decision — so it is the one that asks, and only
 * when it is actually being switched on.
 */
export function ModeratorSettingsForm({
  agentId,
  seatName,
  enabled,
  autoApprove,
  returnTo,
}: {
  agentId: string;
  seatName: string;
  enabled: boolean;
  autoApprove: boolean;
  returnTo: string;
}) {
  const [nextEnabled, setNextEnabled] = useState(enabled);
  const [nextAutoApprove, setNextAutoApprove] = useState(autoApprove);

  const turningOnAutoApprove = nextAutoApprove && !autoApprove;

  return (
    <form
      action={setModeratorSettingAction}
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
      onSubmit={(event) => {
        if (!turningOnAutoApprove) return;
        const confirmed = window.confirm(
          `Let the Inbox Moderator reply on behalf of ${seatName} without review?\n\nLow-risk drafts will be sent to commenters and DM threads automatically. Anything it judges risky still waits for you.`,
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="agent_id" value={agentId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <span className="text-sm font-medium">{seatName}</span>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="enabled"
            checked={nextEnabled}
            onChange={(event) => setNextEnabled(event.target.checked)}
            className="h-4 w-4"
          />
          Draft replies
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="auto_approve_low_risk"
            checked={nextAutoApprove}
            onChange={(event) => setNextAutoApprove(event.target.checked)}
            disabled={!nextEnabled}
            className="h-4 w-4"
          />
          Send low-risk replies without review
        </label>
        <Button type="submit" size="sm" variant="outline">
          Save
        </Button>
      </div>
    </form>
  );
}
