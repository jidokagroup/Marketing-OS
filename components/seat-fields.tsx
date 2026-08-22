/**
 * Carries the active seat through a GET filter form.
 *
 * A form submits only its own fields, so filtering a list would otherwise
 * rewrite the URL without `agent_id` / `client` and leave the header naming a
 * different client than the page is showing.
 *
 * `omit` is for forms that already own one of the names — the Generated
 * Content filter has its own client select, and two `client` fields would
 * submit the param twice.
 */
export function SeatFields({
  seat,
  omit = [],
}: {
  seat: { agentId: string | null; clientId: string | null };
  omit?: ("agent_id" | "client")[];
}) {
  return (
    <>
      {seat.agentId && !omit.includes("agent_id") && (
        <input type="hidden" name="agent_id" value={seat.agentId} />
      )}
      {seat.clientId && !omit.includes("client") && (
        <input type="hidden" name="client" value={seat.clientId} />
      )}
    </>
  );
}
