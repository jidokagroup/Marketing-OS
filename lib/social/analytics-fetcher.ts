import { decryptToken } from "@/lib/crypto";
import { META_GRAPH } from "@/lib/social/meta";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

type AnalyticsResult = {
  accounts_processed: number;
  rows_stored: number;
  errors: number;
  /**
   * What happened per account, so "nothing imported" can be told apart from
   * "nothing was tried" and from "the platform refused".
   */
  accounts: AnalyticsAccountResult[];
};

export type AnalyticsAccountResult = {
  platform: string;
  username: string | null;
  rows: number;
  status: "imported" | "no_data" | "no_token" | "failed";
  error?: string;
};

export type AnalyticsFetchOptions = {
  ownerId?: string;
  agentId?: string;
  platforms?: string[];
  lookbackDays?: number;
  maxPostsPerAccount?: number;
};

type SocialAccountRow = {
  id: string;
  agent_id: string;
  owner_id: string;
  platform: string;
  external_account_id: string | null;
  page_id: string | null;
  page_token_encrypted: string | null;
  username: string | null;
};

type MetricRow = {
  agentId: string;
  ownerId: string;
  socialAccountId: string;
  platform: "instagram" | "facebook" | "youtube" | "x";
  accountName: string | null;
  postId: string;
  postedTime?: string | null;
  caption?: string | null;
  mediaType?: string | null;
  totalFollowers?: number;
  reach?: number;
  impressions?: number;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  raw?: unknown;
};

type FetchWindow = {
  since: Date | null;
  maxPostsPerAccount: number;
};

const RECENT_POST_LIMIT = 25;
const BACKFILL_POST_LIMIT = 250;

function fetchWindow(options: AnalyticsFetchOptions = {}): FetchWindow {
  const cleanDays = Number(options.lookbackDays ?? 0);
  const since =
    Number.isFinite(cleanDays) && cleanDays > 0
      ? new Date(Date.now() - Math.min(cleanDays, 730) * 24 * 60 * 60 * 1000)
      : null;

  return {
    since,
    maxPostsPerAccount: Math.max(
      1,
      Math.min(
        options.maxPostsPerAccount ??
          (since ? BACKFILL_POST_LIMIT : RECENT_POST_LIMIT),
        500,
      ),
    ),
  };
}

function jsonValue(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json;
}

function tokenValue(stored: string): string {
  try {
    return decryptToken(stored);
  } catch {
    return stored;
  }
}

function safeDate(value: string | null | undefined): Date {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function isBeforeSince(value: string | null | undefined, since: Date | null) {
  if (!since || !value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date < since;
}

function clampLimit(value: number, max = 100) {
  return String(Math.max(1, Math.min(value, max)));
}

async function upsertRow(row: MetricRow): Promise<number> {
  const admin = createAdminClient();
  const posted = safeDate(row.postedTime);
  const likes = row.likes ?? 0;
  const comments = row.comments ?? 0;
  const shares = row.shares ?? 0;
  const saves = row.saves ?? 0;
  const engagement = likes + comments + shares + saves;
  const denominator = Math.max(
    row.reach ?? 0,
    row.impressions ?? 0,
    row.views ?? 0,
    1,
  );

  const { error } = await admin.from("marketing_os_platform_analytics").upsert(
    {
      agent_id: row.agentId,
      owner_id: row.ownerId,
      social_account_id: row.socialAccountId,
      platform: row.platform,
      post_id: row.postId,
      title: row.accountName,
      posted_time: posted.toISOString(),
      fetched_at: new Date().toISOString(),
      date: posted.toISOString().slice(0, 10),
      hour: posted.getHours(),
      day_of_week: posted.toLocaleDateString("en-US", { weekday: "long" }),
      caption: row.caption ?? null,
      media_type: row.mediaType ?? null,
      views: row.views ?? 0,
      impressions: row.impressions ?? 0,
      reach: row.reach ?? 0,
      likes,
      comments,
      shares,
      saves,
      engagement_score: engagement,
      performance_score: Math.min(100, Math.round((engagement / denominator) * 1000)),
      raw_metrics: jsonValue({
        account_name: row.accountName,
        total_followers: row.totalFollowers ?? 0,
        source: row.raw ?? null,
      }),
    },
    { onConflict: "owner_id,platform,post_id" },
  );

  if (error) {
    console.error("[analytics] upsert failed", row.platform, row.postId, error.message);
    return 0;
  }
  return 1;
}

async function snapshot(
  account: SocialAccountRow,
  platform: "instagram" | "facebook" | "youtube" | "x",
  accountName: string | null,
  totalFollowers: number,
) {
  const day = new Date().toISOString().slice(0, 10);
  return upsertRow({
    agentId: account.agent_id,
    ownerId: account.owner_id,
    socialAccountId: account.id,
    platform,
    accountName,
    postId: `__account__${account.id}__${day}`,
    postedTime: new Date().toISOString(),
    mediaType: "account_snapshot",
    totalFollowers,
  });
}

async function fetchInstagram(
  account: SocialAccountRow,
  pageToken: string,
  window: FetchWindow,
) {
  const igBusinessId = account.external_account_id;
  // Silently returning zero here is what left an account "connected" and
  // "awaiting analytics" forever with nothing saying why.
  if (!igBusinessId) {
    throw new Error("No Instagram business account id on this connection. Reconnect Instagram.");
  }

  let followers = 0;
  let username = account.username;
  const accountRes = await fetch(
    `${META_GRAPH}/${igBusinessId}?` +
      new URLSearchParams({
        fields: "followers_count,username",
        access_token: pageToken,
      }),
  );
  if (accountRes.ok) {
    const profile = await accountRes.json();
    followers = profile.followers_count ?? 0;
    username = profile.username ?? username;
  }

  let count = await snapshot(account, "instagram", username, followers);
  let fetchedPosts = 0;
  let nextUrl: string | null =
    `${META_GRAPH}/${igBusinessId}/media?` +
    new URLSearchParams({
      fields: "id,caption,media_type,timestamp,like_count,comments_count",
      access_token: pageToken,
      limit: clampLimit(Math.min(window.maxPostsPerAccount, 100)),
    }).toString();

  while (nextUrl && fetchedPosts < window.maxPostsPerAccount) {
    const mediaRes: Response = await fetch(nextUrl);
    if (!mediaRes.ok) return count;

    const json: { data?: unknown; paging?: { next?: string } } =
      await mediaRes.json();
    const posts = json.data;
    if (!Array.isArray(posts) || posts.length === 0) return count;

    let reachedOldPost = false;
    for (const post of posts) {
      if (fetchedPosts >= window.maxPostsPerAccount) break;
      if (isBeforeSince(post.timestamp, window.since)) {
        reachedOldPost = true;
        break;
      }
      fetchedPosts += 1;

      let reach = 0;
      let saves = 0;
      let shares = 0;
      const metric = post.media_type === "VIDEO" ? "reach,saved,shares" : "reach,saved";
      const insightRes = await fetch(
        `${META_GRAPH}/${post.id}/insights?` +
          new URLSearchParams({ metric, access_token: pageToken }),
      );
      if (insightRes.ok) {
        const { data } = await insightRes.json();
        for (const metricRow of data ?? []) {
          const value = metricRow.values?.[0]?.value ?? 0;
          if (metricRow.name === "reach") reach = value;
          if (metricRow.name === "saved") saves = value;
          if (metricRow.name === "shares") shares = value;
        }
      }

      count += await upsertRow({
        agentId: account.agent_id,
        ownerId: account.owner_id,
        socialAccountId: account.id,
        platform: "instagram",
        accountName: username,
        postId: post.id,
        postedTime: post.timestamp,
        caption: post.caption,
        mediaType: post.media_type,
        totalFollowers: followers,
        reach,
        likes: post.like_count ?? 0,
        comments: post.comments_count ?? 0,
        shares,
        saves,
        raw: post,
      });
    }

    nextUrl = reachedOldPost ? null : json.paging?.next ?? null;
  }
  return count;
}

async function fetchFacebook(
  account: SocialAccountRow,
  pageToken: string,
  window: FetchWindow,
) {
  const pageId = account.page_id ?? account.external_account_id;
  if (!pageId) {
    throw new Error("No Facebook Page selected for this connection. Reconnect Facebook and pick a Page.");
  }

  let followers = 0;
  let name = account.username;
  const accountRes = await fetch(
    `${META_GRAPH}/${pageId}?` +
      new URLSearchParams({
        fields: "followers_count,fan_count,name",
        access_token: pageToken,
      }),
  );
  if (accountRes.ok) {
    const profile = await accountRes.json();
    followers = profile.followers_count ?? profile.fan_count ?? 0;
    name = profile.name ?? name;
  }

  let count = await snapshot(account, "facebook", name, followers);
  let fetchedPosts = 0;
  let nextUrl: string | null =
    `${META_GRAPH}/${pageId}/posts?` +
    new URLSearchParams({
      fields: "id,message,created_time,reactions.summary(true),comments.summary(true),shares",
      access_token: pageToken,
      limit: clampLimit(Math.min(window.maxPostsPerAccount, 100)),
    }).toString();

  while (nextUrl && fetchedPosts < window.maxPostsPerAccount) {
    const postsRes: Response = await fetch(nextUrl);
    if (!postsRes.ok) return count;

    const json: { data?: unknown; paging?: { next?: string } } =
      await postsRes.json();
    const posts = json.data;
    if (!Array.isArray(posts) || posts.length === 0) return count;

    let reachedOldPost = false;
    for (const post of posts) {
      if (fetchedPosts >= window.maxPostsPerAccount) break;
      if (isBeforeSince(post.created_time, window.since)) {
        reachedOldPost = true;
        break;
      }
      fetchedPosts += 1;

      let reach = 0;
      let impressions = 0;
      const insightRes = await fetch(
        `${META_GRAPH}/${post.id}/insights?` +
          new URLSearchParams({
            metric: "post_impressions_unique,post_impressions",
            access_token: pageToken,
          }),
      );
      if (insightRes.ok) {
        const { data } = await insightRes.json();
        for (const metricRow of data ?? []) {
          const value = metricRow.values?.[0]?.value ?? 0;
          if (metricRow.name === "post_impressions_unique") reach = value;
          if (metricRow.name === "post_impressions") impressions = value;
        }
      }

      count += await upsertRow({
        agentId: account.agent_id,
        ownerId: account.owner_id,
        socialAccountId: account.id,
        platform: "facebook",
        accountName: name,
        postId: post.id,
        postedTime: post.created_time,
        caption: post.message,
        mediaType: "post",
        totalFollowers: followers,
        reach,
        impressions,
        likes: post.reactions?.summary?.total_count ?? 0,
        comments: post.comments?.summary?.total_count ?? 0,
        shares: post.shares?.count ?? 0,
        raw: post,
      });
    }

    nextUrl = reachedOldPost ? null : json.paging?.next ?? null;
  }
  return count;
}

async function fetchYouTube(
  account: SocialAccountRow,
  refreshToken: string,
  window: FetchWindow,
) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials are not configured for this deployment, so YouTube analytics cannot be imported.");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(
      tokenJson?.error_description ??
        "YouTube refused the refresh token. Reconnect YouTube.",
    );
  }

  const channelRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,contentDetails&mine=true",
    { headers: { Authorization: `Bearer ${tokenJson.access_token}` } },
  );
  if (!channelRes.ok) {
    // A disabled YouTube Data API answers here, and this is the message that
    // tells the user which switch to flip.
    const detail = await channelRes.text();
    throw new Error(
      `YouTube rejected the channel lookup (${channelRes.status}). ${detail.slice(0, 200)}`,
    );
  }
  const channelJson = await channelRes.json();
  const channel = channelJson.items?.[0];
  if (!channel) {
    throw new Error("This Google account has no YouTube channel to read.");
  }

  const followers = Number(channel.statistics?.subscriberCount ?? 0);
  const name = channel.snippet?.title ?? account.username ?? null;
  const uploadsPlaylist = channel.contentDetails?.relatedPlaylists?.uploads;

  let count = await snapshot(account, "youtube", name, followers);
  if (!uploadsPlaylist) return count;

  let fetchedPosts = 0;
  let nextPageToken = "";
  let reachedOldVideo = false;

  while (!reachedOldVideo && fetchedPosts < window.maxPostsPerAccount) {
    const playlistParams = new URLSearchParams({
      part: "contentDetails",
      maxResults: clampLimit(50, 50),
      playlistId: uploadsPlaylist,
    });
    if (nextPageToken) playlistParams.set("pageToken", nextPageToken);

    const playlistRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${playlistParams.toString()}`,
      { headers: { Authorization: `Bearer ${tokenJson.access_token}` } },
    );
    if (!playlistRes.ok) return count;
    const playlistJson = await playlistRes.json();
    const ids: string[] = (playlistJson.items ?? [])
      .map((item: { contentDetails?: { videoId?: string } }) => item.contentDetails?.videoId)
      .filter(Boolean);
    if (!ids.length) return count;

    const videosRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids.join(",")}`,
      { headers: { Authorization: `Bearer ${tokenJson.access_token}` } },
    );
    if (!videosRes.ok) return count;
    const videosJson = await videosRes.json();
    for (const video of videosJson.items ?? []) {
      if (fetchedPosts >= window.maxPostsPerAccount) break;
      if (isBeforeSince(video.snippet?.publishedAt, window.since)) {
        reachedOldVideo = true;
        break;
      }
      fetchedPosts += 1;
      count += await upsertRow({
        agentId: account.agent_id,
        ownerId: account.owner_id,
        socialAccountId: account.id,
        platform: "youtube",
        accountName: name,
        postId: video.id,
        postedTime: video.snippet?.publishedAt,
        caption: video.snippet?.title,
        mediaType: "video",
        totalFollowers: followers,
        views: Number(video.statistics?.viewCount ?? 0),
        likes: Number(video.statistics?.likeCount ?? 0),
        comments: Number(video.statistics?.commentCount ?? 0),
        raw: video.statistics,
      });
    }

    nextPageToken = playlistJson.nextPageToken ?? "";
    if (!nextPageToken) break;
  }
  return count;
}

async function fetchX(
  account: SocialAccountRow,
  tokenPayload: string,
  window: FetchWindow,
) {
  const accessToken = tokenPayload.split("||")[0];
  if (!accessToken) {
    throw new Error("No X access token on this connection. Reconnect X.");
  }

  const meRes = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=public_metrics,username,name,profile_image_url",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!meRes.ok) {
    const detail = await meRes.text();
    throw new Error(`X rejected the account lookup (${meRes.status}). ${detail.slice(0, 200)}`);
  }
  const me = (await meRes.json()).data;
  if (!me) {
    throw new Error("X returned no account for this connection. Reconnect X.");
  }

  const followers = me.public_metrics?.followers_count ?? 0;
  const name = me.name ?? me.username ?? account.username ?? null;
  let count = await snapshot(account, "x", name, followers);

  let fetchedPosts = 0;
  let paginationToken = "";
  let reachedOldTweet = false;

  while (!reachedOldTweet && fetchedPosts < window.maxPostsPerAccount) {
    const params = new URLSearchParams({
      max_results: clampLimit(100, 100),
      "tweet.fields": "public_metrics,created_at",
    });
    if (paginationToken) params.set("pagination_token", paginationToken);

    const tweetsRes = await fetch(
      `https://api.twitter.com/2/users/${me.id}/tweets?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!tweetsRes.ok) return count;
    const tweetsJson = await tweetsRes.json();
    const tweets = tweetsJson.data;
    if (!Array.isArray(tweets)) return count;

    for (const tweet of tweets) {
      if (fetchedPosts >= window.maxPostsPerAccount) break;
      if (isBeforeSince(tweet.created_at, window.since)) {
        reachedOldTweet = true;
        break;
      }
      fetchedPosts += 1;
      const metrics = tweet.public_metrics ?? {};
      count += await upsertRow({
        agentId: account.agent_id,
        ownerId: account.owner_id,
        socialAccountId: account.id,
        platform: "x",
        accountName: name,
        postId: tweet.id,
        postedTime: tweet.created_at,
        caption: tweet.text,
        mediaType: "tweet",
        totalFollowers: followers,
        impressions: metrics.impression_count ?? 0,
        likes: metrics.like_count ?? 0,
        comments: metrics.reply_count ?? 0,
        shares: (metrics.retweet_count ?? 0) + (metrics.quote_count ?? 0),
        raw: metrics,
      });
    }

    paginationToken = tweetsJson.meta?.next_token ?? "";
    if (!paginationToken) break;
  }
  return count;
}

export async function runJidokaAnalyticsFetch(
  options: AnalyticsFetchOptions = {},
): Promise<AnalyticsResult> {
  const admin = createAdminClient();
  const window = fetchWindow(options);
  let accountQuery = admin
    .from("marketing_os_social_accounts")
    .select(
      "id, agent_id, owner_id, platform, external_account_id, page_id, page_token_encrypted, username",
    )
    .eq("status", "active")
    .not("page_token_encrypted", "is", null);
  const platforms = options.platforms?.length
    ? options.platforms
    : ["instagram", "facebook", "youtube", "x"];
  accountQuery = accountQuery.in("platform", platforms);
  if (options.ownerId) accountQuery = accountQuery.eq("owner_id", options.ownerId);
  if (options.agentId) accountQuery = accountQuery.eq("agent_id", options.agentId);
  const { data: accounts } = await accountQuery;

  let accounts_processed = 0;
  let rows_stored = 0;
  let errors = 0;
  const perAccount: AnalyticsAccountResult[] = [];

  for (const account of (accounts ?? []) as SocialAccountRow[]) {
    accounts_processed += 1;
    const token = account.page_token_encrypted ? tokenValue(account.page_token_encrypted) : "";
    if (!token) {
      perAccount.push({
        platform: account.platform,
        username: account.username ?? null,
        rows: 0,
        status: "no_token",
        error: "The stored token could not be read. Reconnect this account.",
      });
      continue;
    }
    try {
      let rows = 0;
      if (account.platform === "instagram") {
        rows = await fetchInstagram(account, token, window);
      } else if (account.platform === "facebook") {
        rows = await fetchFacebook(account, token, window);
      } else if (account.platform === "youtube") {
        rows = await fetchYouTube(account, token, window);
      } else if (account.platform === "x") {
        rows = await fetchX(account, token, window);
      }
      rows_stored += rows;
      perAccount.push({
        platform: account.platform,
        username: account.username ?? null,
        rows,
        status: rows > 0 ? "imported" : "no_data",
      });
    } catch (err) {
      errors += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error("[analytics]", account.platform, account.id, message);
      perAccount.push({
        platform: account.platform,
        username: account.username ?? null,
        rows: 0,
        status: "failed",
        error: message,
      });
    }
  }

  return { accounts_processed, rows_stored, errors, accounts: perAccount };
}
