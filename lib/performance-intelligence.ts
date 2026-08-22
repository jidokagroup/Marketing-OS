/**
 * What the performance analysis needs before it can find a pattern.
 *
 * Shared by the route that enforces it and the page that explains it, so the
 * page can never promise a run the route will refuse.
 */

export const LOOKBACK_DAYS = 90;
export const MINIMUM_MEASURED_POSTS = 4;

export function notEnoughMeasuredPosts(count: number) {
  return `Not enough published, measured content yet to find a pattern (need at least ${MINIMUM_MEASURED_POSTS} posts with analytics in the last ${LOOKBACK_DAYS} days; this seat has ${count}).`;
}

/** The earliest date (YYYY-MM-DD) that still counts as measured history. */
export function measurementCutoff(): string {
  return new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}
