import assert from "node:assert/strict";
import {
  coreTrainingGaps,
  coreTrainingLabel,
  coreTrainingSignals,
  coreTrainingState,
} from "../lib/core-training";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log("ok -", name);
}

const BLANK = {
  training_data: {},
  operating_rules: null,
  approval_rules: null,
  handoff_rules: null,
  data_sources: null,
};

check("no row at all is not started", () => {
  assert.equal(coreTrainingState(null), "not_started");
  assert.equal(coreTrainingLabel(null), "Not started");
});

check("saving blank training does not mark an agent trained", () => {
  // This is the reported bug: the row exists because Save was pressed, and
  // every field is still empty.
  assert.equal(coreTrainingState(BLANK), "needs_training");
  assert.equal(coreTrainingLabel(BLANK), "Needs training");
});

check("saving real training does mark progress", () => {
  const saved = { ...BLANK, operating_rules: "Ship weekly." };
  assert.equal(coreTrainingState(saved), "partial");
  assert.equal(coreTrainingLabel(saved), "Partly trained · 1/5");
});

check("whitespace is not training", () => {
  assert.equal(coreTrainingState({ ...BLANK, approval_rules: "   " }), "needs_training");
  assert.equal(
    coreTrainingState({ ...BLANK, training_data: { focus: "\n\t " } }),
    "needs_training",
  );
});

check("memory alone is its own state", () => {
  assert.equal(coreTrainingState(BLANK, 3), "memory_only");
  assert.equal(coreTrainingLabel(BLANK, 3), "Has memory, needs training");
  assert.equal(coreTrainingState(null, 3), "memory_only");
});

check("every field filled is trained, and memory is noted", () => {
  const full = {
    training_data: { focus: "growth" },
    operating_rules: "a",
    approval_rules: "b",
    handoff_rules: "c",
    data_sources: "d",
  };
  assert.equal(coreTrainingState(full), "trained");
  assert.equal(coreTrainingLabel(full), "Trained");
  assert.equal(coreTrainingLabel(full, 2), "Trained · has memory");
  assert.deepEqual(coreTrainingGaps(full), []);
});

check("gaps name what is missing", () => {
  assert.deepEqual(coreTrainingGaps(BLANK), [
    "Training context",
    "Operating rules",
    "Approval rules",
    "Handoff rules",
    "Data sources",
  ]);
  assert.deepEqual(coreTrainingGaps({ ...BLANK, handoff_rules: "x" }), [
    "Training context",
    "Operating rules",
    "Approval rules",
    "Data sources",
  ]);
});

check("gaps and filled signals always account for the whole agent", () => {
  for (const row of [
    BLANK,
    { ...BLANK, operating_rules: "a" },
    { ...BLANK, training_data: { focus: "x" }, data_sources: "y" },
  ]) {
    const { filled, total } = coreTrainingSignals(row);
    assert.equal(coreTrainingGaps(row).length + filled, total);
  }
});

console.log(`\n${passed} checks passed`);
