import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SIGNED_URL_TTL_SECONDS = 180;

type JsonRecord = Record<string, unknown>;

function jsonResponse(body: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
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

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({
      error: "Cloud audio download is unavailable.",
      errorCode: "DOWNLOAD_UNAVAILABLE",
    }, 500);
  }

  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return jsonResponse({ error: "Authentication required", errorCode: "UNAUTHORIZED" }, 401);
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
      return jsonResponse({ error: "Invalid authentication token", errorCode: "UNAUTHORIZED" }, 401);
    }

    const { data: canRead, error: readError } = await admin.rpc("has_safety_audio_cloud_read_access", {
      p_user_id: user.id,
    });

    if (readError) {
      console.error("get-safety-audio-download-url read access lookup failed", {
        code: readError.code || "unknown",
      });
      return jsonResponse({
        error: "Cloud download is unavailable.",
        errorCode: "DOWNLOAD_UNAVAILABLE",
      }, 500);
    }

    if (canRead !== true) {
      return jsonResponse({
        error: "Wingman Pro is required to access cloud safety audio.",
        errorCode: "PRO_REQUIRED",
      }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as JsonRecord;
    const recordingId = getTrimmedString(body.recordingId);

    if (!recordingId) {
      return jsonResponse({
        error: "recordingId is required",
        errorCode: "BAD_REQUEST",
      }, 400);
    }

    const { data: recording, error: recordingError } = await admin
      .from("safety_audio_cloud_recordings")
      .select("id,bucket,object_path,file_name,mime_type,size_bytes,duration_ms,recorded_at,expires_at,status")
      .eq("id", recordingId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (recordingError || !recording) {
      return jsonResponse({
        error: "Cloud recording not found.",
        errorCode: "NOT_FOUND",
      }, 404);
    }

    const status = getTrimmedString(recording.status).toLowerCase();
    if (["deleted", "grace_deleted", "auto_downloaded"].includes(status)) {
      return jsonResponse({
        error: "Cloud recording is no longer available.",
        errorCode: "NOT_FOUND",
      }, 404);
    }

    const bucket = getTrimmedString(recording.bucket) || "safety-audio-cloud";
    const objectPath = getTrimmedString(recording.object_path);
    if (!objectPath) {
      return jsonResponse({
        error: "Cloud recording path is missing.",
        errorCode: "DOWNLOAD_UNAVAILABLE",
      }, 500);
    }

    const { data: signedData, error: signedError } = await admin
      .storage
      .from(bucket)
      .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);

    if (signedError || !signedData?.signedUrl) {
      console.error("get-safety-audio-download-url signed URL creation failed", {
        code: signedError?.code || "unknown",
      });
      return jsonResponse({
        error: "Unable to issue download URL right now.",
        errorCode: "DOWNLOAD_UNAVAILABLE",
      }, 500);
    }

    return jsonResponse({
      recordingId: recording.id,
      signedUrl: signedData.signedUrl,
      expiresIn: SIGNED_URL_TTL_SECONDS,
      metadata: {
        fileName: getTrimmedString(recording.file_name),
        mimeType: getTrimmedString(recording.mime_type),
        sizeBytes: Number(recording.size_bytes || 0),
        durationMs: Number(recording.duration_ms || 0),
        recordedAt: recording.recorded_at,
        expiresAt: recording.expires_at,
        status: recording.status,
      },
    });
  } catch (error) {
    console.error("get-safety-audio-download-url unexpected error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return jsonResponse({
      error: "Cloud download is unavailable.",
      errorCode: "DOWNLOAD_UNAVAILABLE",
    }, 500);
  }
});
