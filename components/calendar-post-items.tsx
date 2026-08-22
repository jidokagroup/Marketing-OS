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
import { Link2, Trash2 } from "lucide-react";

import {
  deletePostAction,
  scheduleAction,
  updateCaptionAction,
} from "@/app/(dashboard)/scheduler/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PLATFORM_LABELS,
} from "@/lib/social/platforms";
import { cn } from "@/lib/utils";
import { formatInstant, instantToWallTime } from "@/lib/time-format";
import { postLifecycle } from "@/lib/scheduler-lifecycle";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PostLifecycleBadge } from "@/components/post-lifecycle-badge";

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
  readyPlatforms,
}: {
  post: CalendarPost;
  timeZone: string;
  readyPlatforms: string[];
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
        readyPlatforms={readyPlatforms}
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
  readyPlatforms,
}: {
  post: CalendarPost;
  agentName: string;
  clientName: string;
  timeZone: string;
  readyPlatforms: string[];
}) {
  const { deletedIds, markDeleted } = useDeletedPosts();
  if (deletedIds.has(post.id)) return null;

  const isEmailCampaign = post.platform === "mailchimp";
  const lifecycle = postLifecycle(post, readyPlatforms);
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
          <PostLifecycleBadge view={lifecycle} />
          {/* Connected is not the same as able to publish — see
              lib/social/publishing-readiness. */}
          {!post.social_account_id ? (
            <Badge variant="destructive">not connected</Badge>
          ) : lifecycle.canAutoPublish ? (
            <Badge>auto-posting live</Badge>
          ) : (
            <Badge variant="outline">connected · manual only</Badge>
          )}
        </div>
      </div>
      <CalendarPostBody
        post={post}
        timeZone={timeZone}
        readyPlatforms={readyPlatforms}
        onDeleted={() => markDeleted(post.id)}
      />
    </div>
  );
}

function CalendarPostBody({
  post,
  compact = false,
  timeZone,
  readyPlatforms,
  onDeleted,
}: {
  post: CalendarPost;
  compact?: boolean;
  timeZone: string;
  readyPlatforms: string[];
  onDeleted: () => void;
}) {
  // The same derivation the Scheduler uses, so a post cannot read as ready
  // here and blocked there.
  const lifecycle = postLifecycle(post, readyPlatforms);
  const isEmailCampaign = post.platform === "mailchimp";
  return (
    <div className={cn("space-y-2", compact ? "mt-2" : "mt-3")}>
      <div className="flex flex-wrap gap-1.5">
        <PostLifecycleBadge view={lifecycle} />
        <Badge variant="outline">{approvalLabel(post)}</Badge>
      </div>

      <p
        className={cn(
          "text-xs",
          lifecycle.tone === "destructive"
            ? "text-destructive"
            : "text-muted-foreground",
        )}
      >
        {lifecycle.detail}
      </p>

      {post.error && lifecycle.detail !== post.error && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Last attempt: {post.error}
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
            {/* Scheduling hands the post to the publisher, so it confirms
                like the outward-facing action it is. */}
            {/* Scheduling hands the post to the publisher on a timer, which
                is the definition of an action worth asking about. Saving a
                draft time is not, so only one of them asks. */}
            {lifecycle.canAutoPublish ? (
              <ConfirmSubmitButton
                variant="outline"
                size={compact ? "xs" : "sm"}
                destructive={false}
                title={post.scheduled_time ? "Reschedule this post?" : "Schedule this post?"}
                confirmLabel={post.scheduled_time ? "Reschedule" : "Schedule"}
                message={`"${post.title || "This post"}" will publish to ${
                  PLATFORM_LABELS[post.platform as keyof typeof PLATFORM_LABELS] ??
                  post.platform
                } automatically at the time you set. Nobody reviews it again first.`}
              >
                {post.scheduled_time ? "Reschedule" : "Schedule"}
              </ConfirmSubmitButton>
            ) : (
              <Button variant="outline" size={compact ? "xs" : "sm"} type="submit">
                Save draft time
              </Button>
            )}
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
        <ConfirmSubmitButton
          size={compact ? "xs" : "sm"}
          disabled={pending}
          title="Delete this post?"
          confirmLabel="Delete post"
          message="This removes the post from the queue permanently. Any caption, media and Comment-to-DM flow saved on it goes with it."
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          {pending ? "Deleting" : "Delete"}
        </ConfirmSubmitButton>
      </form>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
