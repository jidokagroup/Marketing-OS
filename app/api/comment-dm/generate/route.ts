import { NextResponse } from "next/server";

import { generateCommentDmFlow } from "@/lib/ai/comment-dm";
import { buildDnaBrief, type DnaInput } from "@/lib/ai/generate";
import { getAuthContext } from "@/lib/auth";
import { buildBrandBrainBrief } from "@/lib/brand-brain";
import type { BrandBrain } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface Body {
  agent_id?: string;
  title?: string;
  caption?: string;
  script?: string;
  sample_comment?: string;
  commenter_handle?: string;
  trigger_keywords?: string;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user, supabase } = context;

  const body = (await request.json().catch(() => ({}))) as Body;
  const agentId = text(body.agent_id);
  if (!agentId) {
    return NextResponse.json({ error: "Choose a Writing Agent first." }, { status: 400 });
  }

  const { data: agent } = await supabase
    .from("marketing_os_writing_agents")
    .select("id, owner_id")
    .eq("id", agentId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  try {
    const [voice, belief, hooks, story, phrase, knowledge, brain] =
      await Promise.all([
        supabase.from("marketing_os_voice_profiles").select("*").eq("agent_id", agentId).maybeSingle(),
        supabase.from("marketing_os_belief_profiles").select("*").eq("agent_id", agentId).maybeSingle(),
        supabase.from("marketing_os_hook_libraries").select("*").eq("agent_id", agentId).maybeSingle(),
        supabase.from("marketing_os_story_frameworks").select("*").eq("agent_id", agentId).maybeSingle(),
        supabase.from("marketing_os_phrase_libraries").select("*").eq("agent_id", agentId).maybeSingle(),
        supabase.from("marketing_os_knowledge_graphs").select("*").eq("agent_id", agentId).maybeSingle(),
        supabase.from("marketing_os_brand_brains").select("*").eq("agent_id", agentId).maybeSingle(),
      ]);

    const dna: DnaInput = {
      voice: voice.data as unknown as DnaInput["voice"],
      belief: belief.data as unknown as DnaInput["belief"],
      hooks: hooks.data as unknown as DnaInput["hooks"],
      story: story.data as unknown as DnaInput["story"],
      phrase: phrase.data as unknown as DnaInput["phrase"],
      knowledge: knowledge.data as unknown as DnaInput["knowledge"],
    };

    const result = await generateCommentDmFlow({
      brandBrief: buildBrandBrainBrief((brain.data as BrandBrain) ?? null),
      dnaBrief: buildDnaBrief(dna),
      postTitle: text(body.title) || "Untitled Instagram post",
      postCaption: text(body.caption),
      postScript: text(body.script),
      sampleComment: text(body.sample_comment),
      commenterHandle: text(body.commenter_handle),
      triggerKeywords: text(body.trigger_keywords),
    });

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not generate comment-to-DM flow.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
