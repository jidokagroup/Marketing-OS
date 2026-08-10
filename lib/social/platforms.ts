import {
  Camera,
  Globe2,
  Mail,
  MessageSquare,
  Music2,
  PlaySquare,
  type LucideIcon,
} from "lucide-react";

import type { SocialPlatform } from "@/lib/supabase/types";

export type SchedulerPlatform = Extract<
  SocialPlatform,
  "instagram" | "facebook" | "youtube" | "tiktok" | "x" | "mailchimp"
>;
export type SchedulerContentType = "video" | "photo" | "carousel" | "email_campaign";

export interface PlatformDefinition {
  key: SocialPlatform;
  label: string;
  icon: LucideIcon;
  scheduler: boolean;
  posting: boolean;
  mediaTypes: SchedulerContentType[];
  connectable: boolean;
  note: string;
  disabled?: boolean;
  disabledReason?: string;
}

export const PLATFORM_DEFINITIONS: PlatformDefinition[] = [
  {
    key: "instagram",
    label: "Instagram",
    icon: Camera,
    scheduler: true,
    posting: true,
    mediaTypes: ["video", "photo", "carousel"],
    connectable: true,
    note: "Connect through Meta. Scheduled posts appear in the calendar when active.",
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: Globe2,
    scheduler: true,
    posting: true,
    mediaTypes: ["video", "photo", "carousel"],
    connectable: true,
    note: "Connect through Meta. Pages can use the same scheduling queue.",
  },
  {
    key: "youtube",
    label: "YouTube",
    icon: PlaySquare,
    scheduler: true,
    posting: true,
    mediaTypes: ["video"],
    connectable: true,
    note: "Connect through Google. Video-only. Auto-publishing uses the YouTube Data API upload flow.",
  },
  {
    key: "x",
    label: "X",
    icon: MessageSquare,
    scheduler: true,
    posting: true,
    mediaTypes: ["photo"],
    connectable: true,
    note: "Connect through X OAuth. Auto-publishing is image-only in Jidoka Marketing Team OS.",
  },
  {
    key: "tiktok",
    label: "TikTok",
    icon: Music2,
    scheduler: true,
    posting: false,
    mediaTypes: ["video", "photo", "carousel"],
    connectable: false,
    disabled: true,
    disabledReason: "TikTok uploading and account connection are paused while the API is being set up.",
    note: "API setup in progress. TikTok will be enabled after app review and Content Posting API approval.",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: Globe2,
    scheduler: false,
    posting: false,
    mediaTypes: ["video", "photo", "carousel"],
    connectable: false,
    note: "Planned for company page publishing, lead-gen content, and analytics.",
  },
  {
    key: "mailchimp",
    label: "Email Campaign",
    icon: Mail,
    scheduler: true,
    posting: false,
    mediaTypes: ["email_campaign"],
    connectable: true,
    note: "Choose the email provider in Settings. Mailchimp OAuth is available when Mailchimp is selected.",
  },
];

export const SCHEDULER_PLATFORMS = PLATFORM_DEFINITIONS.filter(
  (platform): platform is PlatformDefinition & { key: SchedulerPlatform } =>
    platform.scheduler,
);

export const PLATFORM_LABELS = Object.fromEntries(
  PLATFORM_DEFINITIONS.map((platform) => [platform.key, platform.label]),
) as Record<SocialPlatform, string>;

export function getPlatformDefinition(platform: string) {
  return PLATFORM_DEFINITIONS.find((item) => item.key === platform);
}

export function isSchedulerPlatform(platform: string): platform is SchedulerPlatform {
  return SCHEDULER_PLATFORMS.some((item) => item.key === platform);
}

export function isAllowedContentType(
  platform: string,
  contentType: string,
): contentType is SchedulerContentType {
  const definition = getPlatformDefinition(platform);
  return Boolean(
    definition?.scheduler &&
      !definition.disabled &&
      definition.mediaTypes.includes(contentType as SchedulerContentType),
  );
}

export function isAutoPublishableContent(platform: string, contentType: string) {
  const definition = getPlatformDefinition(platform);
  if (!definition?.posting || definition.disabled) return false;

  if (platform === "instagram" || platform === "facebook") {
    return contentType === "video" || contentType === "photo";
  }

  if (platform === "youtube") return contentType === "video";
  if (platform === "x") return contentType === "photo";

  return false;
}

export function connectionLabel(platform: string, connected: boolean) {
  const label = getPlatformDefinition(platform)?.label ?? platform;
  return `${label}: ${connected ? "connected" : "not connected"}`;
}
