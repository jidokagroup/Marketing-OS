import assert from "node:assert/strict";
import { groupKeyFor, publicationGroups } from "../lib/publication-group";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log("ok -", name);
}

const READY = ["instagram", "facebook", "youtube", "x"];
const AGENT = "a7cbc04b-e523-4ae5-996e-2ac993a85bf2";

function post(overrides: Record<string, unknown> = {}) {
  return {
    id: String(overrides.id ?? "p1"),
    agent_id: AGENT,
    title: "Launch reel",
    generated_content_id: "gc-1",
    platform: "instagram",
    content_type: "photo",
    status: "posted",
    caption: "Hello",
    media_path: "media/a.jpg",
    social_account_id: "acct-1",
    scheduled_time: "2026-08-22T18:00:00Z",
    external_post_id: "IG_1",
    error: null,
    ...overrides,
  };
}

check("the reported case: two platforms published, one failed, overall partial", () => {
  // Instagram: Published, LinkedIn: Published, YouTube: Failed → Partial.
  const groups = publicationGroups(
    [
      post({ id: "1", platform: "instagram" }),
      post({ id: "2", platform: "facebook", external_post_id: "FB_1" }),
      post({
        id: "3",
        platform: "youtube",
        content_type: "video",
        status: "failed",
        external_post_id: null,
        error: "YouTube Data API is disabled.",
      }),
    ],
    READY,
  );

  assert.equal(groups.length, 1, "three rows are one publication");
  assert.equal(groups[0].state, "partial");
  assert.match(groups[0].summary, /2 of 3/);
  assert.match(groups[0].summary, /the rest are unaffected/);
});

check("only the failed platform is offered for retry", () => {
  // Retrying the group would republish what already went out.
  const groups = publicationGroups(
    [
      post({ id: "1", platform: "instagram" }),
      post({ id: "2", platform: "youtube", content_type: "video", status: "failed", external_post_id: null }),
    ],
    READY,
  );
  assert.deepEqual(groups[0].retryable.map((p) => p.id), ["2"]);
});

check("a post blocked for missing media is not offered as retryable", () => {
  // Retry cannot fix it, so offering it teaches people the button does nothing.
  const groups = publicationGroups(
    [post({ id: "1", status: "scheduled", media_path: null, external_post_id: null })],
    READY,
  );
  assert.deepEqual(groups[0].retryable, []);
  assert.equal(groups[0].state, "blocked");
});

check("nothing is called published while a platform is still going out", () => {
  const groups = publicationGroups(
    [
      post({ id: "1", platform: "instagram" }),
      post({ id: "2", platform: "facebook", status: "posting", external_post_id: null }),
    ],
    READY,
  );
  assert.equal(groups[0].state, "publishing");
});

check("all platforms succeeding is published, all failing is failed", () => {
  const all = publicationGroups(
    [post({ id: "1" }), post({ id: "2", platform: "facebook", external_post_id: "FB_2" })],
    READY,
  );
  assert.equal(all[0].state, "published");
  assert.match(all[0].summary, /all 2 platforms/);

  const none = publicationGroups(
    [
      post({ id: "1", status: "failed", external_post_id: null }),
      post({ id: "2", platform: "facebook", status: "failed", external_post_id: null }),
    ],
    READY,
  );
  assert.equal(none[0].state, "failed");
  assert.match(none[0].summary, /None of the 2/);
});

check("a single failed platform reads as one failure, not none of one", () => {
  const groups = publicationGroups(
    [post({ id: "1", status: "failed", external_post_id: null })],
    READY,
  );
  assert.equal(groups[0].summary, "This didn't go through.");
});

check("rows are grouped by the piece they came from", () => {
  const groups = publicationGroups(
    [
      post({ id: "1", generated_content_id: "gc-1" }),
      post({ id: "2", generated_content_id: "gc-2", platform: "facebook" }),
    ],
    READY,
  );
  assert.equal(groups.length, 2);
});

check("rows with no generated piece fall back to title within one seat", () => {
  const a = groupKeyFor(post({ generated_content_id: null, title: "Launch reel" }) as never);
  const b = groupKeyFor(post({ generated_content_id: null, title: "  LAUNCH REEL " }) as never);
  const other = groupKeyFor(
    post({ generated_content_id: null, title: "Launch reel", agent_id: "other" }) as never,
  );
  assert.equal(a, b, "casing and spacing should not split a publication");
  assert.notEqual(a, other, "another seat's post is not the same publication");
});

check("group order follows the order rows arrived in", () => {
  const groups = publicationGroups(
    [
      post({ id: "1", generated_content_id: "gc-2", title: "Second" }),
      post({ id: "2", generated_content_id: "gc-1", title: "First" }),
    ],
    READY,
  );
  assert.deepEqual(groups.map((g) => g.title), ["Second", "First"]);
});

check("a platform this deployment cannot publish to is blocked, not failed", () => {
  // The YouTube case: connected, complete, but no credentials here.
  const groups = publicationGroups(
    [post({ id: "1", platform: "youtube", content_type: "video", status: "scheduled", external_post_id: null })],
    ["instagram"],
  );
  assert.equal(groups[0].state, "blocked");
});

check("every group says something specific about itself", () => {
  const groups = publicationGroups(
    [
      post({ id: "1" }),
      post({ id: "2", generated_content_id: "gc-2", status: "scheduled", external_post_id: null }),
      post({ id: "3", generated_content_id: "gc-3", status: "failed", external_post_id: null }),
    ],
    READY,
  );
  for (const group of groups) {
    assert.ok(group.summary.trim().length > 10, `${group.state} said little`);
    assert.ok(group.title.trim().length > 0);
    assert.ok(group.members.length > 0);
    assert.ok(group.members.every((m) => m.platformLabel.trim().length > 0));
  }
});

check("an untitled post still gets a readable name", () => {
  const groups = publicationGroups([post({ title: null })], READY);
  assert.equal(groups[0].title, "Untitled post");
});

console.log(`\n${passed} checks passed`);
