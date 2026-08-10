import { decryptToken, encryptToken } from "@/lib/crypto";

const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const X_MEDIA_UPLOAD_URL = "https://api.x.com/2/media/upload";
const X_CREATE_POST_URL = "https://api.x.com/2/tweets";
const MAX_X_IMAGE_BYTES = 5 * 1024 * 1024;

type TokenUpdate = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
};

export type XAccount = {
  access_token_encrypted: string | null;
  page_token_encrypted: string | null;
  token_expires_at: string | null;
};

export type XPublishInput = {
  accessToken: string;
  caption: string;
  mediaUrl: string;
};

function getXClientId() {
  return process.env.X_CLIENT_ID?.trim() ?? "";
}

function getXClientSecret() {
  return process.env.X_CLIENT_SECRET?.trim() ?? "";
}

export function isXConfigured() {
  return Boolean(getXClientId());
}

function shouldRefresh(expiresAt: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() - Date.now() < 5 * 60 * 1000;
}

async function readXError(res: Response, fallback: string) {
  const text = await res.text();
  if (!text) return fallback;
  try {
    const json = JSON.parse(text) as {
      error_description?: string;
      detail?: string;
      title?: string;
      error?: string;
      errors?: { detail?: string; title?: string; message?: string }[];
    };
    return (
      json.error_description ??
      json.detail ??
      json.title ??
      json.error ??
      json.errors?.[0]?.detail ??
      json.errors?.[0]?.message ??
      json.errors?.[0]?.title ??
      fallback
    );
  } catch {
    return text.slice(0, 420);
  }
}

function parseStoredXTokens(account: XAccount) {
  const fallbackAccessToken = account.access_token_encrypted
    ? decryptToken(account.access_token_encrypted)
    : "";
  if (!account.page_token_encrypted) {
    return { accessToken: fallbackAccessToken, refreshToken: null };
  }

  const stored = decryptToken(account.page_token_encrypted);
  const [storedAccessToken, storedRefreshToken] = stored.split("||");
  return {
    accessToken: storedAccessToken || fallbackAccessToken,
    refreshToken: storedRefreshToken || null,
  };
}

export async function refreshXAccessToken(account: XAccount): Promise<TokenUpdate> {
  const { accessToken, refreshToken } = parseStoredXTokens(account);
  if (!accessToken) throw new Error("X access token is missing. Reconnect X.");
  if (!shouldRefresh(account.token_expires_at)) {
    return {
      accessToken,
      refreshToken,
      expiresAt: account.token_expires_at,
    };
  }
  if (!refreshToken) {
    throw new Error("X refresh token is missing. Reconnect X with offline access enabled.");
  }

  const clientId = getXClientId();
  const clientSecret = getXClientSecret();
  if (!clientId) throw new Error("X_CLIENT_ID is missing for X publishing.");

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_id", clientId);
  }

  const res = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers,
    body,
  });
  if (!res.ok) throw new Error(await readXError(res, "Could not refresh X token."));

  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) throw new Error("X did not return an access token.");

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresAt: json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : null,
  };
}

function cleanCaption(value: string) {
  const caption = value.trim().replace(/\s+/g, " ");
  return caption ? caption.slice(0, 280) : "";
}

export async function publishToX(input: XPublishInput) {
  const mediaRes = await fetch(input.mediaUrl);
  if (!mediaRes.ok) throw new Error("Could not read uploaded image for X.");

  const contentType = mediaRes.headers.get("content-type") || "image/png";
  if (!contentType.startsWith("image/")) {
    throw new Error("X auto-publishing currently supports image posts only.");
  }

  const buffer = Buffer.from(await mediaRes.arrayBuffer());
  if (buffer.byteLength > MAX_X_IMAGE_BYTES) {
    throw new Error("X API image uploads must be 5 MB or smaller.");
  }

  const uploadRes = await fetch(X_MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      media: buffer.toString("base64"),
      media_category: "tweet_image",
      media_type: contentType,
    }),
  });
  if (!uploadRes.ok) throw new Error(await readXError(uploadRes, "X media upload failed."));

  const uploadJson = (await uploadRes.json()) as {
    data?: { id?: string; media_id?: string };
  };
  const mediaId = uploadJson.data?.id ?? uploadJson.data?.media_id;
  if (!mediaId) throw new Error("X did not return a media ID.");

  const postRes = await fetch(X_CREATE_POST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: cleanCaption(input.caption),
      media: { media_ids: [mediaId] },
    }),
  });
  if (!postRes.ok) throw new Error(await readXError(postRes, "X post creation failed."));

  const postJson = (await postRes.json()) as { data?: { id?: string } };
  if (!postJson.data?.id) throw new Error("X did not return a post ID.");
  return postJson.data.id;
}

export function encryptedXTokenUpdate(update: TokenUpdate) {
  const refreshToken = update.refreshToken;
  return {
    access_token_encrypted: encryptToken(update.accessToken),
    page_token_encrypted: encryptToken(
      refreshToken ? `${update.accessToken}||${refreshToken}` : update.accessToken,
    ),
    token_expires_at: update.expiresAt,
  };
}
