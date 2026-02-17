import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.25.0?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

type ProfileRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  profile_photo_id_match_attested?: boolean | null;
  id_verified?: boolean | null;
  id_verified_at?: string | null;
  id_verification_status?: string | null;
  id_verification_expires_at?: string | null;
  id_verification_failure_code?: string | null;
  id_verification_failure_message?: string | null;
  id_verification_last_failed_at?: string | null;
};

type FailureReason = {
  code: string;
  message: string;
  sourceSignals: string[];
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

function normalizeHumanName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function toString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function extractVerifiedFullName(session: Stripe.Identity.VerificationSession): string {
  const outputs = session.verified_outputs as Record<string, unknown> | null | undefined;
  if (!outputs || typeof outputs !== "object") {
    return "";
  }

  const fullName = toString(outputs.full_name);
  if (fullName) {
    return fullName;
  }

  const firstName = toString(outputs.first_name);
  const lastName = toString(outputs.last_name);
  return `${firstName} ${lastName}`.trim();
}

function buildExpectedProfileName(profile: ProfileRow): string {
  const firstName = toString(profile.first_name);
  const lastName = toString(profile.last_name);
  return `${firstName} ${lastName}`.trim();
}

function isCurrentlyActiveVerification(profile: ProfileRow): boolean {
  if (profile.id_verified !== true) {
    return false;
  }

  if (String(profile.id_verification_status || "").toLowerCase() !== "verified") {
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

function getThreeYearExpiryIso(now = new Date()): string {
  const expiry = new Date(now);
  expiry.setUTCFullYear(expiry.getUTCFullYear() + 3);
  return expiry.toISOString();
}

function addSignal(target: Set<string>, raw: unknown): void {
  const value = toString(raw).toLowerCase();
  if (value) {
    target.add(value);
  }
}

function collectFailureSignals(
  session: Stripe.Identity.VerificationSession,
  verificationReport: Record<string, unknown> | null,
): string[] {
  const signals = new Set<string>();

  const lastError = (session as unknown as Record<string, unknown>).last_error as Record<string, unknown> | null | undefined;
  if (lastError && typeof lastError === "object") {
    addSignal(signals, lastError.code);
    addSignal(signals, lastError.reason);
    addSignal(signals, lastError.type);
  }

  const documentSection = verificationReport?.document as Record<string, unknown> | undefined;
  const selfieSection = verificationReport?.selfie as Record<string, unknown> | undefined;

  if (documentSection) {
    addSignal(signals, documentSection.status);
    const documentError = documentSection.error as Record<string, unknown> | undefined;
    addSignal(signals, documentError?.code);
    addSignal(signals, documentError?.reason);
    addSignal(signals, documentSection.error_code);
    addSignal(signals, documentSection.error_reason);
  }

  if (selfieSection) {
    addSignal(signals, selfieSection.status);
    const selfieError = selfieSection.error as Record<string, unknown> | undefined;
    addSignal(signals, selfieError?.code);
    addSignal(signals, selfieError?.reason);
    addSignal(signals, selfieSection.error_code);
    addSignal(signals, selfieSection.error_reason);
  }

  addSignal(signals, (session as unknown as Record<string, unknown>).status);

  return [...signals];
}

function hasSignal(signals: string[], tokens: string[]): boolean {
  return signals.some((signal) => tokens.some((token) => signal.includes(token)));
}

function resolveFailureReason(
  session: Stripe.Identity.VerificationSession,
  verificationReport: Record<string, unknown> | null,
  options: {
    nameMismatch: boolean;
    hasPhotoIdAttestation: boolean;
    sessionStatus: string;
  },
): FailureReason {
  if (!options.hasPhotoIdAttestation) {
    return {
      code: "photo_id_attestation_missing",
      message: "Confirm in Edit Profile that your legal name and profile photo match your government photo ID.",
      sourceSignals: ["photo_id_attestation_missing"],
    };
  }

  if (options.nameMismatch) {
    return {
      code: "name_mismatch",
      message: "Your profile legal name must exactly match the name on your government photo ID.",
      sourceSignals: ["name_mismatch"],
    };
  }

  if (options.sessionStatus === "canceled") {
    return {
      code: "verification_canceled",
      message: "Verification was canceled before completion. Restart and complete all capture steps.",
      sourceSignals: ["session_canceled"],
    };
  }

  const signals = collectFailureSignals(session, verificationReport);

  if (hasSignal(signals, ["expired", "document_expired"])) {
    return {
      code: "document_expired",
      message: "Your ID appears expired. Retry with a valid, unexpired government-issued photo ID.",
      sourceSignals: signals,
    };
  }

  if (hasSignal(signals, ["selfie_document_mismatch", "selfie_mismatch", "face_mismatch", "portrait_mismatch"])) {
    return {
      code: "photo_mismatch",
      message: "Your selfie did not match your ID photo closely enough. Retry in good lighting and align your face clearly.",
      sourceSignals: signals,
    };
  }

  if (hasSignal(signals, ["document_unverified", "document_too_blurry", "document_blurry", "document_unreadable", "document_missing"])) {
    return {
      code: "document_unreadable",
      message: "Your ID image could not be verified. Retry with a sharp, glare-free photo and all edges visible.",
      sourceSignals: signals,
    };
  }

  if (hasSignal(signals, ["selfie", "face_not_found", "selfie_unverified"])) {
    return {
      code: "selfie_capture_failed",
      message: "Selfie verification failed. Retry with your face centered, uncovered, and well-lit.",
      sourceSignals: signals,
    };
  }

  if (options.sessionStatus === "requires_input") {
    return {
      code: "requires_input",
      message: "Verification requires additional input. Retry and follow all ID and selfie capture instructions.",
      sourceSignals: signals,
    };
  }

  return {
    code: "verification_failed",
    message: "ID verification failed. Retry with a clear government-issued ID and live selfie capture.",
    sourceSignals: signals,
  };
}

async function getVerificationReport(
  stripe: Stripe,
  session: Stripe.Identity.VerificationSession,
): Promise<Record<string, unknown> | null> {
  const rawReportRef = (session as unknown as Record<string, unknown>).last_verification_report;
  const reportId = (() => {
    const direct = toString(rawReportRef);
    if (direct) return direct;
    if (rawReportRef && typeof rawReportRef === "object") {
      return toString((rawReportRef as Record<string, unknown>).id);
    }
    return "";
  })();
  if (!reportId) {
    return null;
  }

  try {
    const report = await stripe.identity.verificationReports.retrieve(reportId);
    if (!report || typeof report !== "object") {
      return null;
    }

    return report as unknown as Record<string, unknown>;
  } catch (error) {
    console.error("Unable to retrieve verification report:", error);
    return null;
  }
}

async function getProfileForSession(
  supabaseAdmin: ReturnType<typeof createClient>,
  session: Stripe.Identity.VerificationSession
): Promise<ProfileRow | null> {
  const metadata = (session.metadata || {}) as Record<string, string>;
  const metadataUserId = toString(metadata.user_id);

  if (metadataUserId) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select(
        "id,first_name,last_name,profile_photo_id_match_attested,id_verified,id_verified_at,id_verification_status,id_verification_expires_at,id_verification_failure_code,id_verification_failure_message,id_verification_last_failed_at"
      )
      .eq("id", metadataUserId)
      .maybeSingle();

    if (data) {
      return data as ProfileRow;
    }
  }

  const { data: fallbackData } = await supabaseAdmin
    .from("profiles")
    .select(
      "id,first_name,last_name,profile_photo_id_match_attested,id_verified,id_verified_at,id_verification_status,id_verification_expires_at,id_verification_failure_code,id_verification_failure_message,id_verification_last_failed_at"
    )
    .eq("id_verification_provider_ref", session.id)
    .maybeSingle();

  return (fallbackData as ProfileRow | null) || null;
}

async function logVerificationEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  eventType: string,
  eventStatus: "success" | "failed" | "pending",
  eventData: Record<string, unknown>
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("verification_events")
    .insert({
      user_id: userId,
      event_type: eventType,
      event_status: eventStatus,
      event_data: eventData,
    });

  if (error && !["42P01", "PGRST205"].includes(String(error.code || ""))) {
    console.error("Failed to log verification event:", error);
  }
}

async function updateCompanionApplicationFailureState(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("companion_applications")
    .update(payload)
    .eq("user_id", userId);

  if (error && !["42P01", "42703", "PGRST205"].includes(String(error.code || ""))) {
    console.error("Failed to update companion application verification failure state:", error);
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
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const stripeWebhookSecret = Deno.env.get("STRIPE_IDENTITY_WEBHOOK_SECRET");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Server configuration error: missing Supabase settings" }, 500);
  }

  if (!stripeSecretKey || !stripeWebhookSecret) {
    return jsonResponse({ error: "Server configuration error: missing Stripe webhook settings" }, 500);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return jsonResponse({ error: "Missing stripe-signature header" }, 400);
  }

  const rawBody = await req.text();
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

  let event: Stripe.Event;
  try {
    const subtleCryptoProvider = Stripe.createSubtleCryptoProvider();
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      stripeWebhookSecret,
      undefined,
      subtleCryptoProvider,
    );
  } catch (error) {
    console.error("Invalid Stripe webhook signature:", error);
    return jsonResponse({ error: "Invalid signature" }, 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const { data: existingEvent } = await supabaseAdmin
      .from("stripe_identity_webhook_events")
      .select("event_id")
      .eq("event_id", event.id)
      .maybeSingle();

    if (existingEvent?.event_id) {
      return jsonResponse({ received: true, duplicate: true });
    }

    if (!event.type.startsWith("identity.verification_session.")) {
      const { error: idempotencyInsertError } = await supabaseAdmin
        .from("stripe_identity_webhook_events")
        .insert({ event_id: event.id, processed_at: new Date().toISOString() });

      if (idempotencyInsertError && String(idempotencyInsertError.code || "") !== "23505") {
        console.error("Unable to persist idempotency row:", idempotencyInsertError);
      }

      return jsonResponse({ received: true, ignored: true });
    }

    const sessionObject = event.data.object as Stripe.Identity.VerificationSession;
    if (!sessionObject?.id) {
      return jsonResponse({ received: true, ignored: true });
    }

    const session = await stripe.identity.verificationSessions.retrieve(sessionObject.id, {
      expand: ["verified_outputs"],
    });

    const profile = await getProfileForSession(supabaseAdmin, session);
    if (!profile) {
      console.warn("No profile found for Stripe verification session", session.id);
      const { error: idempotencyInsertError } = await supabaseAdmin
        .from("stripe_identity_webhook_events")
        .insert({ event_id: event.id, processed_at: new Date().toISOString() });

      if (idempotencyInsertError && String(idempotencyInsertError.code || "") !== "23505") {
        console.error("Unable to persist idempotency row:", idempotencyInsertError);
      }

      return jsonResponse({ received: true, ignored: true });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const verifiedName = extractVerifiedFullName(session);
    const normalizedExpected = normalizeHumanName(buildExpectedProfileName(profile));
    const normalizedVerified = normalizeHumanName(verifiedName);
    const nameMatches = !!normalizedExpected && normalizedExpected === normalizedVerified;
    const hasPhotoIdAttestation = profile.profile_photo_id_match_attested === true;
    const currentlyActive = isCurrentlyActiveVerification(profile);
    const verificationReport = await getVerificationReport(stripe, session);

    const sessionStatus = toString(session.status).toLowerCase();

    let updatePayload: Record<string, unknown> = {
      id_verification_provider: "stripe_identity",
      id_verification_provider_ref: session.id,
      updated_at: nowIso,
    };

    let companionApplicationUpdate: Record<string, unknown> | null = null;

    if (sessionStatus === "verified" && hasPhotoIdAttestation && nameMatches) {
      updatePayload = {
        ...updatePayload,
        id_verified: true,
        id_verified_at: nowIso,
        id_verification_status: "verified",
        id_verification_expires_at: getThreeYearExpiryIso(now),
        id_verification_failure_code: null,
        id_verification_failure_message: null,
        id_verification_last_failed_at: null,
      };

      companionApplicationUpdate = {
        id_verification_failure_code: null,
        id_verification_failure_message: null,
        updated_at: nowIso,
      };

      await logVerificationEvent(
        supabaseAdmin,
        profile.id,
        "id_verified",
        "success",
        {
          provider: "stripe_identity",
          session_id: session.id,
          verified_at: nowIso,
        },
      );
    } else if (sessionStatus === "verified" && (!hasPhotoIdAttestation || !nameMatches)) {
      const failure = resolveFailureReason(session, verificationReport, {
        nameMismatch: !nameMatches,
        hasPhotoIdAttestation,
        sessionStatus,
      });

      if (!currentlyActive) {
        updatePayload = {
          ...updatePayload,
          id_verified: false,
          id_verified_at: null,
          id_verification_status: hasPhotoIdAttestation ? "failed_name_mismatch" : "failed",
          id_verification_expires_at: null,
          id_verification_failure_code: failure.code,
          id_verification_failure_message: failure.message,
          id_verification_last_failed_at: nowIso,
        };

        companionApplicationUpdate = {
          id_verification_failure_code: failure.code,
          id_verification_failure_message: failure.message,
          updated_at: nowIso,
        };
      }

      await logVerificationEvent(
        supabaseAdmin,
        profile.id,
        "id_verification_failed",
        "failed",
        {
          provider: "stripe_identity",
          session_id: session.id,
          reason_code: failure.code,
          reason_message: failure.message,
          signal_count: failure.sourceSignals.length,
          preserved_previous_active_verification: currentlyActive,
        },
      );
    } else if (sessionStatus === "processing") {
      if (!currentlyActive) {
        updatePayload = {
          ...updatePayload,
          id_verification_status: "pending",
          id_verification_failure_code: null,
          id_verification_failure_message: null,
          id_verification_last_failed_at: null,
        };
      }

      companionApplicationUpdate = {
        id_verification_failure_code: null,
        id_verification_failure_message: null,
        updated_at: nowIso,
      };

      await logVerificationEvent(
        supabaseAdmin,
        profile.id,
        "id_verification_processing",
        "pending",
        {
          provider: "stripe_identity",
          session_id: session.id,
          status: sessionStatus,
        },
      );
    } else if (sessionStatus === "requires_input" || sessionStatus === "canceled") {
      const failure = resolveFailureReason(session, verificationReport, {
        nameMismatch: false,
        hasPhotoIdAttestation,
        sessionStatus,
      });

      if (!currentlyActive) {
        updatePayload = {
          ...updatePayload,
          id_verified: false,
          id_verification_status: "failed",
          id_verification_expires_at: null,
          id_verification_failure_code: failure.code,
          id_verification_failure_message: failure.message,
          id_verification_last_failed_at: nowIso,
        };

        companionApplicationUpdate = {
          id_verification_failure_code: failure.code,
          id_verification_failure_message: failure.message,
          updated_at: nowIso,
        };
      }

      await logVerificationEvent(
        supabaseAdmin,
        profile.id,
        "id_verification_failed",
        "failed",
        {
          provider: "stripe_identity",
          session_id: session.id,
          status: sessionStatus,
          reason_code: failure.code,
          reason_message: failure.message,
          preserved_previous_active_verification: currentlyActive,
        },
      );
    } else {
      await logVerificationEvent(
        supabaseAdmin,
        profile.id,
        "id_verification_status_update",
        "pending",
        {
          provider: "stripe_identity",
          session_id: session.id,
          status: sessionStatus || "unknown",
        },
      );
    }

    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update(updatePayload)
      .eq("id", profile.id);

    if (profileUpdateError) {
      console.error("Failed to update profile verification lifecycle from webhook:", profileUpdateError);
      return jsonResponse({ error: "Failed to persist verification status" }, 500);
    }

    if (companionApplicationUpdate) {
      await updateCompanionApplicationFailureState(
        supabaseAdmin,
        profile.id,
        companionApplicationUpdate,
      );
    }

    const { error: idempotencyInsertError } = await supabaseAdmin
      .from("stripe_identity_webhook_events")
      .insert({ event_id: event.id, processed_at: nowIso });

    if (idempotencyInsertError && String(idempotencyInsertError.code || "") !== "23505") {
      console.error("Unable to persist idempotency row:", idempotencyInsertError);
      return jsonResponse({ error: "Failed to persist idempotency state" }, 500);
    }

    return jsonResponse({ received: true });
  } catch (error) {
    console.error("stripe-identity-webhook error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
