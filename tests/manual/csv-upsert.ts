/**
 * NOT part of `npm test` — needs a local Postgres, so it would either fail or
 * silently skip on a machine without one, and a check that silently skips is
 * worse than no check. Run it by hand when touching the import path; the
 * header below says what it needs.
 *
 * Proves the claim the import panel makes: "importing the same export twice
 * updates those posts rather than duplicating them."
 *
 * The hazard is specific — the unique key is (owner_id, platform, post_id) and
 * Postgres treats NULL post ids as distinct, so an export with no id column
 * would insert a fresh copy of every row on every import. This runs the real
 * parser and the real synthetic-id function against a real Postgres with the
 * real constraint.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { parseAnalyticsCsv, syntheticPostId } from "../../lib/analytics-csv";

const PGDIR = "/var/tmp/jidokapg2";
const OWNER = "11111111-1111-1111-1111-111111111111";
const AGENT = "a7cbc04b-e523-4ae5-996e-2ac993a85bf2";

function sql(statement: string): string {
  return execFileSync(
    "psql",
    ["-h", PGDIR, "-p", "55433", "-U", "postgres", "-d", "jidoka", "-At", "-v", "ON_ERROR_STOP=1", "-c", statement],
    { encoding: "utf8" },
  ).trim();
}

function literal(value: string | number | null): string {
  if (value === null) return "null";
  if (typeof value === "number") return String(value);
  return `'${value.replace(/'/g, "''")}'`;
}

/** Mirrors the upsert the server action performs. */
function importCsv(text: string, platform: string) {
  const parsed = parseAnalyticsCsv(text);
  for (const row of parsed.rows) {
    const postId = row.postId ?? syntheticPostId(row);
    const engagement = row.likes + row.comments + row.shares + row.saves;
    sql(`
      insert into public.marketing_os_platform_analytics
        (agent_id, owner_id, platform, post_id, title, caption, posted_time, date,
         views, impressions, reach, likes, comments, shares, saves, engagement_score)
      values (${literal(AGENT)}, ${literal(OWNER)}, ${literal(platform)}, ${literal(postId)},
              ${literal(row.caption)}, ${literal(row.caption)}, ${literal(row.postedAt)},
              ${literal(row.postedAt.slice(0, 10))},
              ${row.views}, ${row.impressions}, ${row.reach}, ${row.likes},
              ${row.comments}, ${row.shares}, ${row.saves}, ${engagement})
      on conflict (owner_id, platform, post_id) do update set
        title = excluded.title, caption = excluded.caption,
        posted_time = excluded.posted_time, date = excluded.date,
        views = excluded.views, impressions = excluded.impressions,
        reach = excluded.reach, likes = excluded.likes,
        comments = excluded.comments, shares = excluded.shares,
        saves = excluded.saves, engagement_score = excluded.engagement_score
    `);
  }
  return parsed;
}

const count = () =>
  Number(sql("select count(*) from public.marketing_os_platform_analytics"));

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log("ok -", name);
}

// An export with no id column at all — the case the synthetic id exists for.
const NO_ID_CSV = [
  "Date,Post title,Video views,Likes,Comments",
  "2026-08-20,Morning routine,1200,80,4",
  "2026-08-21,Studio tour,900,55,2",
  "2026-08-22,Client story,2400,190,17",
].join("\n");

check("a first import stores every usable row", () => {
  const parsed = importCsv(NO_ID_CSV, "tiktok");
  assert.equal(parsed.rows.length, 3);
  assert.equal(count(), 3);
});

check("re-importing the same export does not duplicate it", () => {
  importCsv(NO_ID_CSV, "tiktok");
  assert.equal(count(), 3, "a second import should update, not insert");
});

check("a corrected export updates the row in place", () => {
  const corrected = NO_ID_CSV.replace(
    "2026-08-22,Client story,2400,190,17",
    "2026-08-22,Client story,2400,190,23",
  );
  importCsv(corrected, "tiktok");
  // The comment count moved, so the row was rewritten rather than added...
  assert.equal(
    sql("select comments from public.marketing_os_platform_analytics where caption = 'Client story'"),
    "23",
  );
  // ...and the corrected row replaced the old one instead of joining it.
  assert.equal(count(), 3);
});

check("the same file under a different platform is separate history", () => {
  importCsv(NO_ID_CSV, "linkedin");
  assert.equal(count(), 6);
  assert.equal(
    sql("select count(*) from public.marketing_os_platform_analytics where platform = 'tiktok'"),
    "3",
  );
});

check("an export that does carry post ids uses them", () => {
  const withIds = [
    "Date,Permalink,Likes",
    "2026-08-23,https://example.com/p/aaa,10",
    "2026-08-24,https://example.com/p/bbb,20",
  ].join("\n");
  importCsv(withIds, "instagram");
  importCsv(withIds, "instagram");
  assert.equal(
    sql("select count(*) from public.marketing_os_platform_analytics where platform = 'instagram'"),
    "2",
  );
  assert.equal(
    sql("select post_id from public.marketing_os_platform_analytics where platform = 'instagram' order by date limit 1"),
    "https://example.com/p/aaa",
  );
});

check("skipped rows never reach the table", () => {
  const before = count();
  const parsed = importCsv(
    ["Date,Likes", "not a date,5", "2026-08-25,0"].join("\n"),
    "tiktok",
  );
  assert.equal(parsed.rows.length, 0);
  assert.equal(parsed.errors.length, 2);
  assert.equal(count(), before);
});

console.log(`\n${passed} checks passed against a real Postgres constraint`);
