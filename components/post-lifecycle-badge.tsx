import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LifecycleView, PostLifecycleState } from "@/lib/scheduler-lifecycle";

const STYLES: Record<PostLifecycleState, string> = {
  draft: "bg-muted text-muted-foreground",
  ready_to_schedule:
    "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-300",
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  publishing: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  posted:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  needs_media: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  needs_caption: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  blocked_connection:
    "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  manual_only:
    "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
};

/**
 * One badge for the state a post is really in, shared by the Scheduler and the
 * Calendar so the same post never reads as two different things.
 */
export function PostLifecycleBadge({ view }: { view: LifecycleView }) {
  return (
    <Badge
      className={cn("border-0 font-medium", STYLES[view.state])}
      title={view.detail}
    >
      {view.label}
    </Badge>
  );
}
