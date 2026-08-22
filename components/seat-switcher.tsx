"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";

import { SEAT_COOKIE, seatCookieValue } from "@/lib/seat-cookie";

export type SeatOption = {
  id: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
};

/**
 * Switches which seat the workspace is scoped to.
 *
 * A seat is a client. Each client has exactly one writing agent — one Voice
 * DNA, one version of who they sound like — so the client name is the whole
 * identity and the agent name is only a disambiguator on older data where a
 * client still has more than one.
 */
function seatLabel(seat: SeatOption, ambiguous: boolean) {
  const base = seat.clientName ?? seat.name;
  return ambiguous && seat.clientName ? `${base} — ${seat.name}` : base;
}

/**
 * Remember the seat for every navigation that cannot carry it in the URL —
 * a GET filter form, a server-action redirect, a detail page reached by id.
 * The server reads this back in `lib/seat.ts`.
 */
function rememberSeat(agentId: string, clientId: string | null) {
  const value = encodeURIComponent(seatCookieValue(agentId, clientId));
  document.cookie = `${SEAT_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
}

export function SeatSwitcher({
  seats,
  remembered = null,
}: {
  seats: SeatOption[];
  /** Seat id from the cookie, used when the URL names none. */
  remembered?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const agentMatch = pathname.match(/^\/agents\/([^/]+)(.*)$/);
  const clientMatch = pathname.match(/^\/clients\/([^/]+)(.*)$/);
  const agentId =
    searchParams.get("agent_id") ||
    (agentMatch?.[1] && agentMatch[1] !== "new" ? agentMatch[1] : null);
  const clientId =
    searchParams.get("client") ||
    (clientMatch?.[1] && clientMatch[1] !== "new" ? clientMatch[1] : null);

  // The URL wins when it names a seat. When it does not — a filter submit, an
  // action redirect, a detail page reached by id — the remembered seat keeps
  // the header honest instead of silently sliding to whichever seat happens to
  // sort first.
  const active =
    (agentId ? seats.find((seat) => seat.id === agentId) : null) ??
    (clientId ? seats.find((seat) => seat.clientId === clientId) : null) ??
    (remembered ? seats.find((seat) => seat.id === remembered) : null) ??
    seats[0] ??
    null;

  const activeId = active?.id ?? null;
  const activeClientId = active?.clientId ?? null;
  useEffect(() => {
    if (activeId) rememberSeat(activeId, activeClientId);
  }, [activeId, activeClientId]);

  // Only qualify a name when the same client genuinely has more than one seat,
  // which one-agent-per-client prevents going forward but older data may hold.
  const clientCounts = new Map<string, number>();
  for (const seat of seats) {
    if (!seat.clientName) continue;
    clientCounts.set(seat.clientName, (clientCounts.get(seat.clientName) ?? 0) + 1);
  }

  if (!active) {
    return (
      <p className="truncate text-sm text-muted-foreground">
        No seat yet — add a client to get started
      </p>
    );
  }

  function onSelect(nextId: string) {
    const seat = seats.find((option) => option.id === nextId);
    if (!seat) return;
    rememberSeat(seat.id, seat.clientId);

    const params = new URLSearchParams(searchParams.toString());
    let target = pathname;

    // On a page that already names an agent or client in its path, switching
    // seats should move to that page for the new seat rather than leaving the
    // header disagreeing with what is on screen.
    if (agentMatch && agentMatch[1] !== "new") {
      target = `/agents/${seat.id}${agentMatch[2]}`;
      params.delete("agent_id");
      params.delete("client");
    } else if (clientMatch && clientMatch[1] !== "new" && seat.clientId) {
      target = `/clients/${seat.clientId}${clientMatch[2]}`;
      params.delete("agent_id");
      params.delete("client");
    } else {
      params.set("agent_id", seat.id);
      if (seat.clientId) params.set("client", seat.clientId);
      else params.delete("client");
    }

    const query = params.toString();
    router.push(query ? `${target}?${query}` : target);
  }

  return (
    <label className="group relative inline-flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 text-sm text-muted-foreground">Seat:</span>
      <span className="truncate text-sm font-medium">
        {seatLabel(active, (clientCounts.get(active.clientName ?? "") ?? 0) > 1)}
      </span>
      <ChevronsUpDown
        className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
        aria-hidden="true"
      />
      {/* A native select: it sits invisibly over the label so the header keeps
          reading as text, while keyboard, screen-reader and mobile behaviour
          all come from the platform rather than being re-implemented. */}
      <select
        aria-label="Switch seat"
        value={active.id}
        onChange={(event) => onSelect(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {seats.map((seat) => (
          <option key={seat.id} value={seat.id}>
            {seatLabel(seat, (clientCounts.get(seat.clientName ?? "") ?? 0) > 1)}
          </option>
        ))}
      </select>
    </label>
  );
}
