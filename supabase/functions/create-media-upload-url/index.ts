/**
 * Supabase Edge Function: create-media-upload-url
 * Mints short-lived signed upload URLs for encrypted media messages.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MEDIA_BUCKET = 'message-media-encrypted';
const MAX_CIPHERTEXT_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_DURATION_MS = 60_000;
const MAX_UPLOADS_PER_MINUTE_PER_USER = 12;
const MAX_UPLOADS_PER_MINUTE_PER_CONVERSATION = 8;

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

function getPositiveInt(input: unknown): number {
  const value = Number(input);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
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
    .select('participant_1,participant_2')
    .eq('id', conversationId)
    .maybeSingle();

  if (conversationError || !conversation) {
    throw new Error('Conversation not found.');
  }

  const participant1 = getString((conversation as Json).participant_1);
  const participant2 = getString((conversation as Json).participant_2);
  if (participant1 !== userId && participant2 !== userId) {
    throw new Error('Not authorized to upload media to this conversation.');
  }
}

async function enforceUploadRateLimits(
  admin: ReturnType<typeof createClient>,
  userId: string,
  conversationId: string,
): Promise<void> {
  const since = new Date(Date.now() - 60 * 1000).toISOString();

  const [userWindow, conversationWindow] = await Promise.all([
    admin
      .from('message_attachments')
      .select('id', { count: 'exact', head: true })
      .eq('sender_user_id', userId)
      .gte('created_at', since),
    admin
      .from('message_attachments')
      .select('id', { count: 'exact', head: true })
      .eq('sender_user_id', userId)
      .eq('conversation_id', conversationId)
      .gte('created_at', since),
  ]);

  if (!userWindow.error && (userWindow.count || 0) >= MAX_UPLOADS_PER_MINUTE_PER_USER) {
    throw new Error('Upload rate limit reached. Please wait a minute and try again.');
  }

  if (!conversationWindow.error && (conversationWindow.count || 0) >= MAX_UPLOADS_PER_MINUTE_PER_CONVERSATION) {
    throw new Error('You are sending media too quickly in this chat. Please wait a moment.');
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
    const conversationId = getString(body.conversationId);
    const mediaKind = getString(body.mediaKind).toLowerCase();
    const ciphertextSizeBytes = getPositiveInt(body.ciphertextSizeBytes);
    const durationMs = getPositiveInt(body.durationMs);

    if (!conversationId) {
      return jsonResponse({ error: 'conversationId is required' }, 400);
    }

    if (mediaKind !== 'image' && mediaKind !== 'video') {
      return jsonResponse({ error: 'mediaKind must be image or video' }, 400);
    }

    if (ciphertextSizeBytes <= 0 || ciphertextSizeBytes > MAX_CIPHERTEXT_BYTES) {
      return jsonResponse({ error: 'ciphertextSizeBytes must be within 1 and 20971520' }, 400);
    }

    if (mediaKind === 'video' && durationMs > MAX_VIDEO_DURATION_MS) {
      return jsonResponse({ error: 'Video duration exceeds 60 second limit' }, 400);
    }

    await assertConversationMembership(admin, conversationId, user.id);
    await enforceUploadRateLimits(admin, user.id, conversationId);

    const randomId = crypto.randomUUID();
    const objectPath = `${conversationId}/${user.id}/${Date.now()}-${randomId}.enc`;

    const { data: uploadData, error: uploadError } = await admin
      .storage
      .from(MEDIA_BUCKET)
      .createSignedUploadUrl(objectPath);

    if (uploadError || !uploadData) {
      console.error('Error creating signed upload URL:', uploadError);
      return jsonResponse({ error: 'Unable to create upload URL right now.' }, 500);
    }

    return jsonResponse({
      bucket: MEDIA_BUCKET,
      objectPath,
      signedUrl: uploadData.signedUrl,
      token: uploadData.token,
      path: uploadData.path,
      maxCiphertextBytes: MAX_CIPHERTEXT_BYTES,
      maxVideoDurationMs: MAX_VIDEO_DURATION_MS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse({ error: message }, 400);
  }
});

