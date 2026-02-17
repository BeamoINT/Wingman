import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token",
};

type StripeIdentitySessionResponse = {
  id?: string;
  url?: string;
  error?: {
    type?: string;
    code?: string;
    doc_url?: string;
    message?: string;
  };
};

type ProfileRow = {
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  profile_photo_source?: string | null;
  profile_photo_captured_at?: string | null;
  profile_photo_capture_verified?: boolean | null;
  profile_photo_last_changed_at?: string | null;
  id_verified?: boolean | null;
  id_verification_status?: string | null;
  id_verification_expires_at?: string | null;
  id_verification_failure_code?: string | null;
  id_verification_failure_message?: string | null;
  id_verification_last_failed_at?: string | null;
};

type StartVerificationErrorCode =
  | "STRIPE_IDENTITY_NOT_ENABLED"
  | "STRIPE_KEY_INVALID"
  | "STRIPE_ACCOUNT_INCOMPLETE"
  | "ID_VERIFICATION_UNAVAILABLE";

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function extractAccessToken(req: Request, requestBody: Record<string, unknown>): string | null {
  const sessionTokenHeader = req.headers.get("x-session-token");
  const authHeader = req.headers.get("Authorization");
  const bearerMatch = authHeader?.trim().match(/^Bearer\s+(.+)$/i);

  const possibleTokens = [
    typeof sessionTokenHeader === "string" ? sessionTokenHeader.trim() : "",
    typeof requestBody.accessToken === "string" ? requestBody.accessToken.trim() : "",
    typeof bearerMatch?.[1] === "string" ? bearerMatch[1].trim() : "",
  ];

  const token = possibleTokens.find((candidate) => candidate && candidate.split(".").length === 3) || null;
  return token;
}

function normalizeNamePart(value: string | null | undefined): string {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function isLikelyTestModeSecret(secretKey: string): boolean {
  const normalized = secretKey.trim().toLowerCase();
  return normalized.startsWith("sk_test_") || normalized.startsWith("rk_test_");
}

function getStripeIdentitySetupUrl(secretKey: string): string {
  return isLikelyTestModeSecret(secretKey)
    ? "https://dashboard.stripe.com/test/settings/identity"
    : "https://dashboard.stripe.com/settings/identity";
}

function buildActionableErrorResponse(
  error: string,
  errorCode: StartVerificationErrorCode,
  status = 400,
  extra: {
    adminActionUrl?: string;
    supportMessage?: string;
  } = {},
): Response {
  return jsonResponse(
    {
      error,
      errorCode,
      ...extra,
    },
    status,
  );
}

function mapStripeIdentitySessionError(
  stripePayload: StripeIdentitySessionResponse,
  stripeSecretKey: string,
): {
  status: number;
  error: string;
  errorCode: StartVerificationErrorCode;
  adminActionUrl?: string;
  supportMessage?: string;
} {
  const rawMessage = String(stripePayload?.error?.message || "").trim();
  const message = rawMessage.toLowerCase();
  const code = String(stripePayload?.error?.code || "").toLowerCase();
  const type = String(stripePayload?.error?.type || "").toLowerCase();
  const setupUrl = getStripeIdentitySetupUrl(stripeSecretKey);

  if (
    message.includes("not set up to use identity")
    || message.includes("not enabled for identity")
    || message.includes("identity verification is not enabled")
  ) {
    return {
      status: 400,
      error: "Stripe Identity is not enabled for this account yet.",
      errorCode: "STRIPE_IDENTITY_NOT_ENABLED",
      adminActionUrl: setupUrl,
      supportMessage: "Ask an account admin to enable Stripe Identity in Dashboard settings, then retry.",
    };
  }

  if (
    code.includes("api_key")
    || message.includes("invalid api key")
    || message.includes("no such api key")
    || type.includes("authentication_error")
  ) {
    return {
      status: 500,
      error: "Stripe credentials are invalid for Identity verification.",
      errorCode: "STRIPE_KEY_INVALID",
      adminActionUrl: setupUrl,
      supportMessage: "Rotate STRIPE_SECRET_KEY and ensure it belongs to the Stripe account with Identity enabled.",
    };
  }

  if (
    message.includes("account")
    && (
      message.includes("incomplete")
      || message.includes("restricted")
      || message.includes("requirements")
      || message.includes("disabled")
    )
  ) {
    return {
      status: 400,
      error: "Stripe account setup is incomplete for Identity verification.",
      errorCode: "STRIPE_ACCOUNT_INCOMPLETE",
      adminActionUrl: setupUrl,
      supportMessage: "An account admin must complete Stripe account requirements before users can verify IDs.",
    };
  }

  return {
    status: 500,
    error: rawMessage || "Unable to create identity verification session.",
    errorCode: "ID_VERIFICATION_UNAVAILABLE",
    supportMessage: "Please retry shortly. If this persists, contact support.",
  };
}

function isCurrentlyActiveVerification(profile: ProfileRow): boolean {
  if (profile.id_verified !== true) {
    return false;
  }

  if (String(profile.id_verification_status || "").trim().toLowerCase() !== "verified") {
    return false;
  }

  if (!profile.id_verification_expires_at) {
    return false;
  }

  const expiry = new Date(profile.id_verification_expires_at);
  if (Number.isNaN(expiry.getTime())) {
    return false;
  }

  return expiry.getTime() > Date.now();
}

function isPhotoCaptureFreshForVerification(profile: ProfileRow): boolean {
  const capturedAt = parseIsoDate(profile.profile_photo_captured_at);
  if (!capturedAt) {
    return false;
  }
  const maxPhotoAgeMs = 1000 * 60 * 60 * 24 * 30;
  return Date.now() - capturedAt.getTime() <= maxPhotoAgeMs;
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
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const returnUrl = Deno.env.get("STRIPE_IDENTITY_RETURN_URL");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Server configuration error: missing Supabase settings" }, 500);
  }

  if (!stripeSecretKey) {
    return buildActionableErrorResponse(
      "ID verification service is temporarily unavailable.",
      "ID_VERIFICATION_UNAVAILABLE",
      500,
      {
        supportMessage: "Server configuration is missing STRIPE_SECRET_KEY.",
      },
    );
  }

  try {
    const requestBody = await req.json().catch(() => ({})) as Record<string, unknown>;
    const token = extractAccessToken(req, requestBody);

    if (!token) {
      return jsonResponse({ error: "Authentication required" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const {
      data: authData,
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData?.user) {
      return jsonResponse({ error: "Invalid authentication token" }, 401);
    }

    const userId = authData.user.id;

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select(
        "first_name,last_name,avatar_url,profile_photo_source,profile_photo_captured_at,profile_photo_capture_verified,profile_photo_last_changed_at,id_verified,id_verification_status,id_verification_expires_at,id_verification_failure_code,id_verification_failure_message,id_verification_last_failed_at"
      )
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profileData) {
      return jsonResponse({ error: "Profile not found. Please complete profile setup first." }, 400);
    }

    const profile = profileData as ProfileRow;
    const firstName = normalizeNamePart(profile.first_name);
    const lastName = normalizeNamePart(profile.last_name);

    if (!firstName || !lastName) {
      return buildActionableErrorResponse(
        "Your legal profile name is required. Add your first and last name exactly as shown on your government-issued photo ID.",
        "ID_VERIFICATION_UNAVAILABLE",
        400
      );
    }

    if (!normalizeNamePart(profile.avatar_url)) {
      return buildActionableErrorResponse(
        "Take a profile photo in Edit Profile before starting verification.",
        "ID_VERIFICATION_UNAVAILABLE",
        400
      );
    }

    if (String(profile.profile_photo_source || "").toLowerCase() !== "in_app_camera") {
      return buildActionableErrorResponse(
        "Retake your profile photo with the in-app camera before starting verification.",
        "ID_VERIFICATION_UNAVAILABLE",
        400,
      );
    }

    if (profile.profile_photo_capture_verified !== true) {
      return buildActionableErrorResponse(
        "Your profile photo needs a fresh quality check. Retake and save your profile photo before verification.",
        "ID_VERIFICATION_UNAVAILABLE",
        400
      );
    }

    if (!isPhotoCaptureFreshForVerification(profile)) {
      return buildActionableErrorResponse(
        "Your profile photo capture is too old. Retake your photo before starting verification.",
        "ID_VERIFICATION_UNAVAILABLE",
        400
      );
    }

    const fifteenMinutesAgoIso = new Date(Date.now() - (15 * 60 * 1000)).toISOString();
    const { count: recentStartCount, error: recentStartError } = await supabaseAdmin
      .from("verification_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("event_type", "id_verification_started")
      .gte("created_at", fifteenMinutesAgoIso);

    if (recentStartError && !["42P01", "PGRST205"].includes(String(recentStartError.code || ""))) {
      console.error("Unable to check verification start rate-limit:", recentStartError);
    }

    if ((recentStartCount || 0) >= 5) {
      return buildActionableErrorResponse(
        "Too many verification attempts. Please wait a few minutes and try again.",
        "ID_VERIFICATION_UNAVAILABLE",
        429
      );
    }

    const fullName = `${firstName} ${lastName}`.trim();

    const body = new URLSearchParams();
    body.set("type", "document");
    body.set("options[document][require_matching_selfie]", "true");
    body.set("metadata[user_id]", userId);
    body.set("metadata[profile_first_name]", firstName);
    body.set("metadata[profile_last_name]", lastName);
    body.set("metadata[profile_full_name]", fullName);

    if (typeof returnUrl === "string" && returnUrl.trim()) {
      body.set("return_url", returnUrl.trim());
    }

    const stripeResponse = await fetch("https://api.stripe.com/v1/identity/verification_sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const stripePayload = await stripeResponse.json().catch(() => ({})) as StripeIdentitySessionResponse;

    if (!stripeResponse.ok || !stripePayload.id || !stripePayload.url) {
      const mappedError = mapStripeIdentitySessionError(stripePayload, stripeSecretKey);
      console.error("Stripe Identity session creation failed:", {
        status: stripeResponse.status,
        error_code: stripePayload?.error?.code || null,
        error_type: stripePayload?.error?.type || null,
        mapped_error_code: mappedError.errorCode,
      });
      return buildActionableErrorResponse(
        mappedError.error,
        mappedError.errorCode,
        mappedError.status,
        {
          adminActionUrl: mappedError.adminActionUrl,
          supportMessage: mappedError.supportMessage,
        },
      );
    }

    const nowIso = new Date().toISOString();
    const currentlyActive = isCurrentlyActiveVerification(profile);

    const profileUpdates: Record<string, unknown> = {
      id_verification_provider: "stripe_identity",
      id_verification_provider_ref: stripePayload.id,
      updated_at: nowIso,
    };

    if (!currentlyActive) {
      profileUpdates.id_verification_status = "pending";
      profileUpdates.id_verified = false;
    }
    profileUpdates.id_verification_failure_code = null;
    profileUpdates.id_verification_failure_message = null;
    profileUpdates.id_verification_last_failed_at = null;

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdates)
      .eq("id", userId);

    if (updateError) {
      console.error("Unable to update profile verification status before session launch:", updateError);
      return jsonResponse({ error: "Unable to start ID verification right now." }, 500);
    }

    const { error: appResetError } = await supabaseAdmin
      .from("companion_applications")
      .update({
        id_verification_failure_code: null,
        id_verification_failure_message: null,
        updated_at: nowIso,
      })
      .eq("user_id", userId);

    if (appResetError && !["42P01", "42703", "PGRST205"].includes(String(appResetError.code || ""))) {
      console.error("Unable to clear companion application verification failure state:", appResetError);
    }

    const { error: eventError } = await supabaseAdmin
      .from("verification_events")
      .insert({
        user_id: userId,
        event_type: "id_verification_started",
        event_status: "pending",
        event_data: {
          provider: "stripe_identity",
          session_id: stripePayload.id,
          started_at: nowIso,
          preserving_active_verification: currentlyActive,
        },
      });

    if (eventError && !["42P01", "PGRST205"].includes(String(eventError.code || ""))) {
      console.error("Unable to log id_verification_started event:", eventError);
    }

    return jsonResponse({
      sessionId: stripePayload.id,
      url: stripePayload.url,
      status: currentlyActive ? "verified" : "pending",
    });
  } catch (error) {
    console.error("create-id-verification-session error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
