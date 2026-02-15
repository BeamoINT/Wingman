/**
 * Payments API Service
 * Handles payment-method management via Stripe Customer Portal.
 */

import Constants from 'expo-constants';
import { supabase } from '../supabase';

interface CustomerPortalSessionResponse {
  url?: string;
  error?: string;
}

export interface PaymentPortalResult {
  url: string | null;
  error: string | null;
}

interface FunctionsErrorLike {
  message?: string;
  context?: Response;
}

function getStripePortalFallbackUrl(): string | null {
  const configured = Constants.expoConfig?.extra?.stripeCustomerPortalUrl
    || process.env.EXPO_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL;

  if (typeof configured !== 'string') {
    return null;
  }

  const trimmed = configured.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed;
}

async function extractFunctionError(
  error: FunctionsErrorLike | null
): Promise<{ status: number | null; message: string | null }> {
  if (!error) {
    return { status: null, message: null };
  }

  const response = error.context;
  if (!response) {
    return { status: null, message: error.message || null };
  }

  const status = typeof response.status === 'number' ? response.status : null;

  try {
    const payload = await response.clone().json() as Record<string, unknown>;
    const payloadMessage = typeof payload.message === 'string'
      ? payload.message
      : typeof payload.error === 'string'
        ? payload.error
        : null;
    return { status, message: payloadMessage || error.message || null };
  } catch {
    return { status, message: error.message || null };
  }
}

async function invokeCreatePortalSession(accessToken: string | null) {
  const headers = accessToken
    ? { 'x-session-token': accessToken }
    : undefined;

  return supabase.functions.invoke<CustomerPortalSessionResponse>(
    'create-customer-portal-session',
    {
      body: accessToken ? { accessToken } : {},
      headers,
    }
  );
}

async function getCurrentAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      return null;
    }
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Create a Stripe customer portal session URL for the current user.
 */
export async function createPaymentPortalSession(): Promise<PaymentPortalResult> {
  const fallbackUrl = getStripePortalFallbackUrl();
  const accessToken = await getCurrentAccessToken();
  let { data, error } = await invokeCreatePortalSession(accessToken);

  if (!error && data?.url) {
    return { url: data.url, error: null };
  }

  if (data?.error) {
    return { url: null, error: data.error };
  }

  let { status, message } = await extractFunctionError(error as FunctionsErrorLike | null);

  if (status === 401) {
    const refreshedAccessToken = await refreshAccessToken();

    if (refreshedAccessToken) {
      const retryResult = await invokeCreatePortalSession(refreshedAccessToken);
      data = retryResult.data;
      error = retryResult.error;

      if (!error && data?.url) {
        return { url: data.url, error: null };
      }

      if (data?.error) {
        return { url: null, error: data.error };
      }

      const retryError = await extractFunctionError(error as FunctionsErrorLike | null);
      status = retryError.status;
      message = retryError.message;
    }
  }

  if (fallbackUrl) {
    return { url: fallbackUrl, error: null };
  }

  if (status === 404) {
    return {
      url: null,
      error: 'Payment management is not deployed yet. Please deploy the Stripe portal function.',
    };
  }

  if (status === 401) {
    return {
      url: null,
      error: 'Your session expired. Please sign out and sign back in, then try again.',
    };
  }

  return {
    url: null,
    error: message || 'Unable to open payment management right now. Please try again.',
  };
}
