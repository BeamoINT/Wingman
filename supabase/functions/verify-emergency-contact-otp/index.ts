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

    const body = await req.json().catch(() => ({})) as { contactId?: string; code?: string };
    const contactId = typeof body.contactId === "string" ? body.contactId.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!contactId || !code) {
      return jsonResponse({ error: "contactId and code are required" }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData?.user?.id) {
      return jsonResponse({ error: "Invalid authentication token" }, 401);
    }

    const userId = authData.user.id;

    const { data: contactData, error: contactError } = await supabaseAdmin
      .from("emergency_contacts")
      .select("id,user_id,phone_e164,is_verified")
      .eq("id", contactId)
      .eq("user_id", userId)
      .maybeSingle();

    if (contactError || !contactData) {
      return jsonResponse({ error: "Emergency contact not found" }, 404);
    }

    const contact = contactData as ContactRow;

    if (contact.is_verified) {
      return jsonResponse({ verified: true, alreadyVerified: true });
    }

    const twilioUrl = `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`;
    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: contact.phone_e164,
        Code: code,
      }),
    });

    const twilioPayload = await twilioResponse.json().catch(() => ({})) as {
      status?: string;
      message?: string;
      code?: number;
    };

    if (!twilioResponse.ok) {
      return jsonResponse({
        verified: false,
        error: twilioPayload.message || "Failed to verify code",
        code: twilioPayload.code || null,
      }, 400);
    }

    const approved = twilioPayload.status === "approved";

    if (!approved) {
      return jsonResponse({
        verified: false,
        error: "Invalid verification code",
      }, 200);
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("emergency_contacts")
      .update({
        is_verified: true,
        verified_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", contact.id)
      .eq("user_id", userId);

    if (updateError) {
      return jsonResponse({
        verified: false,
        error: "Code approved but contact verification could not be saved",
      }, 500);
    }

    return jsonResponse({
      verified: true,
      status: "approved",
    });
  } catch (error) {
    console.error("verify-emergency-contact-otp error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return jsonResponse({ error: "Internal server error", verified: false }, 500);
  }
});
