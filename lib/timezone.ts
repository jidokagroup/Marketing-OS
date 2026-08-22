/**
 * Reads the workspace timezone for the current request.
 *
 * Split from `lib/time-format.ts` so the formatting helpers, which the browser
 * also needs, are not dragged into a client bundle alongside `next/headers`.
 */

import { cookies } from "next/headers";

import {
  DEFAULT_TIME_ZONE,
  TIME_ZONE_COOKIE,
  isValidTimeZone,
} from "./time-format";

export * from "./time-format";

/** The zone this request should render in. */
export async function workspaceTimeZone(): Promise<string> {
  const store = await cookies();
  const raw = store.get(TIME_ZONE_COOKIE)?.value;
  // The browser writes the zone encoded, and cookie values arrive exactly as
  // sent, so "America%2FNew_York" has to be decoded before it will validate.
  let value = raw ?? "";
  try {
    value = decodeURIComponent(value);
  } catch {
    return DEFAULT_TIME_ZONE;
  }
  return isValidTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}
