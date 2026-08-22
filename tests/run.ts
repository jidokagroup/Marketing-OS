/**
 * Runs every `*.test.ts` in this directory in its own process.
 *
 * These are plain assertion scripts rather than a test framework: the parts of
 * this app that are worth pinning down are pure functions and one grep-based
 * rule, and none of that needs a runner. A failing file exits non-zero and
 * takes the whole run with it.
 */

import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here)
  .filter((name) => name.endsWith(".test.ts"))
  .sort();

let failed = 0;
for (const file of files) {
  console.log(`\n── ${file}`);
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", join(here, file)],
    { stdio: "inherit" },
  );
  if (result.status !== 0) failed += 1;
}

console.log(
  `\n${files.length - failed}/${files.length} test files passed`,
);
process.exit(failed === 0 ? 0 : 1);
