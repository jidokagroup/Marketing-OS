import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth";
import type { GenerationRequest } from "@/lib/ai/generate";
import { CONTENT_CHANNEL_LABELS } from "@/lib/core-agents";

export const runtime = "nodejs";

function cleanPlatformList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => String(item).trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function channelLabel(key: string) {
  return CONTENT_CHANNEL_LABELS[key] ?? key.replace(/_/g, " ");
}

/**
 * Resolve the deployed origin so the route can hand work to the background
 * worker. Netlify sets URL/DEPLOY_PRIME_URL; NEXT_PUBLIC_SITE_URL wins locally.
 */
function siteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    ""
  ).replace(/\/$/, "");
}

/**
 * Hand generation to the Netlify background function. Background functions
 * ack with 202 straight away and then run with a multi-minute budget, so
 * awaiting this trigger stays fast -- it is the generation itself we must
 * not wait for (see the background function for why: a regular Netlify
 * Function's real platform timeout is far lower than the maxDuration this
 * route used to declare).
 */
async function triggerGenerationWorker(contentId: string): Promise<boolean> {
  const origin = siteOrigin();
  const secret = process.env.CRON_SECRET;
  if (!origin || !secret) return false;

  try {
    const res = await fetch(`${origin}/.netlify/functions/generate-content-background`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ contentId }),
    });
    return res.ok || res.status === 202;
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: agentId } = await params;
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user, supabase } = context;

  const { data: agent } = await supabase
    .from("marketing_os_writing_agents")
    .select("id, status")
    .eq("id", agentId)
    .maybeSingle();
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<
    GenerationRequest & { platforms?: string[] }
  >;
  const topic = String(body.topic ?? "").trim();
  if (!topic) {
    return NextResponse.json({ error: "Topic is required" }, { status: 400 });
  }
  const platforms = cleanPlatformList(body.platforms);
  const platformLabel =
    platforms.length > 0
      ? platforms.map(channelLabel).join(", ")
      : body.platform?.trim() || undefined;

  // Require an analyzed agent (Voice DNA present).
  const { data: voice } = await supabase
    .from("marketing_os_voice_profiles")
    .select("agent_id")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (!voice) {
    return NextResponse.json(
      { error: "Analyze this agent before generating content." },
      { status: 400 },
    );
  }

  // Generation itself runs out-of-band: retrieval plus a Claude call for a
  // full multi-channel bundle can easily exceed what a regular Netlify
  // Function is actually allowed to run for. Queue the row and let the
  // worker fill it in; the page polls and swaps in the result when it's
  // ready, the same pattern already used for competitor scans.
  const { data: inserted, error: insertError } = await supabase
    .from("marketing_os_generated_content")
    .insert({
      agent_id: agentId,
      owner_id: user.id,
      title: body.title?.trim() || topic,
      topic,
      goal: body.goal?.trim() || null,
      platform: platformLabel ?? null,
      audience: body.audience?.trim() || null,
      offer: body.offer?.trim() || null,
      cta: body.cta?.trim() || null,
      length: body.length?.trim() || null,
      notes: body.notes?.trim() || null,
      status: "queued",
      requested_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "Could not queue generation" },
      { status: 500 },
    );
  }

  const triggered = await triggerGenerationWorker(inserted.id);
  if (!triggered) {
    const reason = !siteOrigin()
      ? "no site URL configured"
      : !process.env.CRON_SECRET
        ? "CRON_SECRET is not set"
        : "the background worker could not be reached";
    await supabase
      .from("marketing_os_generated_content")
      .update({
        status: "failed",
        error_message: `Generation worker was not triggered (${reason}). Try generating again.`,
      })
      .eq("id", inserted.id);
  }

  revalidatePath("/generated");
  revalidatePath("/dashboard");

  return NextResponse.json({ id: inserted.id, status: triggered ? "queued" : "failed" });
}
