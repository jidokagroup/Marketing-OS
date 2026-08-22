import assert from "node:assert/strict";
import {
  formatInstant,
  instantToHour,
  instantToDayKey,
  instantToWallTime,
  isValidTimeZone,
  timeZoneOffsetMs,
  wallTimeToInstant,
} from "../lib/time-format";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log("ok -", name);
}

const NY = "America/New_York";

check("EDT wall time maps to the right instant", () => {
  const instant = wallTimeToInstant("2026-08-22T14:00", NY);
  assert.equal(instant?.toISOString(), "2026-08-22T18:00:00.000Z");
});

check("EST wall time maps to the right instant", () => {
  const instant = wallTimeToInstant("2026-01-15T14:00", NY);
  assert.equal(instant?.toISOString(), "2026-01-15T19:00:00.000Z");
});

check("round trip is stable across DST", () => {
  for (const wall of [
    "2026-03-08T01:30",
    "2026-03-08T04:00",
    "2026-11-01T04:00",
    "2026-06-30T23:59",
  ]) {
    const instant = wallTimeToInstant(wall, NY);
    assert.ok(instant, `no instant for ${wall}`);
    assert.equal(instantToWallTime(instant, NY), wall, `round trip ${wall}`);
  }
});

check("a wall time that does not exist resolves forward, not back", () => {
  // 2:30 AM does not exist on 2026-03-08 in New York: the clock jumps 2 -> 3.
  // Landing on 3:30 EDT publishes late; landing on 1:30 EST would publish an
  // hour early, which is the worse failure for a scheduler.
  const instant = wallTimeToInstant("2026-03-08T02:30", NY);
  assert.equal(instant?.toISOString(), "2026-03-08T07:30:00.000Z");
});

check("an ambiguous wall time picks the first occurrence", () => {
  // 1:30 AM happens twice on 2026-11-01 in New York.
  const instant = wallTimeToInstant("2026-11-01T01:30", NY);
  assert.equal(instant?.toISOString(), "2026-11-01T05:30:00.000Z");
});

check("UTC is the identity", () => {
  assert.equal(
    wallTimeToInstant("2026-08-22T14:00", "UTC")?.toISOString(),
    "2026-08-22T14:00:00.000Z",
  );
});

check("offset is signed the way the name says", () => {
  // New York is behind UTC, so its offset from UTC is negative.
  assert.equal(timeZoneOffsetMs(new Date("2026-08-22T18:00:00Z"), NY), -4 * 3600_000);
  assert.equal(timeZoneOffsetMs(new Date("2026-01-15T19:00:00Z"), NY), -5 * 3600_000);
  assert.equal(timeZoneOffsetMs(new Date("2026-08-22T18:00:00Z"), "Asia/Tokyo"), 9 * 3600_000);
});

check("midnight does not render as hour 24", () => {
  assert.equal(instantToWallTime("2026-08-22T04:00:00Z", NY), "2026-08-22T00:00");
});

check("the day key follows the viewer's zone, not UTC", () => {
  // 1am UTC on the 23rd is still the evening of the 22nd in New York.
  assert.equal(instantToDayKey("2026-08-23T01:00:00Z", NY), "2026-08-22");
  assert.equal(instantToDayKey("2026-08-23T01:00:00Z", "UTC"), "2026-08-23");
});

check("a UTC render says so, a zoned render does not", () => {
  assert.match(formatInstant("2026-08-22T18:00:00Z", "UTC"), /UTC$/);
  const local = formatInstant("2026-08-22T18:00:00Z", NY);
  assert.equal(local, "Aug 22, 2026, 2:00 PM");
});

check("bad input is empty, not NaN", () => {
  assert.equal(formatInstant(null, NY), "");
  assert.equal(formatInstant("not a date", NY), "");
  assert.equal(instantToWallTime(undefined, NY), "");
  assert.equal(wallTimeToInstant("", NY), null);
  assert.equal(wallTimeToInstant("22/08/2026", NY), null);
});

check("timezone validation rejects junk", () => {
  assert.equal(isValidTimeZone(NY), true);
  assert.equal(isValidTimeZone("UTC"), true);
  assert.equal(isValidTimeZone("Mars/Olympus"), false);
  assert.equal(isValidTimeZone(""), false);
  assert.equal(isValidTimeZone(null), false);
});

check("the hour follows the viewer's zone, not the host's", () => {
  // The bug this exists for: an 8pm Eastern post was being reported as a
  // midnight post, so "best posting time" pointed at the wrong hour entirely.
  assert.equal(instantToHour("2026-08-23T00:30:00Z", NY), 20);
  assert.equal(instantToHour("2026-08-23T00:30:00Z", "UTC"), 0);
  assert.equal(instantToHour("2026-08-22T18:00:00Z", NY), 14);
});

check("midnight is hour 0, not 24", () => {
  assert.equal(instantToHour("2026-08-22T04:00:00Z", NY), 0);
});

check("an unreadable instant has no hour rather than a wrong one", () => {
  assert.equal(instantToHour(null, NY), null);
  assert.equal(instantToHour("not a date", NY), null);
  assert.equal(instantToHour(undefined, NY), null);
});

check("hour and day key agree with each other across the date line", () => {
  // A late-evening post must land on the evening's date and the evening's
  // hour, not split across two days.
  const instant = "2026-08-23T01:00:00Z";
  assert.equal(instantToDayKey(instant, NY), "2026-08-22");
  assert.equal(instantToHour(instant, NY), 21);
});

console.log(`\n${passed} timezone checks passed`);
