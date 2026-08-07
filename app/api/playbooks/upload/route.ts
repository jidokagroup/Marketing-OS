import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth";
import { extractFromFile } from "@/lib/extract";
import { isOpsSchemaMissing, opsTable } from "@/lib/marketing-os/operations";
import { scanPlaybookText } from "@/lib/playbooks/ingest";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PLAYBOOK_UPLOAD_BYTES = 25 * 1024 * 1024;

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user, supabase } = context;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a playbook document first." }, { status: 400 });
  }
  if (file.size > MAX_PLAYBOOK_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Playbook uploads must be under 25 MB." }, { status: 413 });
  }

  const mimeType = file.type || "application/octet-stream";
  const buffer = Buffer.from(await file.arrayBuffer());
  let extractedText = "";

  try {
    extractedText = await extractFromFile(buffer, mimeType, file.name);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not scan this playbook." },
      { status: 422 },
    );
  }

  if (!extractedText || extractedText.length < 20) {
    return NextResponse.json(
      { error: "No readable playbook text could be extracted from this file." },
      { status: 422 },
    );
  }

  const scan = scanPlaybookText(extractedText, file.name);
  const title = cleanText(form.get("title")) ?? scan.title;
  const category = cleanText(form.get("category")) ?? scan.category;
  const ownerName = cleanText(form.get("owner_name"));

  const playbookResult = await opsTable(supabase, "marketing_os_playbooks")
    .insert({
      owner_id: user.id,
      organization_id: user.id,
      title,
      category,
      status: "active",
      summary: scan.summary,
      steps: scan.steps,
      owner_name: ownerName,
      last_reviewed_at: new Date().toISOString(),
      source_type: "upload",
      source_file_name: file.name,
      source_mime_type: mimeType,
      source_byte_size: file.size,
      extracted_text: extractedText,
      extraction_status: "extracted",
    })
    .select("id, title")
    .single();

  if (isOpsSchemaMissing(playbookResult.error)) {
    return NextResponse.json(
      { error: "Playbook upload tables need the latest Supabase migration." },
      { status: 500 },
    );
  }
  if (playbookResult.error || !playbookResult.data) {
    return NextResponse.json(
      { error: playbookResult.error?.message ?? "Could not save playbook." },
      { status: 500 },
    );
  }

  const playbook = playbookResult.data as { id: string; title: string };
  let memorySaved = false;
  const memoryResult = await opsTable(supabase, "marketing_os_memory_records")
    .insert({
      owner_id: user.id,
      organization_id: user.id,
      record_type: "Playbook",
      title,
      information: scan.memoryInformation,
      source: "Uploaded playbook",
      source_record_id: playbook.id,
      memory_owner: scan.memoryOwner,
      confidence_level: "User Confirmed",
      affected_business_systems: scan.affectedSystems,
      status: "active",
    })
    .select("id")
    .maybeSingle();

  if (!isOpsSchemaMissing(memoryResult.error) && memoryResult.data) {
    memorySaved = true;
    const memoryId = (memoryResult.data as { id: string }).id;
    await opsTable(supabase, "marketing_os_playbooks")
      .update({ orchestrator_memory_id: memoryId })
      .eq("id", playbook.id)
      .eq("owner_id", user.id);
  }

  revalidatePath("/playbooks");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/core/success-intelligence");

  return NextResponse.json({
    playbook,
    memory_saved: memorySaved,
    category,
    affected_systems: scan.affectedSystems,
  });
}
