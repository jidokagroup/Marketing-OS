import { FileText, Search } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Source Library · Jidoka Marketing Team OS" };

export default async function ScriptsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string }>;
}) {
  const { supabase } = await requireUser();
  const { q = "", type = "all", status = "all" } = await searchParams;

  const { data: assets } = await supabase
    .from("marketing_os_uploaded_assets")
    .select("id, agent_id, title, kind, status, char_count, extracted_text, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const assetList = assets ?? [];
  const agentIds = [...new Set(assetList.map((asset) => asset.agent_id))];
  const { data: agents } = agentIds.length
    ? await supabase.from("marketing_os_writing_agents").select("id, name").in("id", agentIds)
    : { data: [] };
  const agentById = new Map((agents ?? []).map((agent) => [agent.id, agent.name]));
  const types = ["all", ...Array.from(new Set(assetList.map((asset) => asset.kind))).sort()];
  const statuses = [
    "all",
    ...Array.from(new Set(assetList.map((asset) => asset.status))).sort(),
  ];
  const query = q.trim().toLowerCase();
  const filtered = assetList.filter((asset) => {
    const agentName = agentById.get(asset.agent_id) ?? "";
    const haystack = `${asset.title ?? ""} ${asset.kind} ${asset.status} ${agentName}`.toLowerCase();
    return (
      (!query || haystack.includes(query)) &&
      (type === "all" || asset.kind === type) &&
      (status === "all" || asset.status === status)
    );
  });

  return (
    <div>
      <PageHeader
        title="Source Library"
        description="Search the source files uploaded to your Client Content Agents. Upload new files from the agent that owns them."
      >
        <ButtonLink href="/agents" variant="outline">
          Open Client Content Agents
        </ButtonLink>
      </PageHeader>

      {!assets || assets.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No assets uploaded"
          description="Upload scripts, posts, captions, emails, and transcripts on an agent to build its library."
          actionLabel="Go to agents"
          actionHref="/agents"
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            This is a reference view. For everyday work, open the Client Content Agent to
            upload files, analyze voice, generate content, and view the Knowledge Base.
          </div>

          <form className="grid gap-2 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_160px_160px_auto]">
            <label className="relative">
              <span className="sr-only">Search source files</span>
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input name="q" defaultValue={q} placeholder="Search by title or agent" className="pl-8" />
            </label>
            <select
              name="type"
              defaultValue={type}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {types.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All types" : item}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={status}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All statuses" : item}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Filter
            </Button>
          </form>

          <details
            className="rounded-lg border p-3"
            open={Boolean(query || type !== "all" || status !== "all")}
          >
            <summary className="cursor-pointer list-none font-medium">
              View source table
              <span className="ml-2 text-xs text-muted-foreground">
                {filtered.length} file{filtered.length === 1 ? "" : "s"}
              </span>
            </summary>
          <div className="mt-3 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Characters</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => {
                  const agentName = agentById.get(a.agent_id);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="max-w-md font-medium">
                        <details>
                          <summary className="cursor-pointer list-none truncate">
                            {a.title || "Untitled"}
                          </summary>
                          <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-xs font-normal text-muted-foreground">
                            {a.extracted_text || "No extracted preview available."}
                          </p>
                        </details>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {agentName ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{a.kind}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={a.status === "extracted" ? "default" : "outline"}
                        >
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {a.char_count?.toLocaleString() ?? "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No source files match those filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          </details>
        </div>
      )}
    </div>
  );
}
