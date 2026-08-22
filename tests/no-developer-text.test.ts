/**
 * A rule rather than a function: nothing a customer can read may contain a
 * developer instruction. This is the check that keeps Priority 3 true after
 * the next feature lands, because the failure mode is somebody adding one
 * helpful-looking line six months from now.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log("ok -", name);
}

/** Files whose whole job is talking about this rule. */
const EXEMPT = [
  "components/error-notice.tsx",
  "components/ops-schema-notice.tsx",
];

function uiFiles(): string[] {
  return execSync(`find ${ROOT}/app ${ROOT}/components -name '*.tsx'`, {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)
    .filter((file) => !EXEMPT.some((exempt) => file.endsWith(exempt)));
}

/** Strips comments, so a note to the next engineer is not read as UI copy. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

check("no rendered string tells a customer to run a migration", () => {
  const offenders: string[] = [];
  for (const file of uiFiles()) {
    const source = withoutComments(readFileSync(file, "utf8"));
    if (/supabase\/migrations|needs migration|run (the |this )?migration|apply migration/i.test(source)) {
      offenders.push(file.replace(`${ROOT}/`, ""));
    }
  }
  assert.deepEqual(offenders, [], `migration instructions still shown in: ${offenders.join(", ")}`);
});

check("no rendered string names a .sql file or a Postgres error code", () => {
  const offenders: string[] = [];
  for (const file of uiFiles()) {
    const source = withoutComments(readFileSync(file, "utf8"));
    if (/\.sql\b|\b42P01\b|\b42703\b|\bPGRST\d+\b|\b22P02\b/i.test(source)) {
      offenders.push(file.replace(`${ROOT}/`, ""));
    }
  }
  assert.deepEqual(offenders, [], `database internals shown in: ${offenders.join(", ")}`);
});

check("no rendered string names an environment variable", () => {
  // Checked against the real names in .env.example rather than by shape:
  // matching SCREAMING_SNAKE would flag ordinary local constants, and a check
  // that cries wolf gets deleted.
  const names = readFileSync(`${ROOT}/.env.example`, "utf8")
    .split("\n")
    .map((line) => line.split("=")[0].trim())
    .filter((name) => /^[A-Z][A-Z0-9_]{4,}$/.test(name));
  assert.ok(names.length > 3, "expected .env.example to list real variables");

  const offenders: string[] = [];
  for (const file of uiFiles()) {
    const source = withoutComments(readFileSync(file, "utf8"));
    for (const name of names) {
      // `process.env.X` is code; the same name inside a quoted sentence is copy.
      const inProse = new RegExp(`["'\`][^"'\`]*\\s${name}\\b|\\b${name}\\b[^"'\`]*\\s[^"'\`]*["'\`]`);
      const withoutCodeRefs = source.replace(
        new RegExp(`process\\.env\\.${name}`, "g"),
        "",
      );
      if (inProse.test(withoutCodeRefs)) {
        offenders.push(`${file.replace(`${ROOT}/`, "")}: ${name}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `environment variables shown in: ${offenders.join(", ")}`);
});

check("every dashboard route is behind an error boundary", () => {
  // Without one, a thrown exception renders Next's own error page: nothing
  // useful for the customer, and nothing recorded for us. That is how an
  // "internal error" gets reported with no way to say what it was.
  const boundary = `${ROOT}/app/(dashboard)/error.tsx`;
  const source = readFileSync(boundary, "utf8");
  assert.match(source, /ErrorNotice/, "the boundary should use the shared notice");
  assert.match(source, /reset/, "the boundary should offer a retry");
  assert.match(source, /digest/, "the boundary should surface the support reference");
});

check("the boundary never renders the raw exception message", () => {
  const source = readFileSync(`${ROOT}/app/(dashboard)/error.tsx`, "utf8");
  const jsx = source.slice(source.indexOf("return ("));
  assert.ok(
    !/\{error\.message\}/.test(jsx),
    "the exception message must stay server-side, not render to the page",
  );
});

console.log(`\n${passed} checks passed`);
