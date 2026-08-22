/**
 * Which seat (client + its writing agent) the workspace is currently scoped to.
 *
 * The seat travels in the URL as `agent_id` / `client` so links, filters and
 * shared URLs stay self-describing. But not every navigation can carry it: a
 * GET filter form only submits its own fields, a server action redirects to
 * wherever it wants, and a detail page is reached by an id alone. Without a
 * memory the header would silently fall back to the first seat in the list
 * while the page below it still showed another client's records — the app
 * telling the user they are in one client's workspace while displaying
 * another's.
 *
 * So the URL stays the source of truth when it says anything, and this cookie
 * remembers the last seat the URL named for every navigation that doesn't.
 */

import { cookies } from "next/headers";

import { SEAT_COOKIE, parseSeatCookie, seatId } from "./seat-cookie";

export { SEAT_COOKIE, seatId };

export type SeatContext = {
  agentId: string | null;
  clientId: string | null;
};

/** The seat remembered from the last navigation that named one. */
export async function seatFromCookie(): Promise<SeatContext> {
  const store = await cookies();
  return parseSeatCookie(store.get(SEAT_COOKIE)?.value);
}

/**
 * The seat a page should render as active: what the URL says, or failing that
 * what the last URL said. Params win as a pair — a URL naming only an agent
 * means that agent with no client filter, not that agent plus a stale client.
 */
export async function activeSeat(params: {
  agent_id?: string;
  client?: string;
}): Promise<SeatContext> {
  const fromUrl = {
    agentId: seatId(params.agent_id),
    clientId: seatId(params.client),
  };
  if (fromUrl.agentId || fromUrl.clientId) return fromUrl;
  return seatFromCookie();
}
