/**
 * Which platforms this deployment can actually publish to.
 *
 * "Connected" and "publishable" are different claims. An account can be
 * connected through OAuth while the app is missing the credentials the
 * publish call needs, or while the platform's API is switched off for the
 * project — which is how a YouTube post that looked ready failed at publish
 * time with an API-disabled error. Reads env, so server only.
 */

import { isMetaConfigured } from "@/lib/social/meta";
import { isXConfigured } from "@/lib/social/x";
import { isYouTubeConfigured } from "@/lib/social/youtube";
import { SCHEDULER_PLATFORMS } from "@/lib/social/platforms";

export function isPublishingConfigured(platform: string): boolean {
  switch (platform) {
    case "instagram":
    case "facebook":
      return isMetaConfigured();
    case "youtube":
      return isYouTubeConfigured();
    case "x":
      return isXConfigured();
    default:
      // TikTok, LinkedIn and email campaigns have no live publisher yet, so
      // nothing here should claim they are ready to auto-publish.
      return false;
  }
}

/** The platforms a page can honestly present as able to auto-publish. */
export function publishReadyPlatforms(): string[] {
  return SCHEDULER_PLATFORMS.map((platform) => platform.key).filter(
    isPublishingConfigured,
  );
}
