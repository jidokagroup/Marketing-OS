import Link from "next/link";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import { instantToDayKey, instantToWallTime, workspaceTimeZone } from "@/lib/timezone";
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

/**
 * The grid is drawn in the workspace timezone, not the host's.
 *
 * Every date here is a `YYYY-MM-DD` key rather than a `Date`, because a `Date`
 * built on the server carries the host's zone — UTC on Netlify — and a post at
 * 8pm Eastern on the 31st would then land in the next month's grid while the
 * card beside it read "Aug 31". Keys compare and sort correctly as strings.
 */
function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dayKey(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    offset?: string;
    view?: string;
    client?: string;
    agent_id?: string;
    platform?: string;
    status?: string;
    day?: string;
  }>;
}) {
  const { supabase } = await requireUser();
  const {
    offset,
    view = "month",
    client: rawClient = "",
    agent_id: requestedAgentId = "",
    platform = "all",
    status = "all",
    day,
  } = await searchParams;
  const monthOffset = Math.max(0, Math.min(11, Number(offset ?? 0) || 0));

  const timeZone = await workspaceTimeZone();
  const todayKey = instantToDayKey(new Date(), timeZone);
  const [todayYear, todayMonth, todayDay] = todayKey.split("-").map(Number);

  // UTC arithmetic on a zone-derived date: the components are already the
  // user's, so this is plain calendar maths with no second zone applied.
  const shownMonth = new Date(
    Date.UTC(todayYear, todayMonth - 1 + monthOffset, 1),
  );
  const year = shownMonth.getUTCFullYear();
  const month = shownMonth.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstWeekday = shownMonth.getUTCDay();

  const rangeStartKey =
    view === "week" ? todayKey : dayKey(year, month, 1);
  const rangeEndKey =
    view === "week"
      ? instantToWallTime(
          new Date(Date.UTC(todayYear, todayMonth - 1, todayDay + 7)),
          "UTC",
        ).slice(0, 10)
      : dayKey(year, month, daysInMonth);

  const [{ data: agents }, { data: clients }] = await Promise.all([
    supabase
      .from("marketing_os_writing_agents")
      .select("id, name, client_id")
      .order("updated_at", { ascending: false }),
    supabase.from("marketing_os_clients").select("id, name").order("name"),
  ]);

  const agentById = new Map((agents ?? []).map((agent) => [agent.id, agent]));
  const clientById = new Map((clients ?? []).map((item) => [item.id, item.name]));
  const requestedAgent = requestedAgentId ? agentById.get(requestedAgentId) : null;
  const client =
    rawClient === "all"
      ? "all"
      : rawClient || requestedAgent?.client_id || agents?.[0]?.client_id || "all";
  const requestedAgentInScope = Boolean(
    requestedAgent && client !== "all" && requestedAgent.client_id === client,
  );
  const clientAgentIds =
    client === "all"
      ? []
      : (agents ?? [])
          .filter((agent) => agent.client_id === client)
          .map((agent) => agent.id);
  const activeAgentId =
    requestedAgentInScope && requestedAgent ? requestedAgent.id : "";
  const postAgentIds = activeAgentId ? [activeAgentId] : clientAgentIds;

  let posts: CalendarPost[] = [];
  if (client === "all" || postAgentIds.length > 0) {
    let postsQuery = supabase
      .from("marketing_os_scheduled_posts")
      .select(
        "id, agent_id, title, status, scheduled_time, platform, caption, generated_content_id, social_account_id, content_type, media_path, error",
      )
      .order("scheduled_time", { ascending: true, nullsFirst: false });

    if (activeAgentId) postsQuery = postsQuery.eq("agent_id", activeAgentId);
    else if (client !== "all") postsQuery = postsQuery.in("agent_id", postAgentIds);
    if (platform !== "all") postsQuery = postsQuery.eq("platform", platform);
    if (status !== "all") postsQuery = postsQuery.eq("status", status);

    const postsResult = await postsQuery;
    posts = (postsResult.data ?? []) as CalendarPost[];
  }

  const postList = posts;
  const keyForPost = (post: CalendarPost) =>
    post.scheduled_time ? instantToDayKey(post.scheduled_time, timeZone) : "";
  const visiblePosts =
    view === "list"
      ? postList
      : postList.filter((post) => {
          const key = keyForPost(post);
          return Boolean(key) && key >= rangeStartKey && key <= rangeEndKey;
        });

  const byDay = new Map<number, CalendarPost[]>();
  for (const post of visiblePosts) {
    const key = keyForPost(post);
    if (!key) continue;
    const d = Number(key.slice(8, 10));
    const arr = byDay.get(d) ?? [];
    arr.push(post);
    byDay.set(d, arr);
  }

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(shownMonth);
  const todayDate =
    todayYear === year && todayMonth - 1 === month ? todayDay : -1;
  const requestedDay = Number(day ?? todayDate);
  const selectedDay =
    view === "month"
      ? Math.max(1, Math.min(daysInMonth, requestedDay || 1))
      : null;
  const selectedKey = selectedDay ? dayKey(year, month, selectedDay) : null;
  const selectedDate = selectedDay
    ? new Date(Date.UTC(year, month, selectedDay))
    : null;
  const selectedPosts = selectedKey
    ? postList.filter((post) => keyForPost(post) === selectedKey)
    : [];
  const platforms = [
    "all",
    ...Array.from(new Set(posts.map((post) => post.platform))).sort(),
  ];
  const schedulerParams = new URLSearchParams();
  if (client !== "all") schedulerParams.set("client", client);
  if (activeAgentId) schedulerParams.set("agent_id", activeAgentId);
  const schedulerHref = schedulerParams.toString()
    ? `/scheduler?${schedulerParams.toString()}`
    : "/scheduler";
  function calendarHref(
    next: {
      offset?: number;
      view?: string;
      platform?: string;
      status?: string;
      day?: number;
    } = {},
  ) {
    const params = new URLSearchParams();
    params.set("offset", String(next.offset ?? monthOffset));
    params.set("view", next.view ?? view);
    params.set("client", client);
    if (activeAgentId) params.set("agent_id", activeAgentId);
    params.set("platform", next.platform ?? platform);
    params.set("status", next.status ?? status);
    if (next.day) params.set("day", String(next.day));
    return `/calendar?${params.toString()}`;
  }

  return (
    <div>
      <PageHeader title="Calendar" description="Review drafts, scheduled posts, approvals, and account issues.">
        <div className="flex items-center gap-2">
          <ButtonLink href={calendarHref({ offset: Math.max(0, monthOffset - 1) })} variant="outline" size="icon-sm">
            <ChevronLeft className="h-4 w-4" />
          </ButtonLink>
          <span className="min-w-36 text-center text-sm font-medium">{monthLabel}</span>
          <ButtonLink href={calendarHref({ offset: Math.min(11, monthOffset + 1) })} variant="outline" size="icon-sm">
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
            href={calendarHref({ view: value })}
            variant={view === value ? "default" : "outline"}
            size="sm"
          >
            {label}
          </ButtonLink>
        ))}
      </div>

      <form className="mb-4 grid gap-2 rounded-lg border p-3 sm:grid-cols-3 lg:grid-cols-4">
        <input type="hidden" name="view" value={view} />
        {activeAgentId && <input type="hidden" name="agent_id" value={activeAgentId} />}
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
            actionHref={schedulerHref}
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
                  timeZone={timeZone}
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
                          href={calendarHref({ view: "month", day })}
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
                            <CalendarPostDetails key={post.id} post={post} timeZone={timeZone} />
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
                timeZone: "UTC",
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
                    timeZone={timeZone}
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
