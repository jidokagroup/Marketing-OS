"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readJsonResponse } from "@/lib/client-response";

const PLATFORMS = [
  { label: "Instagram", value: "Instagram" },
  { label: "TikTok (API setup)", value: "TikTok", disabled: true },
  { label: "YouTube", value: "YouTube" },
  { label: "LinkedIn", value: "LinkedIn" },
  { label: "Facebook", value: "Facebook" },
  { label: "X / Twitter", value: "X / Twitter" },
  { label: "Email", value: "Email" },
  { label: "Multi-platform", value: "Multi-platform" },
];

export function AgentForm({
  clients,
  defaultClientId = "",
}: {
  clients: { id: string; name: string }[];
  defaultClientId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch("/api/agents/create", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const json = await readJsonResponse<{
        id?: string;
        error?: string;
      }>(res);
      if (!res.ok || !json.id) {
        throw new Error(json.error ?? "Could not create agent.");
      }
      router.push(`/agents/${json.id}?new=1`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create agent.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Agent name *</Label>
        <Input id="name" name="name" required placeholder="Erik — IG Authority Voice" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="client_id">Client *</Label>
        <p className="text-xs text-muted-foreground">
          Each client gets their own Client Content Agent because the uploaded data and voice are different.
        </p>
        {/* Plain select keeps the value in the form payload reliably. */}
        <select
          id="client_id"
          name="client_id"
          defaultValue={defaultClientId}
          required
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">
            {clients.length ? "Select a client" : "Create a client first"}
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <Input id="industry" name="industry" placeholder="Fitness coaching" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="platform">Primary platform</Label>
          <p className="text-xs text-muted-foreground">
            Optional starting point. Smart Scheduler can still post to multiple
            platforms later.
          </p>
          <select
            id="platform"
            name="platform"
            defaultValue=""
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">— Select —</option>
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value} disabled={p.disabled}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Useful context about this client, their voice, and what this agent should help create."
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create agent & continue"}
      </Button>
    </form>
  );
}
