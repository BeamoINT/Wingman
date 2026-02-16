/**
 * Supabase Edge Function: verify-phone-otp
 * Verifies SMS OTP via Twilio Verify API
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ error: 'Phone number and code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const verifyServiceSid = Deno.env.get('TWILIO_VERIFY_SERVICE_SID');

    if (!accountSid || !authToken || !verifyServiceSid) {
      console.error('Missing Twilio configuration');
      return new Response(
        JSON.stringify({ verified: false, error: 'Server configuration error' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Twilio Verify API to check OTP
    const twilioUrl = `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`;

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: phone,
        Code: code,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Twilio error:', data);
      return new Response(
        JSON.stringify({
          verified: false,
          error: data.message || 'Failed to verify code',
          code: data.code
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const verified = data.status === 'approved';

    // If verified, update the user's profile in Supabase.
    // Verification is only considered complete if account status is persisted.
    if (verified) {
      // Get the authorization header to identify the user
      const authHeader = req.headers.get('Authorization');

      if (!authHeader) {
        return new Response(
          JSON.stringify({
            verified: false,
            error: 'Please sign in before verifying your phone number.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!supabaseUrl || !supabaseServiceKey) {
        return new Response(
          JSON.stringify({
            verified: false,
            error: 'Server configuration error',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const token = authHeader.replace('Bearer ', '').trim();
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (!user || userError) {
        console.error('Unable to resolve authenticated user for phone verification:', userError?.message);
        return new Response(
          JSON.stringify({
            verified: false,
            error: 'Unable to link verification to your account. Please sign in again and retry.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const nowIso = new Date().toISOString();
      const profileUpdate = {
        phone,
        phone_verified: true,
        phone_verified_at: nowIso,
      };

      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id)
        .select('id')
        .maybeSingle();

      if (updateError) {
        console.error('Failed to update phone verification status:', updateError.message);
        return new Response(
          JSON.stringify({
            verified: false,
            error: 'Phone verified, but failed to update your account. Please try again.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!updatedProfile) {
        const metadata = (user.user_metadata || {}) as Record<string, unknown>;
        const firstName = typeof metadata.first_name === 'string' ? metadata.first_name : '';
        const lastName = typeof metadata.last_name === 'string' ? metadata.last_name : '';

        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: user.id,
              first_name: firstName,
              last_name: lastName,
              email: user.email || '',
              ...profileUpdate,
            },
            { onConflict: 'id' }
          );

        if (upsertError) {
          console.error('Failed to upsert profile after phone verification:', upsertError.message);
          return new Response(
            JSON.stringify({
              verified: false,
              error: 'Phone verified, but failed to save your account status. Please contact support.',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Best-effort verification history logging.
      // Do not fail phone verification if history table is unavailable.
      const { error: verificationEventError } = await supabase
        .from('verification_events')
        .insert({
          user_id: user.id,
          event_type: 'phone_verified',
          event_status: 'success',
          event_data: {
            source: 'verify-phone-otp',
            verified_at: nowIso,
          },
        });

      if (verificationEventError) {
        if (!['42P01', 'PGRST205'].includes(String(verificationEventError.code || ''))) {
          console.error('Failed to log verification event:', verificationEventError.message);
        }
      }
    }

    return new Response(
      JSON.stringify({
        verified,
        status: data.status
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-phone-otp:', error);
    return new Response(
      JSON.stringify({ verified: false, error: 'Internal server error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
