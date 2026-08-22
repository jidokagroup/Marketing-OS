import assert from "node:assert/strict";
import {
  parseAnalyticsCsv,
  parseCsv,
  syntheticPostId,
} from "../lib/analytics-csv";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log("ok -", name);
}

check("a caption containing commas stays one field", () => {
  // The reason this is a real parser: splitting on commas turns one post into
  // several unusable rows.
  const table = parseCsv('date,caption\n2026-08-22,"Hello, world, again"\n');
  assert.deepEqual(table[1], ["2026-08-22", "Hello, world, again"]);
});

check("escaped quotes and newlines inside a field survive", () => {
  const table = parseCsv('date,caption\n2026-08-22,"She said ""hi""\nthen left"\n');
  assert.equal(table[1][1], 'She said "hi"\nthen left');
  assert.equal(table.length, 2);
});

check("CRLF files do not produce blank rows", () => {
  const table = parseCsv("date,likes\r\n2026-08-22,5\r\n2026-08-23,6\r\n");
  assert.equal(table.length, 3);
});

check("an Excel byte order mark does not break the first column", () => {
  const result = parseAnalyticsCsv("﻿Date,Likes\n2026-08-22,5\n");
  assert.equal(result.errors.length, 0);
  assert.equal(result.rows.length, 1);
});

check("header names are matched however the export spells them", () => {
  const result = parseAnalyticsCsv(
    "Publish time,Video title,Video views,Likes,Comments added\n2026-08-22,Launch,1200,45,3\n",
  );
  assert.equal(result.errors.length, 0);
  const [row] = result.rows;
  assert.equal(row.caption, "Launch");
  assert.equal(row.views, 1200);
  assert.equal(row.likes, 45);
  assert.equal(row.comments, 3);
});

check("thousands separators and K/M suffixes are read as numbers", () => {
  const result = parseAnalyticsCsv(
    "date,views,likes,shares\n2026-08-22,\"12,400\",1.2K,3M\n",
  );
  const [row] = result.rows;
  assert.equal(row.views, 12400);
  assert.equal(row.likes, 1200);
  assert.equal(row.shares, 3_000_000);
});

check("ISO and US dates are both accepted", () => {
  const iso = parseAnalyticsCsv("date,likes\n2026-08-22T14:30:00Z,5\n");
  assert.equal(iso.rows[0].postedAt, "2026-08-22T14:30:00.000Z");
  const us = parseAnalyticsCsv("date,likes\n8/22/2026,5\n");
  assert.equal(us.rows[0].postedAt.slice(0, 10), "2026-08-22");
});

check("an ambiguous day-first date is refused, not guessed", () => {
  // 22/08/2026 is unambiguous, but guessing it would mean guessing 08/09/2026
  // too, and importing half a year against the wrong dates is worse than
  // refusing the row.
  const result = parseAnalyticsCsv("date,likes\n22/08/2026,5\n");
  assert.equal(result.rows.length, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].reason, /YYYY-MM-DD/);
  assert.equal(result.errors[0].line, 2);
});

check("a row with no usable metric is reported, not stored as zeroes", () => {
  const result = parseAnalyticsCsv("date,views,likes\n2026-08-22,0,0\n2026-08-23,,\n");
  assert.equal(result.rows.length, 0);
  assert.equal(result.errors.length, 2);
  assert.match(result.errors[0].reason, /nothing to import/);
});

check("a file with no date column fails with the fix in the message", () => {
  const result = parseAnalyticsCsv("post,likes\nHello,5\n");
  assert.equal(result.rows.length, 0);
  assert.match(result.errors[0].reason, /No date column/);
  assert.match(result.errors[0].reason, /date/);
});

check("an empty file is an error, not an empty success", () => {
  const result = parseAnalyticsCsv("");
  assert.equal(result.rows.length, 0);
  assert.equal(result.errors.length, 1);
});

check("good rows import even when neighbours are broken", () => {
  const result = parseAnalyticsCsv(
    [
      "date,caption,likes",
      "2026-08-22,Good,10",
      "not a date,Broken,10",
      "2026-08-24,Also good,20",
    ].join("\n"),
  );
  assert.equal(result.rows.length, 2);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].line, 3);
});

check("unrecognised columns are named rather than silently dropped", () => {
  const result = parseAnalyticsCsv("date,likes,Sentiment score\n2026-08-22,5,0.9\n");
  assert.deepEqual(result.ignoredColumns, ["Sentiment score"]);
});

check("the same row always gets the same synthetic id", () => {
  const row = { postedAt: "2026-08-22T00:00:00.000Z", caption: "Launch", views: 10, likes: 2 };
  assert.equal(syntheticPostId(row), syntheticPostId({ ...row }));
  assert.match(syntheticPostId(row), /^csv:2026-08-22:/);
});

check("different rows get different synthetic ids", () => {
  const base = { postedAt: "2026-08-22T00:00:00.000Z", caption: "Launch", views: 10, likes: 2 };
  assert.notEqual(syntheticPostId(base), syntheticPostId({ ...base, caption: "Other" }));
  assert.notEqual(syntheticPostId(base), syntheticPostId({ ...base, views: 11 }));
});

console.log(`\n${passed} checks passed`);
