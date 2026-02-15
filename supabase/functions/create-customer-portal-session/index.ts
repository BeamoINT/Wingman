/**
 * Supabase Edge Function: create-customer-portal-session
 * Creates a Stripe Billing Portal session for the authenticated user.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type StripeResponse = Record<string, unknown>;

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function stripeRequest(
  secretKey: string,
  endpoint: string,
  method: 'GET' | 'POST' = 'POST',
  params?: Record<string, string>
): Promise<{ data: StripeResponse | null; error: string | null; status?: number }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
  };

  let url = `https://api.stripe.com${endpoint}`;
  let body: URLSearchParams | undefined;

  if (method === 'GET' && params) {
    const query = new URLSearchParams(params);
    url = `${url}?${query.toString()}`;
  } else if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(params);
  }

  const response = await fetch(url, { method, headers, body });
  const data = await response.json() as StripeResponse;

  if (!response.ok) {
    const errorMessage = typeof data?.error === 'object' && data.error !== null
      ? String((data.error as Record<string, unknown>).message || 'Stripe request failed')
      : 'Stripe request failed';
    return { data: null, error: errorMessage, status: response.status };
  }

  return { data, error: null, status: response.status };
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
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const stripePortalReturnUrl = Deno.env.get('STRIPE_PORTAL_RETURN_URL');

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Server configuration error: missing Supabase settings' }, 500);
  }

  if (!stripeSecretKey || !stripePortalReturnUrl) {
    return jsonResponse(
      { error: 'Payments are not configured. Missing STRIPE_SECRET_KEY or STRIPE_PORTAL_RETURN_URL.' },
      500
    );
  }

  try {
    const requestBody = await req.json().catch(() => ({})) as Record<string, unknown>;
    const sessionTokenHeader = req.headers.get('x-session-token');
    const authHeader = req.headers.get('Authorization');

    const bearerMatch = authHeader?.trim().match(/^Bearer\s+(.+)$/i);
    const authorizationToken = bearerMatch?.[1]?.trim();

    const possibleTokens = [
      typeof sessionTokenHeader === 'string' ? sessionTokenHeader.trim() : '',
      typeof requestBody.accessToken === 'string' ? requestBody.accessToken.trim() : '',
      typeof authorizationToken === 'string' ? authorizationToken : '',
    ];

    const token = possibleTokens.find(candidate => {
      if (!candidate) return false;
      // Access tokens are JWTs (three dot-separated segments).
      return candidate.split('.').length === 3;
    }) || null;

    if (!token) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    const user = authData?.user;

    if (authError || !user) {
      return jsonResponse({ error: 'Invalid authentication token' }, 401);
    }

    let profile: Record<string, unknown> | null = null;
    let hasStripeCustomerColumn = true;

    const profileWithStripe = await supabaseAdmin
      .from('profiles')
      .select('id,email,first_name,last_name,stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileWithStripe.error) {
      if (profileWithStripe.error.code === '42703') {
        hasStripeCustomerColumn = false;
        const fallbackProfile = await supabaseAdmin
          .from('profiles')
          .select('id,email,first_name,last_name')
          .eq('id', user.id)
          .single();

        if (fallbackProfile.error || !fallbackProfile.data) {
          return jsonResponse({ error: 'Unable to load user profile' }, 400);
        }
        profile = fallbackProfile.data as Record<string, unknown>;
      } else {
        return jsonResponse({ error: 'Unable to load user profile' }, 400);
      }
    } else {
      profile = profileWithStripe.data as Record<string, unknown>;
    }

    const email = String(profile?.email || user.email || '').trim();
    if (!email) {
      return jsonResponse({ error: 'No email found for this account' }, 400);
    }

    const fullName = `${String(profile?.first_name || '').trim()} ${String(profile?.last_name || '').trim()}`.trim();
    let customerId = String(profile?.stripe_customer_id || '').trim() || null;

    if (customerId) {
      const existingCustomer = await stripeRequest(
        stripeSecretKey,
        `/v1/customers/${encodeURIComponent(customerId)}`,
        'GET'
      );

      if (existingCustomer.error) {
        customerId = null;
      } else if (existingCustomer.data?.deleted === true) {
        customerId = null;
      }
    }

    if (!customerId) {
      const listResult = await stripeRequest(
        stripeSecretKey,
        '/v1/customers',
        'GET',
        { email, limit: '10' }
      );

      if (listResult.error) {
        return jsonResponse({ error: listResult.error }, 500);
      }

      const listed = Array.isArray(listResult.data?.data)
        ? listResult.data.data as Array<Record<string, unknown>>
        : [];

      const matchByMetadata = listed.find((candidate) => {
        if (candidate.deleted === true) return false;
        const metadata = candidate.metadata as Record<string, unknown> | undefined;
        return String(metadata?.supabase_user_id || '') === user.id;
      });

      const firstActive = listed.find(candidate => candidate.deleted !== true);
      const existing = matchByMetadata || firstActive;

      if (existing?.id) {
        customerId = String(existing.id);
      } else {
        const createParams: Record<string, string> = {
          email,
          'metadata[supabase_user_id]': user.id,
        };

        if (fullName) {
          createParams.name = fullName;
        }

        const createCustomer = await stripeRequest(
          stripeSecretKey,
          '/v1/customers',
          'POST',
          createParams
        );

        if (createCustomer.error || !createCustomer.data?.id) {
          return jsonResponse({ error: createCustomer.error || 'Failed to create Stripe customer' }, 500);
        }

        customerId = String(createCustomer.data.id);
      }

      if (customerId && hasStripeCustomerColumn) {
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (updateError) {
          console.warn('Unable to persist stripe_customer_id:', updateError.message);
        }
      }
    }

    if (!customerId) {
      return jsonResponse({ error: 'Could not initialize Stripe customer account' }, 500);
    }

    const portalSession = await stripeRequest(
      stripeSecretKey,
      '/v1/billing_portal/sessions',
      'POST',
      {
        customer: customerId,
        return_url: stripePortalReturnUrl,
      }
    );

    if (portalSession.error || !portalSession.data?.url) {
      return jsonResponse({ error: portalSession.error || 'Failed to create billing portal session' }, 500);
    }

    return jsonResponse({
      url: String(portalSession.data.url),
    });
  } catch (error) {
    console.error('Error in create-customer-portal-session:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
