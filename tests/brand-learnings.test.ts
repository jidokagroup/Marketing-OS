import assert from "node:assert/strict";
import {
  buildLearningsBrief,
  confidenceBand,
  confidenceFor,
  confidenceLabel,
  isSameLearning,
  mergeLearning,
  originForSource,
  type BrandLearning,
} from "../lib/brand-learnings";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log("ok -", name);
}

function learning(overrides: Partial<BrandLearning> = {}): BrandLearning {
  return {
    id: "l1",
    statement: "Never use emojis in captions",
    kind: "emoji",
    source: "client_edit",
    origin: "manual",
    confidence: 0.9,
    supporting_examples: 4,
    active: true,
    learned_at: "2026-08-22T00:00:00Z",
    ...overrides,
  };
}

check("performance and human sources are told apart", () => {
  assert.equal(originForSource("client_edit"), "manual");
  assert.equal(originForSource("manual"), "manual");
  assert.equal(originForSource("publishing_performance"), "performance");
  assert.equal(originForSource("revenue_attribution"), "performance");
  assert.equal(originForSource("performance_intelligence"), "performance");
});

check("confidence grows with evidence but never reaches certainty", () => {
  const one = confidenceFor("user_edit", 1);
  const four = confidenceFor("user_edit", 4);
  const forty = confidenceFor("user_edit", 40);
  assert.ok(one < four && four < forty, `${one} / ${four} / ${forty}`);
  assert.ok(forty < 1, "nothing learned from evidence should be certain");
});

check("most of what evidence tells you arrives early", () => {
  // The gap from 1 to 4 examples should dwarf the gap from 20 to 40, or the
  // scale is just counting rather than saying anything.
  const early = confidenceFor("user_edit", 4) - confidenceFor("user_edit", 1);
  const late = confidenceFor("user_edit", 40) - confidenceFor("user_edit", 20);
  assert.ok(early > late * 3, `early ${early.toFixed(2)} vs late ${late.toFixed(2)}`);
});

check("a stated preference starts high without needing evidence", () => {
  // Someone typing a rule is stating it, not providing a data point for it.
  assert.ok(confidenceFor("manual", 1) >= 0.9);
  assert.ok(confidenceFor("manual", 1) > confidenceFor("user_edit", 1));
});

check("one observation is never dressed up as established", () => {
  assert.equal(confidenceBand(confidenceFor("publishing_performance", 1)), "observed");
  assert.match(confidenceLabel({ confidence: 0.4, supporting_examples: 1 }), /Observed once · 1 example/);
  assert.match(confidenceLabel({ confidence: 0.9, supporting_examples: 12 }), /Established · 12 examples/);
});

check("the prompt separates settled rules from mere tendencies", () => {
  // Fifteen equally-worded rules make a model write like a compliance
  // document. The split is what keeps the output sounding like the client.
  const brief = buildLearningsBrief([
    learning({ id: "a", statement: "Never use emojis", confidence: 0.92 }),
    learning({ id: "b", statement: "Prefers short CTAs", confidence: 0.5, supporting_examples: 2 }),
  ]);
  assert.match(brief, /Never use emojis/);
  assert.match(brief, /Prefers short CTAs/);
  assert.match(brief, /Follow these/);
  assert.match(brief, /patterns, not rules/);
  // The weak one must carry its evidence so the model can weigh it.
  assert.match(brief, /Prefers short CTAs \(2 examples\)/);
});

check("an inactive learning does not reach the model", () => {
  const brief = buildLearningsBrief([
    learning({ id: "a", statement: "Turned off rule", active: false }),
  ]);
  assert.equal(brief, "", "an archived learning should stop steering the writing");
});

check("nothing to say produces nothing, not an empty heading", () => {
  assert.equal(buildLearningsBrief([]), "");
});

check("only the strongest learnings are sent when there are many", () => {
  const many = Array.from({ length: 40 }, (_, i) =>
    learning({ id: `l${i}`, statement: `Rule ${i}`, confidence: i / 100 }),
  );
  const brief = buildLearningsBrief(many);
  const bullets = brief.split("\n").filter((line) => line.startsWith("- "));
  assert.ok(bullets.length <= 24, `sent ${bullets.length}`);
  // The highest-confidence one must survive the cut; the weakest must not.
  assert.match(brief, /Rule 39/);
  assert.ok(!brief.includes("Rule 0\n") && !/- Rule 0\b/.test(brief));
});

check("the same lesson spelled differently is the same lesson", () => {
  assert.equal(isSameLearning("Never use emojis", "never   USE emojis  "), true);
  assert.equal(isSameLearning("Never use emojis", "Never use emoji"), false);
});

check("learning something twice accumulates evidence rather than duplicating", () => {
  const merged = mergeLearning(
    { source: "user_edit", supporting_examples: 3, confidence: 0.6 },
    { source: "user_edit", supporting_examples: 1 },
  );
  assert.equal(merged.supporting_examples, 4);
  assert.ok(merged.confidence > 0.6, "more evidence should raise confidence");
});

check("a stated preference is not downgraded by a later weak signal", () => {
  const merged = mergeLearning(
    { source: "manual", supporting_examples: 1, confidence: 0.9 },
    { source: "publishing_performance", supporting_examples: 1 },
  );
  assert.equal(merged.source, "manual");
  assert.equal(merged.origin, "manual");
  assert.ok(merged.confidence >= 0.9);
});

check("the brief reads as instructions to a writer, not as data", () => {
  const brief = buildLearningsBrief([learning()]);
  assert.ok(!/confidence|0\.\d|kind:|source:/i.test(brief), `leaked internals: ${brief}`);
});

console.log(`\n${passed} checks passed`);
