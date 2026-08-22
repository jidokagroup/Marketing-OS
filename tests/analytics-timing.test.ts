import assert from "node:assert/strict";
import { summariseTiming } from "../lib/analytics-timing";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log("ok -", name);
}

const NY = "America/New_York";

/** A row as the importer writes it: correct instant, UTC-derived columns. */
function row(postedAt: string, metrics: Record<string, number> = {}) {
  const posted = new Date(postedAt);
  return {
    posted_time: postedAt,
    date: posted.toISOString().slice(0, 10),
    hour: posted.getUTCHours(),
    reach: 100,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    engagement_score: 0,
    ...metrics,
  };
}

check("the best hour is the audience's hour, not the host's", () => {
  // Three posts at 8pm Eastern, which is midnight UTC the next day. Reading
  // the stored column would report 0:00; the audience was there at 20:00.
  const rows = [
    row("2026-08-21T00:00:00Z", { engagement_score: 90 }),
    row("2026-08-22T00:00:00Z", { engagement_score: 95 }),
    row("2026-08-23T00:00:00Z", { engagement_score: 100 }),
    row("2026-08-22T14:00:00Z", { engagement_score: 10 }),
  ];
  assert.equal(summariseTiming(rows, NY).bestHour?.hour, "20:00");
  assert.equal(summariseTiming(rows, "UTC").bestHour?.hour, "0:00");
});

check("a late-evening post is charted on the evening it happened", () => {
  // 00:30 UTC on the 23rd is 8:30pm on the 22nd in New York. Filing it under
  // the 23rd moved a day's engagement onto the wrong day.
  const { overTime } = summariseTiming(
    [row("2026-08-23T00:30:00Z", { likes: 40 })],
    NY,
  );
  assert.equal(overTime.length, 1);
  assert.equal(overTime[0].date, "08-22");
  assert.equal(summariseTiming([row("2026-08-23T00:30:00Z", { likes: 40 })], "UTC").overTime[0].date, "08-23");
});

check("posts in the same local hour on different days are one bucket", () => {
  const rows = [
    row("2026-08-21T18:00:00Z", { engagement_score: 10 }),
    row("2026-08-22T18:00:00Z", { engagement_score: 30 }),
  ];
  const { byHour } = summariseTiming(rows, NY);
  assert.equal(byHour.length, 1);
  assert.equal(byHour[0].hour, "14:00");
  // Averaged, not summed: two posts at 10 and 30 is a 20 hour, not a 40 hour.
  assert.equal(byHour[0].engagement, 20);
});

check("an average stops one freak post outranking a reliable hour", () => {
  const rows = [
    // 9am local, consistently decent.
    row("2026-08-20T13:00:00Z", { engagement_score: 50 }),
    row("2026-08-21T13:00:00Z", { engagement_score: 50 }),
    row("2026-08-22T13:00:00Z", { engagement_score: 50 }),
    // 3am local, one viral outlier and one dud.
    row("2026-08-20T07:00:00Z", { engagement_score: 200 }),
    row("2026-08-21T07:00:00Z", { engagement_score: 0 }),
  ];
  const { bestHour } = summariseTiming(rows, NY);
  // 3am averages 100 and still wins here — which is correct arithmetic, and
  // exactly why the page states how the number is derived rather than
  // presenting it as advice.
  assert.equal(bestHour?.hour, "3:00");
  assert.equal(bestHour?.engagement, 100);
  // ...and the count travels with it, so the page can say the 100 is drawn
  // from two posts rather than presenting it as a settled fact.
  assert.equal(bestHour?.posts, 2);
});

check("the sample size behind the best hour is reported", () => {
  const rows = [
    row("2026-08-20T18:00:00Z", { engagement_score: 40 }),
    row("2026-08-21T18:00:00Z", { engagement_score: 60 }),
    row("2026-08-22T18:00:00Z", { engagement_score: 50 }),
  ];
  assert.equal(summariseTiming(rows, NY).bestHour?.posts, 3);
  assert.equal(summariseTiming([row("2026-08-20T18:00:00Z", { likes: 1 })], NY).bestHour?.posts, 1);
});

check("hours are ordered by clock, not by score", () => {
  const rows = [
    row("2026-08-22T22:00:00Z", { engagement_score: 5 }),
    row("2026-08-22T13:00:00Z", { engagement_score: 90 }),
  ];
  const hours = summariseTiming(rows, NY).byHour.map((h) => h.hour);
  assert.deepEqual(hours, ["9:00", "18:00"]);
});

check("rows with no instant fall back to their stored columns", () => {
  const legacy = {
    posted_time: null,
    date: "2026-08-22",
    hour: 15,
    likes: 5,
    engagement_score: 42,
  };
  const { bestHour, overTime } = summariseTiming([legacy], NY);
  assert.equal(bestHour?.hour, "15:00");
  assert.equal(overTime[0].date, "08-22");
});

check("a row with neither an instant nor columns is skipped, not counted as zero", () => {
  const { byHour, overTime, bestHour } = summariseTiming(
    [{ posted_time: null, date: null, hour: null, likes: 9 }],
    NY,
  );
  assert.deepEqual(byHour, []);
  assert.deepEqual(overTime, []);
  assert.equal(bestHour, null);
});

check("no rows gives no best hour rather than a made-up one", () => {
  const summary = summariseTiming([], NY);
  assert.equal(summary.bestHour, null);
  assert.deepEqual(summary.byHour, []);
  assert.deepEqual(summary.overTime, []);
});

check("engagement falls back to raw interactions when no score was stored", () => {
  const legacy = {
    posted_time: "2026-08-22T18:00:00Z",
    likes: 3,
    comments: 2,
    shares: 1,
    saves: 4,
  };
  assert.equal(summariseTiming([legacy], NY).bestHour?.engagement, 10);
});

check("daily reach and engagement add up across posts", () => {
  const rows = [
    row("2026-08-22T14:00:00Z", { reach: 100, likes: 5 }),
    row("2026-08-22T16:00:00Z", { reach: 250, likes: 7, comments: 3 }),
  ];
  const [day] = summariseTiming(rows, NY).overTime;
  assert.equal(day.reach, 350);
  assert.equal(day.engagement, 15);
});

console.log(`\n${passed} checks passed`);
