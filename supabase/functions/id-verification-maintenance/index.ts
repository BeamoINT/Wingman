import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-maintenance-secret",
};

const REMINDER_THRESHOLDS = [90, 30, 7, 1] as const;
type ReminderThreshold = (typeof REMINDER_THRESHOLDS)[number];

type ProfileReminderRow = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  id_verified_at?: string | null;
  id_verification_expires_at?: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getDaysUntilExpiry(expiresAtIso: string, now = new Date()): number | null {
  const expiry = new Date(expiresAtIso);
  if (Number.isNaN(expiry.getTime())) {
    return null;
  }

  const nowUtcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const expiryUtcDay = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate());

  return Math.floor((expiryUtcDay - nowUtcDay) / (1000 * 60 * 60 * 24));
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "soon";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function reminderAlreadyLogged(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  cycleVerifiedAt: string,
  thresholdDays: ReminderThreshold,
  channel: "email" | "in_app",
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("id_verification_reminder_log")
    .select("user_id")
    .eq("user_id", userId)
    .eq("cycle_verified_at", cycleVerifiedAt)
    .eq("threshold_days", thresholdDays)
    .eq("channel", channel)
    .maybeSingle();

  if (error) {
    console.error("Failed to check reminder dedupe state:", error);
    return false;
  }

  return Boolean(data?.user_id);
}

async function logReminder(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  cycleVerifiedAt: string,
  thresholdDays: ReminderThreshold,
  channel: "email" | "in_app",
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("id_verification_reminder_log")
    .insert({
      user_id: userId,
      cycle_verified_at: cycleVerifiedAt,
      threshold_days: thresholdDays,
      channel,
      sent_at: new Date().toISOString(),
    });

  if (error && String(error.code || "") !== "23505") {
    console.error("Failed to persist reminder log:", error);
  }
}

async function sendReminderEmail(
  resendApiKey: string,
  fromEmail: string,
  toEmail: string,
  firstName: string,
  thresholdDays: ReminderThreshold,
  expiryIso: string,
): Promise<boolean> {
  const dayLabel = thresholdDays === 1 ? "1 day" : `${thresholdDays} days`;
  const expiryLabel = formatDate(expiryIso);
  const greetingName = firstName.trim() || "there";

  const subject = `Wingman ID verification expires in ${dayLabel}`;
  const text = [
    `Hi ${greetingName},`,
    "",
    `Your Wingman ID verification will expire in ${dayLabel} on ${expiryLabel}.`,
    "",
    "To keep booking access active, complete your re-verification now in the app:",
    "Profile > Verification > Start ID Verification",
    "",
    "This 3-year reverification policy helps keep the Wingman community safe.",
    "",
    "- Wingman Safety Team",
  ].join("\n");

  const html = [
    `<p>Hi ${greetingName},</p>`,
    `<p>Your Wingman ID verification will expire in <strong>${dayLabel}</strong> on <strong>${expiryLabel}</strong>.</p>`,
    "<p>To keep booking access active, complete your re-verification now in the app:</p>",
    "<p><strong>Profile &gt; Verification &gt; Start ID Verification</strong></p>",
    "<p>This 3-year reverification policy helps keep the Wingman community safe.</p>",
    "<p>- Wingman Safety Team</p>",
  ].join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    console.error("Resend email delivery failed:", payload);
    return false;
  }

  return true;
}

async function logVerificationEvents(
  supabaseAdmin: ReturnType<typeof createClient>,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("verification_events")
    .insert(rows);

  if (error && !["42P01", "PGRST205"].includes(String(error.code || ""))) {
    console.error("Failed to write verification events:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  const maintenanceSecret = Deno.env.get("ID_VERIFICATION_MAINTENANCE_SECRET");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Server configuration error: missing Supabase settings" }, 500);
  }

  if (maintenanceSecret) {
    const providedSecret = req.headers.get("x-maintenance-secret");
    if (!providedSecret || providedSecret !== maintenanceSecret) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const now = new Date();
    const nowIso = now.toISOString();

    const { data: expiredProfiles, error: expireError } = await supabaseAdmin
      .from("profiles")
      .update({
        id_verified: false,
        id_verification_status: "expired",
        updated_at: nowIso,
      })
      .eq("id_verified", true)
      .eq("id_verification_status", "verified")
      .not("id_verification_expires_at", "is", null)
      .lte("id_verification_expires_at", nowIso)
      .select("id,id_verification_expires_at");

    if (expireError) {
      console.error("Failed to expire stale ID verifications:", expireError);
      return jsonResponse({ error: "Failed to process expirations" }, 500);
    }

    const expiredRows = Array.isArray(expiredProfiles) ? expiredProfiles : [];

    await logVerificationEvents(
      supabaseAdmin,
      expiredRows.map((row) => ({
        user_id: row.id,
        event_type: "id_verification_expired",
        event_status: "success",
        event_data: {
          expired_at: nowIso,
          previous_expiration_timestamp: row.id_verification_expires_at,
        },
      }))
    );

    const inNinetyDays = new Date(now);
    inNinetyDays.setUTCDate(inNinetyDays.getUTCDate() + 90);

    const { data: reminderCandidates, error: reminderQueryError } = await supabaseAdmin
      .from("profiles")
      .select("id,email,first_name,id_verified_at,id_verification_expires_at")
      .eq("id_verified", true)
      .eq("id_verification_status", "verified")
      .not("id_verification_expires_at", "is", null)
      .gt("id_verification_expires_at", nowIso)
      .lte("id_verification_expires_at", inNinetyDays.toISOString());

    if (reminderQueryError) {
      console.error("Failed to query reminder candidates:", reminderQueryError);
      return jsonResponse({ error: "Failed to process reminders" }, 500);
    }

    const rows = (reminderCandidates || []) as ProfileReminderRow[];

    let inAppLogged = 0;
    let emailSent = 0;
    let emailFailed = 0;

    for (const row of rows) {
      const expiresAt = typeof row.id_verification_expires_at === "string"
        ? row.id_verification_expires_at
        : null;

      if (!expiresAt) {
        continue;
      }

      const daysUntilExpiry = getDaysUntilExpiry(expiresAt, now);
      if (!daysUntilExpiry || !REMINDER_THRESHOLDS.includes(daysUntilExpiry as ReminderThreshold)) {
        continue;
      }

      const threshold = daysUntilExpiry as ReminderThreshold;
      const cycleVerifiedAt = row.id_verified_at || nowIso;

      const inAppAlreadyLogged = await reminderAlreadyLogged(
        supabaseAdmin,
        row.id,
        cycleVerifiedAt,
        threshold,
        "in_app",
      );

      if (!inAppAlreadyLogged) {
        await logReminder(supabaseAdmin, row.id, cycleVerifiedAt, threshold, "in_app");
        inAppLogged += 1;
      }

      if (!resendApiKey || !resendFromEmail) {
        continue;
      }

      const recipientEmail = typeof row.email === "string" ? row.email.trim() : "";
      if (!recipientEmail) {
        continue;
      }

      const emailAlreadyLogged = await reminderAlreadyLogged(
        supabaseAdmin,
        row.id,
        cycleVerifiedAt,
        threshold,
        "email",
      );

      if (emailAlreadyLogged) {
        continue;
      }

      const sent = await sendReminderEmail(
        resendApiKey,
        resendFromEmail,
        recipientEmail,
        String(row.first_name || ""),
        threshold,
        expiresAt,
      );

      if (sent) {
        await logReminder(supabaseAdmin, row.id, cycleVerifiedAt, threshold, "email");
        emailSent += 1;

        await logVerificationEvents(
          supabaseAdmin,
          [{
            user_id: row.id,
            event_type: "id_verification_reminder_sent",
            event_status: "success",
            event_data: {
              channel: "email",
              threshold_days: threshold,
              expires_at: expiresAt,
            },
          }],
        );
      } else {
        emailFailed += 1;
      }
    }

    return jsonResponse({
      success: true,
      expiredCount: expiredRows.length,
      inAppReminderCount: inAppLogged,
      emailSentCount: emailSent,
      emailFailedCount: emailFailed,
      resendConfigured: Boolean(resendApiKey && resendFromEmail),
    });
  } catch (error) {
    console.error("id-verification-maintenance error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
