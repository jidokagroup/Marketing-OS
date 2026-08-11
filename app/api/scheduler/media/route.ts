import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

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
const MEDIA_BUCKET = "marketing-os-media";
type BucketLimitReport = {
  bucket: unknown;
  liveLimitBytes: number | null;
  ready: boolean;
  updateError: string | null;
};
let mediaBucketReady: Promise<BucketLimitReport> | null = null;

function formatMb(bytes: number) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

function bucketLimitBytes(bucket: unknown) {
  if (!bucket || typeof bucket !== "object") return null;
  const record = bucket as Record<string, unknown>;
  const value = record.file_size_limit ?? record.fileSizeLimit;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function serviceRoleIsConfigured() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function storageLimitErrorMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : "";
  const lower = detail.toLowerCase();
  if (lower.includes("maximum allowed size")) {
    return "Supabase rejected the 500 MB bucket setting because the project global Storage file size limit is lower. On Pro, open Supabase Dashboard > Storage > Settings and set Global file size limit to at least 500 MB, then refresh and try again.";
  }
  if (!serviceRoleIsConfigured()) {
    return "Storage bucket is not ready for large video uploads because SUPABASE_SERVICE_ROLE_KEY is missing in Netlify.";
  }
  return "Storage bucket is not ready for large video uploads. Check the Supabase Storage global file size limit and bucket file size limit, then refresh and try again.";
}

async function inspectMediaBucketLimit(): Promise<BucketLimitReport> {
  const admin = createAdminClient();
  const bucketOptions = {
    public: false,
    fileSizeLimit: MAX_MEDIA_BYTES,
  };
  const current = await admin.storage.getBucket(MEDIA_BUCKET);
  const currentNotFound =
    current.error?.message.toLowerCase().includes("not found") ||
    current.error?.message.toLowerCase().includes("does not exist");
  if (current.error && !currentNotFound) throw current.error;

  const currentLimitBytes = bucketLimitBytes(current.data);
  if (currentLimitBytes && currentLimitBytes >= MAX_MEDIA_BYTES) {
    return {
      bucket: current.data,
      liveLimitBytes: currentLimitBytes,
      ready: true,
      updateError: null,
    };
  }

  const mutation = currentNotFound
    ? await admin.storage.createBucket(MEDIA_BUCKET, bucketOptions)
    : await admin.storage.updateBucket(MEDIA_BUCKET, bucketOptions);

  if (mutation.error) {
    return {
      bucket: current.data,
      liveLimitBytes: currentLimitBytes,
      ready: false,
      updateError: mutation.error.message,
    };
  }

  const updated = await admin.storage.getBucket(MEDIA_BUCKET);
  if (updated.error) throw updated.error;
  const updatedLimitBytes = bucketLimitBytes(updated.data);

  return {
    bucket: updated.data,
    liveLimitBytes: updatedLimitBytes,
    ready: Boolean(updatedLimitBytes && updatedLimitBytes >= MAX_MEDIA_BYTES),
    updateError: null,
  };
}

async function ensureMediaBucketLimit() {
  if (mediaBucketReady) return mediaBucketReady;

  const report = await inspectMediaBucketLimit();
  if (report.ready) {
    mediaBucketReady = Promise.resolve(report);
  }
  return report;
}

export async function GET() {
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await ensureMediaBucketLimit();
    const updateError = report.updateError
      ? new Error(report.updateError)
      : null;

    return NextResponse.json({
      bucket: MEDIA_BUCKET,
      service_role_configured: serviceRoleIsConfigured(),
      configured_limit_mb: MAX_MEDIA_UPLOAD_MB,
      configured_limit_bytes: MAX_MEDIA_BYTES,
      live_bucket_limit_mb: report.liveLimitBytes
        ? formatMb(report.liveLimitBytes)
        : null,
      live_bucket_limit_bytes: report.liveLimitBytes,
      bucket_update_error: report.updateError,
      message: updateError ? storageLimitErrorMessage(updateError) : null,
      ready_for_large_uploads: report.ready,
    });
  } catch (error) {
    return NextResponse.json(
      {
        bucket: MEDIA_BUCKET,
        service_role_configured: serviceRoleIsConfigured(),
        configured_limit_mb: MAX_MEDIA_UPLOAD_MB,
        message: storageLimitErrorMessage(error),
        error:
          error instanceof Error
            ? error.message
            : "Could not inspect media bucket",
      },
      { status: 500 },
    );
  }
}

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

  let report: BucketLimitReport;
  try {
    report = await ensureMediaBucketLimit();
  } catch (error) {
    return NextResponse.json(
      {
        error: storageLimitErrorMessage(error),
        detail:
          error instanceof Error
            ? error.message
            : "Could not verify marketing-os-media bucket limit",
        service_role_configured: serviceRoleIsConfigured(),
      },
      { status: 500 },
    );
  }

  if (!report.ready) {
    const updateError = report.updateError
      ? new Error(report.updateError)
      : new Error("Bucket limit is below the configured media upload limit.");
    return NextResponse.json(
      {
        error: storageLimitErrorMessage(updateError),
        bucket_update_error: report.updateError,
        live_bucket_limit_mb: report.liveLimitBytes
          ? formatMb(report.liveLimitBytes)
          : null,
        selected_file_mb: formatMb(fileSize),
        service_role_configured: serviceRoleIsConfigured(),
      },
      { status: 413 },
    );
  }

  if (report.liveLimitBytes && fileSize > report.liveLimitBytes) {
    return NextResponse.json(
      {
        error: `Supabase is still capping this bucket at ${formatMb(report.liveLimitBytes)} MB. The selected file is ${formatMb(fileSize)} MB. In Supabase Dashboard > Storage > Settings, set Global file size limit to at least ${MAX_MEDIA_UPLOAD_MB} MB, then refresh and try again.`,
        live_bucket_limit_mb: formatMb(report.liveLimitBytes),
        selected_file_mb: formatMb(fileSize),
      },
      { status: 413 },
    );
  }

  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const mediaPath = `${user.id}/${agentId}/${crypto.randomUUID()}-${safe}`;
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
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
