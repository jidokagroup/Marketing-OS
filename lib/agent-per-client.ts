/**
 * One writing agent per client.
 *
 * A client's agent *is* their Voice DNA — their tone, beliefs, hooks, phrase
 * library and knowledge graph, extracted from their own content. Two agents
 * on one client means two competing versions of who that client sounds like,
 * and every generator would then have to guess which one to write from.
 *
 * Enforced in the application rather than by a unique index: existing
 * installs may already have several agents on a client, and a constraint
 * would fail the migration on deploy rather than degrade. Existing data keeps
 * working and keeps rendering; only *new* duplicates are refused.
 */

export const AGENT_EXISTS_FOR_CLIENT_ERROR =
  "This client already has a writing agent. Each client gets one agent, so " +
  "everything is written from a single version of their voice — open the " +
  "existing agent to retrain it on new content instead.";

type LookupSupabase = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        eq: (
          column: string,
          value: string,
        ) => {
          limit: (n: number) => { maybeSingle: () => PromiseLike<{ data: unknown }> };
        };
      };
    };
  };
};

/**
 * The agent already on this client, if any. Returns its id so callers can
 * point the user at it rather than only refusing.
 */
export async function existingAgentForClient(
  supabase: unknown,
  ownerId: string,
  clientId: string,
): Promise<string | null> {
  const db = supabase as LookupSupabase;
  const { data } = await db
    .from("marketing_os_writing_agents")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("client_id", clientId)
    .limit(1)
    .maybeSingle();
  const row = data as { id?: string } | null;
  return row?.id ?? null;
}
