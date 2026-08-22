/**
 * How much of a Core agent has actually been trained.
 *
 * A training row is created as soon as the Core page is saved, even with every
 * field left blank, so "a row exists" is not the same as "this agent knows
 * anything". Reporting those two as the same thing told users their Core
 * agents were trained when nothing had been entered.
 */

export type CoreTrainingFields = {
  training_data: Record<string, unknown> | null;
  operating_rules: string | null;
  approval_rules: string | null;
  handoff_rules: string | null;
  data_sources: string | null;
};

export type CoreTrainingState = "untrained" | "partial" | "trained";

const RULE_FIELDS = [
  "operating_rules",
  "approval_rules",
  "handoff_rules",
  "data_sources",
] as const;

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

/** The five signals that make up a fully trained Core agent. */
export function coreTrainingSignals(row: CoreTrainingFields | null | undefined) {
  const filled = RULE_FIELDS.filter((field) => hasText(row?.[field])).length;
  const hasContext = Object.values(row?.training_data ?? {}).some(hasText);
  return { filled: filled + (hasContext ? 1 : 0), total: RULE_FIELDS.length + 1 };
}

export function coreTrainingState(
  row: CoreTrainingFields | null | undefined,
): CoreTrainingState {
  if (!row) return "untrained";
  const { filled, total } = coreTrainingSignals(row);
  if (filled === 0) return "untrained";
  return filled === total ? "trained" : "partial";
}

export function coreTrainingLabel(row: CoreTrainingFields | null | undefined) {
  const state = coreTrainingState(row);
  if (state === "trained") return "Trained";
  if (state === "untrained") return "Needs training";
  const { filled, total } = coreTrainingSignals(row);
  return `Partly trained · ${filled}/${total}`;
}
