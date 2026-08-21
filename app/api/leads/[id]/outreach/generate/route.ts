import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth";
import { UNTRAINED_AGENT_ERROR, hasVoiceDna } from "@/lib/agent-readiness";
import { generateOutreachMessage, verifyOutreachMessage, type LeadContext } from "@/lib/ai/acquisition";
import { loadDnaInput } from "@/lib/ai/generate";
import { buildBrandBrainBrief } from "@/lib/brand-brain";
import { asRows, isOpsSchemaMissing, opsTable } from "@/lib/marketing-os/operations";
import { OUTREACH_CHANNELS, type OutreachChannel } from "@/lib/schemas/acquisition";
import { nextStageRules, normalizeOutreachStage } from "@/lib/acquisition/stages";
import { daysUntilNextTouch } from "@/lib/acquisition/touchpoints";
import type { BrandBrain } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 180;

type LeadRow = {
  id: string;
  client_id: string | null;
  lead_name: string | null;
  company: string | null;
  email: string | null;
  linkedin_url: string | null;
  source_channel: string | null;
  source_url: string | null;
  evidence: string | null;
  outreach_stage: string | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: leadId } = await params;
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user, supabase } = context;

  const body = (await request.json().catch(() => ({}))) as { channel?: string };
  const channel = (OUTREACH_CHANNELS as readonly string[]).includes(body.channel ?? "")
    ? (body.channel as OutreachChannel)
    : "email";

  const leadResult = await opsTable(supabase, "marketing_os_leads")
    .select(
      "id, client_id, lead_name, company, email, linkedin_url, source_channel, source_url, evidence, outreach_stage",
    )
    .eq("id", leadId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (isOpsSchemaMissing(leadResult.error)) {
    return NextResponse.json(
      { error: "Client acquisition needs migration 0032 applied first." },
      { status: 409 },
    );
  }
  const lead = leadResult.data as LeadRow | null;
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  if (!lead.client_id) {
    return NextResponse.json(
      { error: "Attach this lead to a client first — the message is written in that client's voice." },
      { status: 400 },
    );
  }

  // The client's agent supplies the voice. One agent per client, so this is
  // unambiguous.
  const agentResult = await supabase
    .from("marketing_os_writing_agents")
    .select("id")
    .eq("owner_id", user.id)
    .eq("client_id", lead.client_id)
    .limit(1)
    .maybeSingle();
  const agentId = agentResult.data?.id as string | undefined;
  if (!agentId) {
    return NextResponse.json(
      { error: "This client has no writing agent yet. Create one and train it first." },
      { status: 400 },
    );
  }
  if (!(await hasVoiceDna(supabase, agentId))) {
    return NextResponse.json({ error: UNTRAINED_AGENT_ERROR }, { status: 400 });
  }

  const priorResult = await opsTable(supabase, "marketing_os_acquisition_attempts")
    .select("attempt_no, body")
    .eq("owner_id", user.id)
    .eq("lead_id", leadId)
    .order("attempt_no", { ascending: true });
  const prior = asRows<{ attempt_no: number; body: string }>(priorResult.data);
  const attemptNo = prior.length + 1;

  const [brainResult, dna] = await Promise.all([
    opsTable(supabase, "marketing_os_brand_brains").select("*").eq("agent_id", agentId).maybeSingle(),
    loadDnaInput(supabase, agentId),
  ]);
  const brandBrief = buildBrandBrainBrief((brainResult.data as BrandBrain) ?? null);

  const leadContext: LeadContext = {
    leadName: lead.lead_name,
    company: lead.company,
    email: lead.email,
    linkedinUrl: lead.linkedin_url,
    sourceChannel: lead.source_channel,
    sourceUrl: lead.source_url,
    evidence: lead.evidence,
  };

  try {
    const proposed = await generateOutreachMessage({
      brandBrief,
      dna,
      lead: leadContext,
      channel,
      attemptNo,
      previousMessages: prior.map((p) => p.body),
    });

    // Second pass. A rejected message is still stored, as a draft with its
    // issues attached, so a human can see what was caught and why.
    const verification = await verifyOutreachMessage({
      brandBrief,
      lead: leadContext,
      channel,
      proposed,
    });

    const finalBody =
      verification.verdict === "rejected"
        ? proposed.body
        : verification.approved_message.trim() || proposed.body;

    const { data: inserted, error } = await opsTable(supabase, "marketing_os_acquisition_attempts")
      .insert({
        owner_id: user.id,
        lead_id: leadId,
        client_id: lead.client_id,
        agent_id: agentId,
        attempt_no: attemptNo,
        channel,
        subject: channel === "email" ? proposed.subject : null,
        body: finalBody,
        status: "draft",
        verification: {
          verdict: verification.verdict,
          score: verification.score,
          issues: verification.issues,
          reasoning: verification.reasoning,
          pain_point: proposed.pain_point,
          offer_angle: proposed.offer_angle,
          message_language: proposed.message_language,
        },
      })
      .select("id, attempt_no, channel, subject, body, status, verification, created_at")
      .single();

    if (error || !inserted) {
      return NextResponse.json(
        { error: error?.message ?? "Could not save the drafted message" },
        { status: 500 },
      );
    }

    // Move the lead along the ladder and schedule the next touch. Drafting is
    // not sending, so the stage advances only far enough to reflect that this
    // attempt now exists and when the following one becomes due.
    const stage = normalizeOutreachStage(lead.outreach_stage);
    const rule = nextStageRules[stage];
    const waitDays = daysUntilNextTouch(attemptNo);
    if (rule) {
      await opsTable(supabase, "marketing_os_leads")
        .update({
          // A finished sequence goes to Renurture rather than the next rung:
          // there is no touch 7, so leaving it mid-ladder would keep showing a
          // due date for a message that will never be written.
          outreach_stage: waitDays === null ? "Renurture" : rule.next,
          next_attempt_at:
            waitDays === null
              ? null
              : new Date(Date.now() + waitDays * 86400000).toISOString(),
        })
        .eq("id", leadId)
        .eq("owner_id", user.id);
    }

    revalidatePath("/pipeline");
    return NextResponse.json({ ok: true, attempt: inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Outreach generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
