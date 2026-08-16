import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptToken } from "@/lib/crypto";
import { META_GRAPH } from "@/lib/social/meta";
import type { Database } from "@/lib/supabase/types";

/**
 * Competitor *execution* data — how competitors actually produce content, as
 * opposed to what they talk about.
 *
 * The website scan can only read marketing copy. Format mix (Reels vs carousel
 * vs long-form), posting cadence, and which formats actually earn engagement
 * only exist in the platform APIs, and each platform exposes a different slice:
 *
 * - Instagram: Business Discovery returns public Business/Creator accounts'
 *   recent media with media_product_type (REELS/FEED) and media_type
 *   (IMAGE/VIDEO/CAROUSEL_ALBUM) plus like/comment counts. Needs only the
 *   instagram_basic + instagram_manage_insights scopes we already hold.
 * - YouTube: the Data API serves any public channel, and contentDetails
 *   duration is the short-form vs long-form split.
 * - TikTok: no commercial API exposes competitor data at all (the Research API
 *   is academic-only), so it is handled by web search in the scan itself and
 *   is deliberately absent here.
 *
 * Nothing here is fatal: every fetch failure degrades to "no data" so the scan
 * still runs, and the scan is told which platforms yielded nothing rather than
 * being left to guess.
 */

const IG_MEDIA_LIMIT = 12;
const YT_VIDEO_LIMIT = 12;
const FETCH_TIMEOUT_MS = 8000;

export type WatchlistTarget = {
  url: string;
  platform: "instagram" | "tiktok" | "youtube" | "website";
  handle: string | null;
};

export type CompetitorExecutionResult = {
  /** Prompt-ready block describing real, API-sourced execution data. */
  brief: string;
  /** Watchlist entries we could not get execution data for, with the reason. */
  gaps: { url: string; reason: string }[];
  /** TikTok handles for the scan's web-search pass to look up. */
  tiktokHandles: string[];
};

/** Classify a watchlist entry by platform and pull out the account handle. */
export function classifyWatchlistUrl(raw: string): WatchlistTarget {
  const value = raw.trim();
  let host = "";
  let path = "";
  try {
    const parsed = new URL(value);
    host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    path = parsed.pathname;
  } catch {
    return { url: value, platform: "website", handle: null };
  }

  const segments = path.split("/").filter(Boolean);

  if (host.endsWith("instagram.com")) {
    return { url: value, platform: "instagram", handle: segments[0] ?? null };
  }
  if (host.endsWith("tiktok.com")) {
    const handle = segments.find((segment) => segment.startsWith("@"));
    return { url: value, platform: "tiktok", handle: handle?.slice(1) ?? null };
  }
  if (host.endsWith("youtube.com") || host === "youtu.be") {
    const handle =
      segments.find((segment) => segment.startsWith("@")) ??
      (segments[0] === "c" || segments[0] === "channel" || segments[0] === "user"
        ? segments[1]
        : undefined);
    return { url: value, platform: "youtube", handle: handle ?? null };
  }
  return { url: value, platform: "website", handle: null };
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function readToken(stored: string | null): string | null {
  if (!stored) return null;
  try {
    return decryptToken(stored);
  } catch {
    return stored;
  }
}

type IgMedia = {
  media_product_type?: string;
  media_type?: string;
  like_count?: number;
  comments_count?: number;
  caption?: string;
  timestamp?: string;
  permalink?: string;
};

/** Average engagement per format, so the scan can say which formats actually land. */
function summarizeIgMedia(media: IgMedia[]) {
  const buckets = new Map<string, { count: number; likes: number; comments: number }>();
  for (const item of media) {
    // media_product_type distinguishes Reels from Feed; media_type distinguishes
    // carousel from single image/video. Together they are the format mix.
    const product = (item.media_product_type ?? "").toUpperCase();
    const type = (item.media_type ?? "").toUpperCase();
    const label =
      product === "REELS"
        ? "Reel"
        : type === "CAROUSEL_ALBUM"
          ? "Carousel"
          : type === "VIDEO"
            ? "Feed video"
            : type === "IMAGE"
              ? "Single image"
              : "Other";
    const bucket = buckets.get(label) ?? { count: 0, likes: 0, comments: 0 };
    bucket.count += 1;
    bucket.likes += item.like_count ?? 0;
    bucket.comments += item.comments_count ?? 0;
    buckets.set(label, bucket);
  }

  return [...buckets.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(
      ([label, bucket]) =>
        `${label}: ${bucket.count} of last ${media.length} posts, ` +
        `avg ${Math.round(bucket.likes / bucket.count)} likes / ` +
        `${Math.round(bucket.comments / bucket.count)} comments`,
    );
}

/** Posting cadence in posts per week, from the span of the fetched media. */
function postingCadence(timestamps: (string | undefined)[]): string | null {
  const dates = timestamps
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a);
  if (dates.length < 2) return null;
  const spanDays = (dates[0] - dates[dates.length - 1]) / (1000 * 60 * 60 * 24);
  if (spanDays <= 0) return null;
  const perWeek = (dates.length / spanDays) * 7;
  return `~${perWeek.toFixed(1)} posts/week`;
}

async function fetchInstagramCompetitor(
  igUserId: string,
  token: string,
  username: string,
): Promise<string | null> {
  // business_discovery reads another public Business/Creator account through
  // our own IG user node -- the only official route to competitor IG data.
  const fields =
    `business_discovery.username(${username})` +
    "{username,followers_count,media_count,media.limit(" +
    IG_MEDIA_LIMIT +
    "){media_product_type,media_type,like_count,comments_count,caption,timestamp,permalink}}";

  const json = (await fetchJson(
    `${META_GRAPH}/${igUserId}?` +
      new URLSearchParams({ fields, access_token: token }),
  )) as {
    business_discovery?: {
      username?: string;
      followers_count?: number;
      media_count?: number;
      media?: { data?: IgMedia[] };
    };
  } | null;

  const profile = json?.business_discovery;
  if (!profile) return null;

  const media = profile.media?.data ?? [];
  const lines = [
    `Instagram @${profile.username ?? username}: ` +
      `${profile.followers_count?.toLocaleString() ?? "unknown"} followers, ` +
      `${profile.media_count?.toLocaleString() ?? "unknown"} posts`,
  ];
  if (media.length) {
    lines.push(`Format mix (last ${media.length}): ${summarizeIgMedia(media).join("; ")}`);
    const cadence = postingCadence(media.map((item) => item.timestamp));
    if (cadence) lines.push(`Cadence: ${cadence}`);

    const top = [...media]
      .sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0))
      .slice(0, 3)
      .map(
        (item) =>
          `${item.like_count ?? 0} likes — "${(item.caption ?? "").replace(/\s+/g, " ").slice(0, 120)}"` +
          (item.permalink ? ` (${item.permalink})` : ""),
      );
    if (top.length) lines.push(`Top posts by likes:\n  - ${top.join("\n  - ")}`);
  }
  return lines.join("\n");
}

/** ISO-8601 duration (PT1M30S) to seconds — the short-form vs long-form signal. */
function parseIsoDuration(value: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

async function fetchYouTubeCompetitor(
  handle: string,
  token: string,
): Promise<string | null> {
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const base = "https://www.googleapis.com/youtube/v3";

  // Resolve the handle to a channel, then read its uploads playlist.
  const channelJson = (await fetchJson(
    `${base}/channels?` +
      new URLSearchParams({
        part: "snippet,statistics,contentDetails",
        forHandle: `@${handle.replace(/^@/, "")}`,
      }),
    auth,
  )) as {
    items?: {
      snippet?: { title?: string };
      statistics?: { subscriberCount?: string; videoCount?: string };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }[];
  } | null;

  const channel = channelJson?.items?.[0];
  const uploads = channel?.contentDetails?.relatedPlaylists?.uploads;
  if (!channel || !uploads) return null;

  const playlistJson = (await fetchJson(
    `${base}/playlistItems?` +
      new URLSearchParams({
        part: "contentDetails",
        playlistId: uploads,
        maxResults: String(YT_VIDEO_LIMIT),
      }),
    auth,
  )) as { items?: { contentDetails?: { videoId?: string } }[] } | null;

  const videoIds = (playlistJson?.items ?? [])
    .map((item) => item.contentDetails?.videoId)
    .filter((id): id is string => Boolean(id));

  const lines = [
    `YouTube ${channel.snippet?.title ?? handle}: ` +
      `${Number(channel.statistics?.subscriberCount ?? 0).toLocaleString()} subscribers, ` +
      `${Number(channel.statistics?.videoCount ?? 0).toLocaleString()} videos`,
  ];

  if (videoIds.length) {
    const videoJson = (await fetchJson(
      `${base}/videos?` +
        new URLSearchParams({
          part: "snippet,statistics,contentDetails",
          id: videoIds.join(","),
        }),
      auth,
    )) as {
      items?: {
        snippet?: { title?: string; publishedAt?: string };
        statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
        contentDetails?: { duration?: string };
      }[];
    } | null;

    const videos = videoJson?.items ?? [];
    if (videos.length) {
      const shorts = videos.filter(
        (video) => parseIsoDuration(video.contentDetails?.duration ?? "") <= 60,
      ).length;
      lines.push(
        `Format mix (last ${videos.length}): ${shorts} short-form (<=60s), ` +
          `${videos.length - shorts} long-form`,
      );
      const cadence = postingCadence(videos.map((video) => video.snippet?.publishedAt));
      if (cadence) lines.push(`Cadence: ${cadence}`);

      const top = [...videos]
        .sort(
          (a, b) =>
            Number(b.statistics?.viewCount ?? 0) - Number(a.statistics?.viewCount ?? 0),
        )
        .slice(0, 3)
        .map(
          (video) =>
            `${Number(video.statistics?.viewCount ?? 0).toLocaleString()} views, ` +
            `${Math.round(parseIsoDuration(video.contentDetails?.duration ?? "") )}s — ` +
            `"${video.snippet?.title ?? ""}"`,
        );
      if (top.length) lines.push(`Top videos by views:\n  - ${top.join("\n  - ")}`);
    }
  }

  return lines.join("\n");
}

/**
 * Load whatever real execution data the connected accounts can reach for this
 * watchlist. Never throws: a platform we can't read becomes a recorded gap so
 * the scan can say "no data" instead of inventing an answer.
 */
export async function loadCompetitorExecutionData(
  db: SupabaseClient<Database>,
  ownerId: string,
  websites: string[],
): Promise<CompetitorExecutionResult> {
  const targets = websites.map(classifyWatchlistUrl);
  const gaps: CompetitorExecutionResult["gaps"] = [];
  const blocks: string[] = [];

  const igTargets = targets.filter((t) => t.platform === "instagram" && t.handle);
  const ytTargets = targets.filter((t) => t.platform === "youtube" && t.handle);
  const tiktokHandles = targets
    .filter((t) => t.platform === "tiktok" && t.handle)
    .map((t) => t.handle as string);

  if (igTargets.length || ytTargets.length) {
    const { data: accounts } = await db
      .from("marketing_os_social_accounts")
      .select(
        "platform, status, external_account_id, page_token_encrypted, access_token_encrypted",
      )
      .eq("owner_id", ownerId)
      .eq("status", "active");

    const rows = (accounts ?? []) as {
      platform: string;
      external_account_id: string | null;
      page_token_encrypted: string | null;
      access_token_encrypted: string | null;
    }[];

    const ig = rows.find((row) => row.platform === "instagram");
    const igToken = readToken(ig?.page_token_encrypted ?? null);
    if (igTargets.length) {
      if (!ig?.external_account_id || !igToken) {
        for (const target of igTargets) {
          gaps.push({
            url: target.url,
            reason: "Instagram is not connected, so no execution data could be read.",
          });
        }
      } else {
        const results = await Promise.all(
          igTargets.map((target) =>
            fetchInstagramCompetitor(
              ig.external_account_id as string,
              igToken,
              target.handle as string,
            ).then((text) => ({ target, text })),
          ),
        );
        for (const { target, text } of results) {
          if (text) blocks.push(text);
          else
            gaps.push({
              url: target.url,
              reason:
                "Instagram returned no data — the account is likely personal rather than a public Business/Creator account.",
            });
        }
      }
    }

    // YouTube public data works with the stored OAuth access token; no separate
    // API key to configure.
    const yt = rows.find((row) => row.platform === "youtube");
    const ytToken = readToken(yt?.access_token_encrypted ?? null);
    if (ytTargets.length) {
      if (!ytToken) {
        for (const target of ytTargets) {
          gaps.push({
            url: target.url,
            reason: "YouTube is not connected, so no execution data could be read.",
          });
        }
      } else {
        const results = await Promise.all(
          ytTargets.map((target) =>
            fetchYouTubeCompetitor(target.handle as string, ytToken).then((text) => ({
              target,
              text,
            })),
          ),
        );
        for (const { target, text } of results) {
          if (text) blocks.push(text);
          else
            gaps.push({
              url: target.url,
              reason: "YouTube returned no data for this channel handle.",
            });
        }
      }
    }
  }

  const brief = blocks.length
    ? `\nCOMPETITOR EXECUTION DATA (real platform API data — authoritative, not inferred):\n${blocks.join("\n\n")}`
    : "";

  return { brief, gaps, tiktokHandles };
}
