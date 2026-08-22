/**
 * One vocabulary for everything that can go wrong, in two registers.
 *
 * The app had been showing people its own implementation: migration filenames,
 * Postgres error codes, provider messages, "function invocation failed". None
 * of that is actionable by the person reading it, and all of it reads as a
 * broken product rather than an incomplete setup.
 *
 * So every failure is classified into one of eight categories, each of which
 * knows how to explain itself in plain English and what to suggest next. The
 * technical detail is preserved — it just travels to the internal record
 * instead of to the screen.
 */

export type ErrorCategory =
  | "temporary_service"
  | "connection_required"
  | "permission_required"
  | "setup_incomplete"
  | "provider_unavailable"
  | "invalid_input"
  | "partial_completion"
  | "unknown";

export type CustomerError = {
  category: ErrorCategory;
  /** A short statement of what happened. Never names a system. */
  headline: string;
  /** Why, in terms of what the user was trying to do. */
  explanation: string;
  /** The single next thing worth doing. */
  nextAction: string;
  /** Whether retrying the same thing could plausibly work. */
  retryable: boolean;
  /** Whether this needs someone with more access than the reader has. */
  needsAdministrator: boolean;
};

const CATEGORY_DEFAULTS: Record<ErrorCategory, Omit<CustomerError, "category">> = {
  temporary_service: {
    headline: "That didn't go through",
    explanation: "A temporary problem stopped this from completing. Nothing was changed.",
    nextAction: "Try again in a moment.",
    retryable: true,
    needsAdministrator: false,
  },
  connection_required: {
    headline: "An account needs connecting first",
    explanation: "This needs a connected account that isn't linked to this seat yet.",
    nextAction: "Connect the account, then try again.",
    retryable: false,
    needsAdministrator: false,
  },
  permission_required: {
    headline: "You don't have access to this",
    explanation: "Your account doesn't have permission for this action.",
    nextAction: "Ask a workspace administrator to grant access or make the change for you.",
    retryable: false,
    needsAdministrator: true,
  },
  setup_incomplete: {
    headline: "This part of the workspace isn't switched on yet",
    explanation:
      "The feature is available, but this workspace hasn't finished being set up for it. Everything else keeps working.",
    nextAction: "Ask your workspace administrator to finish setting this up.",
    retryable: false,
    needsAdministrator: true,
  },
  provider_unavailable: {
    headline: "The platform didn't respond",
    explanation:
      "The external platform this depends on refused or didn't answer. That's on their side, not yours.",
    nextAction: "Try again shortly. If it keeps happening, reconnect the account.",
    retryable: true,
    needsAdministrator: false,
  },
  invalid_input: {
    headline: "Something in that wasn't right",
    explanation: "One of the values couldn't be accepted.",
    nextAction: "Check the highlighted fields and try again.",
    retryable: true,
    needsAdministrator: false,
  },
  partial_completion: {
    headline: "Partly finished",
    explanation: "Some of this worked and some didn't. What succeeded has been kept.",
    nextAction: "Retry the part that didn't finish.",
    retryable: true,
    needsAdministrator: false,
  },
  unknown: {
    headline: "Something went wrong",
    explanation: "We couldn't complete that, and we don't yet know why.",
    nextAction: "Try again. If it keeps happening, contact your workspace administrator.",
    retryable: true,
    needsAdministrator: true,
  },
};

/** Postgres and PostgREST codes that mean the schema is behind the code. */
const SETUP_CODES = ["42p01", "42703", "pgrst204", "pgrst205"];
/** Postgres codes that mean row-level security or grants refused the caller. */
const PERMISSION_CODES = ["42501", "pgrst301", "pgrst302"];
const INVALID_INPUT_CODES = ["22p02", "23502", "23514", "23505", "22001"];

function haystack(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error.toLowerCase();
  if (error instanceof Error) return `${error.name} ${error.message}`.toLowerCase();
  if (typeof error === "object") {
    const candidate = error as { code?: string; message?: string; details?: string; hint?: string; status?: number };
    return [candidate.code, candidate.message, candidate.details, candidate.hint, candidate.status]
      .filter((part) => part !== undefined && part !== null)
      .join(" ")
      .toLowerCase();
  }
  return String(error).toLowerCase();
}

/**
 * Decides which category a raw failure belongs to.
 *
 * Ordered most-specific first: a missing table and a permission denial can
 * both mention the same table name, and reading them the wrong way round
 * sends the user to fix something that isn't broken.
 */
export function classifyError(error: unknown): ErrorCategory {
  const text = haystack(error);
  if (!text) return "unknown";

  if (PERMISSION_CODES.some((code) => text.includes(code))) return "permission_required";
  if (/permission denied|not authorized|unauthorized|forbidden|row-level security/.test(text)) {
    return "permission_required";
  }

  if (SETUP_CODES.some((code) => text.includes(code))) return "setup_incomplete";
  if (/does not exist|could not find|schema cache|undefined table|undefined column/.test(text)) {
    return "setup_incomplete";
  }
  // Missing configuration is setup, not a fault: an unset key means nobody has
  // finished switching the feature on.
  if (/is not set|not configured|missing env|api key|credentials/.test(text)) {
    return "setup_incomplete";
  }

  if (/no connected|not connected|reconnect|no active connected|token could not be read|invalid_grant/.test(text)) {
    return "connection_required";
  }

  if (INVALID_INPUT_CODES.some((code) => text.includes(code))) return "invalid_input";
  if (/invalid input syntax|violates check constraint|duplicate key|value too long|is required/.test(text)) {
    return "invalid_input";
  }

  if (/rate limit|429|quota|api is disabled|has not been used|service unavailable|503|502|504|bad gateway/.test(text)) {
    return "provider_unavailable";
  }

  if (/timeout|timed out|aborted|econnreset|etimedout|fetch failed|network/.test(text)) {
    return "temporary_service";
  }

  return "unknown";
}

/**
 * Turns anything thrown into something worth reading.
 *
 * `context` names what the user was doing, so the explanation is about their
 * task rather than about the system: "We couldn't load Pipeline" beats "an
 * error occurred".
 */
export function toCustomerError(
  error: unknown,
  context?: { action?: string; category?: ErrorCategory },
): CustomerError {
  const category = context?.category ?? classifyError(error);
  const base = CATEGORY_DEFAULTS[category];

  if (!context?.action) return { category, ...base };

  // Only the first letter is lowered, never the whole string: "load Pipeline"
  // must not become "load pipeline" and lose the name of the thing.
  const inSentence = context.action.charAt(0).toLowerCase() + context.action.slice(1);

  return {
    category,
    ...base,
    headline:
      category === "setup_incomplete"
        ? `${context.action} isn't switched on for this workspace yet`
        : category === "permission_required"
          ? `You don't have access to ${inSentence}`
          : `We couldn't ${inSentence}`,
  };
}

/**
 * The technical record, kept out of the UI.
 *
 * Deliberately returns a plain object rather than logging directly, so callers
 * can attach their own context and decide where it goes.
 */
export function internalErrorRecord(
  error: unknown,
  context: Record<string, unknown> = {},
): Record<string, unknown> {
  const detail =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : typeof error === "object" && error !== null
        ? { ...(error as Record<string, unknown>) }
        : { message: String(error) };

  return {
    ...context,
    category: classifyError(error),
    error: detail,
    at: new Date().toISOString(),
  };
}
