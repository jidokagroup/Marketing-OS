import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { asRows, formatDate, opsTable, titleCase } from "@/lib/marketing-os/operations";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type ShareLink = {
  id: string;
  owner_id: string;
  client_id: string | null;
  scope: string;
  label: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

const SCOPE_TITLES: Record<string, string> = {
  approval: "Content awaiting your approval",
  calendar: "What's publishing next",
  content_library: "Published content",
  analytics: "Performance",
};

/**
 * Guest view for a client_share_links token.
 *
 * Unauthenticated by design -- a client should not need an account to see
 * their own approvals, calendar, content, or analytics. Because there is no
 * session, this route reads through the service-role client rather than the
 * user-scoped one, and enforces every boundary in code: the token must
 * resolve to a link that is not revoked and not expired, and every query
 * after that is filtered to the owner_id and client_id the link itself
 * carries -- never to anything read from the request.
 */
export default async function GuestSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const linkResult = await opsTable(admin, "marketing_os_client_share_links")
    .select("id, owner_id, client_id, scope, label, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();
  const link = linkResult.data as ShareLink | null;

  if (!link) notFound();
  if (link.revoked_at) notFound();
  if (link.expires_at && new Date(link.expires_at) < new Date()) notFound();

  await opsTable(admin, "marketing_os_client_share_links")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", link.id);

  const { data: client } = link.client_id
    ? await admin.from("marketing_os_clients").select("name").eq("id", link.client_id).maybeSingle()
    : { data: null };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {client?.name ?? "Shared view"}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {link.label || SCOPE_TITLES[link.scope] || "Shared view"}
        </h1>
      </div>

      {link.scope === "approval" && <ApprovalScope admin={admin} link={link} />}
      {link.scope === "calendar" && <CalendarScope admin={admin} link={link} />}
      {link.scope === "content_library" && <ContentLibraryScope admin={admin} link={link} />}
      {link.scope === "analytics" && <AnalyticsScope admin={admin} link={link} />}
    </div>
  );
}

type ScopeProps = { admin: ReturnType<typeof createAdminClient>; link: ShareLink };

async function agentIdsForClient(admin: ScopeProps["admin"], clientId: string | null) {
  if (!clientId) return [] as string[];
  const { data } = await admin
    .from("marketing_os_writing_agents")
    .select("id")
    .eq("client_id", clientId);
  return (data ?? []).map((row) => row.id as string);
}

async function ApprovalScope({ admin, link }: ScopeProps) {
  const result = link.client_id
    ? await opsTable(admin, "marketing_os_approval_requests")
        .select("id, message, status, due_at, created_at")
        .eq("owner_id", link.owner_id)
        .eq("client_id", link.client_id)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: null };
  const requests = asRows<{
    id: string;
    message: string | null;
    status: string;
    due_at: string | null;
    created_at: string;
  }>(result.data);

  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing is waiting on your approval right now.</p>;
  }

  return (
    <div className="space-y-3">
      {requests.map((item) => (
        <Card key={item.id}>
          <CardContent className="space-y-1.5 py-4">
            <div className="flex items-center justify-between gap-2">
              <Badge variant={item.status === "pending" ? "secondary" : "outline"}>
                {titleCase(item.status)}
              </Badge>
              {item.due_at && (
                <span className="text-xs text-muted-foreground">Due {formatDate(item.due_at)}</span>
              )}
            </div>
            {item.message && <p className="text-sm">{item.message}</p>}
            <p className="text-xs text-muted-foreground">Requested {formatDate(item.created_at)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function CalendarScope({ admin, link }: ScopeProps) {
  const agentIds = await agentIdsForClient(admin, link.client_id);
  if (agentIds.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>;
  }
  const { data } = await admin
    .from("marketing_os_scheduled_posts")
    .select("id, title, platform, status, scheduled_time")
    .in("agent_id", agentIds)
    .in("status", ["scheduled", "posting", "posted"])
    .order("scheduled_time", { ascending: true })
    .limit(30);
  const posts = data ?? [];

  if (posts.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>;
  }

  return (
    <div className="space-y-2">
      {posts.map((post) => (
        <Card key={post.id}>
          <CardContent className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="font-medium">{post.title || "Untitled post"}</p>
              <p className="text-xs text-muted-foreground">
                {post.platform ? titleCase(post.platform) : "—"}
                {post.scheduled_time ? ` · ${formatDate(post.scheduled_time)}` : ""}
              </p>
            </div>
            <Badge variant={post.status === "posted" ? "default" : "outline"}>{titleCase(post.status)}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function ContentLibraryScope({ admin, link }: ScopeProps) {
  const agentIds = await agentIdsForClient(admin, link.client_id);
  if (agentIds.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing published yet.</p>;
  }
  const { data } = await admin
    .from("marketing_os_generated_content")
    .select("id, title, topic, platform, created_at")
    .in("agent_id", agentIds)
    .order("created_at", { ascending: false })
    .limit(30);
  const items = data ?? [];

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing published yet.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="space-y-1 py-3">
            <p className="font-medium">{item.title || item.topic || "Untitled piece"}</p>
            <p className="text-xs text-muted-foreground">
              {item.platform ? titleCase(item.platform) : "—"} · {formatDate(item.created_at)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function last30DaysDate(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function AnalyticsScope({ admin, link }: ScopeProps) {
  const result = await opsTable(admin, "marketing_os_platform_analytics")
    .select("platform, views, impressions, likes, comments, shares, performance_score, date")
    .eq("owner_id", link.owner_id)
    .gte("date", last30DaysDate())
    .order("date", { ascending: false })
    .limit(500);
  const rows = asRows<{
    platform: string;
    views: number;
    impressions: number;
    likes: number;
    comments: number;
    shares: number;
    performance_score: number;
    date: string;
  }>(result.data);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No analytics recorded in the last 30 days yet.</p>;
  }

  const byPlatform = new Map<string, { views: number; likes: number; comments: number; shares: number }>();
  for (const row of rows) {
    const bucket = byPlatform.get(row.platform) ?? { views: 0, likes: 0, comments: 0, shares: 0 };
    bucket.views += Number(row.views || 0);
    bucket.likes += Number(row.likes || 0);
    bucket.comments += Number(row.comments || 0);
    bucket.shares += Number(row.shares || 0);
    byPlatform.set(row.platform, bucket);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[...byPlatform.entries()].map(([platform, totals]) => (
        <Card key={platform}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{titleCase(platform)}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Views</p>
              <p className="font-semibold">{totals.views.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Likes</p>
              <p className="font-semibold">{totals.likes.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Comments</p>
              <p className="font-semibold">{totals.comments.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Shares</p>
              <p className="font-semibold">{totals.shares.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
