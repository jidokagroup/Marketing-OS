"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Download,
  FileSpreadsheet,
  Loader2,
  MessageCircle,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
  getPlatformDefinition,
  isAutoPublishableContent,
  SCHEDULER_PLATFORMS,
} from "@/lib/social/platforms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readJsonResponse } from "@/lib/client-response";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const CONTENT_TYPES = ["video", "photo", "carousel", "email_campaign"] as const;
const DEFAULT_MAX_MEDIA_UPLOAD_MB = 500;
const configuredMaxMediaMb = Number(process.env.NEXT_PUBLIC_MAX_MEDIA_UPLOAD_MB);
const MAX_MEDIA_UPLOAD_MB =
  Number.isFinite(configuredMaxMediaMb) && configuredMaxMediaMb > 0
    ? configuredMaxMediaMb
    : DEFAULT_MAX_MEDIA_UPLOAD_MB;
const MAX_MEDIA_UPLOAD_BYTES = MAX_MEDIA_UPLOAD_MB * 1024 * 1024;
const CONTENT_TYPE_LABELS: Record<(typeof CONTENT_TYPES)[number], string> = {
  video: "Video",
  photo: "Photo",
  carousel: "Carousel",
  email_campaign: "Email campaign",
};
const TEMPLATE_HEADERS = [
  "title",
  "agent_name",
  "agent_id",
  "platforms",
  "content_type",
  "scheduled_time",
  "media_file_name",
  "caption",
  "comment_dm_enabled",
  "comment_auto_reply",
  "dm_sequence",
  "use_best_time",
];
const COMMENT_REPLY_EXAMPLE =
  "Reply 1: On your way!\nReply 2: Check your inbox!\nReply 3: Just sent it over.";
const DM_SEQUENCE_EXAMPLE =
  "DM 1: Here it is!\nDM 2: *link*\nDM 3 [2 hours later]: What'd you think about it?";
const TEMPLATE_EXAMPLE = [
  "Offer Myth Busting",
  "Jidoka Marketing Team OS Demo Client",
  "",
  "instagram|facebook",
  "video",
  "2026-07-02 09:00",
  "offer-myths.mp4",
  "Optional caption override. Leave blank to match the Writing Agent title.",
  "yes",
  "Reply 1: On your way! Reply 2: Check your inbox!",
  "DM 1: Here it is! DM 2: *link* DM 3 [2 hours later]: What'd you think about it?",
  "yes",
];
const TEMPLATE_EMAIL_EXAMPLE = [
  "Weekly Client Newsletter",
  "Jidoka Marketing Team OS Demo Client",
  "",
  "email",
  "email_campaign",
  "2026-07-03 10:00",
  "",
  "Subject: 3 gut health shifts to make this week\nPreview: A short educational email with one booking CTA.",
  "no",
  "",
  "",
  "yes",
];

type AgentOption = { id: string; name: string };
type GeneratedOption = {
  id: string;
  agent_id: string;
  title: string | null;
  topic: string | null;
  platform: string | null;
  short_version: string | null;
  organic_version: string | null;
  primary_script: string | null;
};
type CsvRow = Record<string, string>;

function normalizeSchedulerPlatform(value: string) {
  const key = value.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (
    [
      "email",
      "email_campaign",
      "gmail",
      "google_workspace",
      "google_workspace_gmail",
      "resend",
      "smtp",
      "privateemail",
      "custom_smtp",
      "hubspot",
      "klaviyo",
      "activecampaign",
      "constant_contact",
      "custom_api",
      "mailchimp",
    ].includes(key)
  ) {
    return "mailchimp";
  }
  return key;
}

function splitPlatforms(value: string) {
  return value
    .split(/[|,;]/)
    .map(normalizeSchedulerPlatform)
    .filter(Boolean);
}

function parseBool(value: string) {
  return ["1", "true", "yes", "y", "on"].includes(value.trim().toLowerCase());
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);

  const [headers, ...dataRows] = rows;
  if (!headers) return [];
  return dataRows.map((dataRow) =>
    Object.fromEntries(headers.map((header, index) => [header, dataRow[index] ?? ""])),
  );
}

function toCsvLine(values: string[]) {
  return values
    .map((value) => `"${value.replaceAll('"', '""')}"`)
    .join(",");
}

function downloadTemplate() {
  const csv = `${toCsvLine(TEMPLATE_HEADERS)}\n${toCsvLine(TEMPLATE_EXAMPLE)}\n${toCsvLine(TEMPLATE_EMAIL_EXAMPLE)}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "jidoka-os-scheduler-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function nextBestDatetime(platforms: string[]) {
  const now = new Date();
  const target = new Date(now);
  const includesX = platforms.includes("x");
  const includesMailchimp = platforms.includes("mailchimp");
  target.setDate(now.getDate() + 1);
  target.setHours(includesX ? 9 : includesMailchimp ? 10 : 10, 0, 0, 0);
  return target.toISOString();
}

function normalizeScheduledTime(value: string, useBestTime: boolean, platforms: string[]) {
  const clean = value.trim();
  if (clean) return new Date(clean).toISOString();
  return useBestTime ? nextBestDatetime(platforms) : null;
}

function fileByName(files: File[], name: string) {
  const normalized = name.trim().toLowerCase();
  return files.find((file) => file.name.toLowerCase() === normalized) ?? null;
}

function validateMedia(platforms: string[], contentType: string, file: File | null) {
  if (!platforms.length) return "Choose at least one platform.";
  const pausedPlatform = platforms.find((platform) => getPlatformDefinition(platform)?.disabled);
  if (pausedPlatform) {
    const definition = getPlatformDefinition(pausedPlatform);
    return definition?.disabledReason ?? `${definition?.label ?? pausedPlatform} is not available yet.`;
  }
  if (platforms.includes("x") && platforms.includes("youtube")) {
    return "YouTube video posts and X image posts need separate scheduled posts.";
  }
  if (platforms.includes("mailchimp")) {
    if (platforms.length > 1) {
      return "Email campaigns need a separate scheduled item from social posts.";
    }
    if (contentType !== "email_campaign") {
      return "Email campaigns use the email campaign content type.";
    }
    return null;
  }
  if (contentType === "email_campaign") {
    return "Email campaign is only for the Email Campaign platform.";
  }
  if (platforms.includes("youtube")) {
    if (contentType !== "video") return "YouTube is video-only, so choose video.";
    if (!file) return "YouTube posts need an uploaded video.";
    if (!file.type.startsWith("video/")) return "YouTube only accepts video files.";
  }
  if (platforms.includes("x")) {
    if (contentType !== "photo") return "X is image-only, so choose photo.";
    if (!file) return "X posts need an uploaded image.";
    if (!file.type.startsWith("image/")) return "X only accepts image files.";
  }
  if (contentType === "video" && file && !file.type.startsWith("video/")) {
    return "Video posts need a video file.";
  }
  if (contentType === "photo" && file && !file.type.startsWith("image/")) {
    return "Photo posts need an image file.";
  }
  if (file && file.size > MAX_MEDIA_UPLOAD_BYTES) {
    return `Media uploads must be under ${MAX_MEDIA_UPLOAD_MB} MB.`;
  }
  return null;
}

async function uploadMedia(file: File, agentId: string) {
  // Ask the server for a signed Supabase Storage upload URL, then send the
  // file straight from the browser so it never hits Vercel's body-size cap.
  const res = await fetch("/api/scheduler/media", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      agent_id: agentId,
      file_name: file.name,
      file_size: file.size,
    }),
  });
  const json = await readJsonResponse<{
    mediaPath?: string;
    signedUrl?: string;
    token?: string;
  }>(res);
  if (!res.ok || !json.mediaPath || !json.signedUrl) {
    throw new Error(json.error ?? "Media upload failed");
  }

  const uploadBody = new FormData();
  uploadBody.append("cacheControl", "3600");
  uploadBody.append("", file);
  const uploadRes = await fetch(json.signedUrl, {
    method: "PUT",
    body: uploadBody,
  });
  if (!uploadRes.ok) {
    const details = await readJsonResponse(uploadRes);
    throw new Error(details.error ?? "Supabase Storage rejected the media upload.");
  }
  return json.mediaPath;
}

async function createPost(payload: Record<string, unknown>) {
  const res = await fetch("/api/scheduler/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await readJsonResponse<{ ids?: string[]; matched?: boolean }>(res);
  if (!res.ok) throw new Error(json.error ?? "Could not create post");
  return { ids: json.ids ?? [], matched: Boolean(json.matched) };
}

export function SchedulerUploader({
  agents,
  connectedPlatforms = [],
  emailProviderLabel = "your selected email provider",
  defaultAgentId = "",
  defaultTitle = "",
  generatedContent = [],
}: {
  agents: AgentOption[];
  connectedPlatforms?: string[];
  emailProviderLabel?: string;
  defaultAgentId?: string;
  defaultTitle?: string;
  generatedContent?: GeneratedOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selectedAgentId, setSelectedAgentId] = useState(defaultAgentId);
  const [titleValue, setTitleValue] = useState(defaultTitle);
  const [captionOverride, setCaptionOverride] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["instagram"]);
  const [contentType, setContentType] = useState<(typeof CONTENT_TYPES)[number]>(
    "video",
  );
  const [useBestTime, setUseBestTime] = useState(true);
  const [commentDmEnabled, setCommentDmEnabled] = useState(false);

  const agentsByName = useMemo(
    () =>
      new Map(
        agents.map((agent) => [agent.name.trim().toLowerCase(), agent.id]),
      ),
    [agents],
  );
  const working = busy || pending;
  const hasX = platforms.includes("x");
  const hasYouTube = platforms.includes("youtube");
  const hasMailchimp = platforms.includes("mailchimp");
  const emailCampaignProviderLabel = `Email campaign via ${emailProviderLabel}`;
  const mediaAccept = hasMailchimp
    ? undefined
    : hasX
      ? "image/*"
      : hasYouTube
        ? "video/*"
        : "video/*,image/*";
  const connected = useMemo(
    () => new Set(connectedPlatforms),
    [connectedPlatforms],
  );
  const disconnectedSelected = platforms.filter((platform) => !connected.has(platform));
  const disconnectedSelectedLabels = disconnectedSelected.map((platform) =>
    platform === "mailchimp"
      ? "Email Campaign"
      : getPlatformDefinition(platform)?.label ?? platform,
  );
  const autoPublishableSelected = platforms.every((platform) =>
    isAutoPublishableContent(platform, contentType),
  );
  const manualDraftSelected = !autoPublishableSelected;
  const captionPreview = captionOverride.trim();

  function pickGeneratedContent(id: string) {
    const selected = generatedContent.find((item) => item.id === id);
    if (!selected) return;
    setSelectedAgentId(selected.agent_id);
    setTitleValue(selected.title || selected.topic || "");
    setCaptionOverride(
      selected.organic_version ??
        selected.short_version ??
        selected.primary_script ??
        "",
    );
    if (selected.platform) {
      const key =
        splitPlatforms(selected.platform)[0] ??
        selected.platform.trim().toLowerCase();
      const definition = SCHEDULER_PLATFORMS.find((platform) => platform.key === key);
      if (definition?.disabled) {
        toast.info(definition.disabledReason ?? `${definition.label} is not available yet.`);
        return;
      }
      if (definition) {
        setPlatforms([key]);
        if (key === "x") setContentType("photo");
        if (key === "youtube") setContentType("video");
        if (key === "mailchimp") setContentType("email_campaign");
      }
    }
  }

  function togglePlatform(platform: string) {
    const definition = getPlatformDefinition(platform);
    if (definition?.disabled) {
      toast.info(definition.disabledReason ?? `${definition.label} is not available yet.`);
      return;
    }
    setPlatforms((current) => {
      const adding = !current.includes(platform);
      if (adding && platform === "mailchimp") {
        setContentType("email_campaign");
        return ["mailchimp"];
      }
      if (adding && current.includes("mailchimp")) {
        if (platform === "x") setContentType("photo");
        else if (platform === "youtube") setContentType("video");
        else setContentType("video");
        return [platform];
      }
      if (adding && platform === "youtube" && current.includes("x")) {
        toast.info("YouTube video posts and X image posts need separate scheduled posts.");
        return current;
      }
      if (adding && platform === "x" && current.includes("youtube")) {
        toast.info("X image posts and YouTube video posts need separate scheduled posts.");
        return current;
      }
      const next = current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform];
      if (next.includes("x")) setContentType("photo");
      else if (next.includes("youtube")) setContentType("video");
      else if (next.includes("mailchimp")) setContentType("email_campaign");
      else if (contentType === "email_campaign") setContentType("video");
      return next;
    });
  }

  async function onSingleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const agentId = String(form.get("agent_id") ?? "");
    const title = String(form.get("title") ?? "").trim();
    const file = form.get("media");
    const mediaFile = file instanceof File && file.size > 0 ? file : null;

    if (!agentId || !title) {
      toast.error("Pick an agent and enter a title.");
      return;
    }
    const mediaError = validateMedia(platforms, contentType, mediaFile);
    if (mediaError) {
      toast.error(mediaError);
      return;
    }

    setBusy(true);
    try {
      const mediaPath = mediaFile ? await uploadMedia(mediaFile, agentId) : null;
      const scheduledRaw = String(form.get("scheduled_time") ?? "");
      const scheduledTime = normalizeScheduledTime(
        scheduledRaw,
        useBestTime,
        platforms,
      );
      const result = await createPost({
        agent_id: agentId,
        title,
        content_type: contentType,
        platforms,
        caption: String(form.get("caption") ?? ""),
        media_path: mediaPath,
        media_file_name: mediaFile?.name ?? null,
        media_type: mediaFile?.type ?? "",
        scheduled_time: scheduledTime,
        use_best_time: useBestTime,
        comment_dm_enabled: commentDmEnabled,
        comment_auto_reply: String(form.get("comment_auto_reply") ?? ""),
        dm_sequence: String(form.get("dm_sequence") ?? ""),
      });
      toast.success(
        result.matched
          ? `Added ${result.ids.length} scheduled item(s) and matched the title.`
          : `Added ${result.ids.length} scheduled item(s). Generate matching content with this title when ready.`,
      );
      formEl.reset();
      setSelectedAgentId(defaultAgentId);
      setTitleValue(defaultTitle);
      setCaptionOverride("");
      setPlatforms(["instagram"]);
      setContentType("video");
      setCommentDmEnabled(false);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onBulkSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const csvFile = form.get("spreadsheet");
    const mediaFiles = form.getAll("bulk_media").filter(
      (file): file is File => file instanceof File && file.size > 0,
    );

    if (!(csvFile instanceof File) || csvFile.size === 0) {
      toast.error("Upload the completed CSV template.");
      return;
    }

    setBusy(true);
    try {
      const rows = parseCsv(await csvFile.text());
      if (!rows.length) throw new Error("The spreadsheet has no rows.");
      const missingHeaders = TEMPLATE_HEADERS.filter(
        (header) => !(header in rows[0]),
      );
      if (missingHeaders.length) {
        throw new Error(`Missing header(s): ${missingHeaders.join(", ")}`);
      }

      let created = 0;
      let matched = 0;
      const usedMediaNames = new Set<string>();

      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2;
        const title = row.title?.trim();
        const agentId =
          row.agent_id?.trim() ||
          agentsByName.get(row.agent_name?.trim().toLowerCase() ?? "") ||
          "";
        const rowPlatforms = splitPlatforms(row.platforms || "instagram");
        const rowContentType = (row.content_type || "video").trim().toLowerCase();
        const mediaFile = row.media_file_name
          ? fileByName(mediaFiles, row.media_file_name)
          : null;

        if (!title || !agentId) {
          throw new Error(
            `Row ${rowNumber}: add a title and an agent_id or matching agent_name.`,
          );
        }
        const mediaError = validateMedia(rowPlatforms, rowContentType, mediaFile);
        if (mediaError) throw new Error(`Row ${rowNumber}: ${mediaError}`);
        if (mediaFile) usedMediaNames.add(mediaFile.name.toLowerCase());

        const mediaPath = mediaFile
          ? await uploadMedia(mediaFile, agentId)
          : null;
        const useRowBestTime = parseBool(row.use_best_time || "");
        const result = await createPost({
          agent_id: agentId,
          title,
          content_type: rowContentType,
          platforms: rowPlatforms,
          caption: row.caption,
          media_path: mediaPath,
          media_file_name: mediaFile?.name ?? row.media_file_name ?? null,
          media_type: mediaFile?.type ?? "",
          scheduled_time: normalizeScheduledTime(
            row.scheduled_time || "",
            useRowBestTime,
            rowPlatforms,
          ),
          use_best_time: useRowBestTime,
          comment_dm_enabled: parseBool(row.comment_dm_enabled || ""),
          comment_auto_reply: row.comment_auto_reply,
          dm_sequence: row.dm_sequence,
          source_import: csvFile.name,
        });
        created += result.ids.length;
        if (result.matched) matched += 1;
      }

      const unusedMedia = mediaFiles.filter(
        (file) => !usedMediaNames.has(file.name.toLowerCase()),
      );
      if (unusedMedia.length) {
        toast.info(
          `Unused media file(s): ${unusedMedia.map((file) => file.name).join(", ")}`,
        );
      }
      toast.success(`Imported ${created} scheduled item(s); ${matched} row(s) matched generated content.`);
      formEl.reset();
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Tabs defaultValue="single" className="space-y-4">
      <TabsList>
        <TabsTrigger value="single">Single post</TabsTrigger>
        <TabsTrigger value="bulk">Bulk upload</TabsTrigger>
      </TabsList>

      <TabsContent value="single">
      <Card>
        <CardHeader>
          <CardTitle>New scheduled post</CardTitle>
          <CardDescription>
            Pick one or more platforms, upload media, and use the exact title the
            Writing Agent generated so the caption or email copy attaches automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSingleSubmit} className="space-y-5">
            {generatedContent.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="generated_content_pick">Use generated content</Label>
                <select
                  id="generated_content_pick"
                  onChange={(event) => pickGeneratedContent(event.target.value)}
                  defaultValue=""
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Choose a generated title</option>
                  {generatedContent.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title || item.topic || "Untitled generated piece"}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  This fills the agent, title, and caption preview automatically.
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="agent_id">Writing Agent</Label>
                <select
                  id="agent_id"
                  name="agent_id"
                  value={selectedAgentId}
                  onChange={(event) => setSelectedAgentId(event.target.value)}
                  required
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="" disabled>
                    Select agent
                  </option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Generated title</Label>
                <Input
                  id="title"
                  name="title"
                  required
                  value={titleValue}
                  onChange={(event) => setTitleValue(event.target.value)}
                  placeholder="Exact title from generated content"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Platforms</Label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {SCHEDULER_PLATFORMS.map((platform) => {
                  const Icon = platform.icon;
                  const selected = platforms.includes(platform.key);
                  const disabled = Boolean(platform.disabled);
                  return (
                    <label
                      key={platform.key}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm transition-colors has-checked:border-primary has-checked:bg-muted/60 ${
                        disabled
                          ? "cursor-not-allowed bg-muted/40 text-muted-foreground opacity-60"
                          : "cursor-pointer"
                      }`}
                      title={disabled ? platform.disabledReason : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={disabled}
                        onChange={() => togglePlatform(platform.key)}
                        className="mt-1 h-4 w-4"
                      />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-medium">
                          <Icon className="h-4 w-4" />
                          {platform.label}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {disabled
                            ? "API setup in progress"
                            : platform.key === "mailchimp"
                              ? emailCampaignProviderLabel
                              : platform.key === "x"
                                ? "Image-only"
                                : platform.key === "youtube"
                            ? "Video-only"
                            : "Video, photo, carousel"}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {hasX && (
                <p className="text-xs text-muted-foreground">
                  X is selected, so Jidoka Marketing Team OS locks this post to photo upload.
                </p>
              )}
              {hasYouTube && (
                <p className="text-xs text-muted-foreground">
                  YouTube is video-only. Shorts can be square or vertical videos up
                  to 3 minutes. Long-form defaults to 15 minutes; verified accounts
                  can upload up to 12 hours or 256 GB, whichever is less.
                </p>
              )}
              {hasMailchimp && (
                <p className="text-xs text-muted-foreground">
                  {emailCampaignProviderLabel} is selected, so Jidoka Marketing Team OS creates a separate email campaign draft.
                </p>
              )}
              {disconnectedSelected.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  Disconnected: {disconnectedSelectedLabels.join(", ")}. Jidoka Marketing Team OS will
                  save these as scheduled drafts, but automatic publishing needs the
                  accounts connected from the Writing Agent&apos;s Connections tab.
                </div>
              )}
              {disconnectedSelected.length === 0 && manualDraftSelected && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  Automatic posting is live only for Instagram and Facebook photo/video posts right now.
                  This selection will save as a timed draft for manual publishing.
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="content_type">Content type</Label>
                <select
                  id="content_type"
                  name="content_type"
                  value={contentType}
                  onChange={(event) =>
                    setContentType(event.target.value as typeof contentType)
                  }
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {CONTENT_TYPES.map((type) => (
                    <option
                      key={type}
                      value={type}
                      disabled={
                        (hasMailchimp && type !== "email_campaign") ||
                        (!hasMailchimp && type === "email_campaign") ||
                        (hasX && type !== "photo") ||
                        (hasYouTube && type !== "video")
                      }
                    >
                      {CONTENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="media">Media</Label>
                <Input
                  id="media"
                  name="media"
                  type="file"
                  accept={mediaAccept}
                  disabled={hasMailchimp}
                />
                {hasMailchimp && (
                  <p className="text-xs text-muted-foreground">
                    {emailProviderLabel} email campaigns use the title and email copy. Media upload is not required.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduled_time">Schedule time</Label>
                <Input
                  id="scheduled_time"
                  name="scheduled_time"
                  type="datetime-local"
                  disabled={useBestTime}
                />
              </div>
              <label className="flex items-center gap-2 self-end rounded-lg border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={useBestTime}
                  onChange={(event) => setUseBestTime(event.target.checked)}
                  className="h-4 w-4"
                />
                Let Smart Scheduler pick a best time
              </label>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Best-time suggestions use connected profile peak activity and similar
                competitor posting windows when analytics are available. You can turn
                this off to set your own date and time.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="caption">
                {hasMailchimp ? "Email copy / subject notes" : "Caption override"}
              </Label>
              <Textarea
                id="caption"
                name="caption"
                rows={3}
                value={captionOverride}
                onChange={(event) => setCaptionOverride(event.target.value)}
                placeholder={
                  hasMailchimp
                    ? "Subject line, preview text, and email body notes. Leave blank to use matched generated copy."
                    : "Optional. Leave blank to use the matched generated caption."
                }
              />
            </div>

            {!hasMailchimp && (
            <div className="rounded-lg border p-4">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={commentDmEnabled}
                  onChange={(event) => setCommentDmEnabled(event.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="flex items-center gap-2 font-medium">
                    <MessageCircle className="h-4 w-4" />
                    Instagram comment to DM flow
                  </span>
                  <span className="mt-1 block text-muted-foreground">
                    When toggled on, comments can receive a dynamic public reply
                    and a DM sequence for Instagram posts.
                  </span>
                </span>
              </label>
              {commentDmEnabled && (
                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Example public replies
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Reply 1: On your way!",
                        "Reply 2: Check your inbox!",
                        "Reply 3: Just sent it over.",
                      ].map((template) => (
                        <Badge key={template} variant="outline">
                          {template}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="comment_auto_reply">Comment replies</Label>
                      <Textarea
                        id="comment_auto_reply"
                        name="comment_auto_reply"
                        rows={4}
                        placeholder={COMMENT_REPLY_EXAMPLE}
                      />
                      <p className="text-xs text-muted-foreground">
                        Add multiple reply options so the agent can rotate or choose
                        the best fit.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dm_sequence">DM sequence</Label>
                      <Textarea
                        id="dm_sequence"
                        name="dm_sequence"
                        rows={4}
                        placeholder={DM_SEQUENCE_EXAMPLE}
                      />
                      <p className="text-xs text-muted-foreground">
                        Timing notes like [2 hours later] are saved with the DM
                        sequence for review.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">
                    Preview: the public reply is saved first, then the DM
                    sequence is held for the Instagram review queue.
                  </div>
                  <Button type="submit" variant="outline" size="sm">
                    <MessageCircle className="mr-1 h-4 w-4" />
                    Save Comment-to-DM flow
                  </Button>
                </div>
              )}
            </div>
            )}

            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">Platform preview</p>
              <div className="mt-3 grid gap-2">
                {platforms.map((platform) => {
                  const platformName =
                    SCHEDULER_PLATFORMS.find((item) => item.key === platform)?.label ??
                    platform;
                  return (
                    <div key={platform} className="rounded-md border bg-background p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={connected.has(platform) ? "default" : "destructive"}>
                          {platformName}
                        </Badge>
                        <Badge variant="outline">
                          {CONTENT_TYPE_LABELS[contentType]}
                        </Badge>
                        <Badge variant="secondary">medium confidence</Badge>
                        {!isAutoPublishableContent(platform, contentType) && (
                          <Badge variant="outline">manual draft</Badge>
                        )}
                      </div>
                      <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                        {captionPreview ||
                          (platform === "mailchimp"
                            ? "Email copy will come from the matched generated title unless you add notes."
                            : "Caption will come from the matched generated title unless you add an override.")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <Button type="submit" disabled={working}>
              {working ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="mr-1 h-4 w-4" />
              )}
              {working
                ? "Saving…"
                : disconnectedSelected.length > 0 || manualDraftSelected
                  ? "Save draft"
                  : "Add to scheduler"}
            </Button>
          </form>
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="bulk">
      <Card>
        <CardHeader>
          <CardTitle>Bulk upload</CardTitle>
          <CardDescription>
            Download the spreadsheet template, fill in each row, then upload the
            completed CSV with any matching media files.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onBulkSubmit} className="space-y-4">
            <Button type="button" variant="outline" onClick={downloadTemplate}>
              <Download className="mr-1 h-4 w-4" />
              Download template
            </Button>

            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              Required headers:{" "}
              <span className="text-foreground">
                {TEMPLATE_HEADERS.join(", ")}
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="spreadsheet">Completed spreadsheet</Label>
              <Input
                id="spreadsheet"
                name="spreadsheet"
                type="file"
                accept=".csv,text/csv"
              />
              <p className="text-xs text-muted-foreground">
                Upload CSV. Excel files should be saved as CSV before import.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk_media">Media files</Label>
              <Input
                id="bulk_media"
                name="bulk_media"
                type="file"
                accept="video/*,image/*"
                multiple
              />
              <p className="text-xs text-muted-foreground">
                Match each file name to the media_file_name column.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                <FileSpreadsheet className="h-3 w-3" /> CSV template
              </Badge>
              <Badge variant="outline">Title-matching captions</Badge>
              <Badge variant="outline">Multi-platform rows</Badge>
            </div>

            <Button type="submit" disabled={working}>
              {working ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1 h-4 w-4" />
              )}
              {working ? "Importing…" : "Import spreadsheet"}
            </Button>
          </form>
        </CardContent>
      </Card>
      </TabsContent>
    </Tabs>
  );
}
