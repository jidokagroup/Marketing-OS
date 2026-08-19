/**
 * Marketing consent wording.
 *
 * The exact strings shown next to each checkbox live here because they are
 * written verbatim into `marketing_os_consent_events` when someone opts in.
 * If the wording ever changes, past signups keep the text they actually
 * agreed to — which is the only version worth having if consent is ever
 * questioned.
 */

export const BRAND_NAME = "Convia Pro × Jidoka Group";

export const EMAIL_CONSENT_TEXT =
  `Yes, email me about ${BRAND_NAME} — product updates, cohort news and ` +
  "onboarding. You can unsubscribe from any email at any time.";

export const SMS_CONSENT_TEXT =
  `Yes, text me about ${BRAND_NAME} at the number above. Message frequency ` +
  "varies; message and data rates may apply. Reply STOP to opt out or HELP " +
  "for help. Consent is not a condition of purchase.";

/**
 * Loose on purpose. This is a contact field, not an identity check: people
 * write numbers with spaces, dashes, brackets and country codes, and
 * rejecting a real number is worse than storing an odd one. Only the digit
 * count is enforced, and only when a number was actually entered.
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;

  return trimmed;
}
