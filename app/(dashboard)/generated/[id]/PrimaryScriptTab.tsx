"use client";

import { useState } from "react";
import { CalendarClock, Edit3 } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { Button, ButtonLink } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateGeneratedContentAction } from "../actions";

function replaceFirstLine(text: string, line: string): string {
  const lines = text.split("\n");
  const idx = lines.findIndex((l) => l.trim().length > 0);
  if (idx === -1) return line;
  lines[idx] = line;
  return lines.join("\n");
}

function replaceLastLine(text: string, line: string): string {
  const lines = text.split("\n");
  let idx = lines.length - 1;
  while (idx >= 0 && lines[idx].trim().length === 0) idx -= 1;
  if (idx === -1) return line;
  lines[idx] = line;
  return lines.join("\n");
}

function firstNonEmptyLine(text: string): string {
  return text.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
}

function lastNonEmptyLine(text: string): string {
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].trim().length > 0) return lines[i].trim();
  }
  return "";
}

/**
 * The short-form script tab. Alternate hooks/CTAs swap into the script's
 * opening/closing line on click -- the schema treats primary_script as one
 * free-text field with the hook first and the CTA last, so that's the only
 * reliable place to insert them without re-running generation.
 */
export function PrimaryScriptTab({
  contentId,
  label,
  initialScript,
  hooks,
  ctas,
  scheduleHref,
}: {
  contentId: string;
  label: string;
  initialScript: string;
  hooks: string[];
  ctas: string[];
  scheduleHref?: string;
}) {
  const [script, setScript] = useState(initialScript);

  return (
    <form action={updateGeneratedContentAction} className="space-y-4">
      <input type="hidden" name="id" value={contentId} />
      <input type="hidden" name="variant" value="primary" />
      <div className="flex justify-end">
        <CopyButton text={script} />
      </div>
      <Textarea
        name="primary_script"
        rows={12}
        className="font-sans text-sm leading-relaxed"
        value={script}
        onChange={(e) => setScript(e.target.value)}
      />

      {(hooks.length > 0 || ctas.length > 0) && (
        <div className="space-y-4 rounded-md border p-3">
          {hooks.length > 0 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                Alternate hooks — click to swap into the opening line
              </p>
              <div className="flex flex-col gap-1.5">
                {hooks.map((h, i) => {
                  const active = h.trim().length > 0 && firstNonEmptyLine(script) === h.trim();
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setScript((prev) => replaceFirstLine(prev, h))}
                      className={`rounded-md border px-3 py-2 text-left text-sm transition-colors hover:border-primary hover:bg-muted/50 ${
                        active ? "border-primary bg-primary/5" : ""
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {ctas.length > 0 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                Alternate CTAs — click to swap into the closing line
              </p>
              <div className="flex flex-col gap-1.5">
                {ctas.map((c, i) => {
                  const active = c.trim().length > 0 && lastNonEmptyLine(script) === c.trim();
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setScript((prev) => replaceLastLine(prev, c))}
                      className={`rounded-md border px-3 py-2 text-left text-sm transition-colors hover:border-primary hover:bg-muted/50 ${
                        active ? "border-primary bg-primary/5" : ""
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm">
          <Edit3 className="mr-1 h-4 w-4" />
          Save {label.toLowerCase()}
        </Button>
        {scheduleHref && (
          <ButtonLink href={scheduleHref} variant="outline" size="sm">
            <CalendarClock className="mr-1 h-3.5 w-3.5" />
            Pair with a visual asset + schedule
          </ButtonLink>
        )}
      </div>
    </form>
  );
}
