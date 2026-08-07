import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";

export const runtime = "nodejs";

// Media goes straight from the browser to Supabase Storage via a signed
// upload URL, so platform request-body caps do not apply. Keep this limit in
// sync with the Supabase Storage bucket limit for marketing-os-media.
const DEFAULT_MAX_MEDIA_UPLOAD_MB = 500;
const configuredMaxMediaMb = Number(process.env.NEXT_PUBLIC_MAX_MEDIA_UPLOAD_MB);
const MAX_MEDIA_UPLOAD_MB =
  Number.isFinite(configuredMaxMediaMb) && configuredMaxMediaMb > 0
    ? configuredMaxMediaMb
    : DEFAULT_MAX_MEDIA_UPLOAD_MB;
const MAX_MEDIA_BYTES = MAX_MEDIA_UPLOAD_MB * 1024 * 1024;

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user, supabase } = context;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const agentId = String(body.agent_id ?? "");
  const fileName = String(body.file_name ?? "").trim();
  const fileSize = Number(body.file_size ?? 0);

  if (!agentId) {
    return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
  }
  if (!fileName) {
    return NextResponse.json({ error: "file_name is required" }, { status: 400 });
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return NextResponse.json({ error: "file_size is required" }, { status: 400 });
  }
  if (fileSize > MAX_MEDIA_BYTES) {
    return NextResponse.json(
      { error: `Media file exceeds ${MAX_MEDIA_UPLOAD_MB} MB` },
      { status: 413 },
    );
  }

  const { data: agent } = await supabase
    .from("marketing_os_writing_agents")
    .select("id")
    .eq("id", agentId)
    .maybeSingle();
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const mediaPath = `${user.id}/${agentId}/${crypto.randomUUID()}-${safe}`;
  const { data, error } = await supabase.storage
    .from("marketing-os-media")
    .createSignedUploadUrl(mediaPath);
  if (error || !data?.token) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create an upload URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    mediaPath,
    token: data.token,
    signedUrl: data.signedUrl,
  });
}
