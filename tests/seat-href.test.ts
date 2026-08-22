import assert from "node:assert/strict";
import { seatScopedHref } from "../lib/seat-cookie";

const seatHref = (href: string, agentId: string, clientId: string) =>
  seatScopedHref(href, agentId, clientId);

const A = "a7cbc04b-e523-4ae5-996e-2ac993a85bf2";
const C = "785bb8ef-8239-4767-b36b-78c02c0b3f91";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log("ok -", name);
}

check("a bare nav link picks up the seat", () => {
  assert.equal(seatHref("/analytics", A, C), `/analytics?agent_id=${A}&client=${C}`);
});

check("existing params survive", () => {
  assert.equal(
    seatHref("/settings?tab=automations", A, C),
    `/settings?tab=automations&agent_id=${A}&client=${C}`,
  );
});

check("an href that names its own seat is not overridden", () => {
  const other = "11111111-1111-1111-1111-111111111111";
  assert.equal(
    seatHref(`/generated?agent_id=${other}`, A, C),
    `/generated?agent_id=${other}&client=${C}`,
  );
});

check("no seat means the link is left alone", () => {
  assert.equal(seatHref("/analytics", "", ""), "/analytics");
});

check("an agent with no client only carries the agent", () => {
  assert.equal(seatHref("/inbox", A, ""), `/inbox?agent_id=${A}`);
});

console.log(`\n${passed} checks passed`);
