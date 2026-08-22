import assert from "node:assert/strict";
import {
  classifyError,
  internalErrorRecord,
  toCustomerError,
  type ErrorCategory,
} from "../lib/errors";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log("ok -", name);
}

const ALL: ErrorCategory[] = [
  "temporary_service",
  "connection_required",
  "permission_required",
  "setup_incomplete",
  "provider_unavailable",
  "invalid_input",
  "partial_completion",
  "unknown",
];

check("the real errors this app produces land in the right category", () => {
  const cases: [unknown, ErrorCategory][] = [
    // The ones that were being printed as migration instructions.
    [{ code: "42P01", message: 'relation "marketing_os_leads" does not exist' }, "setup_incomplete"],
    [{ code: "42703", message: 'column "outreach_stage" does not exist' }, "setup_incomplete"],
    [{ code: "PGRST205", message: "Could not find the table in the schema cache" }, "setup_incomplete"],
    [new Error("SUPABASE_SERVICE_ROLE_KEY is not set"), "setup_incomplete"],
    // The YouTube case from the audit.
    [new Error("YouTube Data API has not been used in project 123 or it is disabled"), "provider_unavailable"],
    [{ status: 429, message: "rate limit exceeded" }, "provider_unavailable"],
    // RLS refusing a cross-owner write.
    [{ code: "42501", message: "new row violates row-level security policy" }, "permission_required"],
    // The uuid bug that cost a whole debugging session.
    [{ code: "22P02", message: 'invalid input syntax for type uuid: "JidokaTest"' }, "invalid_input"],
    [{ code: "23505", message: "duplicate key value violates unique constraint" }, "invalid_input"],
    [new Error("The stored token could not be read. Reconnect this account."), "connection_required"],
    [new Error("fetch failed"), "temporary_service"],
    [new Error("The operation was aborted due to timeout"), "temporary_service"],
  ];

  for (const [error, expected] of cases) {
    assert.equal(
      classifyError(error),
      expected,
      `${JSON.stringify(error instanceof Error ? error.message : error)} → ${classifyError(error)}`,
    );
  }
});

check("a permission denial is not mistaken for missing setup", () => {
  // Both mention the same table. Reading it the wrong way round sends someone
  // to fix a schema that is perfectly fine.
  assert.equal(
    classifyError({
      code: "42501",
      message: 'permission denied for table marketing_os_leads',
    }),
    "permission_required",
  );
});

check("nothing recognisable is unknown, not a wrong guess", () => {
  assert.equal(classifyError(null), "unknown");
  assert.equal(classifyError(undefined), "unknown");
  assert.equal(classifyError(""), "unknown");
  assert.equal(classifyError({}), "unknown");
  assert.equal(classifyError(new Error("something bizarre happened")), "unknown");
});

check("every category explains itself and suggests one next thing", () => {
  for (const category of ALL) {
    const shown = toCustomerError(null, { category });
    assert.ok(shown.headline.trim().length > 0, category);
    assert.ok(shown.explanation.trim().length > 10, category);
    assert.ok(shown.nextAction.trim().length > 10, category);
  }
});

check("no customer-facing text names a system, a file or a code", () => {
  // This is the rule the whole module exists to enforce. Anything matching
  // here would be a developer instruction reaching a paying user.
  const banned =
    /migration|supabase|postgres|sql|\.ts\b|\.sql\b|api key|env|environment variable|stack|exception|null|undefined|42P01|PGRST|function invocation/i;

  for (const category of ALL) {
    const shown = toCustomerError(new Error("relation does not exist"), { category });
    const text = `${shown.headline} ${shown.explanation} ${shown.nextAction}`;
    assert.ok(!banned.test(text), `${category} leaked: ${text}`);
  }
});

check("the headline names the user's task, not the subsystem", () => {
  const shown = toCustomerError(new Error("fetch failed"), { action: "load Pipeline" });
  assert.equal(shown.headline, "We couldn't load Pipeline");
  assert.equal(shown.retryable, true);
});

check("setup and permission headlines read correctly with an action", () => {
  const setup = toCustomerError({ code: "42P01" }, { action: "Revenue attribution" });
  assert.match(setup.headline, /isn't switched on for this workspace yet/);

  const denied = toCustomerError({ code: "42501" }, { action: "Team settings" });
  assert.match(denied.headline, /don't have access to team settings/i);
});

check("retryable is only true where retrying could actually work", () => {
  // Offering Retry on a missing table trains people to click it pointlessly.
  assert.equal(toCustomerError(null, { category: "setup_incomplete" }).retryable, false);
  assert.equal(toCustomerError(null, { category: "permission_required" }).retryable, false);
  assert.equal(toCustomerError(null, { category: "connection_required" }).retryable, false);
  assert.equal(toCustomerError(null, { category: "temporary_service" }).retryable, true);
  assert.equal(toCustomerError(null, { category: "provider_unavailable" }).retryable, true);
});

check("the things a user cannot fix alone say to ask someone who can", () => {
  assert.equal(toCustomerError(null, { category: "setup_incomplete" }).needsAdministrator, true);
  assert.equal(toCustomerError(null, { category: "permission_required" }).needsAdministrator, true);
  assert.equal(toCustomerError(null, { category: "invalid_input" }).needsAdministrator, false);
});

check("the internal record keeps everything the UI throws away", () => {
  const error = Object.assign(new Error("relation does not exist"), { code: "42P01" });
  const record = internalErrorRecord(error, { route: "/pipeline", ownerId: "abc" });

  assert.equal(record.route, "/pipeline");
  assert.equal(record.ownerId, "abc");
  assert.equal(record.category, "setup_incomplete");
  const detail = record.error as { message: string; stack?: string };
  assert.equal(detail.message, "relation does not exist");
  assert.ok(detail.stack, "the stack is the part an engineer needs");
  assert.ok(typeof record.at === "string");
});

check("a non-Error thrown value is still recorded rather than lost", () => {
  assert.equal((internalErrorRecord("just a string").error as { message: string }).message, "just a string");
  assert.equal(
    (internalErrorRecord({ code: "PGRST205", message: "no table" }).error as { code: string }).code,
    "PGRST205",
  );
});

console.log(`\n${passed} checks passed`);
