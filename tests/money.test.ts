import assert from "node:assert/strict";
import {
  campaignPipeline,
  campaignRevenue,
  campaignRoi,
  formatRoi,
} from "../lib/campaign-money";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log("ok -", name);
}

const CAMPAIGN = { id: "c1", budget: 1000, actual_spend: 200, attributed_revenue: 0 };

check("pipeline value is never counted as revenue", () => {
  // The reported bug: a $1 estimated lead showed as "Revenue $1".
  const leads = [{ estimated_value: 1 }];
  assert.equal(campaignPipeline(leads), 1);
  assert.equal(campaignRevenue(CAMPAIGN, []), 0);
});

check("a zero-dollar revenue event stays zero", () => {
  const events = [{ campaign_id: "c1", amount: 0, event_type: "deal_created" }];
  assert.equal(campaignRevenue(CAMPAIGN, events), 0);
});

check("revenue is attributed plus events", () => {
  const events = [
    { campaign_id: "c1", amount: 500, event_type: "deal_created" },
    { campaign_id: "c1", amount: 250, event_type: "deal_created" },
  ];
  assert.equal(
    campaignRevenue({ ...CAMPAIGN, attributed_revenue: 100 }, events),
    850,
  );
});

check("another campaign's events do not leak in", () => {
  const events = [{ campaign_id: "c2", amount: 999, event_type: "deal_created" }];
  assert.equal(campaignRevenue(CAMPAIGN, events), 0);
});

check("refunds come back out", () => {
  const events = [
    { campaign_id: "c1", amount: 500, event_type: "deal_created" },
    { campaign_id: "c1", amount: 200, event_type: "refund" },
    { campaign_id: "c1", amount: 50, event_type: "chargeback" },
  ];
  assert.equal(campaignRevenue(CAMPAIGN, events), 250);
});

check("an actual lead value supersedes its estimate", () => {
  const leads = [
    { estimated_value: 1000, actual_value: 400 },
    { estimated_value: 300 },
  ];
  assert.equal(campaignPipeline(leads), 700);
});

check("junk amounts do not become NaN", () => {
  assert.equal(
    campaignRevenue({ ...CAMPAIGN, attributed_revenue: "not a number" }, [
      { campaign_id: "c1", amount: null, event_type: "deal_created" },
    ]),
    0,
  );
  assert.equal(campaignPipeline([{ estimated_value: undefined }]), 0);
});

check("string amounts from postgres numeric are handled", () => {
  // Postgres numeric arrives over PostgREST as a string.
  const events = [{ campaign_id: "c1", amount: "125.50", event_type: "deal_created" }];
  assert.equal(campaignRevenue(CAMPAIGN, events), 125.5);
  assert.equal(campaignPipeline([{ estimated_value: "42" }]), 42);
});

check("ROI is undefined rather than infinite with no spend", () => {
  assert.equal(campaignRoi({ ...CAMPAIGN, actual_spend: 0 }, 500), null);
  assert.equal(formatRoi(null), "—");
  assert.equal(formatRoi(campaignRoi(CAMPAIGN, 500)), "2.5×");
});

console.log(`\n${passed} checks passed`);
