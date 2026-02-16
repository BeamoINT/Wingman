/**
 * Messages API Service
 * Handles messaging and conversation operations with Supabase.
 *
 * This implementation is resilient to partially migrated schemas where
 * foreign key relationships may be missing from PostgREST schema cache.
 */

import { supabase } from '../supabase';
import {
  decryptMessageFromSender,
  encryptMessageForRecipient,
  fetchMessagingPublicKeys,
  getEncryptedMessagePreview,
  getMessageEncryptionVersion,
  getMessagingIdentity,
  pinAndCheckPeerPublicKeys,
  type MessagingIdentity,
  SecureMessagingError
} from '../crypto/messagingEncryption';
import type { ProfileData } from './profiles';

type QueryError = {
  code?: string | null;
  message?: string | null;
};

type ConversationParticipantPair = readonly [string, string];
type ParticipantTablePair = readonly [string, string];

type ConversationParticipantTableConfig = {
  conversationColumn: string;
  userColumn: string;
  lastReadColumn?: string;
};

const CONVERSATION_PARTICIPANT_COLUMN_PAIRS: ConversationParticipantPair[] = [
  ['participant_1', 'participant_2'],
  ['user_1', 'user_2'],
  ['member_1', 'member_2'],
] as const;

const CONVERSATION_PARTICIPANTS_TABLE = 'conversation_participants';
const CONVERSATION_PARTICIPANTS_TABLE_PAIRS: ParticipantTablePair[] = [
  ['conversation_id', 'user_id'],
  ['conversation_id', 'participant_id'],
  ['conversation_id', 'profile_id'],
  ['conversation_id', 'member_id'],
  ['thread_id', 'user_id'],
  ['thread_id', 'participant_id'],
  ['thread_id', 'profile_id'],
  ['thread_id', 'member_id'],
] as const;
const CONVERSATION_PARTICIPANTS_LAST_READ_COLUMNS = ['last_read_at', 'read_at'] as const;

const MESSAGE_CONVERSATION_COLUMNS = ['conversation_id', 'thread_id'] as const;
const MESSAGE_SENDER_COLUMNS = ['sender_id', 'user_id', 'author_id'] as const;
const MESSAGE_ENCRYPTION_REQUIRED_COLUMNS = [
  'encrypted_for_participant_1',
  'encrypted_for_participant_2',
  'encryption_nonce_p1',
  'encryption_nonce_p2',
  'encryption_sender_public_key',
  'encryption_version',
] as const;
const ENCRYPTED_MESSAGE_PREVIEW = getEncryptedMessagePreview();
const MESSAGE_ENCRYPTION_VERSION = getMessageEncryptionVersion();
const MESSAGE_KEY_CHANGED_PLACEHOLDER = 'Message unavailable: safety key changed.';

let conversationParticipantsConfigCache: ConversationParticipantTableConfig | null | undefined;
const conversationParticipantCache = new Map<string, {
  participant_1: string;
  participant_2: string;
}>();

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isMissingColumnError(error: unknown, table: string, column?: string): boolean {
  const typedError = error as QueryError | null | undefined;
  if (typedError?.code !== '42703') return false;

  const message = String(typedError.message || '').toLowerCase();
  if (column) {
    return (
      message.includes(`column ${table}.${column}`.toLowerCase()) ||
      message.includes(`column ${column}`.toLowerCase())
    );
  }

  return message.includes(`column ${table}.`);
}

function isMissingTableError(error: unknown, table: string): boolean {
  const typedError = error as QueryError | null | undefined;
  if (typedError?.code !== 'PGRST205') return false;

  const message = String(typedError.message || '').toLowerCase();
  return message.includes(table.toLowerCase());
}

function extractMissingColumn(error: unknown): string | null {
  const typedError = error as QueryError | null | undefined;
  if (typedError?.code !== '42703') return null;

  const message = String(typedError.message || '');
  const directColumnMatch = message.match(/column\s+([a-zA-Z0-9_]+)\s+does not exist/i);
  if (directColumnMatch?.[1]) {
    return directColumnMatch[1];
  }

  const scopedColumnMatch = message.match(/column\s+([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s+does not exist/i);
  if (scopedColumnMatch?.[2]) {
    return scopedColumnMatch[2];
  }

  return null;
}

function extractNotNullColumn(error: unknown): string | null {
  const typedError = error as QueryError | null | undefined;
  if (typedError?.code !== '23502') return null;

  const message = String(typedError.message || '');
  const match = message.match(/null value in column "([a-zA-Z0-9_]+)"/i);
  return match?.[1] || null;
}

function defaultConversationValueForColumn(column: string, nowIso: string): unknown {
  switch (column) {
    case 'created_at':
    case 'updated_at':
      return nowIso;
    case 'last_message_at':
      return null;
    case 'status':
      return 'active';
    case 'type':
      return 'direct';
    default:
      return undefined;
  }
}

function isRelationshipError(error: unknown): boolean {
  const typedError = error as QueryError | null | undefined;
  const code = String(typedError?.code || '');
  const message = String(typedError?.message || '').toLowerCase();

  return (
    code.startsWith('PGRST') &&
    (message.includes('relationship') || message.includes('foreign key') || message.includes('schema cache'))
  );
}

function normalizeProfile(rawProfile: unknown): ProfileData | undefined {
  const profileObject = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
  if (!profileObject || typeof profileObject !== 'object') {
    return undefined;
  }

  const profile = profileObject as Record<string, unknown>;
  const now = new Date().toISOString();

  return {
    id: typeof profile.id === 'string' ? profile.id : '',
    first_name: typeof profile.first_name === 'string' ? profile.first_name : '',
    last_name: typeof profile.last_name === 'string' ? profile.last_name : '',
    email: typeof profile.email === 'string' ? profile.email : '',
    phone: typeof profile.phone === 'string' ? profile.phone : undefined,
    avatar_url: typeof profile.avatar_url === 'string' ? profile.avatar_url : undefined,
    bio: typeof profile.bio === 'string' ? profile.bio : undefined,
    date_of_birth: typeof profile.date_of_birth === 'string' ? profile.date_of_birth : undefined,
    gender: typeof profile.gender === 'string' ? profile.gender : undefined,
    city: typeof profile.city === 'string' ? profile.city : undefined,
    state: typeof profile.state === 'string' ? profile.state : undefined,
    country: typeof profile.country === 'string' ? profile.country : undefined,
    email_verified: !!profile.email_verified,
    phone_verified: !!profile.phone_verified,
    id_verified: !!profile.id_verified,
    verification_level: typeof profile.verification_level === 'string'
      ? profile.verification_level
      : 'basic',
    terms_accepted: !!profile.terms_accepted,
    privacy_accepted: !!profile.privacy_accepted,
    age_confirmed: !!profile.age_confirmed,
    subscription_tier: typeof profile.subscription_tier === 'string'
      ? profile.subscription_tier
      : 'free',
    created_at: typeof profile.created_at === 'string' ? profile.created_at : now,
    updated_at: typeof profile.updated_at === 'string' ? profile.updated_at : now,
  };
}

function normalizeMessageType(value: unknown): MessageData['type'] {
  const normalized = String(value || 'text')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');

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

function pickParticipantPairFromRow(row: Record<string, unknown>): ConversationParticipantPair {
  for (const pair of CONVERSATION_PARTICIPANT_COLUMN_PAIRS) {
    if (pair[0] in row || pair[1] in row) {
      return pair;
    }
  }

  return CONVERSATION_PARTICIPANT_COLUMN_PAIRS[0];
}

function normalizeConversation(
  rawConversation: unknown,
  participantPair?: ConversationParticipantPair
): ConversationData {
  const conversation = (rawConversation || {}) as Record<string, unknown>;
  const pair = participantPair || pickParticipantPairFromRow(conversation);
  const now = new Date().toISOString();

  const participant1 = typeof conversation[pair[0]] === 'string' ? conversation[pair[0]] as string : '';
  const participant2 = typeof conversation[pair[1]] === 'string' ? conversation[pair[1]] as string : '';

  const createdAt =
    typeof conversation.created_at === 'string'
      ? conversation.created_at
      : typeof conversation.updated_at === 'string'
        ? conversation.updated_at
        : now;

  const lastMessageAt =
    typeof conversation.last_message_at === 'string'
      ? conversation.last_message_at
      : undefined;

  const preview =
    typeof conversation.last_message_preview === 'string'
      ? conversation.last_message_preview
      : typeof conversation.last_message === 'string'
        ? conversation.last_message
        : undefined;

  return {
    id: typeof conversation.id === 'string' ? conversation.id : '',
    participant_1: participant1,
    participant_2: participant2,
    booking_id: typeof conversation.booking_id === 'string' ? conversation.booking_id : undefined,
    last_message_at: lastMessageAt,
    last_message_preview: preview,
    created_at: createdAt,
    participant_1_profile: normalizeProfile(conversation.participant_1_profile),
    participant_2_profile: normalizeProfile(conversation.participant_2_profile),
    unread_count: Math.max(0, Math.round(toNumber(conversation.unread_count, 0))),
  };
}

function normalizeMessage(rawMessage: unknown): MessageData {
  const message = (rawMessage || {}) as Record<string, unknown>;
  const now = new Date().toISOString();

  const conversationId =
    typeof message.conversation_id === 'string'
      ? message.conversation_id
      : typeof message.thread_id === 'string'
        ? (message.thread_id as string)
        : '';

  const senderId =
    typeof message.sender_id === 'string'
      ? message.sender_id
      : typeof message.user_id === 'string'
        ? (message.user_id as string)
        : typeof message.author_id === 'string'
          ? (message.author_id as string)
          : '';

  return {
    id: typeof message.id === 'string' ? message.id : '',
    conversation_id: conversationId,
    sender_id: senderId,
    content: typeof message.content === 'string' ? message.content : '',
    encrypted_for_participant_1: typeof message.encrypted_for_participant_1 === 'string'
      ? message.encrypted_for_participant_1
      : undefined,
    encrypted_for_participant_2: typeof message.encrypted_for_participant_2 === 'string'
      ? message.encrypted_for_participant_2
      : undefined,
    encryption_nonce_p1: typeof message.encryption_nonce_p1 === 'string'
      ? message.encryption_nonce_p1
      : undefined,
    encryption_nonce_p2: typeof message.encryption_nonce_p2 === 'string'
      ? message.encryption_nonce_p2
      : undefined,
    encryption_sender_public_key: typeof message.encryption_sender_public_key === 'string'
      ? message.encryption_sender_public_key
      : undefined,
    encryption_version: typeof message.encryption_version === 'string'
      ? message.encryption_version
      : undefined,
    type: normalizeMessageType(message.type),
    is_read: typeof message.is_read === 'boolean' ? message.is_read : false,
    read_at: typeof message.read_at === 'string' ? message.read_at : undefined,
    created_at: typeof message.created_at === 'string' ? message.created_at : now,
    sender: normalizeProfile(message.sender),
  };
}

function uniqueIds(values: string[]): string[] {
  return Array.from(new Set(values.filter((id) => !!id)));
}

function resolveParticipants(
  existingParticipant1: string,
  existingParticipant2: string,
  availableParticipantIds: string[],
  currentUserId: string
): { participant_1: string; participant_2: string } {
  const available = uniqueIds(availableParticipantIds);

  let participant1 = existingParticipant1 || '';
  let participant2 = existingParticipant2 || '';

  if (!participant1 && currentUserId && available.includes(currentUserId)) {
    participant1 = currentUserId;
  }

  if (!participant1) {
    participant1 = available[0] || '';
  }

  if (!participant2) {
    participant2 = available.find((id) => id !== participant1) || '';
  }

  if (!participant1 && participant2) {
    participant1 = available.find((id) => id !== participant2) || participant2;
  }

  if (participant1 && participant2 && participant1 === participant2) {
    participant2 = available.find((id) => id !== participant1) || '';
  }

  if (!participant1 && currentUserId) {
    participant1 = currentUserId;
  }

  return {
    participant_1: participant1,
    participant_2: participant2,
  };
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
    console.error('Error fetching profiles for conversations/messages:', error);
    return {};
  }

  const map: Record<string, ProfileData> = {};
  (data || []).forEach((profileRaw) => {
    const profile = normalizeProfile(profileRaw);
    if (profile?.id) {
      map[profile.id] = profile;
    }
  });

  return map;
}

async function getConversationParticipantsTableConfig(): Promise<ConversationParticipantTableConfig | null> {
  if (conversationParticipantsConfigCache !== undefined) {
    return conversationParticipantsConfigCache;
  }

  for (const pair of CONVERSATION_PARTICIPANTS_TABLE_PAIRS) {
    for (const lastReadColumn of [...CONVERSATION_PARTICIPANTS_LAST_READ_COLUMNS, null]) {
      const selectColumns = [pair[0], pair[1]];
      if (lastReadColumn) {
        selectColumns.push(lastReadColumn);
      }

      const { error } = await supabase
        .from(CONVERSATION_PARTICIPANTS_TABLE)
        .select(selectColumns.join(','))
        .limit(1);

      if (!error) {
        conversationParticipantsConfigCache = {
          conversationColumn: pair[0],
          userColumn: pair[1],
          lastReadColumn: lastReadColumn || undefined,
        };
        return conversationParticipantsConfigCache;
      }

      if (isMissingTableError(error, CONVERSATION_PARTICIPANTS_TABLE)) {
        conversationParticipantsConfigCache = null;
        return null;
      }

      if (lastReadColumn && isMissingColumnError(error, CONVERSATION_PARTICIPANTS_TABLE, lastReadColumn)) {
        continue;
      }

      if (
        isMissingColumnError(error, CONVERSATION_PARTICIPANTS_TABLE, pair[0]) ||
        isMissingColumnError(error, CONVERSATION_PARTICIPANTS_TABLE, pair[1])
      ) {
        break;
      }

      console.error('Error detecting conversation participants table config:', error);
      conversationParticipantsConfigCache = null;
      return null;
    }
  }

  conversationParticipantsConfigCache = null;
  return null;
}

async function fetchConversationParticipantRowsForUser(userId: string): Promise<{
  rows: Array<Record<string, unknown>>;
  config: ConversationParticipantTableConfig | null;
  error: Error | null;
}> {
  const config = await getConversationParticipantsTableConfig();
  if (!config) {
    return { rows: [], config: null, error: null };
  }

  const selectColumns = [config.conversationColumn, config.userColumn];
  if (config.lastReadColumn) {
    selectColumns.push(config.lastReadColumn);
  }

  const { data, error } = await supabase
    .from(CONVERSATION_PARTICIPANTS_TABLE)
    .select(selectColumns.join(','))
    .eq(config.userColumn, userId);

  if (!error) {
    return {
      rows: (data || []) as unknown as Array<Record<string, unknown>>,
      config,
      error: null,
    };
  }

  if (config.lastReadColumn && isMissingColumnError(error, CONVERSATION_PARTICIPANTS_TABLE, config.lastReadColumn)) {
    conversationParticipantsConfigCache = {
      conversationColumn: config.conversationColumn,
      userColumn: config.userColumn,
    };
    return fetchConversationParticipantRowsForUser(userId);
  }

  if (isMissingTableError(error, CONVERSATION_PARTICIPANTS_TABLE)) {
    conversationParticipantsConfigCache = null;
    return { rows: [], config: null, error: null };
  }

  console.error('Error fetching conversation participant rows for user:', error);
  return {
    rows: [],
    config,
    error: new Error(error.message || 'Failed to fetch conversation participants'),
  };
}

async function fetchConversationParticipantRowsByConversationIds(
  conversationIds: string[],
  providedConfig?: ConversationParticipantTableConfig | null
): Promise<{
  rows: Array<Record<string, unknown>>;
  config: ConversationParticipantTableConfig | null;
  error: Error | null;
}> {
  const ids = uniqueIds(conversationIds);
  if (ids.length === 0) {
    return { rows: [], config: providedConfig || null, error: null };
  }

  const config = providedConfig || await getConversationParticipantsTableConfig();
  if (!config) {
    return { rows: [], config: null, error: null };
  }

  const selectColumns = [config.conversationColumn, config.userColumn];
  if (config.lastReadColumn) {
    selectColumns.push(config.lastReadColumn);
  }

  const { data, error } = await supabase
    .from(CONVERSATION_PARTICIPANTS_TABLE)
    .select(selectColumns.join(','))
    .in(config.conversationColumn, ids);

  if (!error) {
    return {
      rows: (data || []) as unknown as Array<Record<string, unknown>>,
      config,
      error: null,
    };
  }

  if (config.lastReadColumn && isMissingColumnError(error, CONVERSATION_PARTICIPANTS_TABLE, config.lastReadColumn)) {
    conversationParticipantsConfigCache = {
      conversationColumn: config.conversationColumn,
      userColumn: config.userColumn,
    };
    return fetchConversationParticipantRowsByConversationIds(ids, conversationParticipantsConfigCache);
  }

  if (isMissingTableError(error, CONVERSATION_PARTICIPANTS_TABLE)) {
    conversationParticipantsConfigCache = null;
    return { rows: [], config: null, error: null };
  }

  console.error('Error fetching conversation participant rows by conversation IDs:', error);
  return {
    rows: [],
    config,
    error: new Error(error.message || 'Failed to fetch conversation participants'),
  };
}

function buildParticipantMap(
  rows: Array<Record<string, unknown>>,
  config: ConversationParticipantTableConfig
): Record<string, string[]> {
  const map: Record<string, string[]> = {};

  rows.forEach((row) => {
    const conversationId =
      typeof row[config.conversationColumn] === 'string'
        ? row[config.conversationColumn] as string
        : '';
    const participantId =
      typeof row[config.userColumn] === 'string'
        ? row[config.userColumn] as string
        : '';

    if (!conversationId || !participantId) return;

    if (!map[conversationId]) {
      map[conversationId] = [];
    }

    if (!map[conversationId].includes(participantId)) {
      map[conversationId].push(participantId);
    }
  });

  return map;
}

function isMissingRequiredMessageEncryptionColumn(error: unknown): boolean {
  return MESSAGE_ENCRYPTION_REQUIRED_COLUMNS.some((column) => (
    isMissingColumnError(error, 'messages', column)
  ));
}

async function resolveConversationParticipants(
  conversationId: string,
  currentUserId: string
): Promise<{ participant_1: string; participant_2: string } | null> {
  if (!conversationId) return null;

  const cached = conversationParticipantCache.get(conversationId);
  if (cached?.participant_1 && cached?.participant_2) {
    return cached;
  }

  let participant1 = '';
  let participant2 = '';

  for (const pair of CONVERSATION_PARTICIPANT_COLUMN_PAIRS) {
    const { data, error } = await supabase
      .from('conversations')
      .select(`${pair[0]},${pair[1]}`)
      .eq('id', conversationId)
      .maybeSingle();

    if (!error && data) {
      const row = data as unknown as Record<string, unknown>;
      participant1 = typeof row[pair[0]] === 'string' ? row[pair[0]] as string : '';
      participant2 = typeof row[pair[1]] === 'string' ? row[pair[1]] as string : '';
      break;
    }

    if (
      isMissingColumnError(error, 'conversations', pair[0]) ||
      isMissingColumnError(error, 'conversations', pair[1])
    ) {
      continue;
    }

    if (error) {
      console.error('Error resolving conversation participants from conversations table:', error);
      break;
    }
  }

  const joinRowsResult = await fetchConversationParticipantRowsByConversationIds([conversationId]);
  if (joinRowsResult.error) {
    console.error('Error resolving conversation participants from join table:', joinRowsResult.error);
  }

  const participantIds = joinRowsResult.config
    ? buildParticipantMap(joinRowsResult.rows, joinRowsResult.config)[conversationId] || []
    : [];

  const resolved = resolveParticipants(
    participant1,
    participant2,
    participantIds,
    currentUserId
  );

  if (!resolved.participant_1 || !resolved.participant_2) {
    return null;
  }

  conversationParticipantCache.set(conversationId, resolved);
  return resolved;
}

function messageHasEncryptedPayload(message: MessageData): boolean {
  return !!(
    message.encrypted_for_participant_1 ||
    message.encrypted_for_participant_2 ||
    message.encryption_nonce_p1 ||
    message.encryption_nonce_p2 ||
    message.encryption_sender_public_key
  );
}

function decryptMessageContentForCurrentUser(
  message: MessageData,
  currentUserId: string,
  participants: { participant_1: string; participant_2: string },
  identity: MessagingIdentity
): string {
  if (!messageHasEncryptedPayload(message)) {
    return message.content;
  }

  if (message.encryption_version && message.encryption_version !== MESSAGE_ENCRYPTION_VERSION) {
    return ENCRYPTED_MESSAGE_PREVIEW;
  }

  const isParticipant1 = participants.participant_1 === currentUserId;
  const isParticipant2 = participants.participant_2 === currentUserId;

  if (!isParticipant1 && !isParticipant2) {
    return ENCRYPTED_MESSAGE_PREVIEW;
  }

  const ciphertext = isParticipant1
    ? message.encrypted_for_participant_1
    : message.encrypted_for_participant_2;
  const nonce = isParticipant1
    ? message.encryption_nonce_p1
    : message.encryption_nonce_p2;
  const senderPublicKey = message.encryption_sender_public_key || '';

  if (!ciphertext || !nonce || !senderPublicKey) {
    return ENCRYPTED_MESSAGE_PREVIEW;
  }

  const decrypted = decryptMessageFromSender(
    ciphertext,
    nonce,
    senderPublicKey,
    identity.secretKey
  );

  return decrypted || ENCRYPTED_MESSAGE_PREVIEW;
}

async function decryptMessagesForCurrentUser(
  messages: MessageData[],
  conversationId: string,
  currentUserId: string
): Promise<MessageData[]> {
  if (!conversationId || !currentUserId || messages.length === 0) {
    return messages;
  }

  if (!messages.some((message) => messageHasEncryptedPayload(message))) {
    return messages;
  }

  const participants = await resolveConversationParticipants(conversationId, currentUserId);
  if (!participants) {
    return messages.map((message) => (
      messageHasEncryptedPayload(message)
        ? { ...message, content: ENCRYPTED_MESSAGE_PREVIEW }
        : message
    ));
  }

  let identity: MessagingIdentity;
  try {
    identity = await getMessagingIdentity(currentUserId, { syncProfile: false });
  } catch (error) {
    console.error('Error loading local messaging identity for decrypt:', error);
    return messages.map((message) => (
      messageHasEncryptedPayload(message)
        ? { ...message, content: ENCRYPTED_MESSAGE_PREVIEW }
        : message
    ));
  }

  const senderPublicKeys: Record<string, string> = {};
  messages.forEach((message) => {
    if (
      message.sender_id &&
      message.sender_id !== currentUserId &&
      message.encryption_sender_public_key
    ) {
      senderPublicKeys[message.sender_id] = message.encryption_sender_public_key;
    }
  });

  let changedSenderIds = new Set<string>();
  try {
    const evaluation = await pinAndCheckPeerPublicKeys(currentUserId, senderPublicKeys);
    changedSenderIds = new Set(evaluation.changedUserIds);
  } catch (error) {
    console.error('Error verifying sender safety keys:', error);
  }

  return messages.map((message) => ({
    ...message,
    content: changedSenderIds.has(message.sender_id)
      ? MESSAGE_KEY_CHANGED_PLACEHOLDER
      : decryptMessageContentForCurrentUser(message, currentUserId, participants, identity),
  }));
}

async function buildEncryptedPayloadForMessage(
  conversationId: string,
  currentUserId: string,
  plaintext: string
): Promise<Record<string, string>> {
  const participants = await resolveConversationParticipants(conversationId, currentUserId);
  if (!participants) {
    throw new Error('Unable to resolve conversation participants for secure messaging.');
  }

  if (participants.participant_1 !== currentUserId && participants.participant_2 !== currentUserId) {
    throw new Error('You are not a participant in this conversation.');
  }

  const identity = await getMessagingIdentity(currentUserId);
  const publicKeyMap = await fetchMessagingPublicKeys([
    participants.participant_1,
    participants.participant_2,
  ]);

  const participant1Key = publicKeyMap[participants.participant_1];
  const participant2Key = publicKeyMap[participants.participant_2];

  if (!participant1Key || !participant2Key) {
    throw new SecureMessagingError(
      'missing_public_key',
      'Secure messaging is still initializing for this conversation. Ask both users to open Messages and try again.'
    );
  }

  const peerParticipantId = participants.participant_1 === currentUserId
    ? participants.participant_2
    : participants.participant_1;
  const peerKey = publicKeyMap[peerParticipantId];

  if (!peerParticipantId || !peerKey) {
    throw new SecureMessagingError(
      'missing_public_key',
      'Recipient secure messaging key is missing.'
    );
  }

  const keyEvaluation = await pinAndCheckPeerPublicKeys(currentUserId, {
    [peerParticipantId]: peerKey,
  });

  if (keyEvaluation.changedUserIds.length > 0) {
    throw new SecureMessagingError(
      'key_changed',
      'Safety key changed for this conversation. Messaging is blocked until the key is verified.'
    );
  }

  const encryptedForParticipant1 = encryptMessageForRecipient(
    plaintext,
    participant1Key,
    identity.secretKey
  );
  const encryptedForParticipant2 = encryptMessageForRecipient(
    plaintext,
    participant2Key,
    identity.secretKey
  );

  return {
    encrypted_for_participant_1: encryptedForParticipant1.ciphertextBase64,
    encrypted_for_participant_2: encryptedForParticipant2.ciphertextBase64,
    encryption_nonce_p1: encryptedForParticipant1.nonceBase64,
    encryption_nonce_p2: encryptedForParticipant2.nonceBase64,
    encryption_sender_public_key: identity.publicKeyBase64,
    encryption_version: MESSAGE_ENCRYPTION_VERSION,
  };
}

async function countUnreadMessages(
  conversationId: string,
  currentUserId: string
): Promise<number> {
  if (!conversationId || !currentUserId) return 0;

  for (const conversationColumn of MESSAGE_CONVERSATION_COLUMNS) {
    let missingConversationColumn = false;

    for (const senderColumn of MESSAGE_SENDER_COLUMNS) {
      for (const withReadFilter of [true, false]) {
        let query = supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq(conversationColumn, conversationId)
          .neq(senderColumn, currentUserId);

        if (withReadFilter) {
          query = query.eq('is_read', false);
        }

        const { count, error } = await query;

        if (!error) {
          return withReadFilter ? (count || 0) : 0;
        }

        if (isMissingColumnError(error, 'messages', conversationColumn)) {
          missingConversationColumn = true;
          break;
        }

        if (isMissingColumnError(error, 'messages', senderColumn)) {
          continue;
        }

        if (withReadFilter && isMissingColumnError(error, 'messages', 'is_read')) {
          continue;
        }

        console.error('Error counting unread messages:', error);
        return 0;
      }

      if (missingConversationColumn) {
        break;
      }
    }

    if (!missingConversationColumn) {
      break;
    }
  }

  return 0;
}

async function fetchLatestMessageMap(
  conversationIds: string[]
): Promise<Record<string, { created_at: string }>> {
  const result: Record<string, { created_at: string }> = {};
  const ids = uniqueIds(conversationIds);

  if (ids.length === 0) {
    return result;
  }

  for (const conversationColumn of MESSAGE_CONVERSATION_COLUMNS) {
    let missingConversationColumn = false;

    for (const includeOrdering of [true, false]) {
      let query = supabase
        .from('messages')
        .select(`${conversationColumn},created_at`)
        .in(conversationColumn, ids);

      if (includeOrdering) {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;

      if (!error) {
        const rows = (data || []) as Array<Record<string, unknown>>;

        rows.forEach((row) => {
          const convId = typeof row[conversationColumn] === 'string' ? row[conversationColumn] as string : '';
          if (!convId || result[convId]) {
            return;
          }

          const createdAt = typeof row.created_at === 'string' ? row.created_at : '';
          result[convId] = { created_at: createdAt };
        });

        return result;
      }

      if (isMissingColumnError(error, 'messages', conversationColumn)) {
        missingConversationColumn = true;
        break;
      }

      if (includeOrdering && isMissingColumnError(error, 'messages', 'created_at')) {
        continue;
      }

      console.error('Error fetching latest message preview fallback:', error);
      return result;
    }

    if (!missingConversationColumn) {
      break;
    }
  }

  return result;
}

async function fetchCounterpartyIdsByConversation(
  conversationIds: string[],
  currentUserId: string
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const ids = uniqueIds(conversationIds);
  if (ids.length === 0 || !currentUserId) {
    return result;
  }

  for (const conversationColumn of MESSAGE_CONVERSATION_COLUMNS) {
    let missingConversationColumn = false;

    for (const senderColumn of MESSAGE_SENDER_COLUMNS) {
      for (const includeOrdering of [true, false]) {
        let query = supabase
          .from('messages')
          .select(`${conversationColumn},${senderColumn},created_at`)
          .in(conversationColumn, ids)
          .neq(senderColumn, currentUserId);

        if (includeOrdering) {
          query = query.order('created_at', { ascending: false });
        }

        const { data, error } = await query;

        if (!error) {
          const rows = (data || []) as Array<Record<string, unknown>>;
          rows.forEach((row) => {
            const convId = typeof row[conversationColumn] === 'string' ? row[conversationColumn] as string : '';
            const senderId = typeof row[senderColumn] === 'string' ? row[senderColumn] as string : '';
            if (!convId || !senderId || result[convId]) {
              return;
            }
            result[convId] = senderId;
          });
          return result;
        }

        if (isMissingColumnError(error, 'messages', conversationColumn)) {
          missingConversationColumn = true;
          break;
        }

        if (isMissingColumnError(error, 'messages', senderColumn)) {
          break;
        }

        if (includeOrdering && isMissingColumnError(error, 'messages', 'created_at')) {
          continue;
        }

        return result;
      }

      if (missingConversationColumn) {
        break;
      }
    }

    if (!missingConversationColumn) {
      break;
    }
  }

  return result;
}

async function fetchConversationRowsForUserDirect(userId: string): Promise<{
  rows: Array<Record<string, unknown>>;
  pair: ConversationParticipantPair | null;
  error: Error | null;
}> {
  for (const pair of CONVERSATION_PARTICIPANT_COLUMN_PAIRS) {
    for (const orderByLastMessage of [true, false]) {
      let query = supabase
        .from('conversations')
        .select('*')
        .or(`${pair[0]}.eq.${userId},${pair[1]}.eq.${userId}`);

      query = query.order(orderByLastMessage ? 'last_message_at' : 'created_at', {
        ascending: false,
        nullsFirst: false,
      });

      const { data, error } = await query;

      if (!error) {
        return {
          rows: (data || []) as Array<Record<string, unknown>>,
          pair,
          error: null,
        };
      }

      if (
        isMissingColumnError(error, 'conversations', pair[0]) ||
        isMissingColumnError(error, 'conversations', pair[1])
      ) {
        break;
      }

      if (orderByLastMessage && isMissingColumnError(error, 'conversations', 'last_message_at')) {
        continue;
      }

      console.error('Error fetching conversation rows (direct columns):', error);
      return {
        rows: [],
        pair: null,
        error: new Error(error.message || 'Failed to fetch conversations'),
      };
    }
  }

  return {
    rows: [],
    pair: null,
    error: new Error('No supported participant columns found for conversations'),
  };
}

async function fetchConversationRowsByIds(conversationIds: string[]): Promise<{
  rows: Array<Record<string, unknown>>;
  error: Error | null;
}> {
  const ids = uniqueIds(conversationIds);
  if (ids.length === 0) {
    return { rows: [], error: null };
  }

  for (const orderByLastMessage of [true, false]) {
    let query = supabase
      .from('conversations')
      .select('*')
      .in('id', ids);

    if (orderByLastMessage) {
      query = query.order('last_message_at', { ascending: false, nullsFirst: false });
    }

    const { data, error } = await query;
    if (!error) {
      return {
        rows: (data || []) as Array<Record<string, unknown>>,
        error: null,
      };
    }

    if (orderByLastMessage && isMissingColumnError(error, 'conversations', 'last_message_at')) {
      continue;
    }

    console.error('Error fetching conversation rows by IDs:', error);
    return { rows: [], error: new Error(error.message || 'Failed to fetch conversations') };
  }

  return { rows: [], error: null };
}

async function finalizeConversations(
  baseConversations: ConversationData[],
  currentUserId: string
): Promise<ConversationData[]> {
  let conversations = [...baseConversations];

  const missingParticipantsIds = conversations
    .filter((conversation) => !conversation.participant_1 || !conversation.participant_2)
    .map((conversation) => conversation.id);

  if (missingParticipantsIds.length > 0) {
    const { rows, config, error } = await fetchConversationParticipantRowsByConversationIds(missingParticipantsIds);
    if (!error && config) {
      const participantMap = buildParticipantMap(rows, config);
      conversations = conversations.map((conversation) => {
        const resolved = resolveParticipants(
          conversation.participant_1,
          conversation.participant_2,
          participantMap[conversation.id] || [],
          currentUserId
        );

        return {
          ...conversation,
          participant_1: resolved.participant_1,
          participant_2: resolved.participant_2,
        };
      });
    }
  }

  const stillMissingParticipantIds = conversations
    .filter((conversation) => !conversation.participant_1 || !conversation.participant_2)
    .map((conversation) => conversation.id);

  if (stillMissingParticipantIds.length > 0) {
    const counterpartyByConversation = await fetchCounterpartyIdsByConversation(
      stillMissingParticipantIds,
      currentUserId
    );

    conversations = conversations.map((conversation) => {
      if (conversation.participant_1 && conversation.participant_2) {
        return conversation;
      }

      const resolved = resolveParticipants(
        conversation.participant_1,
        conversation.participant_2,
        [
          conversation.participant_1,
          conversation.participant_2,
          counterpartyByConversation[conversation.id],
        ],
        currentUserId
      );

      return {
        ...conversation,
        participant_1: resolved.participant_1,
        participant_2: resolved.participant_2,
      };
    });
  }

  const participantIds = conversations.flatMap((conversation) => [
    conversation.participant_1,
    conversation.participant_2,
  ]);
  const profileMap = await fetchProfilesByIds(participantIds);

  const hydrated = conversations.map((conversation) => ({
    ...conversation,
    participant_1_profile: profileMap[conversation.participant_1],
    participant_2_profile: profileMap[conversation.participant_2],
  }));

  const conversationIds = hydrated.map((conversation) => conversation.id).filter(Boolean);
  const [unreadCounts, latestMessageMap] = await Promise.all([
    Promise.all(
      conversationIds.map((conversationId) => countUnreadMessages(conversationId, currentUserId))
    ),
    fetchLatestMessageMap(conversationIds),
  ]);

  const withUnreadAndPreview = hydrated.map((conversation, index) => {
    const fallbackLatest = latestMessageMap[conversation.id];
    const hasMessage = !!(
      conversation.last_message_at ||
      fallbackLatest?.created_at ||
      conversation.last_message_preview
    );

    return {
      ...conversation,
      unread_count: unreadCounts[index] || 0,
      last_message_preview: hasMessage ? ENCRYPTED_MESSAGE_PREVIEW : undefined,
      last_message_at: conversation.last_message_at || fallbackLatest?.created_at || undefined,
    };
  });

  withUnreadAndPreview.forEach((conversation) => {
    if (conversation.id && conversation.participant_1 && conversation.participant_2) {
      conversationParticipantCache.set(conversation.id, {
        participant_1: conversation.participant_1,
        participant_2: conversation.participant_2,
      });
    }
  });

  withUnreadAndPreview.sort((a, b) => {
    const aTime = new Date(a.last_message_at || a.created_at).getTime();
    const bTime = new Date(b.last_message_at || b.created_at).getTime();
    return bTime - aTime;
  });

  return withUnreadAndPreview;
}

async function fetchConversationsViaParticipantJoinTable(
  currentUserId: string
): Promise<{ conversations: ConversationData[]; error: Error | null }> {
  const { rows: ownParticipantRows, config, error: participantError } =
    await fetchConversationParticipantRowsForUser(currentUserId);

  if (participantError) {
    return { conversations: [], error: participantError };
  }

  if (!config) {
    return {
      conversations: [],
      error: new Error('No supported participant schema found for conversations'),
    };
  }

  const conversationIds = uniqueIds(
    ownParticipantRows.map((row) => {
      return typeof row[config.conversationColumn] === 'string'
        ? row[config.conversationColumn] as string
        : '';
    })
  );

  if (conversationIds.length === 0) {
    return { conversations: [], error: null };
  }

  const { rows: conversationRows, error: conversationsError } = await fetchConversationRowsByIds(conversationIds);
  if (conversationsError) {
    return { conversations: [], error: conversationsError };
  }

  const { rows: participantRows, error: participantRowsError } =
    await fetchConversationParticipantRowsByConversationIds(conversationIds, config);

  if (participantRowsError) {
    return { conversations: [], error: participantRowsError };
  }

  const participantMap = buildParticipantMap(participantRows, config);

  const baseConversations = conversationRows.map((row) => {
    const normalized = normalizeConversation(row);
    const resolved = resolveParticipants(
      normalized.participant_1,
      normalized.participant_2,
      participantMap[normalized.id] || [],
      currentUserId
    );

    return {
      ...normalized,
      participant_1: resolved.participant_1,
      participant_2: resolved.participant_2,
    };
  });

  const conversations = await finalizeConversations(baseConversations, currentUserId);
  return { conversations, error: null };
}

async function hydrateConversationRow(
  row: Record<string, unknown>,
  currentUserId: string
): Promise<ConversationData> {
  const pair = pickParticipantPairFromRow(row);
  let conversation = normalizeConversation(row, pair);

  if (!conversation.participant_1 || !conversation.participant_2) {
    const { rows, config } = await fetchConversationParticipantRowsByConversationIds([conversation.id]);
    if (config) {
      const participantMap = buildParticipantMap(rows, config);
      const resolved = resolveParticipants(
        conversation.participant_1,
        conversation.participant_2,
        participantMap[conversation.id] || [],
        currentUserId
      );

      conversation = {
        ...conversation,
        participant_1: resolved.participant_1,
        participant_2: resolved.participant_2,
      };
    }
  }

  if (!conversation.participant_1 || !conversation.participant_2) {
    const counterparty = await fetchCounterpartyIdsByConversation([conversation.id], currentUserId);
    const resolved = resolveParticipants(
      conversation.participant_1,
      conversation.participant_2,
      [
        conversation.participant_1,
        conversation.participant_2,
        counterparty[conversation.id],
      ],
      currentUserId
    );

    conversation = {
      ...conversation,
      participant_1: resolved.participant_1,
      participant_2: resolved.participant_2,
    };
  }

  const profileMap = await fetchProfilesByIds([conversation.participant_1, conversation.participant_2]);
  conversation = {
    ...conversation,
    participant_1_profile: profileMap[conversation.participant_1],
    participant_2_profile: profileMap[conversation.participant_2],
    unread_count: await countUnreadMessages(conversation.id, currentUserId),
  };

  if (!conversation.last_message_preview || !conversation.last_message_at) {
    const latestMap = await fetchLatestMessageMap([conversation.id]);
    const latest = latestMap[conversation.id];

    if (latest) {
      conversation = {
        ...conversation,
        last_message_preview: ENCRYPTED_MESSAGE_PREVIEW,
        last_message_at: conversation.last_message_at || latest.created_at,
      };
    }
  }

  if (conversation.id && conversation.participant_1 && conversation.participant_2) {
    conversationParticipantCache.set(conversation.id, {
      participant_1: conversation.participant_1,
      participant_2: conversation.participant_2,
    });
  }

  return conversation;
}

async function updateConversationLastMessage(conversationId: string): Promise<void> {
  const now = new Date().toISOString();
  const preview = ENCRYPTED_MESSAGE_PREVIEW;

  const payloads: Array<Record<string, unknown>> = [
    { last_message_at: now, last_message_preview: preview },
    { last_message_at: now },
    { last_message_preview: preview },
  ];

  for (const payload of payloads) {
    const { error } = await supabase
      .from('conversations')
      .update(payload)
      .eq('id', conversationId);

    if (!error) {
      return;
    }

    const missingColumn = extractMissingColumn(error);
    if (missingColumn && missingColumn in payload) {
      continue;
    }

    // Conversation preview update should not block sending a message.
    console.error('Error updating conversation last message metadata:', error);
    return;
  }
}

async function fetchMessageById(messageId: string, currentUserId?: string): Promise<MessageData | null> {
  for (const includeSenderRelation of [true, false]) {
    const { data, error } = includeSenderRelation
      ? await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(*)
        `)
        .eq('id', messageId)
        .maybeSingle()
      : await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .maybeSingle();

    if (!error) {
      const normalized = data ? normalizeMessage(data) : null;
      if (!normalized) return null;

      if (!normalized.sender) {
        const senderMap = await fetchProfilesByIds([normalized.sender_id]);
        normalized.sender = normalized.sender_id ? senderMap[normalized.sender_id] : undefined;
      }

      if (currentUserId && normalized.conversation_id) {
        const decrypted = await decryptMessagesForCurrentUser(
          [normalized],
          normalized.conversation_id,
          currentUserId
        );
        return decrypted[0] || normalized;
      }

      return normalized;
    }

    if (includeSenderRelation && isRelationshipError(error)) {
      continue;
    }

    console.error('Error fetching message by id:', error);
    return null;
  }

  return null;
}

async function findExistingConversationViaDirectColumns(
  userId: string,
  otherUserId: string
): Promise<ConversationData | null> {
  for (const pair of CONVERSATION_PARTICIPANT_COLUMN_PAIRS) {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`and(${pair[0]}.eq.${userId},${pair[1]}.eq.${otherUserId}),and(${pair[0]}.eq.${otherUserId},${pair[1]}.eq.${userId})`)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      const normalized = normalizeConversation(data, pair);
      const profileMap = await fetchProfilesByIds([normalized.participant_1, normalized.participant_2]);

      return {
        ...normalized,
        participant_1_profile: profileMap[normalized.participant_1],
        participant_2_profile: profileMap[normalized.participant_2],
      };
    }

    if (isMissingColumnError(error, 'conversations', pair[0]) || isMissingColumnError(error, 'conversations', pair[1])) {
      continue;
    }

    if (error) {
      console.error('Error finding existing conversation (direct columns):', error);
      return null;
    }
  }

  return null;
}

async function findExistingConversationViaParticipantJoinTable(
  userId: string,
  otherUserId: string
): Promise<ConversationData | null> {
  const config = await getConversationParticipantsTableConfig();
  if (!config) {
    return null;
  }

  const { data: ownRows, error: ownRowsError } = await supabase
    .from(CONVERSATION_PARTICIPANTS_TABLE)
    .select(config.conversationColumn)
    .eq(config.userColumn, userId);

  if (ownRowsError) {
    console.error('Error finding existing conversation (join table, own rows):', ownRowsError);
    return null;
  }

  const ownConversationIds = uniqueIds(
    (ownRows || []).map((row) => {
      const typedRow = row as unknown as Record<string, unknown>;
      return typeof typedRow[config.conversationColumn] === 'string'
        ? typedRow[config.conversationColumn] as string
        : '';
    })
  );

  if (ownConversationIds.length === 0) {
    return null;
  }

  const { data: matchRows, error: matchError } = await supabase
    .from(CONVERSATION_PARTICIPANTS_TABLE)
    .select(config.conversationColumn)
    .eq(config.userColumn, otherUserId)
    .in(config.conversationColumn, ownConversationIds)
    .limit(1)
    .maybeSingle();

  if (matchError) {
    console.error('Error finding existing conversation (join table, match rows):', matchError);
    return null;
  }

  const conversationId =
    matchRows && typeof (matchRows as unknown as Record<string, unknown>)[config.conversationColumn] === 'string'
      ? (matchRows as unknown as Record<string, unknown>)[config.conversationColumn] as string
      : '';

  if (!conversationId) {
    return null;
  }

  const { conversation } = await fetchConversationById(conversationId);
  return conversation;
}

async function createConversationViaDirectColumns(
  currentUserId: string,
  otherUserId: string
): Promise<{ conversation: ConversationData | null; error: Error | null }> {
  for (const pair of CONVERSATION_PARTICIPANT_COLUMN_PAIRS) {
    const payload: Record<string, unknown> = {
      [pair[0]]: currentUserId,
      [pair[1]]: otherUserId,
    };

    let attempts = 0;
    while (attempts < 8) {
      attempts += 1;

      const { data, error } = await supabase
        .from('conversations')
        .insert(payload)
        .select('*')
        .maybeSingle();

      if (!error && data) {
        const normalized = normalizeConversation(data, pair);
        const profileMap = await fetchProfilesByIds([normalized.participant_1, normalized.participant_2]);

        return {
          conversation: {
            ...normalized,
            participant_1_profile: profileMap[normalized.participant_1],
            participant_2_profile: profileMap[normalized.participant_2],
          },
          error: null,
        };
      }

      if (error?.code === '23505') {
        const raceConversation = await findExistingConversationViaDirectColumns(currentUserId, otherUserId);
        if (raceConversation) {
          return { conversation: raceConversation, error: null };
        }
      }

      if (isMissingColumnError(error, 'conversations', pair[0]) || isMissingColumnError(error, 'conversations', pair[1])) {
        break;
      }

      const missingColumn = extractMissingColumn(error);
      if (missingColumn && missingColumn in payload) {
        delete payload[missingColumn];
        continue;
      }

      if (error) {
        console.error('Error creating conversation (direct columns):', error);
        return { conversation: null, error: new Error(error.message || 'Failed to create conversation') };
      }
    }
  }

  return { conversation: null, error: new Error('Unable to create direct-column conversation with current schema') };
}

async function createConversationViaParticipantJoinTable(
  currentUserId: string,
  otherUserId: string
): Promise<{ conversation: ConversationData | null; error: Error | null }> {
  const config = await getConversationParticipantsTableConfig();
  if (!config) {
    return {
      conversation: null,
      error: new Error('No supported participant join-table schema found'),
    };
  }

  const now = new Date().toISOString();
  const payloads: Array<Record<string, unknown>> = [
    {},
    { created_at: now },
    { created_at: now, updated_at: now },
    { created_at: now, updated_at: now, last_message_at: null },
    { last_message_at: null },
  ];

  let createdConversationId = '';
  let lastCreateError: QueryError | null = null;

  for (const basePayload of payloads) {
    const payload = { ...basePayload };
    let attempts = 0;

    while (attempts < 8) {
      attempts += 1;

      const { data, error } = await supabase
        .from('conversations')
        .insert(payload)
        .select('*')
        .maybeSingle();

      if (!error && data) {
        const id = typeof (data as Record<string, unknown>).id === 'string'
          ? (data as Record<string, unknown>).id as string
          : '';

        if (id) {
          createdConversationId = id;
          break;
        }
      }

      if (!error) {
        continue;
      }

      lastCreateError = error;

      const missingColumn = extractMissingColumn(error);
      if (missingColumn && missingColumn in payload) {
        delete payload[missingColumn];
        continue;
      }

      const notNullColumn = extractNotNullColumn(error);
      if (notNullColumn && !(notNullColumn in payload)) {
        const fallbackValue = defaultConversationValueForColumn(notNullColumn, now);
        if (fallbackValue !== undefined) {
          payload[notNullColumn] = fallbackValue;
          continue;
        }
      }

      if (isMissingColumnError(error, 'conversations')) {
        break;
      }

      console.error('Error creating conversation (join table):', error);
      return { conversation: null, error: new Error(error.message || 'Failed to create conversation') };
    }

    if (createdConversationId) {
      break;
    }
  }

  if (!createdConversationId) {
    return {
      conversation: null,
      error: new Error(lastCreateError?.message || 'Failed to create conversation'),
    };
  }

  const participantRows = [
    {
      [config.conversationColumn]: createdConversationId,
      [config.userColumn]: currentUserId,
    },
    {
      [config.conversationColumn]: createdConversationId,
      [config.userColumn]: otherUserId,
    },
  ];

  const linkResult = await supabase
    .from(CONVERSATION_PARTICIPANTS_TABLE)
    .insert(participantRows);

  if (linkResult.error && linkResult.error.code !== '23505') {
    const ownLinkResult = await supabase
      .from(CONVERSATION_PARTICIPANTS_TABLE)
      .insert(participantRows[0]);

    if (ownLinkResult.error && ownLinkResult.error.code !== '23505') {
      console.error('Error linking current user to conversation:', ownLinkResult.error);
      return {
        conversation: null,
        error: new Error(ownLinkResult.error.message || 'Failed to link conversation participants'),
      };
    }

    const otherLinkResult = await supabase
      .from(CONVERSATION_PARTICIPANTS_TABLE)
      .insert(participantRows[1]);

    if (otherLinkResult.error && otherLinkResult.error.code !== '23505') {
      console.error('Error linking other participant to conversation:', otherLinkResult.error);
      return {
        conversation: null,
        error: new Error(otherLinkResult.error.message || 'Failed to link conversation participants'),
      };
    }
  }

  const { conversation } = await fetchConversationById(createdConversationId);
  if (conversation) {
    return { conversation, error: null };
  }

  const profileMap = await fetchProfilesByIds([currentUserId, otherUserId]);
  return {
    conversation: {
      id: createdConversationId,
      participant_1: currentUserId,
      participant_2: otherUserId,
      created_at: now,
      participant_1_profile: profileMap[currentUserId],
      participant_2_profile: profileMap[otherUserId],
      unread_count: 0,
    },
    error: null,
  };
}

export interface ConversationData {
  id: string;
  participant_1: string;
  participant_2: string;
  booking_id?: string;
  last_message_at?: string;
  last_message_preview?: string;
  created_at: string;
  participant_1_profile?: ProfileData;
  participant_2_profile?: ProfileData;
  unread_count?: number;
}

export interface MessageData {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  encrypted_for_participant_1?: string;
  encrypted_for_participant_2?: string;
  encryption_nonce_p1?: string;
  encryption_nonce_p2?: string;
  encryption_sender_public_key?: string;
  encryption_version?: string;
  type: 'text' | 'image' | 'booking_request' | 'system';
  is_read: boolean;
  read_at?: string;
  created_at: string;
  sender?: ProfileData;
}

/**
 * Fetch all conversations for the current user
 */
export async function fetchConversations(): Promise<{ conversations: ConversationData[]; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { conversations: [], error: new Error('Not authenticated') };
    }

    const directResult = await fetchConversationRowsForUserDirect(user.id);

    if (!directResult.error && directResult.pair) {
      const normalized = directResult.rows.map((row) => normalizeConversation(row, directResult.pair || undefined));
      const conversations = await finalizeConversations(normalized, user.id);
      return { conversations, error: null };
    }

    const joinTableResult = await fetchConversationsViaParticipantJoinTable(user.id);
    if (!joinTableResult.error) {
      return joinTableResult;
    }

    return {
      conversations: [],
      error: directResult.error || joinTableResult.error || new Error('Failed to fetch conversations'),
    };
  } catch (err) {
    console.error('Error in fetchConversations:', err);
    return {
      conversations: [],
      error: err instanceof Error ? err : new Error('Failed to fetch conversations'),
    };
  }
}

/**
 * Fetch a single conversation by ID
 */
export async function fetchConversationById(
  conversationId: string
): Promise<{ conversation: ConversationData | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id || '';

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

    const row = data as Record<string, unknown>;
    const conversation = await hydrateConversationRow(row, currentUserId);

    return { conversation, error: null };
  } catch (err) {
    console.error('Error in fetchConversationById:', err);
    return {
      conversation: null,
      error: err instanceof Error ? err : new Error('Failed to fetch conversation'),
    };
  }
}

/**
 * Fetch messages for a conversation
 */
export async function fetchMessages(
  conversationId: string
): Promise<{ messages: MessageData[]; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id || '';

    for (const conversationColumn of MESSAGE_CONVERSATION_COLUMNS) {
      let missingConversationColumn = false;

      for (const includeSenderRelation of [true, false]) {
        for (const withCreatedAtOrder of [true, false]) {
          let query = includeSenderRelation
            ? supabase
              .from('messages')
              .select(`
                *,
                sender:profiles!messages_sender_id_fkey(*)
              `)
            : supabase
              .from('messages')
              .select('*');

          query = query.eq(conversationColumn, conversationId);

          if (withCreatedAtOrder) {
            query = query.order('created_at', { ascending: true });
          }

          const { data, error } = await query;

          if (!error) {
            const normalized = (data || []).map((row) => normalizeMessage(row));

            if (!includeSenderRelation) {
              const senderIds = normalized.map((message) => message.sender_id);
              const profileMap = await fetchProfilesByIds(senderIds);
              normalized.forEach((message) => {
                message.sender = profileMap[message.sender_id];
              });
            }

            normalized.sort((a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );

            const decrypted = await decryptMessagesForCurrentUser(
              normalized,
              conversationId,
              currentUserId
            );

            return { messages: decrypted, error: null };
          }

          if (isMissingColumnError(error, 'messages', conversationColumn)) {
            missingConversationColumn = true;
            break;
          }

          if (withCreatedAtOrder && isMissingColumnError(error, 'messages', 'created_at')) {
            continue;
          }

          if (includeSenderRelation && isRelationshipError(error)) {
            break;
          }

          console.error('Error fetching messages:', error);
          return { messages: [], error: new Error(error.message || 'Failed to fetch messages') };
        }

        if (missingConversationColumn) {
          break;
        }
      }

      if (!missingConversationColumn) {
        break;
      }
    }

    return { messages: [], error: new Error('No supported conversation column found for messages') };
  } catch (err) {
    console.error('Error in fetchMessages:', err);
    return {
      messages: [],
      error: err instanceof Error ? err : new Error('Failed to fetch messages'),
    };
  }
}

/**
 * Send a message
 */
export async function sendMessage(
  conversationId: string,
  content: string,
  type: MessageData['type'] = 'text'
): Promise<{ message: MessageData | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { message: null, error: new Error('Not authenticated') };
    }

    const normalizedType = normalizeMessageType(type);
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return { message: null, error: new Error('Message content cannot be empty') };
    }

    let encryptedPayload: Record<string, string>;
    try {
      encryptedPayload = await buildEncryptedPayloadForMessage(conversationId, user.id, trimmedContent);
    } catch (error) {
      if (error instanceof SecureMessagingError) {
        return { message: null, error: new Error(error.message) };
      }

      const message = error instanceof Error ? error.message : 'Failed to encrypt your message.';
      return { message: null, error: new Error(message) };
    }

    for (const conversationColumn of MESSAGE_CONVERSATION_COLUMNS) {
      let missingConversationColumn = false;

      for (const senderColumn of MESSAGE_SENDER_COLUMNS) {
        const payload: Record<string, unknown> = {
          [conversationColumn]: conversationId,
          [senderColumn]: user.id,
          content: ENCRYPTED_MESSAGE_PREVIEW,
          type: normalizedType,
          ...encryptedPayload,
        };

        let attempts = 0;
        while (attempts < 10) {
          attempts += 1;

          const { data, error } = await supabase
            .from('messages')
            .insert(payload)
            .select('*')
            .maybeSingle();

          if (!error) {
            await updateConversationLastMessage(conversationId);

            const normalized = data ? normalizeMessage(data) : null;
            if (!normalized) {
              return { message: null, error: new Error('Message sent but response was empty') };
            }

            if (!normalized.sender) {
              const profileMap = await fetchProfilesByIds([normalized.sender_id]);
              normalized.sender = profileMap[normalized.sender_id];
            }

            const decrypted = await decryptMessagesForCurrentUser([normalized], conversationId, user.id);
            return { message: decrypted[0] || normalized, error: null };
          }

          if (isMissingRequiredMessageEncryptionColumn(error)) {
            return {
              message: null,
              error: new Error('Secure messaging schema is out of date. Please run the latest Supabase migrations.'),
            };
          }

          if (isMissingColumnError(error, 'messages', conversationColumn)) {
            missingConversationColumn = true;
            break;
          }

          if (isMissingColumnError(error, 'messages', senderColumn)) {
            break;
          }

          const missingColumn = extractMissingColumn(error);
          if (missingColumn && missingColumn in payload) {
            if (
              (MESSAGE_ENCRYPTION_REQUIRED_COLUMNS as readonly string[]).includes(missingColumn)
            ) {
              return {
                message: null,
                error: new Error('Secure messaging schema is out of date. Please run the latest Supabase migrations.'),
              };
            }
            delete payload[missingColumn];
            continue;
          }

          console.error('Error sending message:', error);
          return { message: null, error: new Error(error.message || 'Failed to send message') };
        }

        if (missingConversationColumn) {
          break;
        }
      }

      if (!missingConversationColumn) {
        break;
      }
    }

    return { message: null, error: new Error('Unable to send message with current schema') };
  } catch (err) {
    console.error('Error in sendMessage:', err);
    return {
      message: null,
      error: err instanceof Error ? err : new Error('Failed to send message'),
    };
  }
}

/**
 * Create or get a conversation between two users
 */
export async function getOrCreateConversation(
  otherUserId: string
): Promise<{ conversation: ConversationData | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { conversation: null, error: new Error('Not authenticated') };
    }

    if (user.id === otherUserId) {
      return { conversation: null, error: new Error('Cannot create a conversation with yourself') };
    }

    const existingDirect = await findExistingConversationViaDirectColumns(user.id, otherUserId);
    if (existingDirect) {
      return { conversation: existingDirect, error: null };
    }

    const existingJoin = await findExistingConversationViaParticipantJoinTable(user.id, otherUserId);
    if (existingJoin) {
      return { conversation: existingJoin, error: null };
    }

    const createDirectResult = await createConversationViaDirectColumns(user.id, otherUserId);
    if (!createDirectResult.error && createDirectResult.conversation) {
      return createDirectResult;
    }

    const createJoinResult = await createConversationViaParticipantJoinTable(user.id, otherUserId);
    if (!createJoinResult.error && createJoinResult.conversation) {
      return createJoinResult;
    }

    return {
      conversation: null,
      error: createDirectResult.error || createJoinResult.error || new Error('Unable to create conversation with current schema'),
    };
  } catch (err) {
    console.error('Error in getOrCreateConversation:', err);
    return {
      conversation: null,
      error: err instanceof Error ? err : new Error('Failed to create conversation'),
    };
  }
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(
  conversationId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: new Error('Not authenticated') };
    }

    const now = new Date().toISOString();

    for (const conversationColumn of MESSAGE_CONVERSATION_COLUMNS) {
      let missingConversationColumn = false;

      for (const senderColumn of MESSAGE_SENDER_COLUMNS) {
        const payloads: Array<Record<string, unknown>> = [
          { is_read: true, read_at: now },
          { is_read: true },
        ];

        for (const payload of payloads) {
          let query = supabase
            .from('messages')
            .update(payload)
            .eq(conversationColumn, conversationId)
            .neq(senderColumn, user.id);

          if ('is_read' in payload) {
            query = query.eq('is_read', false);
          }

          const { error } = await query;

          if (!error) {
            return { success: true, error: null };
          }

          if (isMissingColumnError(error, 'messages', conversationColumn)) {
            missingConversationColumn = true;
            break;
          }

          if (isMissingColumnError(error, 'messages', senderColumn)) {
            continue;
          }

          if (isMissingColumnError(error, 'messages', 'is_read') && 'is_read' in payload) {
            continue;
          }

          const missingColumn = extractMissingColumn(error);
          if (missingColumn && missingColumn in payload) {
            continue;
          }

          console.error('Error marking messages as read:', error);
          return { success: false, error: new Error(error.message || 'Failed to mark messages as read') };
        }

        if (missingConversationColumn) {
          break;
        }
      }

      if (!missingConversationColumn) {
        break;
      }
    }

    return { success: false, error: new Error('Unable to mark messages as read with current schema') };
  } catch (err) {
    console.error('Error in markMessagesAsRead:', err);
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to mark messages as read'),
    };
  }
}

/**
 * Subscribe to new messages in a conversation
 */
export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: MessageData) => void
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
      },
      async (payload) => {
        const row = payload.new as Record<string, unknown>;
        const rowConversationId =
          typeof row.conversation_id === 'string'
            ? row.conversation_id
            : typeof row.thread_id === 'string'
              ? row.thread_id
              : '';

        if (!rowConversationId || rowConversationId !== conversationId) {
          return;
        }

        if (!currentUserId) {
          const { data } = await supabase.auth.getUser();
          currentUserId = data.user?.id || '';
        }

        const message = await fetchMessageById(String(row.id || ''), currentUserId);
        if (message) {
          onMessage(message);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Get total unread message count
 */
export async function getUnreadCount(): Promise<{ count: number; error: Error | null }> {
  try {
    const { conversations, error } = await fetchConversations();
    if (error) {
      return { count: 0, error };
    }

    const total = conversations.reduce((sum, conversation) => {
      return sum + Math.max(0, Math.round(toNumber(conversation.unread_count, 0)));
    }, 0);

    return { count: total, error: null };
  } catch (err) {
    console.error('Error in getUnreadCount:', err);
    return {
      count: 0,
      error: err instanceof Error ? err : new Error('Failed to get unread count'),
    };
  }
}
