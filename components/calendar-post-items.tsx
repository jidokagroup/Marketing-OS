"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
} from "react";
import { AlertCircle, Link2, Trash2 } from "lucide-react";

import {
  deletePostAction,
  scheduleAction,
  updateCaptionAction,
} from "@/app/(dashboard)/scheduler/actions";
import { PostStatusBadge } from "@/components/post-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  isAutoPublishableContent,
  PLATFORM_LABELS,
} from "@/lib/social/platforms";
import { cn } from "@/lib/utils";
import { formatInstant, instantToWallTime } from "@/lib/time-format";

export type CalendarPost = {
  id: string;
  agent_id: string;
  title: string | null;
  status: string;
  scheduled_time: string | null;
  platform: string;
  caption: string | null;
  generated_content_id: string | null;
  social_account_id: string | null;
  content_type: string;
  media_path: string | null;
  error?: string | null;
};

const STATUS_DOT: Record<string, string> = {
  scheduled: "bg-blue-500",
  posted: "bg-emerald-500",
  posting: "bg-amber-500",
  failed: "bg-red-500",
  draft: "bg-muted-foreground",
};

type DeletedPostsContextValue = {
  deletedIds: Set<string>;
  markDeleted: (id: string) => void;
};

const DeletedPostsContext = createContext<DeletedPostsContextValue | null>(null);

export function CalendarDeletedPostsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());

  const markDeleted = useCallback((id: string) => {
    setDeletedIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ deletedIds, markDeleted }),
    [deletedIds, markDeleted],
  );

  return (
    <DeletedPostsContext.Provider value={value}>
      {children}
    </DeletedPostsContext.Provider>
  );
}

function useDeletedPosts() {
  const context = useContext(DeletedPostsContext);
  if (!context) {
    throw new Error("Calendar post items must be rendered inside CalendarDeletedPostsProvider");
  }
  return context;
}

function approvalLabel(post: CalendarPost) {
  if (post.status === "posted") return "published";
  if (post.status === "scheduled") return "approved";
  if (post.status === "failed") return "needs attention";
  return "needs approval";
}

export function CalendarPostDetails({
  post,
  timeZone,
}: {
  post: CalendarPost;
  timeZone: string;
}) {
  const { deletedIds, markDeleted } = useDeletedPosts();
  if (deletedIds.has(post.id)) return null;

  return (
    <details className="rounded bg-muted/50 px-1 py-0.5 text-xs open:p-2">
      <summary className="flex cursor-pointer list-none items-center gap-1 truncate">
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            STATUS_DOT[post.status] ?? "bg-muted-foreground",
          )}
        />
        <span className="truncate">{post.title}</span>
      </summary>
      <CalendarPostBody
        post={post}
        compact
        timeZone={timeZone}
        onDeleted={() => markDeleted(post.id)}
      />
    </details>
  );
}

export function CalendarPostCard({
  post,
  agentName,
  clientName,
  timeZone,
}: {
  post: CalendarPost;
  agentName: string;
  clientName: string;
  timeZone: string;
}) {
  const { deletedIds, markDeleted } = useDeletedPosts();
  if (deletedIds.has(post.id)) return null;

  const isEmailCampaign = post.platform === "mailchimp";
  const autoPublishable = isAutoPublishableContent(post.platform, post.content_type);
  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{post.title || "Untitled post"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {clientName} · {agentName} ·{" "}
            {post.scheduled_time
              ? formatInstant(post.scheduled_time, timeZone)
              : "Draft with no time"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">
            {PLATFORM_LABELS[post.platform as keyof typeof PLATFORM_LABELS] ??
              post.platform}
          </Badge>
          <Badge variant="outline">
            {isEmailCampaign ? "Email campaign" : post.content_type}
          </Badge>
          <PostStatusBadge status={post.status} />
          <Badge variant={post.social_account_id ? "default" : "destructive"}>
            {post.social_account_id ? "connected" : "not connected"}
          </Badge>
          {post.social_account_id && !autoPublishable && (
            <Badge variant="outline">manual draft</Badge>
          )}
        </div>
      </div>
      <CalendarPostBody
        post={post}
        timeZone={timeZone}
        onDeleted={() => markDeleted(post.id)}
      />
    </div>
  );
}

function CalendarPostBody({
  post,
  compact = false,
  timeZone,
  onDeleted,
}: {
  post: CalendarPost;
  compact?: boolean;
  timeZone: string;
  onDeleted: () => void;
}) {
  const isEmailCampaign = post.platform === "mailchimp";
  const autoPublishable = isAutoPublishableContent(post.platform, post.content_type);
  return (
    <div className={cn("space-y-2", compact ? "mt-2" : "mt-3")}>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">{approvalLabel(post)}</Badge>
        {!post.caption && (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3" />
            {isEmailCampaign ? "needs email copy" : "needs caption"}
          </Badge>
        )}
        {!isEmailCampaign && !post.media_path && (
          <Badge variant="outline">
            <AlertCircle className="h-3 w-3" />
            needs media
          </Badge>
        )}
        {!post.social_account_id && (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3" />
            account disconnected
          </Badge>
        )}
        {post.social_account_id && !autoPublishable && (
          <Badge variant="outline">
            <AlertCircle className="h-3 w-3" />
            auto-posting not live
          </Badge>
        )}
      </div>

      {post.error && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {post.error}
        </div>
      )}

      {post.generated_content_id && (
        <Link
          href={`/generated/${post.generated_content_id}`}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Link2 className="h-3.5 w-3.5" />
          Matched content
        </Link>
      )}

      <form action={updateCaptionAction} className="space-y-2">
        <input type="hidden" name="id" value={post.id} />
        <Textarea
          name="caption"
          rows={compact ? 2 : 3}
          defaultValue={post.caption ?? ""}
          placeholder={isEmailCampaign ? "Edit email copy / subject notes" : "Edit caption"}
          className={compact ? "min-h-14 text-xs" : ""}
        />
        <Button variant="outline" size={compact ? "xs" : "sm"} type="submit">
          Save caption
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {post.status !== "posted" && (
          <form action={scheduleAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={post.id} />
            <Input
              name="scheduled_time"
              type="datetime-local"
              required
              defaultValue={instantToWallTime(post.scheduled_time, timeZone)}
              className="h-8 w-auto"
            />
            <Button variant="outline" size={compact ? "xs" : "sm"} type="submit">
              {post.social_account_id && autoPublishable
                ? post.scheduled_time
                  ? "Reschedule"
                  : "Schedule"
                : "Save draft time"}
            </Button>
          </form>
        )}
        <CalendarDeletePostForm
          postId={post.id}
          compact={compact}
          onDeleted={onDeleted}
        />
      </div>
    </div>
  );
}

function CalendarDeletePostForm({
  postId,
  compact,
  onDeleted,
}: {
  postId: string;
  compact: boolean;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function deletePost(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await deletePostAction(formData);
        onDeleted();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete this post.");
        router.refresh();
      }
    });
  }

  return (
    <div className="ml-auto">
      <form action={deletePost}>
        <input type="hidden" name="id" value={postId} />
        <Button
          variant="ghost"
          size={compact ? "xs" : "sm"}
          type="submit"
          disabled={pending}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          {pending ? "Deleting" : "Delete"}
        </Button>
      </form>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
