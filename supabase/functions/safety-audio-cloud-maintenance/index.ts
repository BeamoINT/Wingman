import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-maintenance-secret",
};

const RETENTION_NOTICE_THRESHOLDS = [30, 7, 1] as const;
const GRACE_NOTICE_THRESHOLDS = [30, 14, 7, 3, 1] as const;
const STALE_UPLOADING_AFTER_HOURS = 2;

const DEFAULT_BUCKET = "safety-audio-cloud";

type JsonRecord = Record<string, unknown>;

type CloudRecordingRow = {
  id: string;
  user_id: string;
  bucket: string | null;
  object_path: string;
  file_name: string | null;
  recorded_at: string;
  expires_at: string;
  status: string;
  auto_action: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  subscription_tier: string | null;
  safety_audio_cloud_grace_until: string | null;
  safety_audio_cloud_downgraded_at: string | null;
};

type SafetyPrefRow = {
  user_id: string;
  cloud_audio_retention_action: string | null;
};

type NoticeType = "retention_warning" | "retention_action" | "grace_warning" | "grace_expired";
type NoticeChannel = "in_app" | "email";

function jsonResponse(body: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseIso(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function getUtcDayTimestamp(input: Date): number {
  return Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate());
}

function daysUntilDate(targetIso: string, now = new Date()): number | null {
  const targetDate = parseIso(targetIso);
  if (!targetDate) {
    return null;
  }

  const targetDay = getUtcDayTimestamp(targetDate);
  const today = getUtcDayTimestamp(now);
  return Math.floor((targetDay - today) / (24 * 60 * 60 * 1000));
}

function formatDate(iso: string): string {
  const parsed = parseIso(iso);
  if (!parsed) {
    return "soon";
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function wasNoticeLogged(
  admin: ReturnType<typeof createClient>,
  params: {
    userId: string;
    recordingId?: string | null;
    noticeType: NoticeType;
    thresholdDays?: number | null;
    channel: NoticeChannel;
  },
): Promise<boolean> {
  let query = admin
    .from("safety_audio_cloud_notice_log")
    .select("id")
    .eq("user_id", params.userId)
    .eq("notice_type", params.noticeType)
    .eq("channel", params.channel);

  if (params.thresholdDays == null) {
    query = query.is("threshold_days", null);
  } else {
    query = query.eq("threshold_days", params.thresholdDays);
  }

  if (params.recordingId) {
    query = query.eq("recording_id", params.recordingId);
  } else {
    query = query.is("recording_id", null);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    return false;
  }

  return Boolean(data?.id);
}

async function logNotice(
  admin: ReturnType<typeof createClient>,
  params: {
    userId: string;
    recordingId?: string | null;
    noticeType: NoticeType;
    thresholdDays?: number | null;
    channel: NoticeChannel;
  },
): Promise<boolean> {
  const { error } = await admin
    .from("safety_audio_cloud_notice_log")
    .insert({
      user_id: params.userId,
      recording_id: params.recordingId ?? null,
      notice_type: params.noticeType,
      threshold_days: params.thresholdDays ?? null,
      channel: params.channel,
      logged_at: new Date().toISOString(),
    });

  if (!error) {
    return true;
  }

  if (String(error.code || "") === "23505") {
    return false;
  }

  console.error("safety-audio-cloud-maintenance logNotice failed", {
    code: error.code || "unknown",
  });
  return false;
}

async function insertInAppNotice(
  admin: ReturnType<typeof createClient>,
  params: {
    userId: string;
    recordingId?: string | null;
    noticeType: NoticeType;
    thresholdDays?: number | null;
    title: string;
    message: string;
    metadata?: JsonRecord;
    expiresAt?: string | null;
  },
): Promise<void> {
  const inserted = await logNotice(admin, {
    userId: params.userId,
    recordingId: params.recordingId ?? null,
    noticeType: params.noticeType,
    thresholdDays: params.thresholdDays ?? null,
    channel: "in_app",
  });

  if (!inserted) {
    return;
  }

  const { error } = await admin
    .from("safety_audio_cloud_notices")
    .insert({
      user_id: params.userId,
      recording_id: params.recordingId ?? null,
      notice_type: params.noticeType,
      threshold_days: params.thresholdDays ?? null,
      title: params.title,
      message: params.message,
      metadata: params.metadata || {},
      expires_at: params.expiresAt ?? null,
    });

  if (error) {
    console.error("safety-audio-cloud-maintenance insertInAppNotice failed", {
      code: error.code || "unknown",
    });
  }
}

async function sendReminderEmail(params: {
  resendApiKey: string;
  resendFromEmail: string;
  toEmail: string;
  subject: string;
  text: string;
  html: string;
}): Promise<boolean> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.resendFromEmail,
      to: [params.toEmail],
      subject: params.subject,
      text: params.text,
      html: params.html,
    }),
  });

  return response.ok;
}

function toCloudAction(value: string | null | undefined): "auto_delete" | "auto_download" {
  return toTrimmedString(value).toLowerCase() === "auto_download" ? "auto_download" : "auto_delete";
}

async function removeStorageObject(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  objectPath: string,
): Promise<boolean> {
  const { error } = await admin.storage.from(bucket || DEFAULT_BUCKET).remove([objectPath]);
  if (!error) {
    return true;
  }

  const message = toTrimmedString(error.message).toLowerCase();
  if (message.includes("not found")) {
    return true;
  }

  console.error("safety-audio-cloud-maintenance removeStorageObject failed", {
    code: error.name || "unknown",
  });
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const maintenanceSecret = Deno.env.get("SAFETY_AUDIO_CLOUD_MAINTENANCE_SECRET");
  const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
  const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "";

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  if (maintenanceSecret) {
    const providedSecret = req.headers.get("x-maintenance-secret");
    if (!providedSecret || providedSecret !== maintenanceSecret) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const inThirtyDaysIso = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: candidateRecordings, error: candidateError } = await admin
      .from("safety_audio_cloud_recordings")
      .select("id,user_id,bucket,object_path,file_name,recorded_at,expires_at,status,auto_action")
      .in("status", ["uploaded", "upload_failed", "pending_auto_download"])
      .lte("expires_at", inThirtyDaysIso)
      .order("expires_at", { ascending: true })
      .limit(2000);

    if (candidateError) {
      console.error("safety-audio-cloud-maintenance candidate query failed", {
        code: candidateError.code || "unknown",
      });
      return jsonResponse({ error: "Unable to load cloud recording candidates" }, 500);
    }

    const recordings = (candidateRecordings || []) as CloudRecordingRow[];
    const userIds = Array.from(new Set(recordings.map((row) => row.user_id).filter(Boolean)));

    const [profileRowsResult, preferenceRowsResult] = await Promise.all([
      userIds.length > 0
        ? admin
          .from("profiles")
          .select("id,email,first_name,subscription_tier,safety_audio_cloud_grace_until,safety_audio_cloud_downgraded_at")
          .in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length > 0
        ? admin
          .from("safety_preferences")
          .select("user_id,cloud_audio_retention_action")
          .in("user_id", userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const profileByUserId = new Map<string, ProfileRow>();
    for (const row of (profileRowsResult.data || []) as ProfileRow[]) {
      profileByUserId.set(row.id, row);
    }

    const preferenceByUserId = new Map<string, SafetyPrefRow>();
    for (const row of (preferenceRowsResult.data || []) as SafetyPrefRow[]) {
      preferenceByUserId.set(row.user_id, row);
    }

    let retentionInAppNotices = 0;
    let retentionEmailsSent = 0;
    let retentionEmailsFailed = 0;

    for (const row of recordings) {
      const daysUntil = daysUntilDate(row.expires_at, now);
      if (daysUntil == null || daysUntil <= 0 || !RETENTION_NOTICE_THRESHOLDS.includes(daysUntil as 30 | 7 | 1)) {
        continue;
      }

      const threshold = daysUntil as 30 | 7 | 1;
      const action = toCloudAction(row.auto_action || preferenceByUserId.get(row.user_id)?.cloud_audio_retention_action);
      const actionLabel = action === "auto_download" ? "auto-download" : "auto-delete";
      const title = threshold === 1
        ? "Cloud recording action in 1 day"
        : `Cloud recording action in ${threshold} days`;
      const message = [
        `A cloud safety audio recording from ${formatDate(row.recorded_at)} reaches the 3-month limit in ${threshold} ${threshold === 1 ? "day" : "days"}.`,
        `Current preference: ${actionLabel}.`,
      ].join(" ");

      const alreadyLoggedInApp = await wasNoticeLogged(admin, {
        userId: row.user_id,
        recordingId: row.id,
        noticeType: "retention_warning",
        thresholdDays: threshold,
        channel: "in_app",
      });

      if (!alreadyLoggedInApp) {
        await insertInAppNotice(admin, {
          userId: row.user_id,
          recordingId: row.id,
          noticeType: "retention_warning",
          thresholdDays: threshold,
          title,
          message,
          metadata: {
            action,
            expiresAt: row.expires_at,
          },
        });
        retentionInAppNotices += 1;
      }

      const profile = profileByUserId.get(row.user_id);
      const email = toTrimmedString(profile?.email);
      if (!email || !resendApiKey || !resendFromEmail) {
        continue;
      }

      const alreadyLoggedEmail = await wasNoticeLogged(admin, {
        userId: row.user_id,
        recordingId: row.id,
        noticeType: "retention_warning",
        thresholdDays: threshold,
        channel: "email",
      });

      if (alreadyLoggedEmail) {
        continue;
      }

      const recipientName = toTrimmedString(profile?.first_name) || "there";
      const dayLabel = threshold === 1 ? "1 day" : `${threshold} days`;
      const emailSent = await sendReminderEmail({
        resendApiKey,
        resendFromEmail,
        toEmail: email,
        subject: `Wingman cloud safety audio action in ${dayLabel}`,
        text: [
          `Hi ${recipientName},`,
          "",
          `A cloud safety audio recording will reach its 3-month retention limit in ${dayLabel}.`,
          `Current preference: ${actionLabel}.`,
          "",
          "You can review this in Safety Center > Cloud Safety Audio.",
        ].join("\n"),
        html: [
          `<p>Hi ${recipientName},</p>`,
          `<p>A cloud safety audio recording will reach its 3-month retention limit in <strong>${dayLabel}</strong>.</p>`,
          `<p>Current preference: <strong>${actionLabel}</strong>.</p>`,
          "<p>You can review this in <strong>Safety Center &gt; Cloud Safety Audio</strong>.</p>",
        ].join(""),
      });

      if (emailSent) {
        await logNotice(admin, {
          userId: row.user_id,
          recordingId: row.id,
          noticeType: "retention_warning",
          thresholdDays: threshold,
          channel: "email",
        });
        retentionEmailsSent += 1;
      } else {
        retentionEmailsFailed += 1;
      }
    }

    const { data: expiredRowsData, error: expiredRowsError } = await admin
      .from("safety_audio_cloud_recordings")
      .select("id,user_id,bucket,object_path,file_name,recorded_at,expires_at,status,auto_action")
      .in("status", ["uploaded", "upload_failed", "pending_auto_download"])
      .lte("expires_at", nowIso)
      .order("expires_at", { ascending: true })
      .limit(2000);

    if (expiredRowsError) {
      console.error("safety-audio-cloud-maintenance expired query failed", {
        code: expiredRowsError.code || "unknown",
      });
      return jsonResponse({ error: "Unable to load expired cloud recordings" }, 500);
    }

    const expiredRows = (expiredRowsData || []) as CloudRecordingRow[];

    let expiredAutoDeleted = 0;
    let expiredMarkedPendingDownload = 0;

    for (const row of expiredRows) {
      const action = toCloudAction(row.auto_action || preferenceByUserId.get(row.user_id)?.cloud_audio_retention_action);

      if (action === "auto_download") {
        if (row.status !== "pending_auto_download") {
          const { error: pendingError } = await admin
            .from("safety_audio_cloud_recordings")
            .update({
              status: "pending_auto_download",
              pending_auto_download_set_at: nowIso,
              auto_action: "auto_download",
              updated_at: nowIso,
            })
            .eq("id", row.id)
            .eq("user_id", row.user_id);

          if (!pendingError) {
            expiredMarkedPendingDownload += 1;
            await insertInAppNotice(admin, {
              userId: row.user_id,
              recordingId: row.id,
              noticeType: "retention_action",
              title: "Cloud recording queued for auto-download",
              message: "A cloud safety audio recording reached 3 months and is queued for automatic local download next time you open the app.",
              metadata: {
                action: "auto_download",
                recordingId: row.id,
              },
            });
          }
        }

        continue;
      }

      const bucket = toTrimmedString(row.bucket) || DEFAULT_BUCKET;
      const removed = await removeStorageObject(admin, bucket, row.object_path);
      if (!removed) {
        continue;
      }

      const { error: deleteMarkError } = await admin
        .from("safety_audio_cloud_recordings")
        .update({
          status: "deleted",
          deleted_at: nowIso,
          auto_action: "auto_delete",
          updated_at: nowIso,
        })
        .eq("id", row.id)
        .eq("user_id", row.user_id);

      if (!deleteMarkError) {
        expiredAutoDeleted += 1;
        await insertInAppNotice(admin, {
          userId: row.user_id,
          recordingId: row.id,
          noticeType: "retention_action",
          title: "Cloud recording deleted",
          message: "A cloud safety audio recording reached the 3-month retention limit and was deleted from cloud storage.",
          metadata: {
            action: "auto_delete",
            recordingId: row.id,
          },
        });
      }
    }

    const { data: graceProfilesData, error: graceProfilesError } = await admin
      .from("profiles")
      .select("id,email,first_name,subscription_tier,safety_audio_cloud_grace_until,safety_audio_cloud_downgraded_at")
      .not("safety_audio_cloud_grace_until", "is", null)
      .not("safety_audio_cloud_downgraded_at", "is", null)
      .order("safety_audio_cloud_grace_until", { ascending: true })
      .limit(2000);

    if (graceProfilesError) {
      console.error("safety-audio-cloud-maintenance grace query failed", {
        code: graceProfilesError.code || "unknown",
      });
      return jsonResponse({ error: "Unable to process grace warnings" }, 500);
    }

    const graceProfiles = (graceProfilesData || []) as ProfileRow[];
    let graceWarningNotices = 0;
    let graceExpiredUsers = 0;
    let graceExpiredDeletedRecordings = 0;

    for (const profile of graceProfiles) {
      if (toTrimmedString(profile.subscription_tier).toLowerCase() === "pro") {
        continue;
      }

      const graceUntil = profile.safety_audio_cloud_grace_until;
      if (!graceUntil) {
        continue;
      }

      const daysUntilGraceEnd = daysUntilDate(graceUntil, now);
      if (daysUntilGraceEnd == null) {
        continue;
      }

      if (daysUntilGraceEnd > 0 && GRACE_NOTICE_THRESHOLDS.includes(daysUntilGraceEnd as 30 | 14 | 7 | 3 | 1)) {
        const threshold = daysUntilGraceEnd as 30 | 14 | 7 | 3 | 1;
        const alreadyInApp = await wasNoticeLogged(admin, {
          userId: profile.id,
          noticeType: "grace_warning",
          thresholdDays: threshold,
          channel: "in_app",
        });

        if (!alreadyInApp) {
          await insertInAppNotice(admin, {
            userId: profile.id,
            noticeType: "grace_warning",
            thresholdDays: threshold,
            title: threshold === 1
              ? "Cloud audio grace ends tomorrow"
              : `Cloud audio grace ends in ${threshold} days`,
            message: "Your Wingman Pro downgrade grace period is active. Download or delete remaining cloud safety audio recordings before grace ends.",
            metadata: {
              graceEndsAt: graceUntil,
              thresholdDays: threshold,
            },
          });
          graceWarningNotices += 1;
        }
      }

      if (daysUntilGraceEnd > 0) {
        continue;
      }

      const { data: activeCloudRows } = await admin
        .from("safety_audio_cloud_recordings")
        .select("id,bucket,object_path,status")
        .eq("user_id", profile.id)
        .in("status", ["uploading", "uploaded", "upload_failed", "pending_auto_download"])
        .limit(2000);

      for (const recording of (activeCloudRows || []) as Array<{ id: string; bucket: string | null; object_path: string; status: string }>) {
        const bucket = toTrimmedString(recording.bucket) || DEFAULT_BUCKET;
        const removed = await removeStorageObject(admin, bucket, recording.object_path);

        if (!removed) {
          continue;
        }

        const { error: graceDeleteError } = await admin
          .from("safety_audio_cloud_recordings")
          .update({
            status: "grace_deleted",
            deleted_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", recording.id)
          .eq("user_id", profile.id);

        if (!graceDeleteError) {
          graceExpiredDeletedRecordings += 1;
        }
      }

      const alreadyLoggedExpired = await wasNoticeLogged(admin, {
        userId: profile.id,
        noticeType: "grace_expired",
        channel: "in_app",
      });

      if (!alreadyLoggedExpired) {
        await insertInAppNotice(admin, {
          userId: profile.id,
          noticeType: "grace_expired",
          title: "Cloud audio grace ended",
          message: "Your cloud safety audio grace window ended and remaining cloud recordings were deleted.",
          metadata: {
            graceEndedAt: graceUntil,
          },
        });
      }

      await admin
        .from("profiles")
        .update({
          safety_audio_cloud_grace_until: null,
          safety_audio_cloud_downgraded_at: null,
          updated_at: nowIso,
        })
        .eq("id", profile.id);

      graceExpiredUsers += 1;
    }

    const staleCutoffIso = new Date(now.getTime() - STALE_UPLOADING_AFTER_HOURS * 60 * 60 * 1000).toISOString();
    const { data: staleRows } = await admin
      .from("safety_audio_cloud_recordings")
      .update({
        status: "upload_failed",
        last_error_code: "UPLOAD_STALE",
        last_error_message: "Upload was not completed in time and needs retry.",
        retry_count: 1,
        last_retry_at: nowIso,
        updated_at: nowIso,
      })
      .eq("status", "uploading")
      .lt("created_at", staleCutoffIso)
      .select("id");

    const staleUploadFailures = Array.isArray(staleRows) ? staleRows.length : 0;

    const { data: potentialOrphans } = await admin
      .from("safety_audio_cloud_recordings")
      .select("id,bucket,object_path")
      .in("status", ["uploaded", "pending_auto_download"])
      .order("updated_at", { ascending: true })
      .limit(100);

    let orphanedRowsDeleted = 0;

    for (const row of (potentialOrphans || []) as Array<{ id: string; bucket: string | null; object_path: string }>) {
      const bucket = toTrimmedString(row.bucket) || DEFAULT_BUCKET;
      const objectPath = toTrimmedString(row.object_path);
      if (!objectPath) {
        continue;
      }

      const { error: signedUrlError } = await admin.storage.from(bucket).createSignedUrl(objectPath, 60);
      if (!signedUrlError) {
        continue;
      }

      const msg = toTrimmedString(signedUrlError.message).toLowerCase();
      if (!msg.includes("not found") && !msg.includes("does not exist")) {
        continue;
      }

      const { error: orphanUpdateError } = await admin
        .from("safety_audio_cloud_recordings")
        .update({
          status: "deleted",
          deleted_at: nowIso,
          last_error_code: "OBJECT_MISSING",
          last_error_message: "Storage object missing; metadata cleaned during maintenance.",
          updated_at: nowIso,
        })
        .eq("id", row.id);

      if (!orphanUpdateError) {
        orphanedRowsDeleted += 1;
      }
    }

    return jsonResponse({
      success: true,
      retentionInAppNotices,
      retentionEmailsSent,
      retentionEmailsFailed,
      expiredAutoDeleted,
      expiredMarkedPendingDownload,
      graceWarningNotices,
      graceExpiredUsers,
      graceExpiredDeletedRecordings,
      staleUploadFailures,
      orphanedRowsDeleted,
      resendConfigured: Boolean(resendApiKey && resendFromEmail),
    });
  } catch (error) {
    console.error("safety-audio-cloud-maintenance unexpected error", {
      message: error instanceof Error ? error.message : "unknown",
    });

    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
