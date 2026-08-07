import Link from "next/link";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PLATFORM_LABELS } from "@/lib/social/platforms";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  CalendarDeletedPostsProvider,
  CalendarPostCard,
  CalendarPostDetails,
  type CalendarPost,
} from "@/components/calendar-post-items";

export const metadata = { title: "Calendar · Jidoka Marketing Team OS" };

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function inRange(value: string | null, start: Date, end: Date) {
  if (!value) return false;
  const date = new Date(value);
  return date >= start && date <= end;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    offset?: string;
    view?: string;
    client?: string;
    platform?: string;
    status?: string;
    day?: string;
  }>;
}) {
  const { supabase } = await requireUser();
  const {
    offset,
    view = "month",
    client = "all",
    platform = "all",
    status = "all",
    day,
  } = await searchParams;
  const monthOffset = Math.max(0, Math.min(11, Number(offset ?? 0) || 0));

  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const rangeStart = view === "week" ? now : new Date(year, month, 1);
  const rangeEnd =
    view === "week"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59)
      : new Date(year, month + 1, 0, 23, 59, 59);

  const [{ data: agents }, { data: clients }] = await Promise.all([
    supabase.from("marketing_os_writing_agents").select("id, name, client_id").order("name"),
    supabase.from("marketing_os_clients").select("id, name").order("name"),
  ]);

  const agentById = new Map((agents ?? []).map((agent) => [agent.id, agent]));
  const clientById = new Map((clients ?? []).map((item) => [item.id, item.name]));
  const clientAgentIds =
    client === "all"
      ? []
      : (agents ?? [])
          .filter((agent) => agent.client_id === client)
          .map((agent) => agent.id);

  let posts: CalendarPost[] = [];
  if (client === "all" || clientAgentIds.length > 0) {
    let postsQuery = supabase
      .from("marketing_os_scheduled_posts")
      .select(
        "id, agent_id, title, status, scheduled_time, platform, caption, generated_content_id, social_account_id, content_type, media_path, error",
      )
      .order("scheduled_time", { ascending: true, nullsFirst: false });

    if (client !== "all") postsQuery = postsQuery.in("agent_id", clientAgentIds);
    if (platform !== "all") postsQuery = postsQuery.eq("platform", platform);
    if (status !== "all") postsQuery = postsQuery.eq("status", status);

    const postsResult = await postsQuery;
    posts = (postsResult.data ?? []) as CalendarPost[];
  }

  const postList = posts;
  const visiblePosts =
    view === "list"
      ? postList
      : postList.filter((post) => inRange(post.scheduled_time, rangeStart, rangeEnd));

  const byDay = new Map<number, CalendarPost[]>();
  for (const post of visiblePosts) {
    if (!post.scheduled_time) continue;
    const d = new Date(post.scheduled_time).getDate();
    const arr = byDay.get(d) ?? [];
    arr.push(post);
    byDay.set(d, arr);
  }

  const firstWeekday = rangeStart.getDay();
  const daysInMonth = rangeEnd.getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = base.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  const todayDate =
    now.getFullYear() === year && now.getMonth() === month ? now.getDate() : -1;
  const requestedDay = Number(day ?? todayDate);
  const selectedDay =
    view === "month"
      ? Math.max(1, Math.min(daysInMonth, requestedDay || 1))
      : null;
  const selectedDate = selectedDay ? new Date(year, month, selectedDay) : null;
  const selectedPosts = selectedDay
    ? postList.filter((post) => {
        if (!post.scheduled_time) return false;
        const date = new Date(post.scheduled_time);
        return (
          date.getFullYear() === year &&
          date.getMonth() === month &&
          date.getDate() === selectedDay
        );
      })
    : [];
  const platforms = [
    "all",
    ...Array.from(new Set(posts.map((post) => post.platform))).sort(),
  ];

  return (
    <div>
      <PageHeader title="Calendar" description="Review drafts, scheduled posts, approvals, and account issues.">
        <div className="flex items-center gap-2">
          <ButtonLink href={`/calendar?offset=${Math.max(0, monthOffset - 1)}&view=${view}&client=${client}&platform=${platform}&status=${status}`} variant="outline" size="icon-sm">
            <ChevronLeft className="h-4 w-4" />
          </ButtonLink>
          <span className="min-w-36 text-center text-sm font-medium">{monthLabel}</span>
          <ButtonLink href={`/calendar?offset=${Math.min(11, monthOffset + 1)}&view=${view}&client=${client}&platform=${platform}&status=${status}`} variant="outline" size="icon-sm">
            <ChevronRight className="h-4 w-4" />
          </ButtonLink>
        </div>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          ["month", "Month"],
          ["week", "Week"],
          ["list", "List"],
        ].map(([value, label]) => (
          <ButtonLink
            key={value}
            href={`/calendar?view=${value}&client=${client}&platform=${platform}&status=${status}`}
            variant={view === value ? "default" : "outline"}
            size="sm"
          >
            {label}
          </ButtonLink>
        ))}
      </div>

      <form className="mb-4 grid gap-2 rounded-lg border p-3 sm:grid-cols-3 lg:grid-cols-4">
        <input type="hidden" name="view" value={view} />
        <select
          name="client"
          defaultValue={client}
          className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="all">All clients</option>
          {(clients ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          name="platform"
          defaultValue={platform}
          className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {platforms.map((item) => (
            <option key={item} value={item}>
              {item === "all" ? "All platforms" : PLATFORM_LABELS[item as keyof typeof PLATFORM_LABELS] ?? item}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {["all", "draft", "scheduled", "posting", "posted", "failed"].map((item) => (
            <option key={item} value={item}>
              {item === "all" ? "All statuses" : item}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      <CalendarDeletedPostsProvider>
        {visiblePosts.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No posts match this view"
            description="Schedule a post, switch to List view for drafts, or clear a filter to see more content."
            actionLabel="Schedule your first post"
            actionHref="/scheduler"
          />
        ) : view === "list" || view === "week" ? (
          <div className="space-y-3">
            {visiblePosts.map((post) => {
              const agent = agentById.get(post.agent_id);
              const clientName = agent?.client_id ? clientById.get(agent.client_id) : null;
              return (
                <CalendarPostCard
                  key={post.id}
                  post={post}
                  agentName={agent?.name ?? "Writing Agent"}
                  clientName={clientName ?? "No client"}
                />
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
              {DOW.map((d) => (
                <div key={d} className="px-2 py-2 text-center">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day, i) => {
                const dayPosts = day ? byDay.get(day) ?? [] : [];
                return (
                  <div
                    key={i}
                    className={cn(
                      "min-h-24 border-b border-r p-1.5 text-sm [&:nth-child(7n)]:border-r-0",
                      !day && "bg-muted/20",
                    )}
                  >
                    {day && (
                      <>
                        <Link
                          href={`/calendar?offset=${monthOffset}&view=month&client=${client}&platform=${platform}&status=${status}&day=${day}`}
                          className={cn(
                            "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs transition-colors hover:bg-muted",
                            day === todayDate && "bg-primary text-primary-foreground",
                            day === selectedDay &&
                              day !== todayDate &&
                              "bg-muted text-foreground",
                          )}
                        >
                          {day}
                        </Link>
                        <div className="space-y-1">
                          {dayPosts.map((post) => (
                            <CalendarPostDetails key={post.id} post={post} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "month" && selectedDate && (
          <div className="mt-6 space-y-3">
            <h2 className="text-lg font-semibold">
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h2>
            {selectedPosts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No content is scheduled on this date.
              </div>
            ) : (
              selectedPosts.map((post) => {
                const agent = agentById.get(post.agent_id);
                const clientName = agent?.client_id ? clientById.get(agent.client_id) : null;
                return (
                  <CalendarPostCard
                    key={post.id}
                    post={post}
                    agentName={agent?.name ?? "Writing Agent"}
                    clientName={clientName ?? "No client"}
                  />
                );
              })
            )}
          </div>
        )}
      </CalendarDeletedPostsProvider>
    </div>
  );
}
