"use client";

import { useState } from "react";
import { CheckCircle2, Circle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STORAGE_KEY = "jidoka-marketing-team-os-getting-started-dismissed";

type Step = {
  label: string;
  done: boolean;
};

const DEFAULT_STEPS: Step[] = [
  { label: "Create or open a Client Content Agent for the client.", done: false },
  {
    label: "Upload the client files once, then run Voice Intelligence Analysis.",
    done: false,
  },
  {
    label:
      "Review Brand Voice DNA and the Knowledge Base after the Client Content Agent analyzes uploaded files.",
    done: false,
  },
  { label: "Generate captions and scripts with exact titles.", done: false },
  {
    label: "Connect social accounts in the Client Content Agent's Connections tab.",
    done: false,
  },
  {
    label:
      "Schedule one post across multiple platforms or bulk import the scheduler CSV template.",
    done: false,
  },
  {
    label:
      "Use Calendar to edit captions, delete posts, and confirm connected accounts before publishing.",
    done: false,
  },
];

export function GettingStartedGuide({ steps = DEFAULT_STEPS }: { steps?: Step[] }) {
  const [hidden, setHidden] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem(STORAGE_KEY) === "true",
  );

  if (hidden) return null;

  return (
    <Card className="mt-8">
      <CardHeader className="has-data-[slot=card-action]:grid-cols-[1fr_auto]">
        <div>
          <CardTitle>Setup checklist</CardTitle>
          <CardDescription>
            Work through these steps once, then close this guide.
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label="Hide setup checklist"
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, "true");
            setHidden(true);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2 text-sm">
          {steps.map((step, index) => {
            const Icon = step.done ? CheckCircle2 : Circle;
            return (
              <li key={step.label} className="flex gap-3">
                <Icon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    step.done ? "text-emerald-500" : "text-muted-foreground"
                  }`}
                />
                <span
                  className={
                    step.done
                      ? "text-muted-foreground line-through decoration-muted-foreground/50"
                      : "text-muted-foreground"
                  }
                >
                  <span className="sr-only">Step {index + 1}: </span>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
