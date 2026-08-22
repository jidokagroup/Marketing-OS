/**
 * The seat cookie's name and value format, shared by the server helpers in
 * `lib/seat.ts` and the header switcher that writes it from the browser.
 *
 * It lives apart from `lib/seat.ts` because that module imports `next/headers`
 * and so cannot be pulled into a client bundle.
 */

export const SEAT_COOKIE = "jidoka_seat";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Filter params spell "no seat" in several ways — absent, empty, or the
 * literal "all" that the list filters use. Only a real id counts.
 */
export function seatId(value: string | null | undefined): string | null {
  const clean = (value ?? "").trim();
  return UUID_PATTERN.test(clean) ? clean : null;
}

export function seatCookieValue(agentId: string, clientId: string | null) {
  return `${agentId}|${clientId ?? ""}`;
}

export function parseSeatCookie(raw: string | null | undefined) {
  // The browser writes this encoded, and cookie values reach the server
  // exactly as sent, so the separator has to be decoded before splitting.
  let value = raw ?? "";
  try {
    value = decodeURIComponent(value);
  } catch {
    // A malformed cookie is treated as no cookie rather than crashing a page.
    return { agentId: null, clientId: null };
  }
  const [agentId, clientId] = value.split("|");
  return { agentId: seatId(agentId), clientId: seatId(clientId) };
}

/**
 * Adds the active seat to a link that would otherwise drop it.
 *
 * An href that already names a seat is left as it is — an explicit link is a
 * deliberate one, and overriding it would make "open this in Canton" mean
 * something other than what it says.
 */
export function seatScopedHref(
  href: string,
  agentId: string | null,
  clientId: string | null,
): string {
  if (!agentId && !clientId) return href;

  const [base, query = ""] = href.split("?", 2);
  const params = new URLSearchParams(query);
  if (agentId && !params.has("agent_id")) params.set("agent_id", agentId);
  if (clientId && !params.has("client")) params.set("client", clientId);
  return `${base}?${params.toString()}`;
}
