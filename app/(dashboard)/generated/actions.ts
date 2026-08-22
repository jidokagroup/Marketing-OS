"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { describeEdit, encodeEditSignal } from "@/lib/edit-signals";

function parseLines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function updateGeneratedContentAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const variant = String(formData.get("variant") ?? "");
  const primaryScript = String(formData.get("primary_script") ?? "");

  // Read before writing, so the edit can be compared against what the agent
  // actually wrote. A person striking the same phrase out every week is the
  // clearest preference signal the product has, and it used to be discarded.
  const { data: previous } = await supabase
    .from("marketing_os_generated_content")
    .select("agent_id, primary_script")
    .eq("id", id)
    .maybeSingle();

  await supabase
    .from("marketing_os_generated_content")
    .update({
      primary_script: String(formData.get("primary_script") ?? "") || null,
      long_version: String(formData.get("long_version") ?? "") || null,
      sales_version: String(formData.get("sales_version") ?? "") || null,
      blog_cta: String(formData.get("blog_cta") ?? "") || null,
      email_cta: String(formData.get("email_cta") ?? "") || null,
      blog_keywords: parseLines(formData.get("blog_keywords")),
      blog_link_suggestions: parseLines(formData.get("blog_link_suggestions")),
    })
    .eq("id", id);

  revalidatePath(`/generated/${id}`);
  revalidatePath("/generated");
  revalidatePath("/scheduler");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");

  const params = new URLSearchParams();
  if (variant) params.set("saved", variant);
  if (previous?.agent_id) {
    const signal = describeEdit(previous.primary_script ?? "", primaryScript);
    const encoded = encodeEditSignal(signal);
    // Only ask when there is something specific to ask about. A prompt with no
    // observation behind it is a nag, and people stop reading nags.
    if (signal.meaningful && encoded) params.set("learn", encoded);
  }
  const query = params.toString();
  redirect(`/generated/${id}${query ? `?${query}` : ""}`);
}

export async function toggleApprovalAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const currentlyApproved = String(formData.get("currently_approved") ?? "") === "1";

  await supabase
    .from("marketing_os_generated_content")
    .update({ approved_at: currentlyApproved ? null : new Date().toISOString() })
    .eq("id", id);

  revalidatePath(`/generated/${id}`);
  revalidatePath("/generated");
  revalidatePath("/dashboard");
}

export async function duplicateGeneratedContentAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { data: content } = await supabase
    .from("marketing_os_generated_content")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!content) return;

  const { data: copy } = await supabase
    .from("marketing_os_generated_content")
    .insert({
      agent_id: content.agent_id,
      owner_id: user.id,
      title: `Copy of ${content.title || content.topic || "generated piece"}`,
      topic: content.topic,
      goal: content.goal,
      platform: content.platform,
      audience: content.audience,
      offer: content.offer,
      cta: content.cta,
      length: content.length,
      notes: content.notes,
      primary_script: content.primary_script,
      alternate_hooks: content.alternate_hooks,
      alternate_ctas: content.alternate_ctas,
      long_version: content.long_version,
      blog_cta: content.blog_cta,
      email_cta: content.email_cta,
      blog_keywords: content.blog_keywords,
      blog_link_suggestions: content.blog_link_suggestions,
      sales_version: content.sales_version,
      retrieved_script_ids: content.retrieved_script_ids,
      overall_score: content.overall_score,
      below_threshold: content.below_threshold,
      attempts: content.attempts,
      model: content.model,
    })
    .select("id")
    .single();

  revalidatePath("/generated");
  revalidatePath("/dashboard");
  if (copy?.id) redirect(`/generated/${copy.id}`);
}

export async function deleteGeneratedContentAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("marketing_os_quality_scores").delete().eq("generated_content_id", id);
  await supabase
    .from("marketing_os_scheduled_posts")
    .update({ generated_content_id: null })
    .eq("generated_content_id", id);
  await supabase.from("marketing_os_generated_content").delete().eq("id", id);

  revalidatePath("/generated");
  revalidatePath("/scheduler");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect("/generated");
}
