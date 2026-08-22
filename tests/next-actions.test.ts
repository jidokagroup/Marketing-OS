import assert from "node:assert/strict";
import { nextBestActions } from "../lib/next-actions";
import { postLifecycle } from "../lib/scheduler-lifecycle";
import { seatReadiness, readinessSummary } from "../lib/seat-readiness";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log("ok -", name);
}

const READY_PLATFORMS = ["instagram", "facebook", "youtube", "x"];
const AGENT = "a7cbc04b-e523-4ae5-996e-2ac993a85bf2";

function post(overrides: Record<string, unknown> = {}) {
  const row = {
    status: "scheduled",
    platform: "instagram",
    content_type: "photo",
    caption: "Hello",
    media_path: "media/a.jpg",
    social_account_id: "acct-1",
    scheduled_time: "2026-08-22T18:00:00Z",
    error: null,
    ...overrides,
  };
  return {
    id: String(overrides.id ?? "p1"),
    title: (overrides.title as string) ?? "QA post",
    platform: row.platform,
    lifecycle: postLifecycle(row, READY_PLATFORMS),
  };
}

const EMPTY = {
  posts: [],
  campaigns: [],
  leadsAwaitingFirstTouch: 0,
  inboxNeedsReview: 0,
  latestScan: null,
  hasVoiceDna: true,
  agentId: AGENT,
  analyticsRows: 10,
};

check("a fully set up seat with nothing pending gets no busywork", () => {
  assert.deepEqual(nextBestActions(EMPTY), []);
});

check("a blocked post is named, not counted", () => {
  const actions = nextBestActions({
    ...EMPTY,
    posts: [post({ media_path: null, title: "Crystal launch reel" })],
  });
  const blocked = actions.find((action) => action.key === "posts-blocked");
  assert.ok(blocked, "expected a blocked-post action");
  assert.match(blocked.headline, /Crystal launch reel/);
  assert.match(blocked.headline, /Instagram/);
  assert.match(blocked.headline, /media/i);
  assert.equal(blocked.href, "/scheduler");
});

check("an untrained agent outranks everything else", () => {
  const actions = nextBestActions({
    ...EMPTY,
    hasVoiceDna: false,
    inboxNeedsReview: 5,
    posts: [post({ media_path: null })],
  });
  assert.equal(actions[0].key, "voice-dna");
  assert.equal(actions[0].urgency, "critical");
});

check("a failed publish outranks a blocked draft", () => {
  const actions = nextBestActions({
    ...EMPTY,
    posts: [
      post({ id: "p1", media_path: null }),
      post({ id: "p2", status: "failed", error: "YouTube API disabled." }),
    ],
  });
  assert.equal(actions[0].key, "posts-failed");
  assert.equal(actions[1].key, "posts-blocked");
});

check("pipeline with no revenue reads as the gap it is", () => {
  const actions = nextBestActions({
    ...EMPTY,
    campaigns: [
      {
        id: "c1",
        name: "QA TEST campaign",
        stage: "work",
        generatedCount: 3,
        workCount: 1,
        leadCount: 2,
        pipelineValue: 2,
        revenue: 0,
      },
    ],
  });
  const action = actions.find((item) => item.key === "campaign-pipeline");
  assert.ok(action);
  assert.match(action.headline, /QA TEST campaign/);
  assert.match(action.headline, /2 leads/);
  assert.match(action.headline, /no revenue attributed/);
  assert.equal(action.href, "/campaigns/c1");
});

check("a campaign with revenue is not nagged about pipeline", () => {
  const actions = nextBestActions({
    ...EMPTY,
    campaigns: [
      {
        id: "c1",
        name: "Winner",
        stage: "work",
        generatedCount: 2,
        workCount: 1,
        leadCount: 4,
        pipelineValue: 900,
        revenue: 500,
      },
    ],
  });
  assert.equal(
    actions.find((item) => item.key === "campaign-pipeline"),
    undefined,
  );
});

check("a stalled scan becomes an action, a healthy one does not", () => {
  const stale = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const stranded = nextBestActions({
    ...EMPTY,
    latestScan: { status: "running", requested_at: stale },
  });
  assert.ok(stranded.find((item) => item.key === "scan"));

  const done = nextBestActions({
    ...EMPTY,
    latestScan: { status: "complete", scanned_at: stale },
  });
  assert.equal(done.find((item) => item.key === "scan"), undefined);
});

check("every action links somewhere and says what to do", () => {
  const actions = nextBestActions({
    ...EMPTY,
    hasVoiceDna: false,
    analyticsRows: 0,
    inboxNeedsReview: 2,
    leadsAwaitingFirstTouch: 3,
    posts: [post({ media_path: null })],
    campaigns: [
      {
        id: "c1",
        name: "Empty campaign",
        stage: "strategy",
        generatedCount: 0,
        workCount: 0,
        leadCount: 0,
        pipelineValue: 0,
        revenue: 0,
      },
    ],
  });
  assert.ok(actions.length >= 6);
  for (const action of actions) {
    assert.ok(action.href.startsWith("/"), `bad href on ${action.key}`);
    assert.ok(action.actionLabel.trim(), `no label on ${action.key}`);
    assert.ok(action.headline.trim().length > 20, `thin headline on ${action.key}`);
  }
});

const READINESS = {
  agentId: AGENT,
  clientId: "785bb8ef-8239-4767-b36b-78c02c0b3f91",
  agentName: "Crystal Jr",
  hasVoiceDna: true,
  connectedPlatforms: ["instagram", "facebook"],
  publishReadyPlatforms: READY_PLATFORMS,
  coreTraining: [
    {
      row: {
        training_data: { a: "x" },
        operating_rules: "a",
        approval_rules: "b",
        handoff_rules: "c",
        data_sources: "d",
      },
      memoryCount: 0,
    },
  ],
  analyticsRows: 40,
  publishableposts: 2,
  blockedPosts: 0,
  moderatorEnabled: true,
  inboxNeedsReview: 0,
  billingStatus: "active",
};

check("a ready seat reports ready across the board", () => {
  const items = seatReadiness(READINESS);
  const summary = readinessSummary(items);
  assert.equal(summary.blocked, 0);
  assert.equal(summary.ready, summary.total);
});

check("connected but unpublishable is not reported as ready", () => {
  // The YouTube case: the account is connected, the deployment cannot publish.
  const items = seatReadiness({
    ...READINESS,
    connectedPlatforms: ["youtube"],
    publishReadyPlatforms: [],
  });
  const publishing = items.find((item) => item.key === "publishing");
  assert.equal(publishing?.state, "blocked");
  assert.match(publishing.detail, /YouTube/);
});

check("no Voice DNA blocks the seat and points at the fix", () => {
  const items = seatReadiness({ ...READINESS, hasVoiceDna: false });
  const voice = items.find((item) => item.key === "voice");
  assert.equal(voice?.state, "blocked");
  assert.ok(voice.href.includes(AGENT));
});

check("blank Core training is not counted as trained", () => {
  const items = seatReadiness({
    ...READINESS,
    coreTraining: [
      {
        row: {
          training_data: {},
          operating_rules: null,
          approval_rules: null,
          handoff_rules: null,
          data_sources: null,
        },
        memoryCount: 0,
      },
    ],
  });
  const core = items.find((item) => item.key === "core");
  assert.notEqual(core?.state, "ready");
});

check("billing is omitted entirely when the app has no billing", () => {
  const items = seatReadiness({ ...READINESS, billingStatus: null });
  assert.equal(items.find((item) => item.key === "billing"), undefined);
});

check("every readiness item links somewhere and explains itself", () => {
  for (const input of [
    READINESS,
    { ...READINESS, hasVoiceDna: false, connectedPlatforms: [], analyticsRows: 0 },
    { ...READINESS, inboxNeedsReview: 3, moderatorEnabled: false },
  ]) {
    for (const item of seatReadiness(input)) {
      assert.ok(item.href.startsWith("/"), `bad href on ${item.key}`);
      assert.ok(item.detail.trim().length > 10, `thin detail on ${item.key}`);
      assert.ok(item.actionLabel.trim(), `no label on ${item.key}`);
    }
  }
});

console.log(`\n${passed} checks passed`);
