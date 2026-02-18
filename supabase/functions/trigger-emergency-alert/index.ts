import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type AlertSource =
  | "sos_button"
  | "checkin_unsafe"
  | "checkin_timeout"
  | "live_location_started"
  | "manual";

const ALLOWED_SOURCES = new Set<AlertSource>([
  "sos_button",
  "checkin_unsafe",
  "checkin_timeout",
  "live_location_started",
  "manual",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ContactRow = {
  id: string;
  phone_e164: string;
  name: string;
};

type ProfileRow = {
  first_name?: string | null;
  last_name?: string | null;
  country?: string | null;
};

type ShareRow = {
  id: string;
  expires_at: string;
};

type TriggerAlertRequest = {
  bookingId?: string;
  source?: string;
  message?: string;
  includeLiveLocationLink?: boolean;
  location?: {
    latitude?: number;
    longitude?: number;
    accuracyM?: number;
    capturedAt?: string;
  };
  metadata?: Record<string, unknown>;
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

function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function toTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function validateCoordinates(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function normalizeSource(value: unknown): AlertSource {
  const normalized = toTrimmed(value).toLowerCase() as AlertSource;
  if (ALLOWED_SOURCES.has(normalized)) {
    return normalized;
  }
  return "sos_button";
}

function resolveEmergencyDialNumber(countryCode: string | null | undefined): string {
  const normalized = toTrimmed(countryCode).toUpperCase();

  if (["GB", "IE", "HK", "MY", "SG"].includes(normalized)) return "999";
  if (["AU"].includes(normalized)) return "000";
  if (["NZ"].includes(normalized)) return "111";
  if (["IN", "DE", "FR", "ES", "IT", "NL", "SE", "NO", "DK", "FI", "PT", "AT", "BE", "CH", "ZA"].includes(normalized)) return "112";

  return "911";
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateViewerToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildDefaultMessage(params: {
  fullName: string;
  source: AlertSource;
  bookingId: string | null;
  emergencyDialNumber: string;
}): string {
  const bookingSegment = params.bookingId ? " for an active Wingman booking" : "";
  const sourceSegment = params.source === "checkin_timeout"
    ? "Safety check-in timed out"
    : params.source === "checkin_unsafe"
      ? "User reported feeling unsafe"
      : "SOS was activated";

  return `Wingman Safety Alert: ${sourceSegment}. ${params.fullName} may need immediate help${bookingSegment}. If urgent, call ${params.emergencyDialNumber}.`;
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

  try {
    const token = getBearerToken(req);
    if (!token) {
      return jsonResponse({ error: "Authentication required" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioMessagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");
    const twilioFromNumber = Deno.env.get("TWILIO_FROM_NUMBER");
    const linkSigningSecret = Deno.env.get("EMERGENCY_LINK_SIGNING_SECRET");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    if (!twilioAccountSid || !twilioAuthToken) {
      return jsonResponse({ error: "SMS alert service is unavailable" }, 500);
    }

    const body = await req.json().catch(() => ({})) as TriggerAlertRequest;
    const source = normalizeSource(body.source);
    const bookingId = toTrimmed(body.bookingId) || null;
    const customMessage = toTrimmed(body.message);
    const includeLiveLocationLink = body.includeLiveLocationLink === true;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user?.id) {
      return jsonResponse({ error: "Invalid authentication token" }, 401);
    }

    const userId = authData.user.id;

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { count: recentEventCount } = await supabaseAdmin
      .from("emergency_alert_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", twoMinutesAgo);

    if (Number(recentEventCount || 0) >= 5) {
      return jsonResponse({ error: "Too many emergency alert attempts. Please wait and try again." }, 429);
    }

    if (bookingId) {
      const { data: canAccessBooking, error: bookingAccessError } = await supabaseAdmin
        .rpc("is_booking_participant", {
          p_booking_id: bookingId,
          p_user_id: userId,
        });

      if (bookingAccessError || canAccessBooking !== true) {
        return jsonResponse({ error: "Booking access denied" }, 403);
      }
    }

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("first_name,last_name,country")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profileData) {
      return jsonResponse({ error: "Unable to load sender profile" }, 400);
    }

    const profile = profileData as ProfileRow;
    const fullName = `${toTrimmed(profile.first_name)} ${toTrimmed(profile.last_name)}`.trim() || "A Wingman user";
    const emergencyDialNumber = resolveEmergencyDialNumber(profile.country || null);

    const { data: contactsData, error: contactsError } = await supabaseAdmin
      .from("emergency_contacts")
      .select("id,phone_e164,name")
      .eq("user_id", userId)
      .eq("is_verified", true)
      .order("created_at", { ascending: true });

    if (contactsError) {
      return jsonResponse({ error: "Unable to load emergency contacts" }, 500);
    }

    const contacts = (contactsData || []) as ContactRow[];

    if (contacts.length === 0) {
      return jsonResponse({ error: "Add and verify at least one emergency contact first." }, 400);
    }

    const locationLat = toFiniteNumber(body.location?.latitude);
    const locationLng = toFiniteNumber(body.location?.longitude);
    const hasValidLocation = locationLat != null && locationLng != null && validateCoordinates(locationLat, locationLng);
    const locationAccuracy = toFiniteNumber(body.location?.accuracyM);
    const locationCapturedAt = toTrimmed(body.location?.capturedAt) || new Date().toISOString();
    const locationLink = hasValidLocation
      ? `https://maps.google.com/?q=${locationLat},${locationLng}`
      : null;

    const baseMessage = customMessage || buildDefaultMessage({
      fullName,
      source,
      bookingId,
      emergencyDialNumber,
    });

    const metadata = {
      ...(body.metadata || {}),
      includeLiveLocationLink,
      emergencyDialNumber,
    };

    const { data: alertEventData, error: alertEventError } = await supabaseAdmin
      .from("emergency_alert_events")
      .insert({
        user_id: userId,
        booking_id: bookingId,
        source,
        message_text: baseMessage,
        location_available: hasValidLocation,
        location_latitude: hasValidLocation ? locationLat : null,
        location_longitude: hasValidLocation ? locationLng : null,
        location_accuracy_m: hasValidLocation ? locationAccuracy : null,
        location_captured_at: hasValidLocation ? locationCapturedAt : null,
        metadata,
      })
      .select("id")
      .single();

    if (alertEventError || !alertEventData?.id) {
      return jsonResponse({ error: "Unable to create emergency alert event" }, 500);
    }

    const alertEventId = alertEventData.id as string;

    const liveLinksByContactId = new Map<string, string>();
    if (includeLiveLocationLink && bookingId && linkSigningSecret) {
      const { data: shareData } = await supabaseAdmin
        .from("emergency_live_location_shares")
        .select("id,expires_at")
        .eq("booking_id", bookingId)
        .eq("user_id", userId)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (shareData) {
        const share = shareData as ShareRow;
        const viewerBaseUrl = `${new URL(req.url).origin}/emergency-live-location-view`;

        await supabaseAdmin
          .from("emergency_live_location_view_tokens")
          .update({
            status: "revoked",
            revoked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("share_id", share.id)
          .eq("status", "active");

        for (const contact of contacts) {
          const rawToken = generateViewerToken();
          const tokenHash = await sha256Hex(`${linkSigningSecret}:${rawToken}`);

          const { error: tokenInsertError } = await supabaseAdmin
            .from("emergency_live_location_view_tokens")
            .insert({
              share_id: share.id,
              user_id: userId,
              contact_id: contact.id,
              token_hash: tokenHash,
              token_prefix: rawToken.slice(0, 10),
              status: "active",
              expires_at: share.expires_at,
            });

          if (!tokenInsertError) {
            liveLinksByContactId.set(contact.id, `${viewerBaseUrl}?token=${encodeURIComponent(rawToken)}`);
          }
        }
      }
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const contact of contacts) {
      const shareLink = liveLinksByContactId.get(contact.id);
      const parts = [baseMessage];

      if (locationLink) {
        parts.push(`Last known location: ${locationLink}`);
      }

      if (shareLink) {
        parts.push(`Live location: ${shareLink}`);
      }

      parts.push(`Alert time: ${new Date().toLocaleString("en-US", { hour12: true })}`);

      const outboundMessage = parts.join("\n");

      const { data: dispatchData, error: dispatchInsertError } = await supabaseAdmin
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

      if (dispatchInsertError || !dispatchData?.id) {
        failedCount += 1;
        continue;
      }

      const dispatchId = dispatchData.id as string;
      const smsResult = await sendTwilioSms({
        accountSid: twilioAccountSid,
        authToken: twilioAuthToken,
        messagingServiceSid: twilioMessagingServiceSid,
        fromNumber: twilioFromNumber,
        to: contact.phone_e164,
        body: outboundMessage,
      });

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
          .eq("id", dispatchId);
      } else {
        failedCount += 1;
        await supabaseAdmin
          .from("emergency_alert_dispatches")
          .update({
            status: "failed",
            provider_error_code: smsResult.errorCode || null,
            provider_error_message: smsResult.errorMessage || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", dispatchId);
      }
    }

    return jsonResponse({
      success: sentCount > 0,
      alertEventId,
      sentCount,
      failedCount,
      emergencyDialNumber,
    }, sentCount > 0 ? 200 : 502);
  } catch (error) {
    console.error("trigger-emergency-alert internal error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
