import { Brain } from "lucide-react";

import { saveLearningAction } from "@/app/(dashboard)/learnings/actions";
import { suggestedStatement } from "@/lib/edit-signals";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Offers to keep what an edit revealed.
 *
 * Appears only after a substantial edit, and only when there is a specific
 * observation to show — a phrase the writer used that is now gone. The
 * statement is pre-filled and editable rather than saved automatically: the
 * system observed the deletion, it did not deduce the rule, and putting an
 * invented preference into a client's Brand Brain unasked is worse than
 * capturing nothing.
 *
 * Dismissing is a link back to the same page without the prompt, so ignoring
 * it costs nothing and leaves no record.
 */
export function LearnFromEditPrompt({
  agentId,
  clientId,
  contentId,
  removedTerms,
}: {
  agentId: string;
  clientId: string | null;
  contentId: string;
  removedTerms: string[];
}) {
  const statement = suggestedStatement({
    meaningful: true,
    removedTerms,
    addedTerms: [],
    changedChars: 0,
  });
  if (!statement) return null;

  return (
    <div className="mb-6 rounded-lg border border-dashed bg-muted/30 p-4">
      <div className="flex items-start gap-2">
        <Brain className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-medium">Save this preference to Brand Brain?</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your edit took out{" "}
              {removedTerms.map((term) => `“${term}”`).join(", ")}. Keeping this as a
              preference means future drafts for this agent avoid it. Edit the wording
              before saving if that is not quite the rule.
            </p>
          </div>
          <form action={saveLearningAction} className="flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="agent_id" value={agentId} />
            <input type="hidden" name="client_id" value={clientId ?? ""} />
            <input type="hidden" name="source" value="user_edit" />
            <input type="hidden" name="kind" value="prohibited_phrase" />
            <input type="hidden" name="evidence" value={`From an edit to ${contentId}`} />
            <Input
              name="statement"
              defaultValue={statement}
              maxLength={400}
              aria-label="Preference to save"
              className="flex-1"
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Save preference
              </Button>
              <ButtonLink href={`/generated/${contentId}`} size="sm" variant="ghost">
                Not this time
              </ButtonLink>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
