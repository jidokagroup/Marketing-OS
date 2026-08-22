"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { wallTimeToInstant, workspaceTimeZone } from "@/lib/timezone";
import { opsTable, type WorkflowStage } from "@/lib/marketing-os/operations";

function textValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function numberValue(formData: FormData, key: string) {
  const value = Number(formData.get(key) ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function dateValue(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value || null;
}

export async function createCampaignAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const name = textValue(formData, "name");
  if (!name) return;

  const result = await opsTable(supabase, "marketing_os_campaigns")
    .insert({
      owner_id: user.id,
      organization_id: user.id,
      client_id: textValue(formData, "client_id"),
      name,
      campaign_type: textValue(formData, "campaign_type") ?? "integrated",
      status: textValue(formData, "status") ?? "planning",
      stage: textValue(formData, "stage") ?? "strategy",
      health: textValue(formData, "health") ?? "on_track",
      priority: textValue(formData, "priority") ?? "medium",
      goal: textValue(formData, "goal"),
      primary_kpi: textValue(formData, "primary_kpi"),
      target_audience: textValue(formData, "target_audience"),
      owner_name: textValue(formData, "owner_name"),
      budget: numberValue(formData, "budget"),
      expected_revenue: numberValue(formData, "expected_revenue"),
      lead_goal: numberValue(formData, "lead_goal"),
      start_date: dateValue(formData, "start_date"),
      end_date: dateValue(formData, "end_date"),
      notes: textValue(formData, "notes"),
    })
    .select("id")
    .single();

  revalidatePath("/campaigns");
  const row = result.data as { id?: string } | null;
  redirect(row?.id ? `/campaigns/${row.id}` : "/campaigns");
}

export async function updateCampaignAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const id = textValue(formData, "id");
  if (!id) return;

  await opsTable(supabase, "marketing_os_campaigns")
    .update({
      status: textValue(formData, "status") ?? "planning",
      stage: textValue(formData, "stage") ?? "strategy",
      health: textValue(formData, "health") ?? "on_track",
      priority: textValue(formData, "priority") ?? "medium",
      owner_name: textValue(formData, "owner_name"),
      budget: numberValue(formData, "budget"),
      actual_spend: numberValue(formData, "actual_spend"),
      expected_revenue: numberValue(formData, "expected_revenue"),
      attributed_revenue: numberValue(formData, "attributed_revenue"),
      lead_goal: numberValue(formData, "lead_goal"),
      leads_count: numberValue(formData, "leads_count"),
      start_date: dateValue(formData, "start_date"),
      end_date: dateValue(formData, "end_date"),
      goal: textValue(formData, "goal"),
      primary_kpi: textValue(formData, "primary_kpi"),
      target_audience: textValue(formData, "target_audience"),
      notes: textValue(formData, "notes"),
    })
    .eq("id", id)
    .eq("owner_id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${id}`);
}

export async function advanceCampaignStageAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const id = textValue(formData, "id");
  const stage = textValue(formData, "stage") as WorkflowStage | null;
  if (!id || !stage) return;

  await opsTable(supabase, "marketing_os_campaigns")
    .update({ stage })
    .eq("id", id)
    .eq("owner_id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${id}`);
}

export async function saveCampaignBriefAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const campaignId = textValue(formData, "campaign_id");
  if (!campaignId) return;

  const channels = String(formData.get("channels") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const pillars = String(formData.get("content_pillars") ?? "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((name) => ({ name }));

  await opsTable(supabase, "marketing_os_campaign_briefs")
    .upsert(
      {
        owner_id: user.id,
        organization_id: user.id,
        campaign_id: campaignId,
        strategy_summary: textValue(formData, "strategy_summary"),
        audience: textValue(formData, "audience"),
        offer: textValue(formData, "offer"),
        positioning: textValue(formData, "positioning"),
        core_message: textValue(formData, "core_message"),
        channels,
        content_pillars: pillars,
        competitor_notes: textValue(formData, "competitor_notes"),
        approval_requirements: textValue(formData, "approval_requirements"),
        measurement_plan: textValue(formData, "measurement_plan"),
      },
      { onConflict: "campaign_id" },
    )
    .select("id")
    .maybeSingle();

  await opsTable(supabase, "marketing_os_campaigns")
    .update({
      brief: {
        strategy_summary: textValue(formData, "strategy_summary"),
        audience: textValue(formData, "audience"),
        offer: textValue(formData, "offer"),
        positioning: textValue(formData, "positioning"),
        core_message: textValue(formData, "core_message"),
        channels,
        content_pillars: pillars,
        measurement_plan: textValue(formData, "measurement_plan"),
      },
    })
    .eq("id", campaignId)
    .eq("owner_id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function createCampaignWorkAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const campaignId = textValue(formData, "campaign_id");
  const title = textValue(formData, "title");
  if (!title) return;

  await opsTable(supabase, "marketing_os_work_items").insert({
    owner_id: user.id,
    organization_id: user.id,
    campaign_id: campaignId,
    client_id: textValue(formData, "client_id"),
    title,
    description: textValue(formData, "description"),
    work_type: textValue(formData, "work_type") ?? "content",
    status: textValue(formData, "status") ?? "not_started",
    priority: textValue(formData, "priority") ?? "medium",
    assignee_name: textValue(formData, "assignee_name"),
    due_at: textValue(formData, "due_at"),
    estimate_hours: numberValue(formData, "estimate_hours"),
    created_by: user.id,
  });

  revalidatePath("/dashboard");
  revalidatePath("/work");
  if (campaignId) revalidatePath(`/campaigns/${campaignId}`);
}

export async function createCampaignLeadAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const campaignId = textValue(formData, "campaign_id");

  await opsTable(supabase, "marketing_os_leads").insert({
    owner_id: user.id,
    organization_id: user.id,
    campaign_id: campaignId,
    client_id: textValue(formData, "client_id"),
    source_channel: textValue(formData, "source_channel"),
    lead_name: textValue(formData, "lead_name"),
    email: textValue(formData, "email"),
    phone: textValue(formData, "phone"),
    company: textValue(formData, "company"),
    status: textValue(formData, "lead_status") ?? "new",
    estimated_value: numberValue(formData, "estimated_value"),
    actual_value: numberValue(formData, "actual_value"),
  });

  if (campaignId) {
    revalidatePath(`/campaigns/${campaignId}`);
  }
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

export async function createRevenueEventAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const campaignId = textValue(formData, "campaign_id");
  const timeZone = await workspaceTimeZone();

  await opsTable(supabase, "marketing_os_revenue_events").insert({
    owner_id: user.id,
    organization_id: user.id,
    campaign_id: campaignId,
    client_id: textValue(formData, "client_id"),
    lead_id: textValue(formData, "lead_id"),
    amount: numberValue(formData, "amount"),
    event_type: textValue(formData, "event_type") ?? "deal_created",
    attribution_model: textValue(formData, "attribution_model") ?? "manual",
    // The form sends a wall time with no zone; without this it would be
    // stored as if the user had typed it in UTC.
    occurred_at:
      wallTimeToInstant(
        textValue(formData, "occurred_at") ?? "",
        timeZone,
      )?.toISOString() ?? new Date().toISOString(),
    notes: textValue(formData, "notes"),
  });

  if (campaignId) {
    revalidatePath(`/campaigns/${campaignId}`);
  }
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}
