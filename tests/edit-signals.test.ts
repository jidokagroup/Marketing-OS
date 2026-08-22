import assert from "node:assert/strict";

import {
  decodeEditSignal,
  describeEdit,
  encodeEditSignal,
  suggestedStatement,
} from "../lib/edit-signals";

const draft =
  "Unlock the game-changer strategy that transforms your coaching business. " +
  "This game-changer approach will unlock revenue you did not know existed.";

// A typo fix is not a preference.
{
  const signal = describeEdit(draft, draft.replace("existed", "existd"));
  assert.equal(signal.meaningful, false, "one-character change should not prompt");
}

// An identical save says nothing at all.
{
  const signal = describeEdit(draft, draft);
  assert.equal(signal.meaningful, false);
  assert.equal(signal.changedChars, 0);
  assert.deepEqual(signal.removedTerms, []);
}

// Striking the hype words out is exactly the signal worth surfacing.
{
  const edited =
    "Here is the pricing structure that works for coaching businesses. " +
    "It is a straightforward approach to revenue you can run this quarter.";
  const signal = describeEdit(draft, edited);
  assert.equal(signal.meaningful, true);
  assert.ok(signal.removedTerms.includes("game-changer"), signal.removedTerms.join(","));
  assert.ok(signal.removedTerms.includes("unlock"), signal.removedTerms.join(","));
  // Words still present must never be reported as removed.
  assert.ok(!signal.removedTerms.includes("revenue"));
  assert.ok(signal.addedTerms.includes("pricing"), signal.addedTerms.join(","));
}

// Stopwords are never a preference.
{
  const signal = describeEdit(
    "The team should review the report and then the plan before the meeting starts today.",
    "Review the report, then the plan, ahead of the meeting.",
  );
  for (const term of signal.removedTerms) {
    assert.ok(!["the", "and", "before", "should"].includes(term), `stopword surfaced: ${term}`);
  }
}

// The suggestion reads as a sentence a person would actually write.
{
  assert.equal(
    suggestedStatement({ meaningful: true, removedTerms: ["unlock"], addedTerms: [], changedChars: 50 }),
    'Do not use "unlock".',
  );
  assert.equal(
    suggestedStatement({
      meaningful: true,
      removedTerms: ["unlock", "game-changer"],
      addedTerms: [],
      changedChars: 50,
    }),
    'Do not use "unlock" or "game-changer".',
  );
  assert.equal(
    suggestedStatement({ meaningful: true, removedTerms: [], addedTerms: [], changedChars: 90 }),
    null,
    "no removed words means nothing to suggest",
  );
}

// The round trip through a URL keeps the terms and refuses to grow unbounded.
{
  const signal = describeEdit(draft, "Pricing structure for coaching businesses, run this quarter.");
  assert.deepEqual(decodeEditSignal(encodeEditSignal(signal)), signal.removedTerms);
  assert.deepEqual(decodeEditSignal(undefined), []);
  assert.deepEqual(decodeEditSignal(""), []);
  assert.equal(decodeEditSignal("a,b,c,d,e,f,g,h").length, 5, "caps what a crafted URL can inject");
  assert.equal(decodeEditSignal("x".repeat(200))[0].length, 40, "caps term length");
}

console.log("edit-signals: all assertions passed");
