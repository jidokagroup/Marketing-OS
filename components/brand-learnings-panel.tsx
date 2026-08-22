import { Brain, Trash2 } from "lucide-react";

import {
  deleteLearningAction,
  saveLearningAction,
  setLearningActiveAction,
} from "@/app/(dashboard)/learnings/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import {
  LEARNING_KINDS,
  SOURCE_LABEL,
  confidenceBand,
  confidenceLabel,
  type BrandLearning,
  type LearningKind,
} from "@/lib/brand-learnings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const KIND_LABEL: Record<LearningKind, string> = {
  terminology: "Terminology",
  prohibited_phrase: "Never say",
  cta_style: "Call to action",
  emoji: "Emoji",
  length: "Length",
  voice_pattern: "Voice pattern",
  positioning: "Positioning",
  format: "Format",
  other: "Other",
};

/**
 * What the agent has learned since its Voice DNA was built.
 *
 * Sits beside the DNA rather than inside it, because these are two different
 * kinds of claim: the DNA is an analysis of what the client already published,
 * and a learning is a correction made afterwards. Merging them would hide
 * which is which, and the whole point of showing this is that a person can see
 * why the writing changed and undo it.
 */
export function BrandLearningsPanel({
  agentId,
  clientId,
  learnings,
  unavailable = false,
}: {
  agentId: string;
  clientId?: string | null;
  learnings: BrandLearning[];
  unavailable?: boolean;
}) {
  const active = learnings.filter((learning) => learning.active);
  const archived = learnings.filter((learning) => !learning.active);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4" /> Learned preferences
        </CardTitle>
        <CardDescription>
          Corrections and findings from after the voice profile was built. Active ones are
          sent with every draft this agent writes. Nothing is added without you accepting it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {unavailable ? (
          <p className="text-sm text-muted-foreground">
            Learned preferences are not available yet. Generation is unaffected — drafts still
            use this agent&apos;s Voice DNA.
          </p>
        ) : (
          <>
            {active.length === 0 && archived.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing learned yet. Add a preference below, or save one from a draft you
                edited or an insight on Performance Intelligence.
              </p>
            ) : null}

            {active.length > 0 && (
              <ul className="space-y-2">
                {active.map((learning) => (
                  <LearningRow key={learning.id} agentId={agentId} learning={learning} />
                ))}
              </ul>
            )}

            {archived.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Turned off ({archived.length})
                </p>
                <ul className="space-y-2">
                  {archived.map((learning) => (
                    <LearningRow key={learning.id} agentId={agentId} learning={learning} />
                  ))}
                </ul>
              </div>
            )}

            <form action={saveLearningAction} className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <input type="hidden" name="agent_id" value={agentId} />
              <input type="hidden" name="client_id" value={clientId ?? ""} />
              <input type="hidden" name="source" value="manual" />
              <div className="space-y-1.5">
                <Label htmlFor="learning-statement">Add a preference</Label>
                <Input
                  id="learning-statement"
                  name="statement"
                  required
                  maxLength={400}
                  placeholder="Never open a post with a question."
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="learning-kind">Kind</Label>
                  <select
                    id="learning-kind"
                    name="kind"
                    defaultValue="voice_pattern"
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {LEARNING_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {KIND_LABEL[kind]}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" size="sm">
                  Save preference
                </Button>
              </div>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LearningRow({ agentId, learning }: { agentId: string; learning: BrandLearning }) {
  const band = confidenceBand(learning.confidence);
  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <p className={learning.active ? "text-sm" : "text-sm text-muted-foreground line-through"}>
          {learning.statement}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={band === "established" ? "default" : "secondary"}>
            {confidenceLabel(learning)}
          </Badge>
          <Badge variant="outline">{KIND_LABEL[learning.kind]}</Badge>
          <span className="text-xs text-muted-foreground">{SOURCE_LABEL[learning.source]}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <form action={setLearningActiveAction}>
          <input type="hidden" name="id" value={learning.id} />
          <input type="hidden" name="agent_id" value={agentId} />
          <input type="hidden" name="active" value={learning.active ? "false" : "true"} />
          <Button type="submit" variant="ghost" size="sm">
            {learning.active ? "Turn off" : "Turn on"}
          </Button>
        </form>
        <form action={deleteLearningAction}>
          <input type="hidden" name="id" value={learning.id} />
          <input type="hidden" name="agent_id" value={agentId} />
          <ConfirmSubmitButton
            title="Delete this preference?"
            confirmLabel="Delete"
            message={`"${learning.statement}" is removed permanently, along with the evidence behind it. Turning it off instead keeps both and can be undone.`}
            size="sm"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </ConfirmSubmitButton>
        </form>
      </div>
    </li>
  );
}
