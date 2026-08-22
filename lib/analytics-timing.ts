/**
 * When a seat's audience actually shows up.
 *
 * Analytics rows carry `date` and `hour` columns, but both were written from
 * whichever machine ran the import — UTC on Netlify — so an 8pm Eastern post
 * was filed as a midnight post on the following day. That put "best posting
 * time" hours away from the truth and shifted the engagement chart by a day at
 * every late-evening post.
 *
 * The row also carries `posted_time`, which is a real instant and therefore
 * unambiguous. Everything here is derived from that in the viewer's zone, so
 * the answer is right for rows written before the columns were fixed as well
 * as after — which no amount of correcting the writer would have achieved.
 */

import { instantToDayKey, instantToHour } from "@/lib/time-format";

export type TimingRow = {
  posted_time?: string | null;
  /** Fallbacks for rows old enough to predate `posted_time`. */
  date?: string | null;
  hour?: number | null;
  reach?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  engagement_score?: number | null;
};

export type TimingSummary = {
  /** Average engagement per hour of the day, ascending by hour. */
  byHour: { hour: string; engagement: number }[];
  /**
   * The hour with the highest average engagement, or null with no data.
   * `posts` is how many posts that average is drawn from — an hour with one
   * post in it is that post, and a "best time" nobody can weigh is the kind
   * of confident-looking number that stops being believed.
   */
  bestHour: { hour: string; engagement: number; posts: number } | null;
  /** Reach and engagement per day, ascending by date. */
  overTime: { date: string; reach: number; engagement: number }[];
};

function interactions(row: TimingRow) {
  return (
    (row.likes ?? 0) + (row.comments ?? 0) + (row.shares ?? 0) + (row.saves ?? 0)
  );
}

export function summariseTiming(
  rows: TimingRow[],
  timeZone: string,
): TimingSummary {
  const byDay = new Map<string, { reach: number; engagement: number }>();
  const byHour = new Map<number, { sum: number; n: number }>();

  for (const row of rows) {
    const engagement = interactions(row);
    const day = instantToDayKey(row.posted_time, timeZone) || row.date;
    const hour = instantToHour(row.posted_time, timeZone) ?? row.hour;

    if (day) {
      const current = byDay.get(day) ?? { reach: 0, engagement: 0 };
      current.reach += row.reach ?? 0;
      current.engagement += engagement;
      byDay.set(day, current);
    }

    if (hour != null) {
      const current = byHour.get(hour) ?? { sum: 0, n: 0 };
      // `engagement_score` is what the importer computed; fall back to the raw
      // interaction count for rows that predate it.
      current.sum += row.engagement_score ?? engagement;
      current.n += 1;
      byHour.set(hour, current);
    }
  }

  const hours = [...byHour.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, value]) => ({
      hour: `${hour}:00`,
      engagement: Math.round(value.sum / value.n),
      posts: value.n,
    }));

  return {
    byHour: hours.map(({ hour, engagement }) => ({ hour, engagement })),
    // An average rather than a total, so a busy hour cannot win on volume
    // alone — but two posts still average, so the count travels with it.
    bestHour:
      hours.slice().sort((a, b) => b.engagement - a.engagement)[0] ?? null,
    overTime: [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({
        date: date.slice(5),
        reach: value.reach,
        engagement: value.engagement,
      })),
  };
}
