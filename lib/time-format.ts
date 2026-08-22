/**
 * The timezone the workspace reads and writes times in.
 *
 * Scheduled posts are stored as instants, but everything a user does with them
 * is wall-clock: they pick "2:00 PM" in a `datetime-local` input and expect the
 * post to go out at 2:00 PM where they live. Server rendering has no timezone
 * of its own beyond the host's — UTC on Netlify — so the same instant rendered
 * on the server and in the browser disagreed by the user's UTC offset, and a
 * time typed into a form was stored as if it had been typed in UTC.
 *
 * The browser reports its zone into a cookie (see `components/time-zone-sync`)
 * and every server render formats and parses through it. Before that cookie
 * exists the app falls back to UTC and says so, rather than showing a local
 * time it cannot know.
 */


export const TIME_ZONE_COOKIE = "jidoka_tz";
export const DEFAULT_TIME_ZONE = "UTC";

export function isValidTimeZone(value: string | null | undefined): boolean {
  const clean = (value ?? "").trim();
  if (!clean) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: clean });
    return true;
  } catch {
    return false;
  }
}

function partsIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    // Intl renders midnight as hour 24 in some locales/engines.
    hour: Number(lookup.hour) % 24,
    minute: Number(lookup.minute),
    second: Number(lookup.second),
  };
}

/** How far ahead of UTC `timeZone` is at this instant, in milliseconds. */
export function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const p = partsIn(date, timeZone);
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
    date.getTime()
  );
}

/**
 * Turn a `datetime-local` value ("2026-08-22T14:00") into the instant that
 * wall-clock time names in `timeZone`.
 *
 * The offset depends on the instant we are solving for, so this guesses with
 * the offset at the naive UTC reading and then re-solves once. That second
 * pass is what makes the hour either side of a DST change come out right.
 */
export function wallTimeToInstant(
  value: string,
  timeZone: string,
): Date | null {
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second = "0"] = match;
  const naive = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  if (!Number.isFinite(naive)) return null;

  const firstPass = new Date(naive - timeZoneOffsetMs(new Date(naive), timeZone));
  const settled = new Date(naive - timeZoneOffsetMs(firstPass, timeZone));
  if (Number.isNaN(settled.getTime())) return null;

  // On the spring-forward morning the requested wall time may not exist at
  // all. The second pass then lands an hour *before* what was asked for, which
  // for a scheduler means publishing early; the first pass lands after it.
  // Publishing late is the safer of the two, so prefer it.
  const requested = `${year}-${month}-${day}T${hour}:${minute}`;
  if (instantToWallTime(settled, timeZone) !== requested) {
    return Number.isNaN(firstPass.getTime()) ? null : firstPass;
  }
  return settled;
}

/** The `datetime-local` value that shows this instant as wall time in `timeZone`. */
export function instantToWallTime(
  value: string | Date | null | undefined,
  timeZone: string,
): string {
  const date = value instanceof Date ? value : new Date(value ?? "");
  if (!value || Number.isNaN(date.getTime())) return "";
  const p = partsIn(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** The calendar day an instant falls on in `timeZone`, as `YYYY-MM-DD`. */
export function instantToDayKey(
  value: string | Date | null | undefined,
  timeZone: string,
): string {
  return instantToWallTime(value, timeZone).slice(0, 10);
}

/**
 * Format an instant for display. Falls back to naming UTC explicitly so a
 * first render, before the browser has reported its zone, is never mistaken
 * for a local time.
 */
export function formatInstant(
  value: string | Date | null | undefined,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
): string {
  const date = value instanceof Date ? value : new Date(value ?? "");
  if (!value || Number.isNaN(date.getTime())) return "";
  const formatted = new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone,
  }).format(date);
  return timeZone === DEFAULT_TIME_ZONE ? `${formatted} UTC` : formatted;
}

/** Date only — no time, so no zone suffix is needed to read it correctly. */
export function formatInstantDate(
  value: string | Date | null | undefined,
  timeZone: string,
): string {
  const date = value instanceof Date ? value : new Date(value ?? "");
  if (!value || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
  }).format(date);
}
