/**
 * How much of a Core agent has actually been trained.
 *
 * A training row is created the first time the Core page is saved, even with
 * every field left blank, so "a row exists" is not the same as "this agent
 * knows anything". Reporting those two as the same thing told users their Core
 * agents were trained when nothing had been entered — the kind of false
 * confidence that makes every other readout suspect.
 */

export type CoreTrainingFields = {
  training_data: Record<string, unknown> | null;
  operating_rules: string | null;
  approval_rules: string | null;
  handoff_rules: string | null;
  data_sources: string | null;
};

export type CoreTrainingState =
  | "not_started"
  | "needs_training"
  | "memory_only"
  | "partial"
  | "trained";

export const CORE_RULE_FIELDS = [
  { key: "operating_rules", label: "Operating rules" },
  { key: "approval_rules", label: "Approval rules" },
  { key: "handoff_rules", label: "Handoff rules" },
  { key: "data_sources", label: "Data sources" },
] as const;

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

/** The five signals that make up a fully trained Core agent. */
export function coreTrainingSignals(row: CoreTrainingFields | null | undefined) {
  const filled = CORE_RULE_FIELDS.filter((field) =>
    hasText(row?.[field.key]),
  ).length;
  const hasContext = Object.values(row?.training_data ?? {}).some(hasText);
  return {
    filled: filled + (hasContext ? 1 : 0),
    total: CORE_RULE_FIELDS.length + 1,
  };
}

/** Which named parts are still empty, for a page that shows what is missing. */
export function coreTrainingGaps(
  row: CoreTrainingFields | null | undefined,
): string[] {
  const gaps: string[] = CORE_RULE_FIELDS.filter(
    (field) => !hasText(row?.[field.key]),
  ).map((field) => field.label);
  if (!Object.values(row?.training_data ?? {}).some(hasText)) {
    gaps.unshift("Training context");
  }
  return gaps;
}

export function coreTrainingState(
  row: CoreTrainingFields | null | undefined,
  memoryCount = 0,
): CoreTrainingState {
  if (!row) return memoryCount > 0 ? "memory_only" : "not_started";

  const { filled, total } = coreTrainingSignals(row);
  if (filled === 0) return memoryCount > 0 ? "memory_only" : "needs_training";
  return filled === total ? "trained" : "partial";
}

export function coreTrainingLabel(
  row: CoreTrainingFields | null | undefined,
  memoryCount = 0,
) {
  const state = coreTrainingState(row, memoryCount);
  if (state === "not_started") return "Not started";
  if (state === "needs_training") return "Needs training";
  if (state === "memory_only") return "Has memory, needs training";

  const { filled, total } = coreTrainingSignals(row);
  if (state === "partial") return `Partly trained · ${filled}/${total}`;
  return memoryCount > 0 ? "Trained · has memory" : "Trained";
}
