/**
 * Messages API Service (v2-first)
 *
 * - Full E2EE for text/image/video via per-device key boxes (v2).
 * - Group/event conversation support via conversation_members.
 * - Backward-compatible fallback read/send for legacy v1 direct conversations.
 */

import { messagingFeatureFlags } from '../../config/featureFlags';
import {
  createMediaUploadUrl,
  downloadEncryptedMediaToCache,
  getMediaDownloadUrl,
  uploadEncryptedMediaFile,
} from './messageMedia';
import {
  DeviceIdentityError,
  fetchRecipientDeviceIdentities,
  getOrCreateDeviceIdentity,
} from '../crypto/deviceIdentity';
import {
  decryptMediaFileToCache,
  encryptMediaFile,
  MediaCryptoError,
} from '../crypto/mediaCrypto';
import {
  createClientMessageId,
  createEncryptedMessageEnvelope,
  decryptMessageEnvelopeForDevice,
  MessageCryptoV2Error,
  type MessageKeyBoxPayload,
  type RecipientDevice,
} from '../crypto/messageCryptoV2';
import {
  decryptMessageFromSender,
  encryptMessageForRecipient,
  fetchMessagingPublicKeys,
  getEncryptedMessagePreview,
  getMessageEncryptionVersion,
  getMessagingIdentity,
  makePeerDeviceFingerprintKey,
  pinAndCheckPeerDevicePublicKeys,
  pinAndCheckPeerPublicKeys,
  type MessagingIdentity,
  SecureMessagingError,
} from '../crypto/messagingEncryption';
import {
  compressImageForMessaging,
  compressVideoForMessaging,
  MediaCompressionError,
} from '../media/compression';
import { generateVideoThumbnailForMessaging } from '../media/thumbnails';
import { supabase } from '../supabase';
import type { ProfileData } from './profiles';

type QueryError = {
  code?: string | null;
  message?: string | null;
};

type RawRecord = Record<string, unknown>;

type ConversationKind = 'direct' | 'group' | 'event';
type MessageKind = 'text' | 'image' | 'video' | 'system' | 'booking_request';

export interface MessageAttachmentData {
  id?: string;
  message_id?: string;
  conversation_id?: string;
  sender_user_id?: string;
  media_kind: 'image' | 'video';
  bucket: string;
  object_path: string;
  ciphertext_size_bytes: number;
  original_size_bytes?: number;
  duration_ms?: number;
  width?: number;
  height?: number;
  sha256: string;
  thumbnail_object_path?: string;
  media_key_base64?: string;
  media_nonce_base64?: string;
  thumbnail_key_base64?: string;
  thumbnail_nonce_base64?: string;
  decrypted_uri?: string;
  decrypted_thumbnail_uri?: string;
}

export interface ConversationData {
  id: string;
  participant_1: string;
  participant_2: string;
  booking_id?: string;
  last_message_at?: string;
  last_message_preview?: string;
  created_at: string;
  updated_at?: string;
  kind?: ConversationKind;
  title?: string;
  avatar_url?: string;
  member_count?: number;
  group_id?: string;
  event_id?: string;
  participant_1_profile?: ProfileData;
  participant_2_profile?: ProfileData;
  unread_count?: number;
}

export interface MessageData {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_user_id?: string;
  sender_device_id?: string;
  content: string;
  encrypted_for_participant_1?: string;
  encrypted_for_participant_2?: string;
  encryption_nonce_p1?: string;
  encryption_nonce_p2?: string;
  encryption_sender_public_key?: string;
  encryption_version?: string;
  message_kind?: MessageKind;
  ciphertext?: string;
  ciphertext_nonce?: string;
  ciphertext_version?: string;
  preview_ciphertext?: string;
  preview_nonce?: string;
  client_message_id?: string;
  reply_to_message_id?: string;
  type: 'text' | 'image' | 'booking_request' | 'system';
  is_read: boolean;
  read_at?: string;
  created_at: string;
  sender?: ProfileData;
  attachments?: MessageAttachmentData[];
}

type ConversationMemberRow = {
  conversation_id: string;
  user_id: string;
  role?: string;
  last_read_at?: string;
  left_at?: string | null;
};

type MessageKeyBoxRow = {
  message_id: string;
  recipient_user_id: string;
  recipient_device_id: string;
  wrapped_key: string;
  wrapped_key_nonce: string;
  sender_public_key: string;
  sender_key_version: string;
};

type MediaPayloadAttachment = {
  bucket: string;
  objectPath: string;
  mediaKind: 'image' | 'video';
  mediaKeyBase64: string;
  mediaNonceBase64: string;
  thumbnailObjectPath?: string;
  thumbnailKeyBase64?: string;
  thumbnailNonceBase64?: string;
};

type MediaMessagePayload = {
  text?: string;
  attachments: MediaPayloadAttachment[];
};

const ENCRYPTED_MESSAGE_PREVIEW = getEncryptedMessagePreview();
const MESSAGE_KEY_CHANGED_PLACEHOLDER = 'Message unavailable: safety key changed.';
const LEGACY_ENCRYPTION_VERSION = getMessageEncryptionVersion();
let messagingV2SupportCache: boolean | null = null;

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function normalizeMessageKind(value: unknown): MessageKind {
  const normalized = String(value || 'text').trim().toLowerCase().replace(/-/g, '_');

  switch (normalized) {
    case 'text':
    case 'image':
    case 'video':
    case 'system':
    case 'booking_request':
      return normalized;
    default:
      return 'text';
  }
}

function normalizeMessageType(value: unknown): MessageData['type'] {
  const normalized = String(value || 'text').trim().toLowerCase().replace(/-/g, '_');
  switch (normalized) {
    case 'text':
    case 'image':
    case 'booking_request':
    case 'system':
      return normalized;
    default:
      return 'text';
  }
}

function normalizeConversationKind(value: unknown): ConversationKind {
  const normalized = String(value || 'direct').trim().toLowerCase();
  if (normalized === 'group' || normalized === 'event') {
    return normalized;
  }
  return 'direct';
}

function normalizeProfile(rawProfile: unknown): ProfileData | undefined {
  const value = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const profile = value as RawRecord;
  const now = new Date().toISOString();

  return {
    id: getString(profile.id),
    first_name: getString(profile.first_name),
    last_name: getString(profile.last_name),
    email: getString(profile.email),
    phone: getOptionalString(profile.phone),
    avatar_url: getOptionalString(profile.avatar_url),
    bio: getOptionalString(profile.bio),
    date_of_birth: getOptionalString(profile.date_of_birth),
    gender: getOptionalString(profile.gender),
    city: getOptionalString(profile.city),
    state: getOptionalString(profile.state),
    country: getOptionalString(profile.country),
    email_verified: profile.email_verified === true,
    phone_verified: profile.phone_verified === true,
    id_verified: profile.id_verified === true,
    verification_level: getString(profile.verification_level, 'basic'),
    terms_accepted: profile.terms_accepted === true,
    privacy_accepted: profile.privacy_accepted === true,
    age_confirmed: profile.age_confirmed === true,
    electronic_signature_consent: profile.electronic_signature_consent === true,
    electronic_signature_consent_at: getOptionalString(profile.electronic_signature_consent_at) ?? null,
    marketing_opt_in: profile.marketing_opt_in === true,
    subscription_tier: getString(profile.subscription_tier, 'free'),
    created_at: getString(profile.created_at, now),
    updated_at: getString(profile.updated_at, now),
  };
}

function normalizeConversation(row: RawRecord): ConversationData {
  const now = new Date().toISOString();
  return {
    id: getString(row.id),
    participant_1: getString(row.participant_1),
    participant_2: getString(row.participant_2),
    booking_id: getOptionalString(row.booking_id),
    last_message_at: getOptionalString(row.last_message_at),
    last_message_preview: getOptionalString(row.last_message_preview),
    created_at: getString(row.created_at, now),
    updated_at: getOptionalString(row.updated_at),
    kind: normalizeConversationKind(row.kind),
    title: getOptionalString(row.title),
    avatar_url: getOptionalString(row.avatar_url),
    member_count: undefined,
    group_id: getOptionalString(row.group_id),
    event_id: getOptionalString(row.event_id),
    unread_count: 0,
  };
}

function normalizeAttachment(row: RawRecord): MessageAttachmentData {
  return {
    id: getOptionalString(row.id),
    message_id: getOptionalString(row.message_id),
    conversation_id: getOptionalString(row.conversation_id),
    sender_user_id: getOptionalString(row.sender_user_id),
    media_kind: getString(row.media_kind) === 'video' ? 'video' : 'image',
    bucket: getString(row.bucket),
    object_path: getString(row.object_path),
    ciphertext_size_bytes: Math.max(0, Math.round(toNumber(row.ciphertext_size_bytes, 0))),
    original_size_bytes: toNumber(row.original_size_bytes, 0) || undefined,
    duration_ms: toNumber(row.duration_ms, 0) || undefined,
    width: toNumber(row.width, 0) || undefined,
    height: toNumber(row.height, 0) || undefined,
    sha256: getString(row.sha256),
    thumbnail_object_path: getOptionalString(row.thumbnail_object_path),
  };
}

function normalizeMessage(row: RawRecord): MessageData {
  const now = new Date().toISOString();
  const senderId = getString(row.sender_user_id) || getString(row.sender_id);

  return {
    id: getString(row.id),
    conversation_id: getString(row.conversation_id),
    sender_id: senderId,
    sender_user_id: getOptionalString(row.sender_user_id),
    sender_device_id: getOptionalString(row.sender_device_id),
    content: getString(row.content),
    encrypted_for_participant_1: getOptionalString(row.encrypted_for_participant_1),
    encrypted_for_participant_2: getOptionalString(row.encrypted_for_participant_2),
    encryption_nonce_p1: getOptionalString(row.encryption_nonce_p1),
    encryption_nonce_p2: getOptionalString(row.encryption_nonce_p2),
    encryption_sender_public_key: getOptionalString(row.encryption_sender_public_key),
    encryption_version: getOptionalString(row.encryption_version),
    message_kind: normalizeMessageKind(row.message_kind),
    ciphertext: getOptionalString(row.ciphertext),
    ciphertext_nonce: getOptionalString(row.ciphertext_nonce),
    ciphertext_version: getOptionalString(row.ciphertext_version),
    preview_ciphertext: getOptionalString(row.preview_ciphertext),
    preview_nonce: getOptionalString(row.preview_nonce),
    client_message_id: getOptionalString(row.client_message_id),
    reply_to_message_id: getOptionalString(row.reply_to_message_id),
    type: normalizeMessageType(row.type),
    is_read: row.is_read === true,
    read_at: getOptionalString(row.read_at),
    created_at: getString(row.created_at, now),
    sender: normalizeProfile(row.sender),
  };
}

function uniqueIds(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function isMissingSchemaError(error: unknown, entity?: string): boolean {
  const typed = (error || {}) as QueryError;
  const code = String(typed.code || '').toUpperCase();
  if (code === '42P01' || code === '42703' || code === 'PGRST205') {
    return true;
  }

  if (!entity) {
    return false;
  }

  const message = String(typed.message || '').toLowerCase();
  return message.includes(entity.toLowerCase());
}

async function getCurrentUserId(): Promise<{ userId: string | null; error: Error | null }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return { userId: null, error: new Error(error.message || 'Authentication failed') };
  }

  if (!user?.id) {
    return { userId: null, error: new Error('Not authenticated') };
  }

  return { userId: user.id, error: null };
}

async function isMessagingV2Available(): Promise<boolean> {
  if (!messagingFeatureFlags.messagesV2Enabled) {
    return false;
  }

  if (messagingV2SupportCache !== null) {
    return messagingV2SupportCache;
  }

  const checks = await Promise.all([
    supabase.from('conversation_members').select('conversation_id').limit(1),
    supabase.from('message_device_identities').select('device_id').limit(1),
    supabase.from('messages').select('ciphertext,ciphertext_nonce,message_kind').limit(1),
  ]);

  const hasMissing = checks.some((result) => isMissingSchemaError(result.error));
  messagingV2SupportCache = !hasMissing;
  return messagingV2SupportCache;
}

async function fetchProfilesByIds(ids: string[]): Promise<Record<string, ProfileData>> {
  const unique = uniqueIds(ids);
  if (unique.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('id', unique);

  if (error) {
    console.error('Error fetching profiles:', error);
    return {};
  }

  const map: Record<string, ProfileData> = {};
  (data || []).forEach((row) => {
    const profile = normalizeProfile(row);
    if (profile?.id) {
      map[profile.id] = profile;
    }
  });

  return map;
}

async function fetchConversationRowsByIds(conversationIds: string[]): Promise<RawRecord[]> {
  const ids = uniqueIds(conversationIds);
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .in('id', ids)
    .order('updated_at', { ascending: false, nullsFirst: false });

  if (!error) {
    return (data || []) as RawRecord[];
  }

  if (isMissingSchemaError(error, 'updated_at')) {
    const fallback = await supabase
      .from('conversations')
      .select('*')
      .in('id', ids)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (!fallback.error) {
      return (fallback.data || []) as RawRecord[];
    }

    console.error('Error fetching conversations by IDs (fallback):', fallback.error);
    return [];
  }

  console.error('Error fetching conversations by IDs:', error);
  return [];
}

async function fetchLegacyDirectConversationRows(userId: string): Promise<RawRecord[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (!error) {
    return (data || []) as RawRecord[];
  }

  if (isMissingSchemaError(error, 'last_message_at')) {
    const fallback = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
      .order('created_at', { ascending: false, nullsFirst: false });

    if (!fallback.error) {
      return (fallback.data || []) as RawRecord[];
    }

    console.error('Error fetching direct conversations (fallback):', fallback.error);
    return [];
  }

  console.error('Error fetching direct conversations:', error);
  return [];
}

async function fetchConversationMembers(conversationIds: string[]): Promise<ConversationMemberRow[]> {
  const ids = uniqueIds(conversationIds);
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('conversation_members')
    .select('conversation_id,user_id,role,last_read_at,left_at')
    .in('conversation_id', ids)
    .is('left_at', null);

  if (error) {
    if (!isMissingSchemaError(error, 'conversation_members')) {
      console.error('Error fetching conversation members:', error);
    }
    return [];
  }

  return (data || []) as ConversationMemberRow[];
}

async function fetchLatestMessageByConversation(conversationIds: string[]): Promise<Record<string, MessageData>> {
  const ids = uniqueIds(conversationIds);
  const map: Record<string, MessageData> = {};
  if (ids.length === 0) {
    return map;
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .in('conversation_id', ids)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching latest messages by conversation:', error);
    return map;
  }

  (data || []).forEach((row) => {
    const message = normalizeMessage(row as RawRecord);
    if (!message.conversation_id || map[message.conversation_id]) {
      return;
    }
    map[message.conversation_id] = message;
  });

  return map;
}

async function countUnreadMessages(
  conversationId: string,
  currentUserId: string,
  lastReadAt?: string,
): Promise<number> {
  let query = supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .neq('sender_user_id', currentUserId);

  if (lastReadAt) {
    query = query.gt('created_at', lastReadAt);
  }

  const { count, error } = await query;
  if (!error) {
    return Math.max(0, Math.round(toNumber(count, 0)));
  }

  if (isMissingSchemaError(error, 'sender_user_id')) {
    let legacyQuery = supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', currentUserId);

    if (lastReadAt) {
      legacyQuery = legacyQuery.gt('created_at', lastReadAt);
    }

    const legacy = await legacyQuery;
    return Math.max(0, Math.round(toNumber(legacy.count, 0)));
  }

  console.error('Error counting unread messages:', error);
  return 0;
}

function mergeConversationParticipants(
  conversation: ConversationData,
  members: ConversationMemberRow[],
  currentUserId: string,
): ConversationData {
  if (members.length === 0) {
    return conversation;
  }

  const participantIds = uniqueIds(members.map((member) => member.user_id));

  const normalized = { ...conversation };

  if (normalized.kind === 'direct') {
    const otherId = participantIds.find((id) => id !== currentUserId) || participantIds[0] || '';
    normalized.participant_1 = currentUserId;
    normalized.participant_2 = otherId;
  } else {
    normalized.participant_1 = participantIds[0] || normalized.participant_1;
    normalized.participant_2 = participantIds[1] || normalized.participant_2;
  }

  normalized.member_count = participantIds.length;
  return normalized;
}

function buildConversationTitle(
  conversation: ConversationData,
  profileMap: Record<string, ProfileData>,
  members: ConversationMemberRow[],
  currentUserId: string,
): string | undefined {
  if (conversation.kind === 'group' || conversation.kind === 'event') {
    return conversation.title || undefined;
  }

  const otherUserId = members
    .map((member) => member.user_id)
    .find((id) => id !== currentUserId)
    || (conversation.participant_1 === currentUserId ? conversation.participant_2 : conversation.participant_1);

  const profile = profileMap[otherUserId || ''];
  if (!profile) {
    return undefined;
  }

  return `${profile.first_name || 'User'} ${profile.last_name || ''}`.trim();
}

async function hydrateConversationRows(
  rows: RawRecord[],
  currentUserId: string,
): Promise<ConversationData[]> {
  const conversations = rows.map((row) => normalizeConversation(row));
  const conversationIds = conversations.map((conversation) => conversation.id).filter(Boolean);

  const members = await fetchConversationMembers(conversationIds);
  const membersByConversation = members.reduce<Record<string, ConversationMemberRow[]>>((acc, member) => {
    if (!acc[member.conversation_id]) {
      acc[member.conversation_id] = [];
    }
    acc[member.conversation_id].push(member);
    return acc;
  }, {});

  const memberUserIds = members.map((member) => member.user_id);
  const participantIds = conversations.flatMap((conversation) => [conversation.participant_1, conversation.participant_2]);
  const profileMap = await fetchProfilesByIds([...memberUserIds, ...participantIds]);

  const latestMessages = await fetchLatestMessageByConversation(conversationIds);

  const hydrated: ConversationData[] = [];

  for (const conversation of conversations) {
    const conversationMembers = membersByConversation[conversation.id] || [];
    const merged = mergeConversationParticipants(conversation, conversationMembers, currentUserId);
    const ownMember = conversationMembers.find((member) => member.user_id === currentUserId);

    const unreadCount = await countUnreadMessages(
      merged.id,
      currentUserId,
      ownMember?.last_read_at,
    );

    const latest = latestMessages[merged.id];
    const title = buildConversationTitle(merged, profileMap, conversationMembers, currentUserId);

    hydrated.push({
      ...merged,
      title,
      last_message_at: latest?.created_at || merged.last_message_at,
      last_message_preview: latest ? ENCRYPTED_MESSAGE_PREVIEW : merged.last_message_preview,
      participant_1_profile: profileMap[merged.participant_1],
      participant_2_profile: profileMap[merged.participant_2],
      unread_count: unreadCount,
    });
  }

  hydrated.sort((a, b) => {
    const aTime = new Date(a.last_message_at || a.created_at).getTime();
    const bTime = new Date(b.last_message_at || b.created_at).getTime();
    return bTime - aTime;
  });

  return hydrated;
}

async function resolveLegacyConversationParticipants(
  conversationId: string,
): Promise<{ participant_1: string; participant_2: string } | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('participant_1,participant_2')
    .eq('id', conversationId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const participant1 = getString((data as RawRecord).participant_1);
  const participant2 = getString((data as RawRecord).participant_2);
  if (!participant1 || !participant2) {
    return null;
  }

  return {
    participant_1: participant1,
    participant_2: participant2,
  };
}

function messageHasLegacyEncryptedPayload(message: MessageData): boolean {
  return Boolean(
    message.encrypted_for_participant_1
    || message.encrypted_for_participant_2
    || message.encryption_nonce_p1
    || message.encryption_nonce_p2
    || message.encryption_sender_public_key,
  );
}

async function decryptLegacyV1Messages(
  messages: MessageData[],
  conversationId: string,
  currentUserId: string,
): Promise<MessageData[]> {
  if (!messages.some((message) => messageHasLegacyEncryptedPayload(message))) {
    return messages;
  }

  const participants = await resolveLegacyConversationParticipants(conversationId);
  if (!participants) {
    return messages.map((message) => ({
      ...message,
      content: messageHasLegacyEncryptedPayload(message)
        ? ENCRYPTED_MESSAGE_PREVIEW
        : message.content,
    }));
  }

  let identity: MessagingIdentity;
  try {
    identity = await getMessagingIdentity(currentUserId, { syncProfile: false });
  } catch (error) {
    console.error('Error loading legacy messaging identity:', error);
    return messages.map((message) => ({
      ...message,
      content: messageHasLegacyEncryptedPayload(message)
        ? ENCRYPTED_MESSAGE_PREVIEW
        : message.content,
    }));
  }

  const senderPublicKeys: Record<string, string> = {};
  messages.forEach((message) => {
    if (message.sender_id && message.sender_id !== currentUserId && message.encryption_sender_public_key) {
      senderPublicKeys[message.sender_id] = message.encryption_sender_public_key;
    }
  });

  let changedSenderIds = new Set<string>();
  try {
    const evaluation = await pinAndCheckPeerPublicKeys(currentUserId, senderPublicKeys);
    changedSenderIds = new Set(evaluation.changedUserIds);
  } catch (error) {
    console.error('Error pinning legacy peer keys:', error);
  }

  return messages.map((message) => {
    if (!messageHasLegacyEncryptedPayload(message)) {
      return message;
    }

    if (changedSenderIds.has(message.sender_id)) {
      return {
        ...message,
        content: MESSAGE_KEY_CHANGED_PLACEHOLDER,
      };
    }

    if (message.encryption_version && message.encryption_version !== LEGACY_ENCRYPTION_VERSION) {
      return {
        ...message,
        content: ENCRYPTED_MESSAGE_PREVIEW,
      };
    }

    const isParticipant1 = participants.participant_1 === currentUserId;
    const ciphertext = isParticipant1
      ? message.encrypted_for_participant_1
      : message.encrypted_for_participant_2;
    const nonce = isParticipant1
      ? message.encryption_nonce_p1
      : message.encryption_nonce_p2;

    if (!ciphertext || !nonce || !message.encryption_sender_public_key) {
      return {
        ...message,
        content: ENCRYPTED_MESSAGE_PREVIEW,
      };
    }

    const decrypted = decryptMessageFromSender(
      ciphertext,
      nonce,
      message.encryption_sender_public_key,
      identity.secretKey,
    );

    return {
      ...message,
      content: decrypted || ENCRYPTED_MESSAGE_PREVIEW,
    };
  });
}

function parseMediaMessagePayload(content: string): MediaMessagePayload | null {
  try {
    const parsed = JSON.parse(content) as { text?: unknown; attachments?: unknown };
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const attachments: MediaPayloadAttachment[] = [];
    if (Array.isArray(parsed.attachments)) {
      parsed.attachments.forEach((attachment) => {
        const typed = (attachment || {}) as Record<string, unknown>;
        const mediaKind = getString(typed.mediaKind) === 'video' ? 'video' : 'image';
        const bucket = getString(typed.bucket);
        const objectPath = getString(typed.objectPath);
        const mediaKeyBase64 = getString(typed.mediaKeyBase64);
        const mediaNonceBase64 = getString(typed.mediaNonceBase64);

        if (!bucket || !objectPath || !mediaKeyBase64 || !mediaNonceBase64) {
          return;
        }

        const parsedAttachment: MediaPayloadAttachment = {
          bucket,
          objectPath,
          mediaKind,
          mediaKeyBase64,
          mediaNonceBase64,
          thumbnailObjectPath: getOptionalString(typed.thumbnailObjectPath),
          thumbnailKeyBase64: getOptionalString(typed.thumbnailKeyBase64),
          thumbnailNonceBase64: getOptionalString(typed.thumbnailNonceBase64),
        };

        attachments.push(parsedAttachment);
      });
    }

    return {
      text: getOptionalString(parsed.text),
      attachments,
    };
  } catch {
    return null;
  }
}

function mergeMediaAttachments(
  storedAttachments: MessageAttachmentData[],
  payload: MediaMessagePayload | null,
): MessageAttachmentData[] {
  if (storedAttachments.length === 0) {
    return [];
  }

  const payloadByPath = new Map<string, MediaPayloadAttachment>();
  payload?.attachments.forEach((attachment) => {
    payloadByPath.set(attachment.objectPath, attachment);
  });

  return storedAttachments.map((attachment) => {
    const payloadAttachment = payloadByPath.get(attachment.object_path);
    if (!payloadAttachment) {
      return attachment;
    }

    return {
      ...attachment,
      media_key_base64: payloadAttachment.mediaKeyBase64,
      media_nonce_base64: payloadAttachment.mediaNonceBase64,
      thumbnail_key_base64: payloadAttachment.thumbnailKeyBase64,
      thumbnail_nonce_base64: payloadAttachment.thumbnailNonceBase64,
    };
  });
}

async function fetchMessageKeyBoxesForDevice(
  messageIds: string[],
  currentUserId: string,
  deviceId: string,
): Promise<Record<string, MessageKeyBoxRow>> {
  const ids = uniqueIds(messageIds);
  if (ids.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from('message_key_boxes')
    .select('message_id,recipient_user_id,recipient_device_id,wrapped_key,wrapped_key_nonce,sender_public_key,sender_key_version')
    .in('message_id', ids)
    .eq('recipient_user_id', currentUserId)
    .eq('recipient_device_id', deviceId);

  if (error) {
    if (!isMissingSchemaError(error, 'message_key_boxes')) {
      console.error('Error fetching message key boxes:', error);
    }
    return {};
  }

  return (data || []).reduce<Record<string, MessageKeyBoxRow>>((acc, row) => {
    const keyBox = row as MessageKeyBoxRow;
    if (keyBox?.message_id) {
      acc[keyBox.message_id] = keyBox;
    }
    return acc;
  }, {});
}

async function fetchMessageAttachmentsByMessageId(messageIds: string[]): Promise<Record<string, MessageAttachmentData[]>> {
  const ids = uniqueIds(messageIds);
  if (ids.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from('message_attachments')
    .select('*')
    .in('message_id', ids)
    .order('created_at', { ascending: true });

  if (error) {
    if (!isMissingSchemaError(error, 'message_attachments')) {
      console.error('Error fetching message attachments:', error);
    }
    return {};
  }

  return (data || []).reduce<Record<string, MessageAttachmentData[]>>((acc, row) => {
    const attachment = normalizeAttachment(row as RawRecord);
    if (!attachment.message_id) {
      return acc;
    }

    if (!acc[attachment.message_id]) {
      acc[attachment.message_id] = [];
    }

    acc[attachment.message_id].push(attachment);
    return acc;
  }, {});
}

async function decryptMessagesForCurrentUser(
  rawMessages: MessageData[],
  conversationId: string,
  currentUserId: string,
): Promise<MessageData[]> {
  if (rawMessages.length === 0) {
    return rawMessages;
  }

  let v2Identity: Awaited<ReturnType<typeof getOrCreateDeviceIdentity>> | null = null;
  let keyBoxesByMessageId: Record<string, MessageKeyBoxRow> = {};
  let attachmentMap: Record<string, MessageAttachmentData[]> = {};
  let changedDeviceFingerprints = new Set<string>();

  if (await isMessagingV2Available()) {
    try {
      v2Identity = await getOrCreateDeviceIdentity(currentUserId, { sync: false });
      keyBoxesByMessageId = await fetchMessageKeyBoxesForDevice(
        rawMessages.map((message) => message.id),
        currentUserId,
        v2Identity.deviceId,
      );
      attachmentMap = await fetchMessageAttachmentsByMessageId(rawMessages.map((message) => message.id));

      const deviceKeyMap: Record<string, string> = {};
      rawMessages.forEach((message) => {
        const keyBox = keyBoxesByMessageId[message.id];
        if (!keyBox || !message.sender_id || message.sender_id === currentUserId) {
          return;
        }

        const deviceFingerprintKey = makePeerDeviceFingerprintKey(
          message.sender_id,
          message.sender_device_id || 'unknown',
        );
        if (keyBox.sender_public_key) {
          deviceKeyMap[deviceFingerprintKey] = keyBox.sender_public_key;
        }
      });

      if (Object.keys(deviceKeyMap).length > 0) {
        const pinResult = await pinAndCheckPeerDevicePublicKeys(currentUserId, deviceKeyMap);
        changedDeviceFingerprints = new Set(pinResult.changedDeviceIds);
      }
    } catch (error) {
      if (!(error instanceof DeviceIdentityError)) {
        console.error('Error preparing v2 decryption pipeline:', error);
      }
    }
  }

  const decrypted = rawMessages.map((message) => {
    const attachments = attachmentMap[message.id] || [];

    if (message.ciphertext && message.ciphertext_nonce && v2Identity) {
      const keyBox = keyBoxesByMessageId[message.id];

      if (!keyBox) {
        return {
          ...message,
          content: ENCRYPTED_MESSAGE_PREVIEW,
          attachments,
        };
      }

      const fingerprintKey = makePeerDeviceFingerprintKey(
        message.sender_id,
        message.sender_device_id || 'unknown',
      );

      if (message.sender_id !== currentUserId && changedDeviceFingerprints.has(fingerprintKey)) {
        return {
          ...message,
          content: MESSAGE_KEY_CHANGED_PLACEHOLDER,
          attachments,
        };
      }

      try {
        const plaintext = decryptMessageEnvelopeForDevice({
          ciphertext: message.ciphertext,
          ciphertextNonce: message.ciphertext_nonce,
          senderPublicKey: keyBox.sender_public_key,
          wrappedKey: keyBox.wrapped_key,
          wrappedKeyNonce: keyBox.wrapped_key_nonce,
          recipientSecretKey: v2Identity.secretKey,
        });

        if (message.message_kind === 'image' || message.message_kind === 'video') {
          const payload = parseMediaMessagePayload(plaintext);
          return {
            ...message,
            content: payload?.text || (message.message_kind === 'video' ? 'Video message' : 'Image message'),
            attachments: mergeMediaAttachments(attachments, payload),
          };
        }

        return {
          ...message,
          content: plaintext,
          attachments,
        };
      } catch (error) {
        if (!(error instanceof MessageCryptoV2Error)) {
          console.error('Error decrypting v2 message:', error);
        }

        return {
          ...message,
          content: ENCRYPTED_MESSAGE_PREVIEW,
          attachments,
        };
      }
    }

    return {
      ...message,
      attachments,
    };
  });

  return decryptLegacyV1Messages(decrypted, conversationId, currentUserId);
}

async function fetchMessagesRaw(conversationId: string): Promise<{ rows: RawRecord[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (!error) {
    return {
      rows: (data || []) as RawRecord[],
      error: null,
    };
  }

  console.error('Error fetching raw messages:', error);
  return {
    rows: [],
    error: new Error(error.message || 'Failed to fetch messages'),
  };
}

async function hydrateMessages(
  rows: RawRecord[],
  conversationId: string,
  currentUserId: string,
): Promise<MessageData[]> {
  if (rows.length === 0) {
    return [];
  }

  const messages = rows.map((row) => normalizeMessage(row));
  const senderIds = uniqueIds(messages.map((message) => message.sender_id));
  const senderMap = await fetchProfilesByIds(senderIds);

  messages.forEach((message) => {
    if (!message.sender) {
      message.sender = senderMap[message.sender_id];
    }
  });

  return decryptMessagesForCurrentUser(messages, conversationId, currentUserId);
}

async function fetchMessageById(
  messageId: string,
  currentUserId: string,
): Promise<MessageData | null> {
  if (!messageId) {
    return null;
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('id', messageId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error('Error fetching message by id:', error);
    }
    return null;
  }

  const message = normalizeMessage(data as RawRecord);
  const hydrated = await hydrateMessages([data as RawRecord], message.conversation_id, currentUserId);
  return hydrated[0] || message;
}

async function ensureConversationMembersForDirect(
  conversationId: string,
  participant1: string,
  participant2: string,
): Promise<void> {
  if (!await isMessagingV2Available()) {
    return;
  }

  const rows = [participant1, participant2]
    .filter(Boolean)
    .map((userId) => ({
      conversation_id: conversationId,
      user_id: userId,
      role: 'member',
      left_at: null,
      joined_at: new Date().toISOString(),
    }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from('conversation_members')
    .upsert(rows, { onConflict: 'conversation_id,user_id' });

  if (error && !isMissingSchemaError(error, 'conversation_members')) {
    console.error('Error ensuring direct conversation members:', error);
  }
}

async function getConversationMemberUserIds(
  conversationId: string,
): Promise<string[]> {
  if (await isMessagingV2Available()) {
    const { data, error } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .is('left_at', null);

    if (!error) {
      return uniqueIds((data || []).map((row) => getString((row as RawRecord).user_id)));
    }

    if (!isMissingSchemaError(error, 'conversation_members')) {
      console.error('Error fetching conversation member IDs:', error);
    }
  }

  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('participant_1,participant_2')
    .eq('id', conversationId)
    .maybeSingle();

  if (error || !conversation) {
    return [];
  }

  return uniqueIds([
    getString((conversation as RawRecord).participant_1),
    getString((conversation as RawRecord).participant_2),
  ]);
}

function buildMediaPayload(params: {
  text?: string;
  attachments: MediaPayloadAttachment[];
}): string {
  return JSON.stringify({
    text: params.text || '',
    attachments: params.attachments,
  } satisfies MediaMessagePayload);
}

async function sendSecureMessageV2Internal(params: {
  conversationId: string;
  messageKind: MessageKind;
  plaintext: string;
  attachmentRows?: Array<{
    media_kind: 'image' | 'video';
    bucket: string;
    object_path: string;
    ciphertext_size_bytes: number;
    original_size_bytes?: number;
    duration_ms?: number;
    width?: number;
    height?: number;
    sha256: string;
    thumbnail_object_path?: string;
  }>;
}): Promise<{ message: MessageData | null; error: Error | null }> {
  try {
    const { userId, error: authError } = await getCurrentUserId();
    if (authError || !userId) {
      return { message: null, error: authError || new Error('Not authenticated') };
    }

    const deviceIdentity = await getOrCreateDeviceIdentity(userId);
    const memberUserIds = await getConversationMemberUserIds(params.conversationId);
    if (memberUserIds.length === 0) {
      return { message: null, error: new Error('Unable to resolve conversation members.') };
    }

    const recipientDevices = await fetchRecipientDeviceIdentities(memberUserIds);
    const missingMembers = memberUserIds.filter((memberId) => (
      !recipientDevices.some((device) => device.userId === memberId)
    ));

    if (missingMembers.length > 0) {
      return {
        message: null,
        error: new Error('Secure messaging keys are still initializing for one or more recipients. Ask them to open Messages and try again.'),
      };
    }

    const senderDeviceAlreadyPresent = recipientDevices.some((device) => (
      device.userId === userId && device.deviceId === deviceIdentity.deviceId
    ));

    const resolvedRecipients: RecipientDevice[] = senderDeviceAlreadyPresent
      ? recipientDevices
      : [
        ...recipientDevices,
        {
          userId,
          deviceId: deviceIdentity.deviceId,
          publicKey: deviceIdentity.publicKeyBase64,
          keyVersion: deviceIdentity.version,
        },
      ];

    const peerDevicePublicKeys: Record<string, string> = {};
    resolvedRecipients.forEach((recipient) => {
      if (recipient.userId === userId) {
        return;
      }
      const key = makePeerDeviceFingerprintKey(recipient.userId, recipient.deviceId);
      peerDevicePublicKeys[key] = recipient.publicKey;
    });

    const pinResult = await pinAndCheckPeerDevicePublicKeys(userId, peerDevicePublicKeys);
    if (pinResult.changedDeviceIds.length > 0) {
      return {
        message: null,
        error: new Error('A participant safety key changed. Messaging is blocked until trust is re-established.'),
      };
    }

    const envelope = createEncryptedMessageEnvelope({
      plaintext: params.plaintext,
      senderIdentity: deviceIdentity,
      recipients: resolvedRecipients,
      includeEncryptedPreview: true,
    });

    const rpcPayload: Record<string, unknown> = {
      p_conversation_id: params.conversationId,
      p_sender_device_id: deviceIdentity.deviceId,
      p_message_kind: params.messageKind,
      p_ciphertext: envelope.ciphertext,
      p_ciphertext_nonce: envelope.ciphertextNonce,
      p_ciphertext_version: envelope.ciphertextVersion,
      p_preview_ciphertext: envelope.previewCiphertext || null,
      p_preview_nonce: envelope.previewNonce || null,
      p_client_message_id: createClientMessageId(),
      p_reply_to_message_id: null,
      p_key_boxes: envelope.keyBoxes,
      p_attachments: params.attachmentRows || [],
    };

    const { data, error } = await supabase.rpc('send_secure_message_v2', rpcPayload);
    if (error) {
      console.error('Error sending secure v2 message:', error);
      return { message: null, error: new Error(error.message || 'Failed to send message') };
    }

    const firstRow = Array.isArray(data) ? (data[0] as RawRecord | undefined) : (data as RawRecord | null);
    const messageId = firstRow ? getString(firstRow.message_id) : '';
    if (!messageId) {
      return { message: null, error: new Error('Message sent but no message ID was returned.') };
    }

    const message = await fetchMessageById(messageId, userId);
    if (!message) {
      return { message: null, error: new Error('Message sent but could not be loaded.') };
    }

    return {
      message,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send secure message.';
    return {
      message: null,
      error: new Error(message),
    };
  }
}

async function sendLegacyV1Message(
  conversationId: string,
  content: string,
  type: MessageData['type'],
): Promise<{ message: MessageData | null; error: Error | null }> {
  try {
    const { userId, error: authError } = await getCurrentUserId();
    if (authError || !userId) {
      return { message: null, error: authError || new Error('Not authenticated') };
    }

    const participants = await resolveLegacyConversationParticipants(conversationId);
    if (!participants) {
      return { message: null, error: new Error('Unable to resolve conversation participants.') };
    }

    if (participants.participant_1 !== userId && participants.participant_2 !== userId) {
      return { message: null, error: new Error('You are not a participant in this conversation.') };
    }

    const identity = await getMessagingIdentity(userId);
    const publicKeys = await fetchMessagingPublicKeys([
      participants.participant_1,
      participants.participant_2,
    ]);

    const participant1Key = publicKeys[participants.participant_1];
    const participant2Key = publicKeys[participants.participant_2];

    if (!participant1Key || !participant2Key) {
      return {
        message: null,
        error: new Error('Secure messaging keys are missing for this conversation.'),
      };
    }

    const peerId = participants.participant_1 === userId
      ? participants.participant_2
      : participants.participant_1;
    const peerKey = publicKeys[peerId];

    if (peerId && peerKey) {
      const pinResult = await pinAndCheckPeerPublicKeys(userId, { [peerId]: peerKey });
      if (pinResult.changedUserIds.length > 0) {
        return {
          message: null,
          error: new Error('Safety key changed for this chat. Messaging is blocked until verified.'),
        };
      }
    }

    const encryptedForP1 = encryptMessageForRecipient(content, participant1Key, identity.secretKey);
    const encryptedForP2 = encryptMessageForRecipient(content, participant2Key, identity.secretKey);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: ENCRYPTED_MESSAGE_PREVIEW,
        type,
        encrypted_for_participant_1: encryptedForP1.ciphertextBase64,
        encrypted_for_participant_2: encryptedForP2.ciphertextBase64,
        encryption_nonce_p1: encryptedForP1.nonceBase64,
        encryption_nonce_p2: encryptedForP2.nonceBase64,
        encryption_sender_public_key: identity.publicKeyBase64,
        encryption_version: LEGACY_ENCRYPTION_VERSION,
      })
      .select('*')
      .maybeSingle();

    if (error || !data) {
      console.error('Error sending legacy v1 message:', error);
      return { message: null, error: new Error(error?.message || 'Failed to send message') };
    }

    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: ENCRYPTED_MESSAGE_PREVIEW,
      })
      .eq('id', conversationId);

    const message = await fetchMessageById(getString((data as RawRecord).id), userId);
    return {
      message,
      error: null,
    };
  } catch (error) {
    if (error instanceof SecureMessagingError) {
      return { message: null, error: new Error(error.message) };
    }

    return {
      message: null,
      error: new Error(error instanceof Error ? error.message : 'Failed to send message'),
    };
  }
}

export async function fetchConversations(): Promise<{ conversations: ConversationData[]; error: Error | null }> {
  try {
    const { userId, error: authError } = await getCurrentUserId();
    if (authError || !userId) {
      return { conversations: [], error: authError || new Error('Not authenticated') };
    }

    if (await isMessagingV2Available()) {
      const memberRowsResult = await supabase
        .from('conversation_members')
        .select('conversation_id,user_id,last_read_at,left_at')
        .eq('user_id', userId)
        .is('left_at', null);

      if (!memberRowsResult.error) {
        const conversationIds = uniqueIds((memberRowsResult.data || []).map((row) => getString((row as RawRecord).conversation_id)));
        if (conversationIds.length === 0) {
          return { conversations: [], error: null };
        }

        const rows = await fetchConversationRowsByIds(conversationIds);
        const conversations = await hydrateConversationRows(rows, userId);
        return { conversations, error: null };
      }

      if (!isMissingSchemaError(memberRowsResult.error, 'conversation_members')) {
        console.error('Error fetching v2 member rows:', memberRowsResult.error);
      }
    }

    const rows = await fetchLegacyDirectConversationRows(userId);
    const conversations = await hydrateConversationRows(rows, userId);
    return { conversations, error: null };
  } catch (error) {
    console.error('Error in fetchConversations:', error);
    return {
      conversations: [],
      error: error instanceof Error ? error : new Error('Failed to fetch conversations'),
    };
  }
}

export async function fetchConversationById(
  conversationId: string,
): Promise<{ conversation: ConversationData | null; error: Error | null }> {
  try {
    const { userId, error: authError } = await getCurrentUserId();
    if (authError || !userId) {
      return { conversation: null, error: authError || new Error('Not authenticated') };
    }

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching conversation by id:', error);
      return { conversation: null, error: new Error(error.message || 'Failed to fetch conversation') };
    }

    if (!data) {
      return { conversation: null, error: null };
    }

    const hydrated = await hydrateConversationRows([data as RawRecord], userId);
    return {
      conversation: hydrated[0] || null,
      error: null,
    };
  } catch (error) {
    console.error('Error in fetchConversationById:', error);
    return {
      conversation: null,
      error: error instanceof Error ? error : new Error('Failed to fetch conversation'),
    };
  }
}

export async function fetchMessages(
  conversationId: string,
): Promise<{ messages: MessageData[]; error: Error | null }> {
  try {
    const { userId, error: authError } = await getCurrentUserId();
    if (authError || !userId) {
      return { messages: [], error: authError || new Error('Not authenticated') };
    }

    const { rows, error } = await fetchMessagesRaw(conversationId);
    if (error) {
      return { messages: [], error };
    }

    const messages = await hydrateMessages(rows, conversationId, userId);
    return { messages, error: null };
  } catch (error) {
    console.error('Error in fetchMessages:', error);
    return {
      messages: [],
      error: error instanceof Error ? error : new Error('Failed to fetch messages'),
    };
  }
}

export async function sendTextMessageV2(
  conversationId: string,
  content: string,
): Promise<{ message: MessageData | null; error: Error | null }> {
  const trimmed = content.trim();
  if (!trimmed) {
    return { message: null, error: new Error('Message content cannot be empty') };
  }

  return sendSecureMessageV2Internal({
    conversationId,
    messageKind: 'text',
    plaintext: trimmed,
    attachmentRows: [],
  });
}

export async function sendImageMessageV2(params: {
  conversationId: string;
  localUri: string;
  caption?: string;
  width?: number;
  height?: number;
}): Promise<{ message: MessageData | null; error: Error | null }> {
  try {
    const compressed = await compressImageForMessaging(params.localUri);
    const encrypted = await encryptMediaFile(compressed.uri);

    const upload = await createMediaUploadUrl({
      conversationId: params.conversationId,
      mediaKind: 'image',
      ciphertextSizeBytes: encrypted.ciphertextSizeBytes,
    });

    await uploadEncryptedMediaFile({
      encryptedUri: encrypted.encryptedUri,
      signedUrl: upload.signedUrl,
    });

    const payloadAttachment: MediaPayloadAttachment = {
      bucket: upload.bucket,
      objectPath: upload.objectPath,
      mediaKind: 'image',
      mediaKeyBase64: encrypted.mediaKeyBase64,
      mediaNonceBase64: encrypted.mediaNonceBase64,
    };

    const attachmentRows = [
      {
        media_kind: 'image' as const,
        bucket: upload.bucket,
        object_path: upload.objectPath,
        ciphertext_size_bytes: encrypted.ciphertextSizeBytes,
        original_size_bytes: encrypted.originalSizeBytes,
        width: params.width,
        height: params.height,
        sha256: encrypted.sha256,
      },
    ];

    return sendSecureMessageV2Internal({
      conversationId: params.conversationId,
      messageKind: 'image',
      plaintext: buildMediaPayload({
        text: params.caption,
        attachments: [payloadAttachment],
      }),
      attachmentRows,
    });
  } catch (error) {
    if (
      error instanceof MediaCompressionError
      || error instanceof MediaCryptoError
      || error instanceof MessageCryptoV2Error
      || error instanceof DeviceIdentityError
    ) {
      return { message: null, error: new Error(error.message) };
    }

    return {
      message: null,
      error: new Error(error instanceof Error ? error.message : 'Failed to send image message'),
    };
  }
}

export async function sendVideoMessageV2(params: {
  conversationId: string;
  localUri: string;
  caption?: string;
  durationMs?: number;
  width?: number;
  height?: number;
}): Promise<{ message: MessageData | null; error: Error | null }> {
  try {
    const compressedVideo = await compressVideoForMessaging(params.localUri, params.durationMs);
    const encryptedVideo = await encryptMediaFile(compressedVideo.uri);

    const videoUpload = await createMediaUploadUrl({
      conversationId: params.conversationId,
      mediaKind: 'video',
      ciphertextSizeBytes: encryptedVideo.ciphertextSizeBytes,
      durationMs: compressedVideo.durationMs,
    });

    await uploadEncryptedMediaFile({
      encryptedUri: encryptedVideo.encryptedUri,
      signedUrl: videoUpload.signedUrl,
    });

    let thumbnailPayload: {
      objectPath: string;
      key: string;
      nonce: string;
    } | null = null;

    try {
      const thumbnail = await generateVideoThumbnailForMessaging(compressedVideo.uri);
      const compressedThumbnail = await compressImageForMessaging(thumbnail.uri);
      const encryptedThumbnail = await encryptMediaFile(compressedThumbnail.uri);

      const thumbnailUpload = await createMediaUploadUrl({
        conversationId: params.conversationId,
        mediaKind: 'image',
        ciphertextSizeBytes: encryptedThumbnail.ciphertextSizeBytes,
      });

      await uploadEncryptedMediaFile({
        encryptedUri: encryptedThumbnail.encryptedUri,
        signedUrl: thumbnailUpload.signedUrl,
      });

      thumbnailPayload = {
        objectPath: thumbnailUpload.objectPath,
        key: encryptedThumbnail.mediaKeyBase64,
        nonce: encryptedThumbnail.mediaNonceBase64,
      };
    } catch (thumbnailError) {
      console.warn('Unable to generate encrypted video thumbnail:', thumbnailError);
    }

    const payloadAttachment: MediaPayloadAttachment = {
      bucket: videoUpload.bucket,
      objectPath: videoUpload.objectPath,
      mediaKind: 'video',
      mediaKeyBase64: encryptedVideo.mediaKeyBase64,
      mediaNonceBase64: encryptedVideo.mediaNonceBase64,
      thumbnailObjectPath: thumbnailPayload?.objectPath,
      thumbnailKeyBase64: thumbnailPayload?.key,
      thumbnailNonceBase64: thumbnailPayload?.nonce,
    };

    const attachmentRows = [
      {
        media_kind: 'video' as const,
        bucket: videoUpload.bucket,
        object_path: videoUpload.objectPath,
        ciphertext_size_bytes: encryptedVideo.ciphertextSizeBytes,
        original_size_bytes: encryptedVideo.originalSizeBytes,
        duration_ms: compressedVideo.durationMs,
        width: params.width,
        height: params.height,
        sha256: encryptedVideo.sha256,
        thumbnail_object_path: thumbnailPayload?.objectPath,
      },
    ];

    return sendSecureMessageV2Internal({
      conversationId: params.conversationId,
      messageKind: 'video',
      plaintext: buildMediaPayload({
        text: params.caption,
        attachments: [payloadAttachment],
      }),
      attachmentRows,
    });
  } catch (error) {
    if (
      error instanceof MediaCompressionError
      || error instanceof MediaCryptoError
      || error instanceof MessageCryptoV2Error
      || error instanceof DeviceIdentityError
    ) {
      return { message: null, error: new Error(error.message) };
    }

    return {
      message: null,
      error: new Error(error instanceof Error ? error.message : 'Failed to send video message'),
    };
  }
}

export async function sendMessage(
  conversationId: string,
  content: string,
  type: MessageData['type'] = 'text',
): Promise<{ message: MessageData | null; error: Error | null }> {
  const normalizedType = normalizeMessageType(type);
  const trimmed = content.trim();

  if (!trimmed) {
    return { message: null, error: new Error('Message content cannot be empty') };
  }

  const fallbackToLegacyIfNeeded = async (result: { message: MessageData | null; error: Error | null }) => {
    if (!result.error) {
      return result;
    }

    const message = result.error.message.toLowerCase();
    const shouldFallback = (
      message.includes('send_secure_message_v2')
      || message.includes('schema')
      || message.includes('function')
    );

    if (!shouldFallback) {
      return result;
    }

    messagingV2SupportCache = false;
    return sendLegacyV1Message(conversationId, trimmed, normalizedType);
  };

  if (await isMessagingV2Available()) {
    if (normalizedType === 'text') {
      const result = await sendTextMessageV2(conversationId, trimmed);
      return fallbackToLegacyIfNeeded(result);
    }

    const result = await sendSecureMessageV2Internal({
      conversationId,
      messageKind: normalizedType === 'booking_request'
        ? 'booking_request'
        : normalizedType === 'system'
          ? 'system'
          : normalizedType === 'image'
            ? 'image'
            : 'text',
      plaintext: trimmed,
      attachmentRows: [],
    });
    return fallbackToLegacyIfNeeded(result);
  }

  return sendLegacyV1Message(conversationId, trimmed, normalizedType);
}

export async function getOrCreateConversation(
  otherUserId: string,
): Promise<{ conversation: ConversationData | null; error: Error | null }> {
  try {
    const { userId, error: authError } = await getCurrentUserId();
    if (authError || !userId) {
      return { conversation: null, error: authError || new Error('Not authenticated') };
    }

    if (!otherUserId || otherUserId === userId) {
      return { conversation: null, error: new Error('Invalid conversation participant') };
    }

    const canonicalPair = [userId, otherUserId].sort();

    const existing = await supabase
      .from('conversations')
      .select('*')
      .or(`and(participant_1.eq.${canonicalPair[0]},participant_2.eq.${canonicalPair[1]}),and(participant_1.eq.${canonicalPair[1]},participant_2.eq.${canonicalPair[0]})`)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!existing.error && existing.data) {
      await ensureConversationMembersForDirect(
        getString((existing.data as RawRecord).id),
        canonicalPair[0],
        canonicalPair[1],
      );
      return fetchConversationById(getString((existing.data as RawRecord).id));
    }

    const now = new Date().toISOString();
    const { data: created, error: createError } = await supabase
      .from('conversations')
      .insert({
        participant_1: canonicalPair[0],
        participant_2: canonicalPair[1],
        kind: 'direct',
        created_by: userId,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .maybeSingle();

    if (createError && createError.code !== '23505') {
      console.error('Error creating direct conversation:', createError);
      return {
        conversation: null,
        error: new Error(createError.message || 'Failed to create conversation'),
      };
    }

    const conversationId = getString((created as RawRecord | null)?.id);
    if (conversationId) {
      await ensureConversationMembersForDirect(conversationId, canonicalPair[0], canonicalPair[1]);
      return fetchConversationById(conversationId);
    }

    const retry = await supabase
      .from('conversations')
      .select('*')
      .or(`and(participant_1.eq.${canonicalPair[0]},participant_2.eq.${canonicalPair[1]}),and(participant_1.eq.${canonicalPair[1]},participant_2.eq.${canonicalPair[0]})`)
      .limit(1)
      .maybeSingle();

    if (retry.error || !retry.data) {
      return {
        conversation: null,
        error: new Error(retry.error?.message || 'Failed to resolve conversation after creation'),
      };
    }

    const retryConversationId = getString((retry.data as RawRecord).id);
    await ensureConversationMembersForDirect(retryConversationId, canonicalPair[0], canonicalPair[1]);
    return fetchConversationById(retryConversationId);
  } catch (error) {
    console.error('Error in getOrCreateConversation:', error);
    return {
      conversation: null,
      error: error instanceof Error ? error : new Error('Failed to create conversation'),
    };
  }
}

export async function getOrCreateGroupConversation(
  groupId: string,
): Promise<{ conversation: ConversationData | null; error: Error | null }> {
  try {
    if (!groupId) {
      return { conversation: null, error: new Error('groupId is required') };
    }

    const { data, error } = await supabase.rpc('get_or_create_group_conversation', {
      p_group_id: groupId,
    });

    if (error) {
      console.error('Error getting/creating group conversation:', error);
      return { conversation: null, error: new Error(error.message || 'Failed to open group chat') };
    }

    const conversationId = typeof data === 'string'
      ? data
      : Array.isArray(data)
        ? getString((data[0] as RawRecord | undefined)?.get_or_create_group_conversation)
        : getString((data as RawRecord | null)?.get_or_create_group_conversation);

    if (!conversationId) {
      return { conversation: null, error: new Error('Group chat conversation ID was not returned.') };
    }

    return fetchConversationById(conversationId);
  } catch (error) {
    console.error('Error in getOrCreateGroupConversation:', error);
    return {
      conversation: null,
      error: error instanceof Error ? error : new Error('Failed to open group chat'),
    };
  }
}

export async function getOrCreateEventConversation(
  eventId: string,
): Promise<{ conversation: ConversationData | null; error: Error | null }> {
  try {
    if (!eventId) {
      return { conversation: null, error: new Error('eventId is required') };
    }

    const { data, error } = await supabase.rpc('get_or_create_event_conversation', {
      p_event_id: eventId,
    });

    if (error) {
      console.error('Error getting/creating event conversation:', error);
      return { conversation: null, error: new Error(error.message || 'Failed to open event chat') };
    }

    const conversationId = typeof data === 'string'
      ? data
      : Array.isArray(data)
        ? getString((data[0] as RawRecord | undefined)?.get_or_create_event_conversation)
        : getString((data as RawRecord | null)?.get_or_create_event_conversation);

    if (!conversationId) {
      return { conversation: null, error: new Error('Event chat conversation ID was not returned.') };
    }

    return fetchConversationById(conversationId);
  } catch (error) {
    console.error('Error in getOrCreateEventConversation:', error);
    return {
      conversation: null,
      error: error instanceof Error ? error : new Error('Failed to open event chat'),
    };
  }
}

export async function markMessagesAsRead(
  conversationId: string,
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { userId, error: authError } = await getCurrentUserId();
    if (authError || !userId) {
      return { success: false, error: authError || new Error('Not authenticated') };
    }

    if (await isMessagingV2Available()) {
      const { error } = await supabase.rpc('mark_conversation_read_v2', {
        p_conversation_id: conversationId,
        p_read_at: new Date().toISOString(),
      });

      if (error && !isMissingSchemaError(error, 'mark_conversation_read_v2')) {
        console.error('Error marking conversation read via v2 RPC:', error);
      }
    }

    const now = new Date().toISOString();
    const primary = await supabase
      .from('messages')
      .update({
        is_read: true,
        read_at: now,
      })
      .eq('conversation_id', conversationId)
      .neq('sender_user_id', userId)
      .eq('is_read', false);

    if (!primary.error) {
      return { success: true, error: null };
    }

    if (isMissingSchemaError(primary.error, 'sender_user_id')) {
      const fallback = await supabase
        .from('messages')
        .update({
          is_read: true,
          read_at: now,
        })
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId)
        .eq('is_read', false);

      if (!fallback.error) {
        return { success: true, error: null };
      }

      console.error('Error marking messages as read (fallback):', fallback.error);
      return {
        success: false,
        error: new Error(fallback.error.message || 'Failed to mark messages as read'),
      };
    }

    console.error('Error marking messages as read:', primary.error);
    return {
      success: false,
      error: new Error(primary.error.message || 'Failed to mark messages as read'),
    };
  } catch (error) {
    console.error('Error in markMessagesAsRead:', error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Failed to mark messages as read'),
    };
  }
}

export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: MessageData) => void,
): () => void {
  let currentUserId = '';

  void supabase.auth.getUser().then(({ data }) => {
    currentUserId = data.user?.id || '';
  });

  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      async (payload) => {
        const row = payload.new as RawRecord;
        const messageConversationId = getString(row.conversation_id);
        if (!messageConversationId || messageConversationId !== conversationId) {
          return;
        }

        if (!currentUserId) {
          const { data } = await supabase.auth.getUser();
          currentUserId = data.user?.id || '';
        }

        const message = await fetchMessageById(getString(row.id), currentUserId);
        if (message) {
          onMessage(message);
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getUnreadCount(): Promise<{ count: number; error: Error | null }> {
  try {
    const { conversations, error } = await fetchConversations();
    if (error) {
      return { count: 0, error };
    }

    const total = conversations.reduce((sum, conversation) => (
      sum + Math.max(0, Math.round(toNumber(conversation.unread_count, 0)))
    ), 0);

    return { count: total, error: null };
  } catch (error) {
    console.error('Error in getUnreadCount:', error);
    return {
      count: 0,
      error: error instanceof Error ? error : new Error('Failed to get unread count'),
    };
  }
}

export async function resolveMessageAttachmentUri(
  attachment: MessageAttachmentData,
): Promise<string> {
  if (!attachment.object_path || !attachment.media_key_base64 || !attachment.media_nonce_base64) {
    throw new Error('Attachment does not include required media decryption metadata.');
  }

  const download = await getMediaDownloadUrl(attachment.object_path);
  const encryptedUri = await downloadEncryptedMediaToCache(download.signedUrl);

  const extension = attachment.media_kind === 'video' ? '.mp4' : '.jpg';
  return decryptMediaFileToCache({
    encryptedUri,
    mediaKeyBase64: attachment.media_key_base64,
    mediaNonceBase64: attachment.media_nonce_base64,
    outputExtension: extension,
  });
}
