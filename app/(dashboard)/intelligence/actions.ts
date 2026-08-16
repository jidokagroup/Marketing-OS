"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { type ScanClient } from "@/lib/ai/competitor-scan";
import { triggerBackgroundFunction } from "@/lib/background-trigger";
import { asRow, opsTable, type CampaignRow } from "@/lib/marketing-os/operations";

const BASELINE_TOPICS = [
  "Problem-aware education posts",
  "Customer objection breakdowns",
  "Founder or practitioner point-of-view clips",
  "Before-and-after process stories",
  "Offer education with clear proof points",
];

const BASELINE_HOOKS = [
  "Most brands explain this backwards.",
  "If your audience keeps asking this, make it a post.",
  "Here is the part competitors skip.",
  "Three signs your customer is ready for the next step.",
];

const BASELINE_TRENDS = [
  "Short teaching clips with one visual framework",
  "Carousel myth breakdowns",
  "Comment keyword to DM lead magnets",
  "Expert POV responses to trending industry claims",
];

const BASELINE_POSITIONING = [
  "Own the specific problem competitors mention but rarely explain step by step.",
  "Translate expert work into plain English while competitors stay generic.",
  "Lead with real POV content where competitors rely on stock-style posts.",
  "Use education-first proof to build trust where competitors overpromise.",
];

const BASELINE_CONTENT_GAPS = [
  "Competitors explain the problem, but not the practical decision framework buyers can use next.",
  "Competitors mention outcomes, but rarely show the process, tradeoffs, or proof behind them.",
  "The client should answer buying objections earlier with education-first content.",
  "There is room for simpler next-step content that turns attention into a qualified conversation.",
];

const BASELINE_HOOK_LIBRARY = [
  "Reel: Most people are solving the visible problem, not the real one.",
  "Carousel: Save this before you choose your next step.",
  "YouTube: The mistake that makes this problem more expensive than it needs to be.",
  "Email: If this keeps coming up, it is probably not a people problem.",
  "Blog: A practical guide to deciding what to fix first.",
];

const BASELINE_OFFER_TRACKER = [
  "Diagnostic or assessment that clarifies whether the buyer has the problem.",
  "Comment keyword resource connected to a DM sequence.",
  "Audit call framed around one specific pain point.",
  "Checklist or framework that helps the buyer choose the next step.",
];

const BASELINE_COMMENT_THEMES = [
  "How do I know if this applies to me?",
  "What should I fix first?",
  "How long does this take?",
  "What does this cost?",
  "Can you send me the resource?",
];

const BASELINE_OPPORTUNITY_SIGNALS = [
  "High relevance, medium saturation: turn the main objection into a weekly series.",
  "High save/share potential: package the decision framework as a carousel or lead magnet.",
  "Medium velocity: start with short video, then expand into email and blog.",
  "High conversion intent: pair comment keywords with a DM sequence and booking CTA.",
];

const BASELINE_COMPETITOR_WINS = [
  "Add competitor websites and save to see how they actually execute — format mix, editing style, voiceover vs. music, trending audio.",
];

const BASELINE_RECOMMENDED_POSTS = [
  "Carousel: 5 signs your audience is ready for the offer",
  "Reel: The one question customers ask before they buy",
  "Caption: Why the common advice is incomplete",
  "Lead magnet post: Comment GUIDE for the next-step checklist",
];

const BASELINE_OPPORTUNITY_SCORE = 60;
const BASELINE_CONTENT_GAP_SCORE = 55;

/** Baseline guidance has no real competitor page behind it, so every item is untraceable. */
function asInsight(text: string) {
  return { insight: text, source_url: null as string | null };
}

/**
 * Resolve the deployed origin so the action can hand work to the background
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
 * Hand the scan to the Netlify background function. Background functions ack
 * with 202 straight away and then run with a multi-minute budget, so awaiting
 * this trigger stays fast — it is the scan itself we must not wait for.
 *
 * Returns false when the worker could not be reached; the caller leaves the
 * report queued so the scheduled sweep can pick it up instead.
 */
async function triggerScanWorker(reportId: string): Promise<boolean> {
  const origin = siteOrigin();
  const secret = process.env.CRON_SECRET;
  if (!origin || !secret) return false;

  return triggerBackgroundFunction(
    `${origin}/.netlify/functions/competitor-scan-background`,
    secret,
    { reportId },
  );
}

export async function saveCompetitorsAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const competitorWebsites = String(formData.get("competitor_websites") ?? "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) =>
      item.startsWith("http://") || item.startsWith("https://") || item.startsWith("@")
        ? item
        : `https://${item}`,
    );

  const clientId = String(formData.get("client_id") ?? "").trim();
  // Hand-entered audio observations live on the client so they persist across
  // scans; no API exposes competitor trending audio, so this is the only source.
  const audioNotes = String(formData.get("trending_audio_notes") ?? "").trim();
  let client: ScanClient = null;
  if (clientId) {
    await supabase
      .from("marketing_os_clients")
      .update({ trending_audio_notes: audioNotes || null })
      .eq("id", clientId);

    const { data } = await supabase
      .from("marketing_os_clients")
      .select("name, industry, notes, trending_audio_notes")
      .eq("id", clientId)
      .maybeSingle();
    client = data ?? null;
  }

  const { data: accounts } = await supabase
    .from("marketing_os_social_accounts")
    .select("platform, status")
    .eq("status", "active");
  const platforms = [...new Set((accounts ?? []).map((account) => account.platform))];

  const hasWatchlist = competitorWebsites.length > 0;

  // The scan itself runs out-of-band: fetching several competitor sites and
  // generating a structured report takes far longer than a request may live.
  // Save the watchlist with baseline guidance now, then let the worker fill it
  // in. The page renders the baseline immediately and swaps in real results
  // once the row flips to `complete`.
  const { data: inserted, error: insertError } = await supabase
    .from("marketing_os_social_intelligence_reports")
    .insert({
      owner_id: user.id,
      // The industry column doubles as the client-focus label for the report.
      industry: client?.name ?? "general marketing",
      client_id: clientId || null,
      platforms,
      competitor_accounts: competitorWebsites,
      trending_topics: BASELINE_TOPICS.map(asInsight),
      hooks: BASELINE_HOOKS.map(asInsight),
      audios: [
        "Connect Instagram and YouTube to collect live audio trends. TikTok is paused while API setup is in progress.",
      ],
      // Stored as an object so positioning rides along without a schema change;
      // the Intelligence page reads both this shape and the legacy plain array.
      content_opportunities: {
        items: BASELINE_TRENDS.map(asInsight),
        positioning: BASELINE_POSITIONING.map(asInsight),
        content_gaps: BASELINE_CONTENT_GAPS.map(asInsight),
        hook_library: BASELINE_HOOK_LIBRARY.map(asInsight),
        offer_tracker: BASELINE_OFFER_TRACKER.map(asInsight),
        comment_themes: BASELINE_COMMENT_THEMES.map(asInsight),
        opportunity_signals: BASELINE_OPPORTUNITY_SIGNALS.map(asInsight),
        competitor_wins: BASELINE_COMPETITOR_WINS.map(asInsight),
        recommended_posts: BASELINE_RECOMMENDED_POSTS.map(asInsight),
        opportunity_score: BASELINE_OPPORTUNITY_SCORE,
        content_gap_score: BASELINE_CONTENT_GAP_SCORE,
        source: "baseline",
      },
      status: hasWatchlist ? "queued" : "complete",
      summary: hasWatchlist
        ? "Watchlist saved. The competitor scan is running now — baseline guidance is shown below and will be replaced when the scan finishes."
        : "Watchlist cleared. Add competitor websites and save to generate a fresh scan.",
      scanned_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (hasWatchlist && !insertError && inserted) {
    const triggered = await triggerScanWorker(inserted.id);

    // A failed trigger is invisible otherwise: the row just sits at `queued`
    // looking identical to a slow scan. Record why so the page (and anyone
    // reading the table) can tell "never started" from "still running". The
    // status stays `queued` so the scheduled sweep can still claim it.
    if (!triggered) {
      const reason = !siteOrigin()
        ? "no site URL configured"
        : !process.env.CRON_SECRET
          ? "CRON_SECRET is not set"
          : "the background worker could not be reached";
      await supabase
        .from("marketing_os_social_intelligence_reports")
        .update({
          error_message: `Scan worker was not triggered directly (${reason}). Waiting for the scheduled sweep.`,
        })
        .eq("id", inserted.id);
    }
  }

  revalidatePath("/intelligence");
}

function textValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function insightPayload(formData: FormData) {
  return {
    title: textValue(formData, "insight_title") ?? "Intelligence item",
    body: textValue(formData, "insight_body") ?? "",
    type: textValue(formData, "insight_type") ?? "opportunity",
    source: textValue(formData, "insight_source") ?? "intelligence",
  };
}

async function latestOrCreatedCampaign(
  supabase: unknown,
  ownerId: string,
  insight: ReturnType<typeof insightPayload>,
  campaignId?: string | null,
) {
  if (campaignId) return campaignId;

  const latest = await opsTable(supabase, "marketing_os_campaigns")
    .select(
      "id, owner_id, client_id, name, campaign_type, status, stage, health, priority, goal, primary_kpi, target_audience, owner_name, budget, actual_spend, expected_revenue, attributed_revenue, lead_goal, leads_count, start_date, end_date, notes, created_at, updated_at",
    )
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestCampaign = asRow<CampaignRow>(latest.data);
  if (latestCampaign?.id) return latestCampaign.id;

  const created = await opsTable(supabase, "marketing_os_campaigns")
    .insert({
      owner_id: ownerId,
      organization_id: ownerId,
      name: `Intelligence campaign: ${insight.title}`,
      campaign_type: "intelligence-led",
      status: "planning",
      stage: "strategy",
      goal: insight.body,
      notes: `Created from ${insight.source}.`,
    })
    .select("id")
    .single();
  return (created.data as { id?: string } | null)?.id ?? null;
}

export async function createCampaignFromInsightAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const insight = insightPayload(formData);

  await opsTable(supabase, "marketing_os_campaigns").insert({
    owner_id: user.id,
    organization_id: user.id,
    client_id: textValue(formData, "client_id"),
    name: insight.title,
    campaign_type: "intelligence-led",
    status: "planning",
    stage: "strategy",
    goal: insight.body,
    notes: `Created from ${insight.source}.`,
  });

  await recordInsight(supabase, user.id, formData, "converted");
  revalidateOps();
}

export async function createContentIdeaFromInsightAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const insight = insightPayload(formData);

  await opsTable(supabase, "marketing_os_content_ideas").insert({
    owner_id: user.id,
    organization_id: user.id,
    campaign_id: textValue(formData, "campaign_id"),
    client_id: textValue(formData, "client_id"),
    title: insight.title,
    description: insight.body,
    source: insight.source,
    format: textValue(formData, "format"),
    platform: textValue(formData, "platform"),
    funnel_stage: "awareness",
    status: "idea",
    insight_payload: insight,
  });

  await recordInsight(supabase, user.id, formData, "converted");
  revalidateOps();
}

export async function addInsightToBriefAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const insight = insightPayload(formData);
  const campaignId = await latestOrCreatedCampaign(
    supabase,
    user.id,
    insight,
    textValue(formData, "campaign_id"),
  );
  if (!campaignId) return;

  const existing = await opsTable(supabase, "marketing_os_campaign_briefs")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("owner_id", user.id)
    .maybeSingle();
  const existingRow = asRow<{ source_insights?: unknown; strategy_summary?: string | null }>(
    existing.data,
  );
  const sourceInsights = Array.isArray(existingRow?.source_insights)
    ? [...existingRow.source_insights, insight]
    : [insight];

  await opsTable(supabase, "marketing_os_campaign_briefs")
    .upsert(
      {
        owner_id: user.id,
        organization_id: user.id,
        campaign_id: campaignId,
        strategy_summary: existingRow?.strategy_summary ?? insight.body,
        source_insights: sourceInsights,
      },
      { onConflict: "campaign_id" },
    )
    .select("id")
    .maybeSingle();

  await recordInsight(supabase, user.id, formData, "converted", campaignId);
  revalidateOps(campaignId);
}

export async function createTaskFromInsightAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const insight = insightPayload(formData);

  await opsTable(supabase, "marketing_os_work_items").insert({
    owner_id: user.id,
    organization_id: user.id,
    campaign_id: textValue(formData, "campaign_id"),
    client_id: textValue(formData, "client_id"),
    title: insight.title,
    description: insight.body,
    work_type: "strategy",
    status: "not_started",
    priority: "medium",
    source_type: "intelligence",
    created_by: user.id,
  });

  await recordInsight(supabase, user.id, formData, "converted");
  revalidateOps();
}

export async function assignInsightToTeamAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const insight = insightPayload(formData);

  await opsTable(supabase, "marketing_os_work_items").insert({
    owner_id: user.id,
    organization_id: user.id,
    campaign_id: textValue(formData, "campaign_id"),
    client_id: textValue(formData, "client_id"),
    title: insight.title,
    description: insight.body,
    work_type: "strategy",
    status: "in_progress",
    priority: "high",
    assignee_name: textValue(formData, "assignee_name") ?? "Marketing team",
    source_type: "intelligence",
    created_by: user.id,
  });

  await recordInsight(supabase, user.id, formData, "converted");
  revalidateOps();
}

export async function saveInsightForLaterAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  await recordInsight(supabase, user.id, formData, "saved");
  revalidatePath("/intelligence");
}

export async function dismissInsightAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  await recordInsight(supabase, user.id, formData, "dismissed");
  revalidatePath("/intelligence");
}

async function recordInsight(
  supabase: unknown,
  ownerId: string,
  formData: FormData,
  status: "saved" | "dismissed" | "converted",
  campaignId = textValue(formData, "campaign_id"),
) {
  const insight = insightPayload(formData);
  await opsTable(supabase, "marketing_os_saved_insights").insert({
    owner_id: ownerId,
    organization_id: ownerId,
    report_id: textValue(formData, "report_id"),
    campaign_id: campaignId,
    client_id: textValue(formData, "client_id"),
    title: insight.title,
    insight_type: insight.type,
    body: insight.body,
    source: insight.source,
    status,
    action_log: [
      {
        status,
        at: new Date().toISOString(),
      },
    ],
  });
}

function revalidateOps(campaignId?: string | null) {
  revalidatePath("/intelligence");
  revalidatePath("/dashboard");
  revalidatePath("/campaigns");
  revalidatePath("/work");
  revalidatePath("/content/ideas");
  if (campaignId) revalidatePath(`/campaigns/${campaignId}`);
}
