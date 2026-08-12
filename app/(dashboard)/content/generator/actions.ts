"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildBrandBrainBrief } from "@/lib/brand-brain";
import { requireUser } from "@/lib/auth";
import { runContentGeneratorTrendReport, type ContentGeneratorSource } from "@/lib/ai/content-generator-intel";
import {
  isOpsSchemaMissing,
  opsTable,
} from "@/lib/marketing-os/operations";
import type { BrandBrain } from "@/lib/supabase/types";

const SUPPORTED_SOURCE_PLATFORMS = new Set([
  "instagram",
  "facebook",
  "youtube",
  "tiktok",
  "x",
  "linkedin",
  "website",
  "podcast",
  "newsletter",
  "other",
]);

const PLATFORM_ALIASES: Record<string, string> = {
  instagram: "instagram",
  ig: "instagram",
  facebook: "facebook",
  fb: "facebook",
  youtube: "youtube",
  yt: "youtube",
  tiktok: "tiktok",
  tik_tok: "tiktok",
  x: "x",
  twitter: "x",
  linkedin: "linkedin",
  website: "website",
  site: "website",
  podcast: "podcast",
  newsletter: "newsletter",
  substack: "newsletter",
  email: "newsletter",
};

function textValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function normalizeUrl(value: string) {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.includes(".") && !value.includes(" ")) return `https://${value}`;
  return null;
}

function platformFromHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host.includes("instagram.com")) return "instagram";
  if (host.includes("facebook.com") || host.includes("fb.com")) return "facebook";
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
  if (host.includes("tiktok.com")) return "tiktok";
  if (host.includes("x.com") || host.includes("twitter.com")) return "x";
  if (host.includes("linkedin.com")) return "linkedin";
  if (host.includes("podcasts.apple.com") || host.includes("spotify.com")) {
    return "podcast";
  }
  if (
    host.includes("substack.com") ||
    host.includes("beehiiv.com") ||
    host.includes("convertkit.com") ||
    host.includes("mailchi.mp")
  ) {
    return "newsletter";
  }
  return "website";
}

function cleanHandle(value: string) {
  return value
    .trim()
    .replace(/^[\s@]+/, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function sourceFromLine(line: string): ContentGeneratorSource | null {
  const raw = line.trim().replace(/,$/, "");
  if (!raw) return null;

  const explicit = raw.match(/^([a-zA-Z_ -]+)\s*[:|-]\s*(.+)$/);
  const explicitPlatform = explicit
    ? PLATFORM_ALIASES[explicit[1].trim().toLowerCase().replace(/\s+/g, "_")]
    : null;
  const sourceText = explicit ? explicit[2].trim() : raw;
  const profileUrl = normalizeUrl(sourceText);

  let platform = explicitPlatform ?? "other";
  let handle = cleanHandle(sourceText);

  if (profileUrl) {
    try {
      const url = new URL(profileUrl);
      platform = explicitPlatform ?? platformFromHost(url.hostname);
      const pathParts = url.pathname
        .split("/")
        .map((part) => part.trim())
        .filter(Boolean);
      handle = cleanHandle(
        pathParts.find((part) => part.startsWith("@")) ??
          pathParts[pathParts.length - 1] ??
          url.hostname,
      );
    } catch {
      platform = explicitPlatform ?? "website";
    }
  } else if (!explicitPlatform) {
    const lower = sourceText.toLowerCase();
    const found = Object.entries(PLATFORM_ALIASES).find(([alias]) =>
      lower.includes(alias),
    );
    platform = found?.[1] ?? "other";
  }

  if (!SUPPORTED_SOURCE_PLATFORMS.has(platform)) platform = "other";
  if (!handle) handle = raw;

  return {
    raw,
    platform,
    handle,
    profileUrl,
    displayName: handle.startsWith("@") ? handle : `@${handle}`,
  };
}

function parseSources(value: string) {
  const dedupe = new Map<string, ContentGeneratorSource>();
  for (const line of value.split(/\n|,/)) {
    const source = sourceFromLine(line);
    if (!source) continue;
    dedupe.set(`${source.platform}:${source.handle.toLowerCase()}`, source);
  }
  return [...dedupe.values()].slice(0, 10);
}

function cleanChannels(formData: FormData) {
  const values = formData
    .getAll("channels")
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(values)];
  return unique.length ? unique : ["instagram"];
}

export async function generateCompetitorIdeasAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const clientId = textValue(formData, "client_id");
  const requestedAgentId = textValue(formData, "agent_id");
  const channels = cleanChannels(formData);
  const sources = parseSources(String(formData.get("competitor_accounts") ?? ""));
  const goal = textValue(formData, "goal");
  const offer = textValue(formData, "offer");

  const { data: client } = clientId
    ? await supabase
        .from("marketing_os_clients")
        .select("id, name, industry, notes")
        .eq("id", clientId)
        .eq("owner_id", user.id)
        .maybeSingle()
    : { data: null };

  const { data: agent } = requestedAgentId
    ? await supabase
        .from("marketing_os_writing_agents")
        .select("id, name, client_id, industry, notes")
        .eq("id", requestedAgentId)
        .eq("owner_id", user.id)
        .maybeSingle()
    : clientId
      ? await supabase
          .from("marketing_os_writing_agents")
          .select("id, name, client_id, industry, notes")
          .eq("owner_id", user.id)
          .eq("client_id", clientId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : await supabase
          .from("marketing_os_writing_agents")
          .select("id, name, client_id, industry, notes")
          .eq("owner_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

  const agentId = agent?.id ?? null;
  const { data: brandBrain } = agentId
    ? await supabase
        .from("marketing_os_brand_brains")
        .select("*")
        .eq("agent_id", agentId)
        .eq("owner_id", user.id)
        .maybeSingle()
    : { data: null };

  if (sources.length) {
    const watchlistRows = sources.map((source) => ({
      owner_id: user.id,
      client_id: clientId,
      agent_id: agentId,
      platform: source.platform,
      handle: source.handle,
      profile_url: source.profileUrl,
      display_name: source.displayName,
      niche: client?.industry ?? agent?.industry ?? "marketing",
      scan_enabled: true,
      notes: "Saved from Content Generator watchlist.",
    }));
    const { error } = await opsTable(supabase, "marketing_os_competitor_accounts")
      .upsert(watchlistRows, {
        onConflict: "owner_id,platform,handle,client_id",
      });
    if (error && !isOpsSchemaMissing(error)) {
      throw new Error(error.message);
    }
  }

  const report = await runContentGeneratorTrendReport({
    client: client
      ? {
          name: client.name,
          industry: client.industry,
          notes: client.notes,
        }
      : null,
    sources,
    channels,
    brandBrainBrief: buildBrandBrainBrief((brandBrain as BrandBrain) ?? null),
    goal,
    offer,
  });

  const { data: insertedReport, error: reportError } = await supabase
    .from("marketing_os_social_intelligence_reports")
    .insert({
      owner_id: user.id,
      agent_id: agentId,
      industry: client?.name ?? client?.industry ?? "general marketing",
      platforms: channels,
      competitor_accounts: sources.map((source) => source.raw),
      trending_topics: report.trending_topics,
      hooks: report.hooks,
      audios: [
        "Audio and short-form trend detection can be enriched by connected platform analytics and a future browser connector.",
      ],
      content_opportunities: {
        items: report.content_opportunities,
        positioning: report.brand_angles,
        competitor_patterns: report.competitor_patterns,
        content_gaps: report.content_gaps,
        hook_library: report.hook_library,
        offer_tracker: report.offer_tracker,
        comment_themes: report.comment_themes,
        opportunity_signals: report.opportunity_signals,
        generated_ideas: report.generated_ideas,
        scheduler_suggestions: report.scheduler_suggestions,
        limitations: report.limitations,
        source: "content_generator_competitor_watchlist",
      },
      summary: report.summary,
      scanned_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (reportError || !insertedReport) {
    throw new Error(reportError?.message ?? "Could not save trend report");
  }

  const ideaRows = report.generated_ideas.map((idea) => ({
    owner_id: user.id,
    organization_id: user.id,
    client_id: clientId,
    agent_id: agentId,
    title: idea.title,
    description: `${idea.description}\n\nClient-agent prompt: ${idea.generator_prompt}\n\nScheduler note: ${idea.scheduler_suggestion}`,
    source: "content_generator_competitor_scan",
    source_url: sources[0]?.profileUrl,
    format: idea.format,
    platform: idea.channel,
    funnel_stage: idea.funnel_stage,
    status: "idea",
    insight_payload: {
      report_id: insertedReport.id,
      trend_report: report.summary,
      watchlist: sources,
      channels,
      generator_prompt: idea.generator_prompt,
      scheduler_suggestion: idea.scheduler_suggestion,
    },
  }));

  if (ideaRows.length) {
    const { error: ideasError } = await opsTable(
      supabase,
      "marketing_os_content_ideas",
    ).insert(ideaRows);
    if (ideasError && !isOpsSchemaMissing(ideasError)) {
      throw new Error(ideasError.message);
    }
  }

  revalidatePath("/content");
  revalidatePath("/content/generator");
  revalidatePath("/content/ideas");
  revalidatePath("/intelligence");
  revalidatePath("/scheduler");
  redirect(`/content/generator?report=${insertedReport.id}`);
}
