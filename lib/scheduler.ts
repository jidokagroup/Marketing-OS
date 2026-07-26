import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

export interface TitleMatch {
  generated_content_id: string;
  caption: string | null;
  script: string | null;
}

/**
 * Match a scheduled post to a Client Content Agent's generated content by TITLE
 * (case-insensitive). Returns the caption (short version) and full script
 * to attach to the post, or null when there's no matching voice content.
 */
export async function matchGeneratedByTitle(
  supabase: SupabaseClient<Database>,
  agentId: string,
  title: string,
): Promise<TitleMatch | null> {
  const clean = title.trim();
  if (!clean) return null;

  const { data } = await supabase
    .from("marketing_os_generated_content")
    .select("id, title, primary_script, short_version, organic_version")
    .eq("agent_id", agentId)
    .ilike("title", clean)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    generated_content_id: data.id,
    caption: data.organic_version ?? data.short_version ?? data.primary_script,
    script: data.primary_script,
  };
}
