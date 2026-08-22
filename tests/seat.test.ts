import assert from "node:assert/strict";
import {
  parseSeatCookie,
  seatCookieValue,
  seatId,
} from "../lib/seat-cookie";
import { publishBlockers } from "../lib/social/platforms";
import { scanState } from "../lib/intelligence-scan";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log("ok -", name);
}

const CRYSTAL = "a7cbc04b-e523-4ae5-996e-2ac993a85bf2";
const CLIENT = "785bb8ef-8239-4767-b36b-78c02c0b3f91";

check("only a real id counts as a seat", () => {
  assert.equal(seatId(CRYSTAL), CRYSTAL);
  assert.equal(seatId(CRYSTAL.toUpperCase()), CRYSTAL.toUpperCase());
  assert.equal(seatId("all"), null);
  assert.equal(seatId(""), null);
  assert.equal(seatId("  "), null);
  assert.equal(seatId(undefined), null);
  assert.equal(seatId("JidokaTest"), null);
});

check("the cookie survives the browser's encoding", () => {
  const written = encodeURIComponent(seatCookieValue(CRYSTAL, CLIENT));
  assert.ok(written.includes("%7C"), "separator should be encoded in transit");
  assert.deepEqual(parseSeatCookie(written), {
    agentId: CRYSTAL,
    clientId: CLIENT,
  });
});

check("a seat with no client round trips", () => {
  const written = encodeURIComponent(seatCookieValue(CRYSTAL, null));
  assert.deepEqual(parseSeatCookie(written), {
    agentId: CRYSTAL,
    clientId: null,
  });
});

check("a malformed cookie is no cookie, not a crash", () => {
  assert.deepEqual(parseSeatCookie("%E0%A4%A"), { agentId: null, clientId: null });
  assert.deepEqual(parseSeatCookie(""), { agentId: null, clientId: null });
  assert.deepEqual(parseSeatCookie(undefined), { agentId: null, clientId: null });
  assert.deepEqual(parseSeatCookie("JidokaTest|nope"), {
    agentId: null,
    clientId: null,
  });
});

const READY = {
  platform: "instagram",
  content_type: "photo",
  caption: "Hello",
  media_path: "media/abc.jpg",
  social_account_id: "acct-1",
};

check("a publishable post has nothing blocking it", () => {
  assert.deepEqual(publishBlockers(READY), []);
});

check("missing media blocks scheduling", () => {
  const blockers = publishBlockers({ ...READY, media_path: null });
  assert.equal(blockers.length, 1);
  assert.match(blockers[0], /media/i);
});

check("a disconnected account and a blank caption both block", () => {
  const blockers = publishBlockers({
    ...READY,
    social_account_id: null,
    caption: "   ",
  });
  assert.equal(blockers.length, 2);
});

check("an unsupported content type is the whole answer", () => {
  // Nothing the user attaches makes a LinkedIn post auto-publishable, so
  // listing media and caption alongside it would be misleading advice.
  const blockers = publishBlockers({
    platform: "linkedin",
    content_type: "photo",
    caption: null,
    media_path: null,
    social_account_id: null,
  });
  assert.equal(blockers.length, 1);
  assert.match(blockers[0], /not live yet/i);
});

check("email campaigns are never auto-published", () => {
  const blockers = publishBlockers({
    platform: "mailchimp",
    content_type: "email_campaign",
    caption: "Body",
    media_path: null,
    social_account_id: "acct-1",
  });
  assert.equal(blockers.length, 1);
  assert.match(blockers[0], /not live yet/i);
});

const minutesAgo = (n: number) =>
  new Date(Date.now() - n * 60 * 1000).toISOString();

check("a fresh queued scan is pending, an old one is stranded", () => {
  assert.equal(
    scanState({ status: "queued", requested_at: minutesAgo(3) }),
    "pending",
  );
  assert.equal(
    scanState({ status: "running", requested_at: minutesAgo(7) }),
    "pending",
  );
  assert.equal(
    scanState({ status: "running", requested_at: minutesAgo(20) }),
    "stranded",
  );
});

check("terminal scan states are reported as themselves", () => {
  assert.equal(scanState({ status: "complete" }), "complete");
  assert.equal(scanState({ status: "failed" }), "failed");
  assert.equal(scanState(null), "none");
  // A pending row with no timestamp cannot be aged, so it stays pending
  // rather than being declared dead on no evidence.
  assert.equal(scanState({ status: "queued" }), "pending");
});

console.log(`\n${passed} checks passed`);
