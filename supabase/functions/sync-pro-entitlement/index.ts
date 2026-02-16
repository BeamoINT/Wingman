/**
 * Supabase Edge Function: sync-pro-entitlement
 * Authenticated fallback endpoint to reconcile Pro entitlement from RevenueCat.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parseIso(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function resolvePlatform(store: unknown): 'ios' | 'android' | 'web' | null {
  const value = String(store || '').toUpperCase();
  if (!value) return null;
  if (value.includes('APP_STORE')) return 'ios';
  if (value.includes('PLAY_STORE') || value.includes('GOOGLE')) return 'android';
  if (value.includes('STRIPE') || value.includes('WEB')) return 'web';
  return null;
}

function resolveProStatus(
  entitlement: Record<string, unknown> | null,
  expiresAtIso: string | null,
): 'inactive' | 'active' | 'grace' | 'past_due' | 'canceled' {
  if (!entitlement) {
    return 'inactive';
  }

  const nowMs = Date.now();
  const expiresMs = expiresAtIso ? Date.parse(expiresAtIso) : Number.NaN;
  const isExpired = Number.isFinite(expiresMs) && expiresMs <= nowMs;
  if (isExpired) {
    return 'canceled';
  }

  const billingIssuesDetectedAt = parseIso(entitlement.billing_issues_detected_at);
  if (billingIssuesDetectedAt) {
    return 'past_due';
  }

  const unsubscribeDetectedAt = parseIso(entitlement.unsubscribe_detected_at);
  if (unsubscribeDetectedAt) {
    return 'grace';
  }

  return 'active';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const revenueCatSecretKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  const entitlementKey = String(Deno.env.get('REVENUECAT_ENTITLEMENT_PRO') || 'pro').trim();

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Server configuration error: missing Supabase settings' }, 500);
  }

  if (!revenueCatSecretKey) {
    return jsonResponse({ error: 'RevenueCat is not configured on the server.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !authData?.user?.id) {
    return jsonResponse({ error: 'Invalid authentication token' }, 401);
  }

  const userId = authData.user.id;

  const revenueCatResponse = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${revenueCatSecretKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!revenueCatResponse.ok) {
    const rawError = await revenueCatResponse.text().catch(() => '');
    return jsonResponse({ error: rawError || 'Failed to fetch entitlement from RevenueCat' }, 502);
  }

  const rcPayload = await revenueCatResponse.json().catch(() => null) as Record<string, unknown> | null;
  if (!rcPayload) {
    return jsonResponse({ error: 'Unexpected RevenueCat response payload' }, 502);
  }

  const subscriber = (rcPayload.subscriber || {}) as Record<string, unknown>;
  const entitlements = (subscriber.entitlements || {}) as Record<string, unknown>;
  const proEntitlement = (entitlements[entitlementKey] || null) as Record<string, unknown> | null;
  const subscriptions = (subscriber.subscriptions || {}) as Record<string, unknown>;

  const proExpiresAt = parseIso(proEntitlement?.expires_date);
  const proStartedAt = parseIso(proEntitlement?.purchase_date);
  const productId = typeof proEntitlement?.product_identifier === 'string'
    ? proEntitlement.product_identifier
    : null;

  const subscriptionForProduct = productId
    ? (subscriptions[productId] as Record<string, unknown> | undefined)
    : undefined;
  const store = subscriptionForProduct?.store;
  const platform = resolvePlatform(store);

  const now = Date.now();
  const expiresMs = proExpiresAt ? Date.parse(proExpiresAt) : Number.NaN;
  const hasActiveEntitlement = !!proEntitlement && (
    !Number.isFinite(expiresMs) || expiresMs > now
  );
  const proStatus = resolveProStatus(proEntitlement, proExpiresAt);

  const updates: Record<string, unknown> = {
    subscription_tier: hasActiveEntitlement ? 'pro' : 'free',
    pro_status: hasActiveEntitlement ? proStatus : (proStatus === 'canceled' ? 'canceled' : 'inactive'),
    pro_platform: platform,
    pro_product_id: productId,
    pro_started_at: proStartedAt,
    pro_renews_at: proExpiresAt,
    pro_expires_at: proExpiresAt,
    pro_entitlement_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (updateError) {
    return jsonResponse({ error: updateError.message || 'Failed to update entitlement' }, 500);
  }

  const eventInsert = {
    user_id: userId,
    provider: 'revenuecat',
    event_type: 'manual_sync',
    raw_payload: rcPayload,
    processed_at: new Date().toISOString(),
  };

  const { error: eventError } = await supabaseAdmin
    .from('subscription_events')
    .insert(eventInsert);

  if (eventError) {
    console.error('Failed to store manual sync subscription event:', eventError.message);
  }

  return jsonResponse({
    ok: true,
    userId,
    subscriptionTier: hasActiveEntitlement ? 'pro' : 'free',
    proStatus: hasActiveEntitlement ? proStatus : (proStatus === 'canceled' ? 'canceled' : 'inactive'),
    proExpiresAt,
  });
});
