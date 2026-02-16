/**
 * Supabase Edge Function: get-media-download-url
 * Issues short-lived signed download URLs for encrypted message media.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MEDIA_BUCKET = 'message-media-encrypted';
const SIGNED_URL_TTL_SECONDS = 90;

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
    throw new Error('Not authorized to access this media.');
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
    const objectPath = getString(body.objectPath);

    if (!objectPath) {
      return jsonResponse({ error: 'objectPath is required' }, 400);
    }

    const { data: attachment, error: attachmentError } = await admin
      .from('message_attachments')
      .select('conversation_id,bucket,object_path,thumbnail_object_path')
      .eq('bucket', MEDIA_BUCKET)
      .eq('object_path', objectPath)
      .maybeSingle();

    if (attachmentError || !attachment) {
      return jsonResponse({ error: 'Media not found.' }, 404);
    }

    const conversationId = getString((attachment as Json).conversation_id);
    await assertConversationMembership(admin, conversationId, user.id);

    const { data: mediaUrlData, error: mediaUrlError } = await admin
      .storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);

    if (mediaUrlError || !mediaUrlData?.signedUrl) {
      console.error('Error creating signed download URL:', mediaUrlError);
      return jsonResponse({ error: 'Unable to issue download URL right now.' }, 500);
    }

    const thumbnailPath = getString((attachment as Json).thumbnail_object_path);
    let thumbnailSignedUrl: string | null = null;

    if (thumbnailPath) {
      const { data: thumbnailData } = await admin
        .storage
        .from(MEDIA_BUCKET)
        .createSignedUrl(thumbnailPath, SIGNED_URL_TTL_SECONDS);
      thumbnailSignedUrl = thumbnailData?.signedUrl || null;
    }

    return jsonResponse({
      signedUrl: mediaUrlData.signedUrl,
      thumbnailSignedUrl,
      expiresIn: SIGNED_URL_TTL_SECONDS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse({ error: message }, 400);
  }
});
