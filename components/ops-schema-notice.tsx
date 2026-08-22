import { ErrorNotice } from "@/components/error-notice";

/**
 * Shown where a feature's tables are not in the database yet.
 *
 * This used to print the migration filename and tell the reader to run it.
 * That is an instruction for whoever deploys the app, not for the marketing
 * manager looking at the screen — and it reads as a broken product rather than
 * an unfinished setup. The filename now lives in the deployment checklist,
 * where the person who can act on it will look.
 *
 * The `migrationPath` prop is still accepted so existing call sites keep
 * working, and is deliberately ignored.
 */
export function OpsSchemaNotice({
  feature,
  title,
}: {
  /** What is unavailable, in the user's words, e.g. "Revenue attribution". */
  feature?: string;
  /** Legacy prop from when this named a migration. Used only as a fallback. */
  title?: string;
  migrationPath?: string;
}) {
  return (
    <ErrorNotice
      category="setup_incomplete"
      action={feature ?? deriveFeature(title)}
    />
  );
}

/**
 * Older call sites pass strings like "Pipeline needs migration 0016". Take the
 * part before "needs" as the feature name so nothing has to be migrated in
 * lockstep, and never let the rest of it through.
 */
function deriveFeature(title?: string): string | undefined {
  if (!title) return undefined;
  const [feature] = title.split(/\s+needs?\s+/i);
  return feature?.trim() || undefined;
}
