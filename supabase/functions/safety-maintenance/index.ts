import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-maintenance-secret",
};

type EscalationRow = {
  id: string;
  status: "unsafe" | "timed_out";
  user_id: string;
  booking_id: string | null;
};

type ContactRow = {
  id: string;
  phone_e164: string;
};

type ProfileRow = {
  first_name?: string | null;
  last_name?: string | null;
  country?: string | null;
};

type TwilioSendResult = {
  success: boolean;
  sid?: string;
  errorCode?: string;
  errorMessage?: string;
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

function toTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveEmergencyDialNumber(countryCode: string | null | undefined): string {
  const normalized = toTrimmed(countryCode).toUpperCase();

  if (["GB", "IE", "HK", "MY", "SG"].includes(normalized)) return "999";
  if (["AU"].includes(normalized)) return "000";
  if (["NZ"].includes(normalized)) return "111";
  if (["IN", "DE", "FR", "ES", "IT", "NL", "SE", "NO", "DK", "FI", "PT", "AT", "BE", "CH", "ZA"].includes(normalized)) return "112";

  return "911";
}

async function sendTwilioSms(params: {
  accountSid: string;
  authToken: string;
  messagingServiceSid?: string | null;
  fromNumber?: string | null;
  to: string;
  body: string;
}): Promise<TwilioSendResult> {
  const payload = new URLSearchParams({
    To: params.to,
    Body: params.body,
  });

  if (params.messagingServiceSid) {
    payload.set("MessagingServiceSid", params.messagingServiceSid);
  } else if (params.fromNumber) {
    payload.set("From", params.fromNumber);
  } else {
    return {
      success: false,
      errorCode: "MISSING_SENDER",
      errorMessage: "Twilio sender configuration missing",
    };
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${params.accountSid}:${params.authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload,
  });

  const twilioBody = await response.json().catch(() => ({})) as {
    sid?: string;
    code?: number;
    message?: string;
  };

  if (!response.ok) {
    return {
      success: false,
      errorCode: twilioBody.code ? String(twilioBody.code) : "SMS_SEND_FAILED",
      errorMessage: twilioBody.message || "Twilio message send failed",
    };
  }

  return {
    success: true,
    sid: twilioBody.sid,
  };
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
  const maintenanceSecret = Deno.env.get("SAFETY_MAINTENANCE_SECRET");
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioMessagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");
  const twilioFromNumber = Deno.env.get("TWILIO_FROM_NUMBER");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  if (maintenanceSecret) {
    const providedSecret = req.headers.get("x-maintenance-secret");
    if (!providedSecret || providedSecret !== maintenanceSecret) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: maintenanceData, error: maintenanceError } = await supabaseAdmin.rpc("expire_emergency_safety_state_v1");

    if (maintenanceError) {
      console.error("safety-maintenance rpc failure", {
        code: maintenanceError.code || "unknown",
      });
      return jsonResponse({ error: "Failed to run safety maintenance" }, 500);
    }

    const summaryRow = (Array.isArray(maintenanceData) ? maintenanceData[0] : maintenanceData) as Record<string, unknown> | null;

    const { data: escalationRows, error: escalationError } = await supabaseAdmin
      .from("safety_checkins")
      .select("id,status,user_id,booking_id")
      .in("status", ["unsafe", "timed_out"])
      .order("updated_at", { ascending: true })
      .limit(100);

    if (escalationError) {
      return jsonResponse({
        success: true,
        maintenance: summaryRow,
        escalationsHandled: 0,
        escalationsFailed: 0,
      });
    }

    const rows = (escalationRows || []) as EscalationRow[];

    let escalationsHandled = 0;
    let escalationsFailed = 0;

    for (const row of rows) {
      const alertSource = row.status === "unsafe" ? "checkin_unsafe" : "checkin_timeout";

      const { data: duplicateAlert } = await supabaseAdmin
        .from("emergency_alert_events")
        .select("id")
        .eq("user_id", row.user_id)
        .eq("source", alertSource)
        .filter("metadata->>checkin_id", "eq", row.id)
        .maybeSingle();

      if (duplicateAlert?.id) {
        escalationsHandled += 1;
        continue;
      }

      const { data: profileData } = await supabaseAdmin
        .from("profiles")
        .select("first_name,last_name,country")
        .eq("id", row.user_id)
        .maybeSingle();

      const profile = (profileData || {}) as ProfileRow;
      const fullName = `${toTrimmed(profile.first_name)} ${toTrimmed(profile.last_name)}`.trim() || "A Wingman user";
      const emergencyDialNumber = resolveEmergencyDialNumber(profile.country || null);

      const { data: contactsData } = await supabaseAdmin
        .from("emergency_contacts")
        .select("id,phone_e164")
        .eq("user_id", row.user_id)
        .eq("is_verified", true)
        .order("created_at", { ascending: true });

      const contacts = (contactsData || []) as ContactRow[];
      if (contacts.length === 0) {
        escalationsFailed += 1;
        continue;
      }

      const { data: livePoint } = await supabaseAdmin
        .from("emergency_live_location_points")
        .select("latitude,longitude")
        .eq("user_id", row.user_id)
        .eq("booking_id", row.booking_id)
        .gt("expires_at", new Date().toISOString())
        .order("updated_at", { ascending: false })
        .maybeSingle();

      const locationLat = typeof livePoint?.latitude === "number" ? livePoint.latitude : null;
      const locationLng = typeof livePoint?.longitude === "number" ? livePoint.longitude : null;
      const hasLocation = locationLat != null && locationLng != null;
      const locationLink = hasLocation ? `https://maps.google.com/?q=${locationLat},${locationLng}` : null;

      const message = row.status === "unsafe"
        ? `Wingman Safety Alert: ${fullName} reported feeling unsafe during a booking. Please check on them immediately. If urgent, call ${emergencyDialNumber}.`
        : `Wingman Safety Alert: ${fullName} missed a safety check-in during a booking. Please check on them immediately. If urgent, call ${emergencyDialNumber}.`;

      const { data: alertEventData, error: alertEventError } = await supabaseAdmin
        .from("emergency_alert_events")
        .insert({
          user_id: row.user_id,
          booking_id: row.booking_id,
          source: alertSource,
          message_text: message,
          location_available: hasLocation,
          location_latitude: locationLat,
          location_longitude: locationLng,
          metadata: {
            checkin_id: row.id,
            generated_by: "safety-maintenance",
          },
        })
        .select("id")
        .single();

      if (alertEventError || !alertEventData?.id) {
        escalationsFailed += 1;
        continue;
      }

      const alertEventId = alertEventData.id as string;

      let sentCount = 0;
      for (const contact of contacts) {
        const smsBody = [
          message,
          locationLink ? `Last known location: ${locationLink}` : "Location unavailable.",
        ].join("\n");

        const { data: dispatchData } = await supabaseAdmin
          .from("emergency_alert_dispatches")
          .insert({
            alert_event_id: alertEventId,
            contact_id: contact.id,
            phone_e164: contact.phone_e164,
            channel: "sms",
            status: "queued",
          })
          .select("id")
          .maybeSingle();

        if (!dispatchData?.id) {
          continue;
        }

        const smsResult = (twilioAccountSid && twilioAuthToken)
          ? await sendTwilioSms({
            accountSid: twilioAccountSid,
            authToken: twilioAuthToken,
            messagingServiceSid: twilioMessagingServiceSid,
            fromNumber: twilioFromNumber,
            to: contact.phone_e164,
            body: smsBody,
          })
          : { success: false, errorCode: "TWILIO_NOT_CONFIGURED", errorMessage: "Twilio is not configured" };

        if (smsResult.success) {
          sentCount += 1;
          await supabaseAdmin
            .from("emergency_alert_dispatches")
            .update({
              status: "sent",
              provider_ref: smsResult.sid || null,
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", dispatchData.id as string);
        } else {
          await supabaseAdmin
            .from("emergency_alert_dispatches")
            .update({
              status: "failed",
              provider_error_code: smsResult.errorCode || null,
              provider_error_message: smsResult.errorMessage || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", dispatchData.id as string);
        }
      }

      await supabaseAdmin
        .from("safety_checkins")
        .update({
          escalation_triggered: true,
          escalation_source: row.status === "unsafe" ? "unsafe" : "timeout",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (sentCount > 0) {
        escalationsHandled += 1;
      } else {
        escalationsFailed += 1;
      }
    }

    return jsonResponse({
      success: true,
      maintenance: {
        activatedSessionsCount: Number(summaryRow?.activated_sessions_count || 0),
        createdCheckinsCount: Number(summaryRow?.created_checkins_count || 0),
        timeoutEscalationsCount: Number(summaryRow?.timeout_escalations_count || 0),
        expiredSharesCount: Number(summaryRow?.expired_shares_count || 0),
        deletedPointsCount: Number(summaryRow?.deleted_points_count || 0),
        revokedTokensCount: Number(summaryRow?.revoked_tokens_count || 0),
      },
      escalationsHandled,
      escalationsFailed,
    });
  } catch (error) {
    console.error("safety-maintenance internal error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
