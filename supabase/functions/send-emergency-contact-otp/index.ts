import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ContactRow = {
  id: string;
  user_id: string;
  phone_e164: string;
  is_verified: boolean;
  verification_attempts: number | null;
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
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const verifyServiceSid = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    if (!accountSid || !authToken || !verifyServiceSid) {
      return jsonResponse({ error: "SMS verification is unavailable" }, 500);
    }

    const body = await req.json().catch(() => ({})) as { contactId?: string };
    const contactId = typeof body.contactId === "string" ? body.contactId.trim() : "";

    if (!contactId) {
      return jsonResponse({ error: "contactId is required" }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData?.user?.id) {
      return jsonResponse({ error: "Invalid authentication token" }, 401);
    }

    const userId = authData.user.id;

    const { data: contactData, error: contactError } = await supabaseAdmin
      .from("emergency_contacts")
      .select("id,user_id,phone_e164,is_verified,verification_attempts")
      .eq("id", contactId)
      .eq("user_id", userId)
      .maybeSingle();

    if (contactError || !contactData) {
      return jsonResponse({ error: "Emergency contact not found" }, 404);
    }

    const contact = contactData as ContactRow;

    if (contact.is_verified) {
      return jsonResponse({ success: true, alreadyVerified: true });
    }

    const attempts = Number(contact.verification_attempts || 0);
    if (attempts >= 12) {
      return jsonResponse({
        error: "Too many verification attempts for this contact. Try again later.",
      }, 429);
    }

    const twilioUrl = `https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`;
    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: contact.phone_e164,
        Channel: "sms",
      }),
    });

    const twilioPayload = await twilioResponse.json().catch(() => ({})) as {
      status?: string;
      message?: string;
      code?: number;
      sid?: string;
    };

    if (!twilioResponse.ok) {
      return jsonResponse({
        error: twilioPayload.message || "Failed to send verification code",
        code: twilioPayload.code || null,
      }, 400);
    }

    await supabaseAdmin
      .from("emergency_contacts")
      .update({
        verification_last_sent_at: new Date().toISOString(),
        verification_attempts: attempts + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contact.id);

    return jsonResponse({
      success: true,
      status: twilioPayload.status || "pending",
      sid: twilioPayload.sid || null,
    });
  } catch (error) {
    console.error("send-emergency-contact-otp error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
