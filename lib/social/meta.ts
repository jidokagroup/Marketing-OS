/**
 * Meta (Instagram / Facebook) Graph API integration.
 * Uses the approved Autom8 Meta app ID as a fallback when a Jidoka-specific
 * env value is missing. FB_APP_SECRET must stay server-side for token exchange.
 */

export const META_GRAPH_VERSION = "v23.0";
export const META_GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const OAUTH_DIALOG = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;
const AUTOM8_APPROVED_META_APP_ID = "1859085634713050";

const SCOPES = [
  "pages_show_list",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "instagram_manage_comments",
  "instagram_manage_messages",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_read_user_content",
  "pages_manage_engagement",
].join(",");

export function getMetaAppId(): string {
  return process.env.NEXT_PUBLIC_FB_APP_ID?.trim() || AUTOM8_APPROVED_META_APP_ID;
}

function getMetaAppSecret(): string {
  return process.env.FB_APP_SECRET?.trim() ?? "";
}

export function isMetaOAuthConfigured(): boolean {
  return Boolean(getMetaAppId());
}

export function isMetaConfigured(): boolean {
  return Boolean(getMetaAppId() && getMetaAppSecret());
}

export function getMetaOAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: getMetaAppId(),
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    response_type: "code",
  });
  return `${OAUTH_DIALOG}?${params.toString()}`;
}

interface ConnectedAccount {
  igUserId: string | null;
  username: string | null;
  profilePictureUrl: string | null;
  pageId: string;
  pageName: string | null;
  pageToken: string;
  longLivedUserToken: string;
}

export interface MetaConnectionOption {
  pageId: string;
  pageName: string | null;
  pageToken: string;
  igUserId: string | null;
  igUsername: string | null;
  igProfilePictureUrl: string | null;
}

async function readMetaJson(res: Response) {
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message ?? "Meta request failed");
  }
  return json;
}

/** Exchange an OAuth code for a long-lived Meta user token. */
export async function exchangeMetaCodeForLongLivedToken(
  code: string,
  redirectUri: string,
): Promise<string> {
  const appId = getMetaAppId();
  const appSecret = getMetaAppSecret();
  if (!appSecret) throw new Error("FB_APP_SECRET is not set for Meta token exchange");

  // 1) code → short-lived user token
  const shortRes = await fetch(
    `${META_GRAPH}/oauth/access_token?` +
      new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      }),
  );
  const shortJson = await readMetaJson(shortRes);

  // 2) short → long-lived user token
  const longRes = await fetch(
    `${META_GRAPH}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortJson.access_token,
      }),
  );
  const longJson = await readMetaJson(longRes);
  return longJson.access_token;
}

/** List Facebook Pages and linked Instagram Business accounts for the selector. */
export async function listMetaConnectionOptions(
  userToken: string,
): Promise<MetaConnectionOption[]> {
  const pagesRes = await fetch(
    `${META_GRAPH}/me/accounts?` + new URLSearchParams({ access_token: userToken }),
  );
  const pagesJson = await readMetaJson(pagesRes);
  const pages = Array.isArray(pagesJson.data) ? pagesJson.data : [];
  const options: MetaConnectionOption[] = [];

  for (const page of pages) {
    if (!page?.id || !page?.access_token) continue;

    const igRes = await fetch(
      `${META_GRAPH}/${page.id}?` +
        new URLSearchParams({
          fields: "instagram_business_account,name",
          access_token: page.access_token,
        }),
    );
    const igJson = await readMetaJson(igRes);
    const igId = igJson.instagram_business_account?.id ?? null;
    const profile = igId
      ? await fetch(
          `${META_GRAPH}/${igId}?` +
            new URLSearchParams({
              fields: "username,profile_picture_url",
              access_token: page.access_token,
            }),
        ).then((res) => readMetaJson(res))
      : {};

    options.push({
      pageId: page.id,
      pageName: igJson.name ?? page.name ?? null,
      pageToken: page.access_token,
      igUserId: igId,
      igUsername: profile.username ?? null,
      igProfilePictureUrl: profile.profile_picture_url ?? null,
    });
  }

  return options;
}

/** Exchange an OAuth code and use the first available Page. Kept for fallback jobs. */
export async function connectMetaAccount(
  code: string,
  redirectUri: string,
): Promise<ConnectedAccount> {
  const userToken = await exchangeMetaCodeForLongLivedToken(code, redirectUri);
  const options = await listMetaConnectionOptions(userToken);
  const page = options[0];
  if (!page) throw new Error("No Facebook Page linked to this account");

  return {
    igUserId: page.igUserId,
    username: page.igUsername,
    profilePictureUrl: page.igProfilePictureUrl,
    pageId: page.pageId,
    pageName: page.pageName,
    pageToken: page.pageToken,
    longLivedUserToken: userToken,
  };
}

export interface PublishInput {
  igUserId: string;
  pageToken: string;
  caption: string;
  mediaUrl: string; // publicly fetchable (signed) URL
  contentType: string; // reel | video | image | carousel | story
}

/** Publish a single image or reel to Instagram. Returns the IG media id. */
export async function publishToInstagram(input: PublishInput): Promise<string> {
  const { igUserId, pageToken, caption, mediaUrl, contentType } = input;
  const isVideo = contentType === "reel" || contentType === "video" || contentType === "story";

  // 1) create media container
  const createParams: Record<string, string> = {
    caption,
    access_token: pageToken,
  };
  if (isVideo) {
    createParams.media_type = contentType === "story" ? "STORIES" : "REELS";
    createParams.video_url = mediaUrl;
  } else {
    createParams.image_url = mediaUrl;
  }

  const createRes = await fetch(`${META_GRAPH}/${igUserId}/media`, {
    method: "POST",
    body: new URLSearchParams(createParams),
  });
  const createJson = await createRes.json();
  if (!createRes.ok) throw new Error(createJson.error?.message ?? "Container create failed");
  const creationId: string = createJson.id;

  // 2) for video, poll until the container finishes processing
  if (isVideo) {
    for (let i = 0; i < 20; i += 1) {
      await new Promise((r) => setTimeout(r, 3000));
      const statusRes = await fetch(
        `${META_GRAPH}/${creationId}?` +
          new URLSearchParams({ fields: "status_code", access_token: pageToken }),
      );
      const statusJson = await statusRes.json();
      if (statusJson.status_code === "FINISHED") break;
      if (statusJson.status_code === "ERROR")
        throw new Error("Video processing failed at Meta");
    }
  }

  // 3) publish
  const pubRes = await fetch(`${META_GRAPH}/${igUserId}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: creationId, access_token: pageToken }),
  });
  const pubJson = await pubRes.json();
  if (!pubRes.ok) throw new Error(pubJson.error?.message ?? "Publish failed");
  return pubJson.id;
}

export interface FacebookPublishInput {
  pageId: string;
  pageToken: string;
  caption: string;
  mediaUrl: string;
  contentType: string;
}

/** Publish a single photo or video to a Facebook Page. Returns the Page post/media id. */
export async function publishToFacebook(input: FacebookPublishInput): Promise<string> {
  const { pageId, pageToken, caption, mediaUrl, contentType } = input;
  const isVideo = contentType === "video" || contentType === "reel";
  if (contentType === "carousel") {
    throw new Error("Facebook carousel auto-publishing is not live yet. Save it as a draft.");
  }

  const endpoint = `${META_GRAPH}/${pageId}/${isVideo ? "videos" : "photos"}`;
  const params: Record<string, string> = {
    access_token: pageToken,
    published: "true",
  };
  if (isVideo) {
    params.file_url = mediaUrl;
    params.description = caption;
  } else {
    params.url = mediaUrl;
    params.caption = caption;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    body: new URLSearchParams(params),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? "Facebook publish failed");
  return json.post_id ?? json.id;
}

export interface MediaInsights {
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views: number;
}

/** Fetch insights for one published IG media id. */
export async function fetchMediaInsights(
  igMediaId: string,
  pageToken: string,
): Promise<MediaInsights> {
  const metrics = "reach,likes,comments,shares,saved,views";
  const res = await fetch(
    `${META_GRAPH}/${igMediaId}/insights?` +
      new URLSearchParams({ metric: metrics, access_token: pageToken }),
  );
  const json = await res.json();
  const out: MediaInsights = {
    reach: 0,
    impressions: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    views: 0,
  };
  for (const m of json.data ?? []) {
    const value = m.values?.[0]?.value ?? 0;
    switch (m.name) {
      case "reach":
        out.reach = value;
        break;
      case "likes":
        out.likes = value;
        break;
      case "comments":
        out.comments = value;
        break;
      case "shares":
        out.shares = value;
        break;
      case "saved":
        out.saves = value;
        break;
      case "views":
        out.views = value;
        out.impressions = value;
        break;
    }
  }
  return out;
}
