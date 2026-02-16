/**
 * Supabase Edge Function: revenuecat-webhook
 * Syncs RevenueCat subscription events into profiles + subscription_events.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-authorization',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeEvent(payload: Record<string, unknown>): Record<string, unknown> {
  const nested = payload.event;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return payload;
}

function resolveUserId(rawAppUserId: unknown): string | null {
  if (typeof rawAppUserId !== 'string') {
    return null;
  }

  const value = rawAppUserId.trim();
  if (!value) {
    return null;
  }

  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
  const direct = value.match(uuidRegex);
  if (direct?.[0]) {
    return direct[0].toLowerCase();
  }

  return null;
}

function toIsoFromMs(value: unknown): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return new Date(numeric).toISOString();
}

function resolvePlatform(storeValue: unknown): 'ios' | 'android' | 'web' | null {
  const value = String(storeValue || '').toUpperCase();
  if (!value) return null;
  if (value.includes('APP_STORE')) return 'ios';
  if (value.includes('PLAY_STORE') || value.includes('GOOGLE')) return 'android';
  if (value.includes('STRIPE') || value.includes('WEB')) return 'web';
  return null;
}

function resolveShouldActivate(eventType: string): { active: boolean; status: string } {
  const upperType = eventType.toUpperCase();

  if (upperType.includes('BILLING_ISSUE')) {
    return { active: true, status: 'past_due' };
  }

  if (
    upperType.includes('EXPIRATION')
    || upperType.includes('TRANSFER')
    || upperType.includes('REFUND')
    || upperType.includes('REVOKE')
  ) {
    return { active: false, status: 'canceled' };
  }

  if (upperType.includes('CANCELLATION')) {
    return { active: true, status: 'grace' };
  }

  return { active: true, status: 'active' };
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
  const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  const expectedEntitlement = String(Deno.env.get('REVENUECAT_ENTITLEMENT_PRO') || 'pro').trim();

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Server configuration error: missing Supabase settings' }, 500);
  }

  const providedToken = (
    req.headers.get('x-authorization')
    || req.headers.get('X-Authorization')
    || req.headers.get('authorization')
    || req.headers.get('Authorization')
    || ''
  ).replace(/^Bearer\s+/i, '').trim();

  if (webhookSecret && providedToken !== webhookSecret) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const payload = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const event = normalizeEvent(payload);
  const eventType = String(event.type || payload.type || 'UNKNOWN');
  const appUserId = event.app_user_id ?? payload.app_user_id;
  const userId = resolveUserId(appUserId);
  const entitlementIds = Array.isArray(event.entitlement_ids)
    ? event.entitlement_ids.map((id) => String(id))
    : (
      typeof event.entitlement_id === 'string'
        ? [event.entitlement_id]
        : []
    );

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  const eventInsert = {
    user_id: userId,
    provider: 'revenuecat',
    event_type: eventType,
    raw_payload: payload,
    processed_at: new Date().toISOString(),
  };

  const { error: eventInsertError } = await supabaseAdmin
    .from('subscription_events')
    .insert(eventInsert);

  if (eventInsertError) {
    console.error('Failed to persist subscription event:', eventInsertError.message);
  }

  if (!userId) {
    return jsonResponse({ ok: true, ignored: true, reason: 'Unable to resolve app_user_id to user UUID' });
  }

  const includesProEntitlement = entitlementIds.length === 0
    ? true
    : entitlementIds.includes(expectedEntitlement);

  if (!includesProEntitlement) {
    return jsonResponse({ ok: true, ignored: true, reason: 'Event does not include Pro entitlement' });
  }

  const activation = resolveShouldActivate(eventType);
  const expiresAtIso = toIsoFromMs(event.expiration_at_ms ?? payload.expiration_at_ms);
  const startedAtIso = toIsoFromMs(event.purchased_at_ms ?? payload.purchased_at_ms);
  const renewsAtIso = toIsoFromMs(event.renewal_at_ms ?? payload.renewal_at_ms) || expiresAtIso;
  const productId = String(event.product_id || payload.product_id || '').trim() || null;
  const platform = resolvePlatform(event.store || payload.store);

  const now = Date.now();
  const expiresMs = expiresAtIso ? Date.parse(expiresAtIso) : Number.NaN;
  const hasFutureExpiry = Number.isFinite(expiresMs) ? expiresMs > now : true;

  const shouldEnablePro = activation.active && hasFutureExpiry;

  const updates: Record<string, unknown> = {
    subscription_tier: shouldEnablePro ? 'pro' : 'free',
    pro_status: shouldEnablePro ? activation.status : 'canceled',
    pro_platform: platform,
    pro_product_id: productId,
    pro_started_at: startedAtIso,
    pro_renews_at: renewsAtIso,
    pro_expires_at: expiresAtIso,
    pro_entitlement_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (updateError) {
    console.error('Failed to update profile entitlement from RevenueCat:', updateError.message);
    return jsonResponse({ error: updateError.message || 'Failed to sync entitlement' }, 500);
  }

  return jsonResponse({
    ok: true,
    userId,
    subscriptionTier: shouldEnablePro ? 'pro' : 'free',
    status: shouldEnablePro ? activation.status : 'canceled',
  });
});
