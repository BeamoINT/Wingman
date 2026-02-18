import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_BUCKET = "safety-audio-cloud";
const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_UPLOADS_PER_MINUTE = 24;

type JsonRecord = Record<string, unknown>;

type RateLimitState = {
  count: number;
  resetAtMs: number;
};

const rateLimitByUser = new Map<string, RateLimitState>();

function jsonResponse(body: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function getTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getPositiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
}

function toSafeFilename(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 96);
}

function getIsoTimestamp(value: unknown, fallback = new Date()): string {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return fallback.toISOString();
}

function addMonths(inputIso: string, months: number): string {
  const date = new Date(inputIso);
  if (Number.isNaN(date.getTime())) {
    return new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  }

  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next.toISOString();
}

function enforceRateLimit(userId: string): boolean {
  const nowMs = Date.now();
  const existing = rateLimitByUser.get(userId);

  if (!existing || existing.resetAtMs <= nowMs) {
    rateLimitByUser.set(userId, {
      count: 1,
      resetAtMs: nowMs + 60_000,
    });
    return true;
  }

  if (existing.count >= MAX_UPLOADS_PER_MINUTE) {
    return false;
  }

  existing.count += 1;
  rateLimitByUser.set(userId, existing);
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const bucket = getTrimmedString(Deno.env.get("SAFETY_AUDIO_CLOUD_BUCKET") || "") || DEFAULT_BUCKET;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({
      error: "Cloud upload is unavailable right now.",
      errorCode: "UPLOAD_UNAVAILABLE",
    }, 500);
  }

  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return jsonResponse({
      error: "Authentication required",
      errorCode: "UNAUTHORIZED",
    }, 401);
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
  const admin = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user?.id) {
      return jsonResponse({
        error: "Invalid authentication token",
        errorCode: "UNAUTHORIZED",
      }, 401);
    }

    if (!enforceRateLimit(user.id)) {
      return jsonResponse({
        error: "Upload rate limit reached. Please wait a minute and retry.",
        errorCode: "UPLOAD_RATE_LIMITED",
      }, 429);
    }

    const { data: canWrite, error: canWriteError } = await admin.rpc("has_safety_audio_cloud_write_access", {
      p_user_id: user.id,
    });

    if (canWriteError) {
      console.error("create-safety-audio-upload-url write access lookup failed", {
        code: canWriteError.code || "unknown",
      });
      return jsonResponse({
        error: "Cloud upload is temporarily unavailable.",
        errorCode: "UPLOAD_UNAVAILABLE",
      }, 500);
    }

    if (canWrite !== true) {
      const { data: canRead } = await admin.rpc("has_safety_audio_cloud_read_access", {
        p_user_id: user.id,
      });

      if (canRead === true) {
        return jsonResponse({
          error: "Cloud uploads are read-only during your downgrade grace period.",
          errorCode: "GRACE_READ_ONLY",
        }, 403);
      }

      return jsonResponse({
        error: "Wingman Pro is required for cloud safety audio uploads.",
        errorCode: "PRO_REQUIRED",
      }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as JsonRecord;

    const localRecordingId = getTrimmedString(body.localRecordingId);
    const mimeType = getTrimmedString(body.mimeType) || "audio/mp4";
    const fileNameInput = toSafeFilename(getTrimmedString(body.fileName));
    const contextTypeRaw = getTrimmedString(body.contextType).toLowerCase();
    const contextType = contextTypeRaw === "booking" || contextTypeRaw === "live_location" || contextTypeRaw === "manual"
      ? contextTypeRaw
      : "manual";
    const contextId = getTrimmedString(body.contextId) || null;
    const sourceRaw = getTrimmedString(body.source).toLowerCase();
    const source = sourceRaw === "manual"
      || sourceRaw === "auto_booking"
      || sourceRaw === "auto_live_location"
      || sourceRaw === "restarted"
      || sourceRaw === "cloud_download"
      ? sourceRaw
      : "manual";

    const sizeBytes = getPositiveInteger(body.sizeBytes);
    if (!sizeBytes || sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
      return jsonResponse({
        error: `sizeBytes must be between 1 and ${MAX_UPLOAD_SIZE_BYTES}.`,
        errorCode: "UPLOAD_UNAVAILABLE",
      }, 400);
    }

    const durationMs = getPositiveInteger(body.durationMs);
    const recordedAt = getIsoTimestamp(body.recordedAt);
    const expiresAt = addMonths(recordedAt, 3);

    const recordingFileName = fileNameInput || `${Date.now()}.m4a`;
    const objectPath = `${user.id}/${new Date(recordedAt).getUTCFullYear()}/${Date.now()}-${crypto.randomUUID()}-${recordingFileName}`;

    const { data: preferenceRow } = await admin
      .from("safety_preferences")
      .select("cloud_audio_retention_action")
      .eq("user_id", user.id)
      .maybeSingle();

    const retentionAction = getTrimmedString(preferenceRow?.cloud_audio_retention_action || "") || "auto_delete";

    const { data: metadataRow, error: insertError } = await admin
      .from("safety_audio_cloud_recordings")
      .insert({
        user_id: user.id,
        local_recording_id: localRecordingId || null,
        bucket,
        object_path: objectPath,
        file_name: recordingFileName,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        duration_ms: durationMs,
        recorded_at: recordedAt,
        expires_at: expiresAt,
        auto_action: retentionAction,
        status: "uploading",
      })
      .select("id,bucket,object_path,status,expires_at")
      .single();

    if (insertError || !metadataRow?.id) {
      console.error("create-safety-audio-upload-url metadata insert failed", {
        code: insertError?.code || "unknown",
      });
      return jsonResponse({
        error: "Unable to prepare cloud upload metadata.",
        errorCode: "UPLOAD_UNAVAILABLE",
      }, 500);
    }

    const { data: signedUpload, error: signedUploadError } = await admin
      .storage
      .from(bucket)
      .createSignedUploadUrl(objectPath);

    if (signedUploadError || !signedUpload?.signedUrl) {
      await admin
        .from("safety_audio_cloud_recordings")
        .update({
          status: "upload_failed",
          last_error_code: "SIGNED_UPLOAD_FAILED",
          last_error_message: signedUploadError?.message || "Failed to mint signed upload URL",
          retry_count: 1,
          last_retry_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", metadataRow.id);

      console.error("create-safety-audio-upload-url signed URL creation failed", {
        code: signedUploadError?.code || "unknown",
      });

      return jsonResponse({
        error: "Unable to create cloud upload URL right now.",
        errorCode: "UPLOAD_UNAVAILABLE",
      }, 500);
    }

    return jsonResponse({
      recordingId: metadataRow.id,
      bucket: metadataRow.bucket,
      objectPath: metadataRow.object_path,
      status: metadataRow.status,
      expiresAt: metadataRow.expires_at,
      signedUrl: signedUpload.signedUrl,
      token: signedUpload.token,
      path: signedUpload.path,
      maxUploadSizeBytes: MAX_UPLOAD_SIZE_BYTES,
    });
  } catch (error) {
    console.error("create-safety-audio-upload-url unexpected error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return jsonResponse({
      error: "Cloud upload is unavailable right now.",
      errorCode: "UPLOAD_UNAVAILABLE",
    }, 500);
  }
});
