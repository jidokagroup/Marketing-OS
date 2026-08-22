import assert from "node:assert/strict";
import {
  SCAN_SECTION_GROUPS,
  SCAN_SYNTHESIS_FIELDS,
  buildScanContext,
  scanJsonSchema,
} from "../lib/ai/competitor-scan";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log("ok -", name);
}

const ALL_FIELDS = Object.keys(scanJsonSchema.properties);

check("the groups plus the synthesis cover the whole report exactly once", () => {
  // A field in no group would silently vanish from every report; a field in
  // two would be generated twice and the second would overwrite the first.
  const produced = [
    ...SCAN_SECTION_GROUPS.flatMap((group) => [...group.fields]),
    ...SCAN_SYNTHESIS_FIELDS,
  ];
  assert.equal(
    new Set(produced).size,
    produced.length,
    `a field appears in more than one group: ${produced.join(", ")}`,
  );
  assert.deepEqual(produced.slice().sort(), ALL_FIELDS.slice().sort());
});

check("no single call is asked for more than it used to fail at", () => {
  // The whole point of the split: the one call asked for 13 fields at 8000
  // tokens and truncated. Nothing here may drift back towards that.
  for (const group of SCAN_SECTION_GROUPS) {
    assert.ok(group.fields.length <= 4, `${group.key} asks for ${group.fields.length} fields`);
    assert.ok(group.maxTokens <= 3500, `${group.key} budget is ${group.maxTokens}`);
  }
  assert.ok(SCAN_SYNTHESIS_FIELDS.length <= 5);
});

check("every group has a token budget proportional to what it asks for", () => {
  for (const group of SCAN_SECTION_GROUPS) {
    const perField = group.maxTokens / group.fields.length;
    assert.ok(perField >= 750, `${group.key} allows only ${Math.round(perField)} tokens per field`);
  }
});

check("each group names its own fields in its instruction", () => {
  // Guards against a group's prompt and schema drifting apart, which would ask
  // the model for one thing and validate another.
  for (const group of SCAN_SECTION_GROUPS) {
    for (const field of group.fields) {
      assert.ok(
        group.instruction.includes(field),
        `${group.key} does not mention ${field}`,
      );
    }
  }
});

check("a group never mentions a field it does not own", () => {
  for (const group of SCAN_SECTION_GROUPS) {
    const foreign = ALL_FIELDS.filter(
      (field) =>
        !(group.fields as readonly string[]).includes(field) &&
        group.instruction.includes(field),
    );
    assert.deepEqual(foreign, [], `${group.key} also instructs on ${foreign.join(", ")}`);
  }
});

check("context assembly survives a client with nothing filled in", () => {
  const context = buildScanContext({
    client: null as never,
    websites: ["https://a.example"],
    excerpts: [],
  });
  assert.match(context.clientBlock, /no specific client/i);
  // No sites fetched must not produce an empty prompt block.
  assert.match(context.competitorBlock, /https:\/\/a\.example/);
  assert.equal(context.audioBlock, "");
  assert.equal(context.gapBlock, "");
});

check("only sites that actually returned text become research material", () => {
  const context = buildScanContext({
    client: { name: "Crystal", industry: "fitness", notes: null, trending_audio_notes: null } as never,
    websites: ["https://a.example", "https://b.example"],
    excerpts: [
      { url: "https://a.example", text: "real content" },
      { url: "https://b.example", text: "" },
    ],
  });
  assert.match(context.competitorBlock, /a\.example/);
  assert.ok(!context.competitorBlock.includes("b.example"));
  assert.match(context.clientBlock, /Crystal/);
});

check("accounts with no execution data are named, not guessed at", () => {
  const context = buildScanContext({
    client: { name: "Crystal", industry: null, notes: null, trending_audio_notes: null } as never,
    websites: [],
    excerpts: [],
    executionGaps: [{ url: "https://c.example", reason: "no public API" }],
  });
  assert.match(context.gapBlock, /c\.example/);
  assert.match(context.gapBlock, /no public API/);
  assert.match(context.gapBlock, /rather than guessing/i);
});

check("strategist audio notes are marked as first-party, not inferred", () => {
  const context = buildScanContext({
    client: {
      name: "Crystal",
      industry: null,
      notes: null,
      trending_audio_notes: "  slowed remixes trending  ",
    } as never,
    websites: [],
    excerpts: [],
  });
  assert.match(context.audioBlock, /slowed remixes trending/);
  assert.match(context.audioBlock, /first-party/i);
});

console.log(`\n${passed} checks passed`);
