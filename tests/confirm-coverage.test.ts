/**
 * Guards the safety rule rather than a function: every form that runs a
 * destructive or outward-facing action must go through ConfirmSubmitButton.
 * A plain submit next to one of these actions is the failure mode, and it is
 * the kind that reappears whenever someone adds a button in a hurry.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

// Actions that change something irreversibly or reach outside the app.
const GUARDED_ACTIONS = [
  "deleteClientAction",
  "deleteAgentAction",
  "deletePostAction",
  "deleteGeneratedContentAction",
  "deleteAssetAction",
  "disconnectSocialAction",
  "scheduleAction",
  "unscheduleAction",
  "startCheckoutAction",
];

const files = execSync(
  `grep -rl "ConfirmSubmitButton\\|${GUARDED_ACTIONS.join("\\|")}" ${ROOT}/app ${ROOT}/components --include=*.tsx`,
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log("ok -", name);
}

check("every guarded action sits in a form that confirms", () => {
  const offenders: string[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    // Split into <form ...> blocks and check the ones bound to a guarded action.
    const forms = source.split(/<form\b/).slice(1);
    for (const form of forms) {
      const block = form.split("</form>")[0];
      const action = GUARDED_ACTIONS.find((name) =>
        block.includes(`action={${name}}`),
      );
      if (!action) continue;
      // A form may legitimately hold a non-destructive submit alongside the
      // confirmed one (Save draft time next to Schedule), so the rule is that
      // a confirm is present, not that nothing else is.
      if (!block.includes("ConfirmSubmitButton")) {
        offenders.push(`${file.replace(`${ROOT}/`, "")} → ${action}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `these forms run a guarded action with no confirmation:\n  ${offenders.join("\n  ")}`,
  );
});

check("the confirm component still submits through a real submit button", () => {
  // The dialog renders in a portal, outside the form. If this hidden button
  // ever stops being type=submit, every confirmation silently does nothing.
  const source = readFileSync(`${ROOT}/components/confirm-submit-button.tsx`, "utf8");
  assert.match(source, /ref=\{submitRef\}/);
  assert.match(source, /type="submit"/);
  assert.match(source, /submitRef\.current\?\.click\(\)/);
});

check("cancel is the default, and it changes nothing", () => {
  const source = readFileSync(`${ROOT}/components/confirm-submit-button.tsx`, "utf8");
  // Cancel only closes; it must never touch the submit ref.
  const cancel = source.slice(source.indexOf("{cancelLabel}") - 260, source.indexOf("{cancelLabel}"));
  assert.ok(cancel.includes("setOpen(false)"), "cancel should close the dialog");
  assert.ok(!cancel.includes("submitRef"), "cancel must not submit");
});

console.log(`\n${passed} checks passed over ${files.length} files`);
