/**
 * Supabase Edge Function: report-encrypted-message
 * Stores user-initiated abuse reports with optional opt-in decrypted evidence.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Json = Record<string, unknown>;

function jsonResponse(body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function getString(input: unknown): string {
  return typeof input === 'string' ? input.trim() : '';
}

function getNullableString(input: unknown): string | null {
  const value = getString(input);
  return value ? value : null;
}

function getStringArray(input: unknown, maxItems: number): string[] {
  if (!Array.isArray(input)) return [];
  const values = input
    .map((value) => getString(value))
    .filter(Boolean)
    .slice(0, maxItems);
  return values;
}

async function assertConversationMembership(
  admin: ReturnType<typeof createClient>,
  conversationId: string,
  userId: string,
): Promise<void> {
  const { data: memberRow, error: memberError } = await admin
    .from('conversation_members')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .is('left_at', null)
    .maybeSingle();

  if (!memberError && memberRow) {
    return;
  }

  const { data: conversation, error: conversationError } = await admin
    .from('conversations')
    .select('participant_ids')
    .eq('id', conversationId)
    .maybeSingle();

  if (conversationError || !conversation) {
    throw new Error('Conversation not found.');
  }

  const participantIdsRaw = (conversation as Json).participant_ids;
  const participantIds = Array.isArray(participantIdsRaw)
    ? participantIdsRaw.map((value) => getString(value)).filter(Boolean)
    : [];

  if (!participantIds.includes(userId)) {
    throw new Error('Not authorized to report this conversation.');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const token = getBearerToken(req);
  if (!token) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Invalid authentication token' }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as Json;
    const reason = getString(body.reason);
    const notes = getNullableString(body.notes);
    const messageId = getNullableString(body.messageId);
    const conversationIdInput = getNullableString(body.conversationId);
    const disclosedPlaintext = getNullableString(body.disclosedPlaintext);
    const disclosedCiphertext = getNullableString(body.disclosedCiphertext);
    const disclosedAttachmentPaths = getStringArray(body.disclosedAttachmentPaths, 10);

    if (!reason) {
      return jsonResponse({ error: 'reason is required' }, 400);
    }

    if (reason.length > 120) {
      return jsonResponse({ error: 'reason is too long' }, 400);
    }

    let conversationId = conversationIdInput;

    if (messageId) {
      const { data: messageRow, error: messageError } = await admin
        .from('messages')
        .select('id,conversation_id')
        .eq('id', messageId)
        .maybeSingle();

      if (messageError || !messageRow) {
        return jsonResponse({ error: 'Message not found' }, 404);
      }

      conversationId = getString((messageRow as Json).conversation_id);
    }

    if (conversationId) {
      await assertConversationMembership(admin, conversationId, user.id);
    }

    const disclosureProvided = Boolean(
      disclosedPlaintext
      || disclosedCiphertext
      || disclosedAttachmentPaths.length > 0
    );

    const { data: reportRow, error: reportError } = await admin
      .from('encrypted_message_reports')
      .insert({
        reporter_user_id: user.id,
        message_id: messageId,
        conversation_id: conversationId,
        reason,
        notes,
        disclosed_plaintext: disclosedPlaintext,
        disclosed_ciphertext: disclosedCiphertext,
        disclosed_attachment_paths: disclosedAttachmentPaths,
      })
      .select('id,created_at')
      .single();

    if (reportError || !reportRow) {
      console.error('Error creating encrypted message report:', reportError);
      return jsonResponse({ error: 'Unable to submit report right now.' }, 500);
    }

    return jsonResponse({
      reportId: (reportRow as Json).id,
      createdAt: (reportRow as Json).created_at,
      disclosureProvided,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse({ error: message }, 400);
  }
});
