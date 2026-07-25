"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

import { CONTENT_CHANNEL_OPTIONS } from "@/lib/core-agents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readJsonResponse } from "@/lib/client-response";

type GenerateFormDefaults = {
  title?: string;
  topic?: string;
  goal?: string;
  audience?: string;
  offer?: string;
  cta?: string;
  length?: string;
  notes?: string;
  platforms?: string[];
};

export function GenerateForm({
  agentId,
  defaults = {},
}: {
  agentId: string;
  defaults?: GenerateFormDefaults;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const defaultPlatforms = defaults.platforms?.length
    ? defaults.platforms
    : ["instagram"];

  useEffect(() => {
    if (!busy) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsed((seconds) => seconds + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [busy]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload: Record<string, FormDataEntryValue | string[]> =
      Object.fromEntries(form.entries());
    const platforms = form
      .getAll("platforms")
      .map((value) => String(value))
      .filter(Boolean);
    payload.platforms = platforms.length ? platforms : ["instagram"];
    payload.platform = platforms.length ? platforms.join(", ") : "Instagram";
    if (!String(payload.topic ?? "").trim()) {
      toast.error("Topic is required");
      return;
    }
    setElapsed(0);
    setBusy(true);
    toast.info("Generating draft — this usually takes under a minute…");
    try {
      const res = await fetch(`/api/agents/${agentId}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await readJsonResponse<{
        id?: string;
        overall?: number;
      }>(res);
      if (!res.ok) {
        toast.error(json.error ?? "Generation failed");
        return;
      }
      toast.success(`Done — authenticity ${Math.round(Number(json.overall ?? 0))}/100`);
      router.push(`/generated/${json.id}`);
    } catch {
      toast.error("Network error during generation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-lg border p-5">
      <div className="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
        Jidoka Marketing Team OS generates a package: reel script, short caption, long caption,
        carousel copy, email version, hooks, and CTA options.
      </div>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          placeholder="e.g. Morning Routine Myth — Reel 01"
          defaultValue={defaults.title}
        />
        <p className="text-xs text-muted-foreground">
          The Smart Scheduler matches a video/carousel to this content when their
          titles match. Defaults to the topic if left blank.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="topic">Topic *</Label>
        <Input
          id="topic"
          name="topic"
          required
          placeholder="e.g. Why most morning routines fail"
          defaultValue={defaults.topic}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="goal">Goal</Label>
          <Input
            id="goal"
            name="goal"
            placeholder="Drive DMs / book calls"
            defaultValue={defaults.goal}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audience">Audience</Label>
          <Input
            id="audience"
            name="audience"
            placeholder="Coaches scaling to 7-figs"
            defaultValue={defaults.audience}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="offer">Offer</Label>
          <Input
            id="offer"
            name="offer"
            placeholder="Group program"
            defaultValue={defaults.offer}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cta">CTA</Label>
          <Input
            id="cta"
            name="cta"
            placeholder="Comment 'SCALE'"
            defaultValue={defaults.cta}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="length">Length</Label>
          <Input
            id="length"
            name="length"
            placeholder="Short / Medium / Long"
            defaultValue={defaults.length}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Channels</Label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CONTENT_CHANNEL_OPTIONS.map((channel) => (
            <label
              key={channel.key}
              className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors has-checked:border-primary has-checked:bg-muted/60"
            >
              <input
                type="checkbox"
                name="platforms"
                value={channel.key}
                defaultChecked={defaultPlatforms.includes(channel.key)}
                className="h-4 w-4"
              />
              <span>{channel.label}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Intelligence context is included automatically with every generation.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Anything specific to include…"
          defaultValue={defaults.notes}
        />
      </div>
      <Button type="submit" disabled={busy}>
        <Sparkles className="mr-1 h-4 w-4" />
        {busy ? "Generating draft…" : "Generate content package"}
      </Button>
      {busy && (
        <p className="text-sm text-muted-foreground">
          Matching voice examples and drafting now. Elapsed: {elapsed}s
        </p>
      )}
    </form>
  );
}
