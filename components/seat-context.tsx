"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  SEAT_COOKIE,
  seatCookieValue,
  seatScopedHref,
} from "@/lib/seat-cookie";

type RecordSeat = { agentId: string | null; clientId: string | null };

type SeatContextValue = {
  /** The seat the record on screen belongs to, if this page has one. */
  recordSeat: RecordSeat | null;
  setRecordSeat: (seat: RecordSeat | null) => void;
};

const SeatContext = createContext<SeatContextValue>({
  recordSeat: null,
  setRecordSeat: () => {},
});

/**
 * Lets a detail page tell the header which seat it is showing.
 *
 * A record is reached by its own id — `/campaigns/<id>`, `/generated/<id>` —
 * so the URL says nothing about whose workspace it belongs to, and the header
 * had no way to agree with the page. The page knows: it just loaded the row.
 * This carries that answer up to the switcher, which sits in the layout above
 * it and cannot read it any other way.
 */
export function SeatContextProvider({ children }: { children: React.ReactNode }) {
  const [recordSeat, setRecordSeat] = useState<RecordSeat | null>(null);
  const value = useMemo(() => ({ recordSeat, setRecordSeat }), [recordSeat]);
  return <SeatContext.Provider value={value}>{children}</SeatContext.Provider>;
}

export function useRecordSeat() {
  return useContext(SeatContext).recordSeat;
}

/**
 * Rendered by a detail page with the seat its record belongs to.
 *
 * Also writes the cookie, so the seat survives navigating away from the record
 * to a page that has no seat in its URL.
 */
export function SeatSync({
  agentId = null,
  clientId = null,
}: {
  agentId?: string | null;
  clientId?: string | null;
}) {
  const { setRecordSeat } = useContext(SeatContext);

  useEffect(() => {
    if (!agentId && !clientId) return;
    setRecordSeat({ agentId, clientId });

    if (agentId) {
      const value = encodeURIComponent(seatCookieValue(agentId, clientId));
      document.cookie = `${SEAT_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
    }

    // Cleared on unmount so the next page is not described by the record the
    // user just navigated away from.
    return () => setRecordSeat(null);
  }, [agentId, clientId, setRecordSeat]);

  return null;
}

/**
 * Builds links that keep the seat the user is currently in.
 *
 * Navigation used to drop `agent_id` / `client` on every item but one, so
 * moving between modules silently reset the workspace to whichever seat sorted
 * first. The seat is read from the record on screen, then the URL, then the
 * path — the same order the switcher resolves in, so a link and the header can
 * never disagree.
 */
export function useSeatScopedHref() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const recordSeat = useRecordSeat();

  const agentMatch = pathname.match(/^\/agents\/([^/]+)/);
  const clientMatch = pathname.match(/^\/clients\/([^/]+)/);
  const agentId =
    recordSeat?.agentId ||
    searchParams.get("agent_id") ||
    (agentMatch?.[1] && agentMatch[1] !== "new" ? agentMatch[1] : "");
  const clientId =
    recordSeat?.clientId ||
    searchParams.get("client") ||
    (clientMatch?.[1] && clientMatch[1] !== "new" ? clientMatch[1] : "");

  return (href: string) => seatScopedHref(href, agentId, clientId);
}
