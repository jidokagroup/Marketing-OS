import assert from "node:assert/strict";
import { postLifecycle } from "../lib/scheduler-lifecycle";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log("ok -", name);
}

const READY = ["instagram", "facebook", "youtube", "x"];
const base = {
  status: "draft",
  platform: "instagram",
  content_type: "photo",
  caption: "Hello",
  media_path: "media/a.jpg",
  social_account_id: "acct-1",
  scheduled_time: "2026-08-22T18:00:00Z",
  error: null,
};

check("a complete draft with a time is ready to schedule", () => {
  const view = postLifecycle(base, READY);
  assert.equal(view.state, "ready_to_schedule");
  assert.equal(view.canAutoPublish, true);
});

check("a complete draft with no time is a draft", () => {
  const view = postLifecycle({ ...base, scheduled_time: null }, READY);
  assert.equal(view.state, "draft");
});

check("a scheduled post with no media is not scheduled", () => {
  // The stored status says scheduled; the publisher would reject it. The
  // second fact is the one the user needs.
  const view = postLifecycle(
    { ...base, status: "scheduled", media_path: null },
    READY,
  );
  assert.equal(view.state, "needs_media");
  assert.equal(view.canAutoPublish, false);
});

check("a scheduled and complete post is scheduled", () => {
  const view = postLifecycle({ ...base, status: "scheduled" }, READY);
  assert.equal(view.state, "scheduled");
  assert.equal(view.canAutoPublish, true);
});

check("a platform with no credentials is blocked, not ready", () => {
  // This is the YouTube case: the account is connected and the post is
  // complete, but the deployment cannot publish to it.
  const view = postLifecycle(
    { ...base, platform: "youtube", content_type: "video", status: "scheduled" },
    ["instagram", "facebook"],
  );
  assert.equal(view.state, "blocked_connection");
  assert.equal(view.canAutoPublish, false);
  assert.match(view.detail, /YouTube/);
});

check("a disconnected account outranks a missing caption", () => {
  const view = postLifecycle(
    { ...base, social_account_id: null, caption: null },
    READY,
  );
  assert.equal(view.state, "blocked_connection");
});

check("a platform with no live publisher is manual only", () => {
  const view = postLifecycle(
    {
      ...base,
      platform: "mailchimp",
      content_type: "email_campaign",
      status: "scheduled",
    },
    READY,
  );
  assert.equal(view.state, "manual_only");
  assert.equal(view.canAutoPublish, false);
});

check("terminal states win over everything", () => {
  assert.equal(postLifecycle({ ...base, status: "posted" }, []).state, "posted");
  assert.equal(
    postLifecycle({ ...base, status: "posting" }, []).state,
    "publishing",
  );
  const failed = postLifecycle(
    { ...base, status: "failed", error: "YouTube Data API is disabled." },
    READY,
  );
  assert.equal(failed.state, "failed");
  assert.equal(failed.detail, "YouTube Data API is disabled.");
});

check("a missing caption is its own state, not needs_media", () => {
  const view = postLifecycle({ ...base, caption: "  " }, READY);
  assert.equal(view.state, "needs_caption");
});

check("every state carries something to act on", () => {
  for (const post of [
    base,
    { ...base, status: "scheduled" },
    { ...base, media_path: null },
    { ...base, caption: null },
    { ...base, social_account_id: null },
    { ...base, status: "posted" },
    { ...base, status: "failed", error: null },
  ]) {
    const view = postLifecycle(post, READY);
    assert.ok(view.detail.trim().length > 0, `empty detail for ${view.state}`);
    assert.ok(view.label.trim().length > 0, `empty label for ${view.state}`);
  }
});

console.log(`\n${passed} checks passed`);
