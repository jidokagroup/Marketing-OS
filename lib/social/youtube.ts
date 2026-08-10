import { decryptToken, encryptToken } from "@/lib/crypto";

type TokenUpdate = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string | null;
};

export type YouTubeAccount = {
  access_token_encrypted: string | null;
  page_token_encrypted: string | null;
  token_expires_at: string | null;
};

export type YouTubePublishInput = {
  accessToken: string;
  title: string;
  description: string;
  mediaUrl: string;
  privacyStatus?: string;
};

function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
}

function getGoogleClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
}

export function isYouTubeConfigured() {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}

function shouldRefresh(expiresAt: string | null) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() - Date.now() < 5 * 60 * 1000;
}

async function readGoogleError(res: Response, fallback: string) {
  const text = await res.text();
  if (!text) return fallback;
  try {
    const json = JSON.parse(text) as {
      error_description?: string;
      error?: { message?: string };
    };
    return json.error_description ?? json.error?.message ?? fallback;
  } catch {
    return text.slice(0, 420);
  }
}

export async function refreshYouTubeAccessToken(
  account: YouTubeAccount,
): Promise<TokenUpdate> {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth env vars are missing for YouTube publishing.");
  }
  if (!account.page_token_encrypted) {
    throw new Error("YouTube refresh token is missing. Reconnect YouTube.");
  }

  const refreshToken = decryptToken(account.page_token_encrypted);
  if (!shouldRefresh(account.token_expires_at) && account.access_token_encrypted) {
    return {
      accessToken: decryptToken(account.access_token_encrypted),
      refreshToken,
      expiresAt: account.token_expires_at,
    };
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(await readGoogleError(res, "Could not refresh YouTube token."));
  }

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) throw new Error("Google did not return an access token.");

  return {
    accessToken: json.access_token,
    refreshToken,
    expiresAt: json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : null,
  };
}

function cleanTitle(value: string) {
  const title = value.trim().replace(/\s+/g, " ");
  return title ? title.slice(0, 100) : "Scheduled video";
}

function cleanDescription(value: string) {
  return value.trim().slice(0, 5000);
}

export async function publishToYouTube(input: YouTubePublishInput) {
  const privacyStatus = input.privacyStatus?.trim() || "public";
  const mediaRes = await fetch(input.mediaUrl);
  if (!mediaRes.ok) throw new Error("Could not read uploaded video for YouTube.");

  const contentType = mediaRes.headers.get("content-type") || "video/mp4";
  const buffer = Buffer.from(await mediaRes.arrayBuffer());
  if (!contentType.startsWith("video/") && contentType !== "application/octet-stream") {
    throw new Error("YouTube auto-publishing requires a video file.");
  }

  const metadata = {
    snippet: {
      title: cleanTitle(input.title),
      description: cleanDescription(input.description),
    },
    status: {
      privacyStatus,
      selfDeclaredMadeForKids: false,
    },
  };

  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(buffer.byteLength),
        "X-Upload-Content-Type": contentType,
      },
      body: JSON.stringify(metadata),
    },
  );

  if (!initRes.ok) {
    throw new Error(await readGoogleError(initRes, "Could not start YouTube upload."));
  }

  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) throw new Error("Google did not return a YouTube upload URL.");

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Length": String(buffer.byteLength),
      "Content-Type": contentType,
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    throw new Error(await readGoogleError(uploadRes, "YouTube upload failed."));
  }

  const json = (await uploadRes.json()) as { id?: string };
  if (!json.id) throw new Error("YouTube did not return a video ID.");
  return json.id;
}

export function encryptedYouTubeTokenUpdate(update: TokenUpdate) {
  return {
    access_token_encrypted: encryptToken(update.accessToken),
    page_token_encrypted: encryptToken(update.refreshToken),
    token_expires_at: update.expiresAt,
  };
}
