"use client";

import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type InsightAction = {
  label: string;
  action: (formData: FormData) => void | Promise<void>;
  destructive?: boolean;
};

type HiddenFields = {
  title: string;
  body: string;
  type: string;
  source: string;
  reportId?: string;
  clientId?: string;
  campaignId?: string;
};

/**
 * Collapses the insight row's secondary actions (create campaign/idea/task,
 * add to brief, assign, save, dismiss) behind one trigger so each insight
 * shows two controls instead of eight.
 */
export function InsightMoreActions({
  actions,
  hiddenFields,
  opsReady,
}: {
  actions: InsightAction[];
  hiddenFields: HiddenFields;
  opsReady: boolean;
}) {
  if (!opsReady) {
    return (
      <Button type="button" size="xs" variant="outline" disabled>
        <MoreHorizontal className="h-3.5 w-3.5" />
        More
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" size="xs" variant="outline" />}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
        More
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action, index) => {
          const previous = actions[index - 1];
          const needsSeparator = action.destructive && previous && !previous.destructive;
          return (
            <form key={action.label} action={action.action}>
              <input type="hidden" name="insight_title" value={hiddenFields.title} />
              <input type="hidden" name="insight_body" value={hiddenFields.body} />
              <input type="hidden" name="insight_type" value={hiddenFields.type} />
              <input type="hidden" name="insight_source" value={hiddenFields.source} />
              <input type="hidden" name="report_id" value={hiddenFields.reportId ?? ""} />
              <input type="hidden" name="client_id" value={hiddenFields.clientId ?? ""} />
              <input type="hidden" name="campaign_id" value={hiddenFields.campaignId ?? ""} />
              <input type="hidden" name="assignee_name" value="Marketing team" />
              {needsSeparator && <DropdownMenuSeparator />}
              <DropdownMenuItem
                render={<button type="submit" className="w-full text-left" />}
                variant={action.destructive ? "destructive" : "default"}
              >
                {action.label}
              </DropdownMenuItem>
            </form>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
