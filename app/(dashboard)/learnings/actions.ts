"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { asRows, opsTable } from "@/lib/marketing-os/operations";
import {
  LEARNING_KINDS,
  LEARNING_SOURCES,
  confidenceFor,
  mergeLearning,
  originForSource,
  type LearningKind,
  type LearningSource,
} from "@/lib/brand-learnings";

function readKind(value: FormDataEntryValue | null): LearningKind {
  const clean = String(value ?? "").trim();
  return (LEARNING_KINDS as readonly string[]).includes(clean)
    ? (clean as LearningKind)
    : "other";
}

function readSource(value: FormDataEntryValue | null): LearningSource {
  const clean = String(value ?? "").trim();
  return (LEARNING_SOURCES as readonly string[]).includes(clean)
    ? (clean as LearningSource)
    : "manual";
}

/**
 * Accepts a proposed learning.
 *
 * Nothing writes here without a person choosing to: a Brand Brain that edits
 * itself is one nobody can trust with a client's voice. The same lesson
 * arriving twice accumulates evidence rather than becoming a second rule the
 * writer has to reconcile.
 */
export async function saveLearningAction(formData: FormData) {
  const { user, supabase } = await requireUser();

  const agentId = String(formData.get("agent_id") ?? "").trim();
  const statement = String(formData.get("statement") ?? "").trim();
  if (!agentId || !statement) return;

  const source = readSource(formData.get("source"));
  const clientId = String(formData.get("client_id") ?? "").trim() || null;
  const examples = Math.max(1, Number(formData.get("supporting_examples") ?? 1) || 1);

  // Matched the way the database matches, so this merges rather than colliding.
  const { data: existingRows } = await opsTable(supabase, "marketing_os_brand_learnings")
    .select("id, statement, source, supporting_examples, confidence")
    .eq("owner_id", user.id)
    .eq("agent_id", agentId);

  const normalised = statement.replace(/\s+/g, " ").toLowerCase();
  const existing = asRows<{
    id: string;
    statement: string;
    source: LearningSource;
    supporting_examples: number;
    confidence: number;
  }>(existingRows).find(
    (row) => row.statement.trim().replace(/\s+/g, " ").toLowerCase() === normalised,
  );

  if (existing) {
    const merged = mergeLearning(existing, { source, supporting_examples: examples });
    await opsTable(supabase, "marketing_os_brand_learnings")
      .update({ ...merged, active: true, learned_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("owner_id", user.id);
  } else {
    await opsTable(supabase, "marketing_os_brand_learnings").insert({
      owner_id: user.id,
      agent_id: agentId,
      client_id: clientId,
      statement,
      kind: readKind(formData.get("kind")),
      source,
      origin: originForSource(source),
      confidence: confidenceFor(source, examples),
      supporting_examples: examples,
      evidence: { note: String(formData.get("evidence") ?? "").trim() || null },
    });
  }

  revalidatePath(`/agents/${agentId}`);
  revalidatePath("/performance");
}

/**
 * Accepts a Performance Intelligence finding as a learning.
 *
 * The whole point of the analysis is that it changes what gets written next.
 * Until this existed the report was a page a person read and then closed, and
 * the writer went on making the same choices the report had just argued
 * against.
 *
 * One example, not the report's post count: the analysis found this pattern
 * once. If the next report finds it again the evidence accumulates on its own,
 * which is a truer account than borrowing the sample size of the study.
 */
export async function saveInsightAsLearningAction(formData: FormData) {
  const merged = new FormData();
  merged.set("agent_id", String(formData.get("agent_id") ?? ""));
  merged.set("client_id", String(formData.get("client_id") ?? ""));
  merged.set("statement", String(formData.get("insight_body") ?? formData.get("statement") ?? ""));
  merged.set("kind", String(formData.get("kind") ?? "voice_pattern"));
  merged.set("source", "performance_intelligence");
  merged.set("supporting_examples", "1");
  merged.set("evidence", String(formData.get("insight_title") ?? ""));
  await saveLearningAction(merged);
}

/**
 * Turns a learning off without losing it.
 *
 * Archiving rather than deleting, because turning a rule off is a decision
 * worth being able to reverse and its evidence stays useful either way.
 */
export async function setLearningActiveAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const id = String(formData.get("id") ?? "").trim();
  const agentId = String(formData.get("agent_id") ?? "").trim();
  if (!id) return;

  await opsTable(supabase, "marketing_os_brand_learnings")
    .update({ active: formData.get("active") === "true" })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (agentId) revalidatePath(`/agents/${agentId}`);
}

export async function deleteLearningAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const id = String(formData.get("id") ?? "").trim();
  const agentId = String(formData.get("agent_id") ?? "").trim();
  if (!id) return;

  await opsTable(supabase, "marketing_os_brand_learnings")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);

  if (agentId) revalidatePath(`/agents/${agentId}`);
}
