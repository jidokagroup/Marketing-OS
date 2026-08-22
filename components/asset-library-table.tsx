"use client";

import { useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";

import { deleteAssetAction } from "@/app/(dashboard)/agents/[id]/asset-actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AssetRow = {
  id: string;
  title: string | null;
  kind: string;
  status: string;
  char_count: number | null;
  error: string | null;
};

export function AssetLibraryTable({
  agentId,
  assets,
  hasDna,
}: {
  agentId: string;
  assets: AssetRow[];
  hasDna: boolean;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [expanded, setExpanded] = useState(false);

  const kinds = useMemo(
    () => ["all", ...Array.from(new Set(assets.map((asset) => asset.kind))).sort()],
    [assets],
  );
  const statuses = useMemo(
    () => ["all", ...Array.from(new Set(assets.map((asset) => asset.status))).sort()],
    [assets],
  );
  const filtered = assets.filter((asset) => {
    const text = `${asset.title ?? "Untitled"} ${asset.kind} ${asset.status}`.toLowerCase();
    return (
      text.includes(query.trim().toLowerCase()) &&
      (kind === "all" || asset.kind === kind) &&
      (status === "all" || asset.status === status)
    );
  });
  const visible = expanded ? filtered : filtered.slice(0, 8);

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_160px_160px]">
        <label className="relative">
          <span className="sr-only">Search assets</span>
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search files"
            className="pl-8"
          />
        </label>
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {kinds.map((item) => (
            <option key={item} value={item}>
              {item === "all" ? "All types" : item}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item === "all" ? "All statuses" : item}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Characters</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((asset) => (
              <TableRow key={asset.id}>
                <TableCell className="font-medium">
                  {asset.title || "Untitled"}
                  {asset.status === "error" && asset.error && (
                    <span className="block text-xs text-destructive">
                      {asset.error}
                    </span>
                  )}
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {asset.status === "extracted"
                      ? hasDna
                        ? "Used in Voice DNA"
                        : "Ready for Voice DNA"
                      : "Not analyzed yet"}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{asset.kind}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={asset.status === "extracted" ? "default" : "outline"}>
                    {asset.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {asset.char_count?.toLocaleString() ?? "-"}
                </TableCell>
                <TableCell>
                  <form action={deleteAssetAction}>
                    <input type="hidden" name="id" value={asset.id} />
                    <input type="hidden" name="agent_id" value={agentId} />
                    <ConfirmSubmitButton
                      title="Delete this source file?"
                      confirmLabel="Delete file"
                      message={`"${asset.title}" is removed from this agent's knowledge base. Voice DNA already analysed from it stays until the agent is re-analysed.`}
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </ConfirmSubmitButton>
                  </form>
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No files match those filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length > 8 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Collapse file list" : `Show all ${filtered.length} files`}
        </Button>
      )}
    </div>
  );
}
