/**
 * Whether an agent has been trained enough to generate from.
 *
 * Every generator in the system writes *in the client's voice*, which means
 * every one of them is meaningless until that voice has been extracted. The
 * six Voice DNA profiles are written together by the analyze route, so the
 * presence of the voice profile is the marker for "training finished".
 *
 * Checked server-side in each route rather than only in the UI: the buttons
 * are disabled, but the routes are reachable directly, and generating
 * generic copy that claims to be in a client's voice is worse than refusing.
 */

export const UNTRAINED_AGENT_ERROR =
  "This agent has not finished training yet. Upload the client's content and " +
  "run the Voice DNA analysis first — everything here is generated in their " +
  "voice, so there is nothing to write from until that runs.";

type ReadinessSupabase = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => { maybeSingle: () => PromiseLike<{ data: unknown }> };
    };
  };
};

/** True when the agent's Voice DNA has been extracted. */
export async function hasVoiceDna(
  supabase: unknown,
  agentId: string,
): Promise<boolean> {
  const db = supabase as ReadinessSupabase;
  const { data } = await db
    .from("marketing_os_voice_profiles")
    .select("agent_id")
    .eq("agent_id", agentId)
    .maybeSingle();
  return Boolean(data);
}

/** The set of agent ids (from those given) that have finished training. */
export async function trainedAgentIds(
  supabase: unknown,
  agentIds: string[],
): Promise<Set<string>> {
  if (agentIds.length === 0) return new Set();
  const db = supabase as {
    from: (table: string) => {
      select: (columns: string) => {
        in: (column: string, values: string[]) => PromiseLike<{ data: unknown }>;
      };
    };
  };
  const { data } = await db
    .from("marketing_os_voice_profiles")
    .select("agent_id")
    .in("agent_id", agentIds);
  const rows = Array.isArray(data) ? (data as { agent_id: string }[]) : [];
  return new Set(rows.map((row) => row.agent_id));
}
