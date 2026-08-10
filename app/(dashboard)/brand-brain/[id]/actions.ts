"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import type { CtaLink, Faq } from "@/lib/brand-brain";
import type { BrandBrain } from "@/lib/supabase/types";

export type FormState = { error: string } | { ok: true } | null;
const SAVE_TIMEOUT_MS = 15000;

function parseCtaLinks(v: FormDataEntryValue | null): CtaLink[] {
  // One per line: "Label | https://url"
  return String(v ?? "")
    .split("\n")
    .map((line) => {
      const [label, url] = line.split("|").map((s) => s.trim());
      return label && url ? { label, url } : null;
    })
    .filter((x): x is CtaLink => x !== null);
}

function parseFaqs(form: FormData): Faq[] {
  const faqs: Faq[] = [];
  for (let i = 1; i <= 3; i += 1) {
    const q = String(form.get(`faq_q_${i}`) ?? "").trim();
    const a = String(form.get(`faq_a_${i}`) ?? "").trim();
    if (q && a) faqs.push({ q, a });
  }
  return faqs;
}

function parseList(v: FormDataEntryValue | null): string[] {
  return String(v ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseFormality(v: FormDataEntryValue | null) {
  const value = Number(v ?? 50);
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function withTimeout<T>(
  promise: PromiseLike<T>,
  label: string,
  ms = SAVE_TIMEOUT_MS,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} took too long. Please try again.`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function missingSchemaColumn(error: { code?: string; message?: string } | null) {
  if (!error) return null;
  const message = error.message ?? "";
  const isSchemaCacheError =
    error.code === "PGRST204" || message.toLowerCase().includes("schema cache");
  if (!isSchemaCacheError) return null;
  return message.match(/'([^']+)' column/)?.[1] ?? null;
}

async function saveBrandBrainPayload(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  payload: Record<string, unknown>,
) {
  const payloadForSave = { ...payload };
  const skippedColumns: string[] = [];

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { error } = await withTimeout(
      supabase
        .from("marketing_os_brand_brains")
        .upsert(payloadForSave as never, { onConflict: "agent_id" }),
      "Saving Brand Brain",
    );
    if (!error) return { error: null, skippedColumns };

    const missingColumn = missingSchemaColumn(error);
    if (
      missingColumn &&
      missingColumn !== "agent_id" &&
      missingColumn !== "owner_id" &&
      missingColumn in payloadForSave
    ) {
      if (missingColumn === "faqs") {
        return {
          error: new Error(
            "FAQ saving needs the latest Brand Brain database columns. Run the latest Supabase migration, then try again.",
          ),
          skippedColumns,
        };
      }
      delete payloadForSave[missingColumn];
      skippedColumns.push(missingColumn);
      continue;
    }

    return { error, skippedColumns };
  }

  return {
    error: new Error("Brand Brain save could not complete after retrying."),
    skippedColumns,
  };
}

export async function saveBrandBrainAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const { user, supabase } = await requireUser();
    const agentId = String(formData.get("agent_id") ?? "");
    if (!agentId) return { error: "Missing agent." };

    // Ownership check (RLS also enforces).
    const { data: agent } = await withTimeout(
      supabase
        .from("marketing_os_writing_agents")
        .select("id")
        .eq("id", agentId)
        .maybeSingle(),
      "Checking agent access",
    );
    if (!agent) return { error: "Agent not found." };

    const str = (k: string) => String(formData.get(k) ?? "").trim() || null;
    const tones = formData
      .getAll("tone")
      .map((item) => String(item).trim())
      .filter(Boolean);
    const { data: existingBrain } = await withTimeout(
      supabase
        .from("marketing_os_brand_brains")
        .select("*")
        .eq("agent_id", agentId)
        .maybeSingle(),
      "Loading Brand Brain",
    );
    const brain = existingBrain as BrandBrain | null;

    const brainPayload = {
      agent_id: agentId,
      owner_id: user.id,
      business_name: str("business_name"),
      industry: str("industry"),
      description: str("description"),
      language: str("language") ?? "English",
      tone: tones.length ? tones : (brain?.tone ?? []),
      tone_notes: str("tone_notes"),
      offers: str("offers"),
      services_products: str("services_products"),
      pricing: str("pricing"),
      brand_voice_examples: str("brand_voice_examples"),
      web_link: str("web_link"),
      booking_link: str("booking_link"),
      allowed_ctas: str("allowed_ctas"),
      cta_keywords: parseList(formData.get("cta_keywords")),
      cta_links: parseCtaLinks(formData.get("cta_links")),
      faqs: parseFaqs(formData),
      emoji_allowed: formData.get("emoji_allowed") === "on",
      formality_level: parseFormality(formData.get("formality_level")),
      location: str("location"),
      hours: str("hours"),
      phone: str("phone"),
    };

    const { error } = await saveBrandBrainPayload(supabase, brainPayload);
    if (error) {
      return { error: error.message };
    }

    revalidatePath(`/brand-brain/${agentId}`);
    revalidatePath(`/agents/${agentId}`);
    revalidatePath("/clients");
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Brand Brain save failed. Please try again.",
    };
  }
}
