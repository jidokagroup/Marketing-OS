import assert from "node:assert/strict";
import {
  SCAN_STAGES,
  canCancel,
  canRetry,
  customerStatus,
  isTerminal,
  nextStage,
  percentComplete,
  resumeFrom,
} from "../lib/intelligence/stages";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log("ok -", name);
}

check("stages run in order and end after recommendations", () => {
  assert.equal(nextStage("queued"), "fetching");
  assert.equal(nextStage("analyzing"), "aggregating");
  assert.equal(nextStage("generating_recommendations"), null);
});

check("progress never sits at 0 while running, or 100 before finishing", () => {
  for (const stage of SCAN_STAGES) {
    const percent = percentComplete({ status: stage, current_stage: stage });
    assert.ok(percent >= 1, `${stage} showed ${percent}`);
    assert.ok(percent <= 99, `${stage} showed ${percent}`);
  }
  assert.equal(percentComplete({ status: "complete" }), 100);
});

check("progress only moves forward through the stages", () => {
  let previous = -1;
  for (const stage of SCAN_STAGES) {
    const percent = percentComplete({ status: stage, current_stage: stage });
    assert.ok(percent > previous, `${stage} did not advance the bar`);
    previous = percent;
  }
});

check("the bar moves with sources during the long stage", () => {
  const base = { status: "analyzing" as const, current_stage: "analyzing" as const, sources_total: 10 };
  const start = percentComplete({ ...base, sources_completed: 0 });
  const half = percentComplete({ ...base, sources_completed: 5 });
  const end = percentComplete({ ...base, sources_completed: 10 });
  assert.ok(start < half && half < end, `${start} / ${half} / ${end}`);
});

check("a failed source still counts as handled", () => {
  // Otherwise the bar stalls on a source that will never succeed.
  const stalled = percentComplete({
    status: "analyzing",
    current_stage: "analyzing",
    sources_total: 4,
    sources_completed: 2,
    sources_failed: 2,
  });
  const partial = percentComplete({
    status: "analyzing",
    current_stage: "analyzing",
    sources_total: 4,
    sources_completed: 2,
  });
  assert.ok(stalled > partial);
});

check("a retry resumes after the last finished stage, not from scratch", () => {
  // The point of staging: a scan that died writing recommendations must not
  // re-fetch every competitor site.
  assert.equal(resumeFrom({ status: "failed", last_completed_step: "aggregating" }), "generating_recommendations");
  assert.equal(resumeFrom({ status: "failed", last_completed_step: "fetching" }), "normalizing");
  assert.equal(resumeFrom({ status: "failed" }), "fetching");
});

check("a scan that got all the way through resumes at the last stage", () => {
  assert.equal(
    resumeFrom({ status: "failed", last_completed_step: "generating_recommendations" }),
    "generating_recommendations",
  );
});

check("terminal states are terminal", () => {
  for (const state of ["complete", "partial", "failed", "cancelled"]) {
    assert.equal(isTerminal(state), true, state);
    assert.equal(canCancel(state), false, state);
  }
  for (const stage of SCAN_STAGES) {
    assert.equal(isTerminal(stage), false, stage);
    assert.equal(canCancel(stage), true, stage);
  }
});

check("retry is offered exactly where it helps", () => {
  assert.equal(canRetry("failed"), true);
  assert.equal(canRetry("partial"), true);
  assert.equal(canRetry("cancelled"), true);
  assert.equal(canRetry("complete"), false);
  assert.equal(canRetry("analyzing"), false);
});

check("running states tell the user what is happening, never which function", () => {
  for (const stage of SCAN_STAGES) {
    const status = customerStatus({ status: stage, current_stage: stage, sources_total: 7 });
    assert.equal(status.tone, "working", stage);
    assert.ok(status.headline.trim().length > 0, stage);
    assert.ok(status.detail.trim().length > 0, stage);
    // No stage name, snake_case, or infrastructure words should reach the user.
    const text = `${status.headline} ${status.detail}`;
    assert.ok(!/_/.test(text), `underscore leaked in ${stage}: ${text}`);
    assert.ok(
      !/worker|lambda|function|timeout|token|claude|anthropic|api/i.test(text),
      `implementation detail leaked in ${stage}: ${text}`,
    );
  }
});

check("the analyzing headline counts sources the way a person would", () => {
  const status = customerStatus({
    status: "analyzing",
    current_stage: "analyzing",
    sources_total: 18,
    sources_completed: 6,
  });
  assert.equal(status.headline, "Analyzing 7 of 18 sources");
});

check("the count never overshoots the total on the last source", () => {
  const status = customerStatus({
    status: "analyzing",
    current_stage: "analyzing",
    sources_total: 3,
    sources_completed: 3,
  });
  assert.equal(status.headline, "Analyzing 3 of 3 sources");
});

check("a partial scan says what it did have, not just what it lost", () => {
  const status = customerStatus({
    status: "partial",
    sources_total: 9,
    sources_completed: 7,
    sources_failed: 2,
  });
  assert.equal(status.tone, "warning");
  assert.match(status.detail, /7 of 9/);
});

check("a failure offers the resume, and says the work is kept", () => {
  const status = customerStatus({ status: "failed", last_completed_step: "analyzing" });
  assert.equal(status.tone, "error");
  assert.match(status.detail, /retry from the last completed step/i);
  assert.match(status.detail, /kept/i);
});

check("a failure with nothing banked does not promise a resume", () => {
  const status = customerStatus({ status: "failed" });
  assert.match(status.detail, /Nothing was analyzed/);
});

check("singular and plural read correctly", () => {
  assert.match(customerStatus({ status: "fetching", sources_total: 1 }).headline, /1 source$/);
  assert.match(customerStatus({ status: "fetching", sources_total: 4 }).headline, /4 sources$/);
  assert.match(customerStatus({ status: "complete", sources_total: 1 }).detail, /1 source\./);
});

console.log(`\n${passed} checks passed`);
