"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { readJsonResponse } from "@/lib/client-response";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CATEGORIES = [
  "strategy",
  "campaign",
  "content",
  "publishing",
  "analytics",
  "client_ops",
  "sales",
  "agency_ops",
];

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function PlaybookUploadForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = submitting || pending;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      toast.error("Choose a PDF, Word doc, or text playbook first.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/playbooks/upload", {
        method: "POST",
        body: formData,
      });
      const json = await readJsonResponse<{
        error?: string;
        playbook?: { title?: string };
        memory_saved?: boolean;
      }>(response);

      if (!response.ok) {
        throw new Error(json.error ?? "Could not upload this playbook.");
      }

      toast.success(
        json.memory_saved
          ? `Scanned ${json.playbook?.title ?? "playbook"} and saved it to Core memory.`
          // The playbook itself saved; only the memory link did not. Naming a
          // migration here told the reader nothing they could act on.
          : `Scanned ${json.playbook?.title ?? "playbook"}. Core memory isn't switched on for this workspace, so it wasn't added there.`,
      );
      form.reset();
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-lg border p-4 lg:grid-cols-[1fr_170px_160px_auto]">
      <div className="space-y-2 lg:col-span-2">
        <Label htmlFor="playbook_file">Upload PDF, Word doc, or text playbook</Label>
        <Input
          id="playbook_file"
          name="file"
          type="file"
          accept=".pdf,.doc,.docx,.txt,.md,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="playbook_category">Category</Label>
        <select
          id="playbook_category"
          name="category"
          defaultValue="agency_ops"
          className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {label(category)}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={busy} className="self-end">
        {busy ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-1 h-4 w-4" />
        )}
        Scan
      </Button>
      <Input name="title" placeholder="Optional title override" />
      <Input name="owner_name" placeholder="Owner" />
      <p className="text-xs text-muted-foreground lg:col-span-2">
        Jidoka scans the document, creates a structured playbook, stores the
        extracted text, and saves a Core memory record so the orchestrator can
        brief other agents.
      </p>
    </form>
  );
}
