import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Base64 } from 'js-base64';
import nacl from 'tweetnacl';
import { supabase } from '../supabase';

type QueryError = {
  code?: string | null;
  message?: string | null;
};

type StoredMessagingIdentity = {
  version: string;
  publicKey: string;
  secretKey: string;
};

export type MessagingIdentity = {
  version: string;
  publicKey: Uint8Array;
  secretKey: Uint8Array;
  publicKeyBase64: string;
};

export class SecureMessagingError extends Error {
  code: 'schema_unavailable' | 'missing_public_key' | 'invalid_key' | 'identity_unavailable' | 'profile_sync_failed';

  constructor(
    code: SecureMessagingError['code'],
    message: string
  ) {
    super(message);
    this.name = 'SecureMessagingError';
    this.code = code;
  }
}

const MESSAGE_ENCRYPTION_VERSION = 'x25519-xsalsa20poly1305-v1';
const ENCRYPTED_MESSAGE_PREVIEW = 'Encrypted message';
const STORE_PREFIX = 'wingman_msg_keypair_v1_';
const PROFILE_PUBLIC_KEY_COLUMN = 'message_encryption_public_key';
const PROFILE_VERSION_COLUMN = 'message_encryption_key_version';
const PROFILE_UPDATED_AT_COLUMN = 'message_encryption_updated_at';

const identityCache = new Map<string, MessagingIdentity>();
let prngInitialized = false;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function ensureNaclPrngInitialized(): void {
  if (prngInitialized) return;

  nacl.setPRNG((target, length) => {
    const bytes = Crypto.getRandomBytes(length);
    for (let index = 0; index < length; index += 1) {
      target[index] = bytes[index];
    }
  });

  prngInitialized = true;
}

function encodeBase64(bytes: Uint8Array): string {
  return Base64.fromUint8Array(bytes);
}

function decodeBase64(value: string): Uint8Array {
  return Base64.toUint8Array(value);
}

function getStoreKey(userId: string): string {
  return `${STORE_PREFIX}${userId}`;
}

function normalizeQueryError(error: unknown): QueryError | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  return error as QueryError;
}

function isMissingProfileColumnError(error: unknown): boolean {
  const typed = normalizeQueryError(error);
  return String(typed?.code || '') === '42703';
}

function toIdentity(stored: StoredMessagingIdentity): MessagingIdentity | null {
  try {
    const publicKey = decodeBase64(stored.publicKey);
    const secretKey = decodeBase64(stored.secretKey);

    if (publicKey.length !== nacl.box.publicKeyLength || secretKey.length !== nacl.box.secretKeyLength) {
      return null;
    }

    return {
      version: MESSAGE_ENCRYPTION_VERSION,
      publicKey,
      secretKey,
      publicKeyBase64: encodeBase64(publicKey),
    };
  } catch {
    return null;
  }
}

async function loadStoredIdentity(userId: string): Promise<MessagingIdentity | null> {
  const value = await SecureStore.getItemAsync(getStoreKey(userId));
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as StoredMessagingIdentity;
    if (!parsed || parsed.version !== MESSAGE_ENCRYPTION_VERSION) {
      return null;
    }

    return toIdentity(parsed);
  } catch {
    return null;
  }
}

async function saveIdentity(userId: string, identity: MessagingIdentity): Promise<void> {
  const payload: StoredMessagingIdentity = {
    version: identity.version,
    publicKey: identity.publicKeyBase64,
    secretKey: encodeBase64(identity.secretKey),
  };

  await SecureStore.setItemAsync(getStoreKey(userId), JSON.stringify(payload));
}

function createNewIdentity(): MessagingIdentity {
  ensureNaclPrngInitialized();

  const keyPair = nacl.box.keyPair();
  return {
    version: MESSAGE_ENCRYPTION_VERSION,
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey,
    publicKeyBase64: encodeBase64(keyPair.publicKey),
  };
}

async function syncPublicKeyToProfile(
  userId: string,
  publicKeyBase64: string
): Promise<void> {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    [PROFILE_PUBLIC_KEY_COLUMN]: publicKeyBase64,
    [PROFILE_VERSION_COLUMN]: MESSAGE_ENCRYPTION_VERSION,
    [PROFILE_UPDATED_AT_COLUMN]: now,
  };

  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId);

  if (!error) {
    return;
  }

  if (isMissingProfileColumnError(error)) {
    throw new SecureMessagingError(
      'schema_unavailable',
      'Secure messaging schema is not available yet. Please run the latest Supabase migrations.'
    );
  }

  throw new SecureMessagingError(
    'profile_sync_failed',
    error.message || 'Unable to sync secure messaging identity to profile.'
  );
}

export function getMessageEncryptionVersion(): string {
  return MESSAGE_ENCRYPTION_VERSION;
}

export function getEncryptedMessagePreview(): string {
  return ENCRYPTED_MESSAGE_PREVIEW;
}

export async function getMessagingIdentity(
  userId: string,
  options: { syncProfile?: boolean } = {}
): Promise<MessagingIdentity> {
  const syncProfile = options.syncProfile !== false;
  if (!userId) {
    throw new SecureMessagingError('identity_unavailable', 'User is not authenticated.');
  }

  const cached = identityCache.get(userId);
  if (cached) {
    if (syncProfile) {
      await syncPublicKeyToProfile(userId, cached.publicKeyBase64);
    }
    return cached;
  }

  const stored = await loadStoredIdentity(userId);
  const identity = stored || createNewIdentity();

  if (!stored) {
    await saveIdentity(userId, identity);
  }

  identityCache.set(userId, identity);

  if (syncProfile) {
    await syncPublicKeyToProfile(userId, identity.publicKeyBase64);
  }

  return identity;
}

export async function fetchMessagingPublicKeys(userIds: string[]): Promise<Record<string, string>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(`id,${PROFILE_PUBLIC_KEY_COLUMN}`)
    .in('id', uniqueIds);

  if (error) {
    if (isMissingProfileColumnError(error)) {
      throw new SecureMessagingError(
        'schema_unavailable',
        'Secure messaging schema is not available yet. Please run the latest Supabase migrations.'
      );
    }

    throw new SecureMessagingError(
      'profile_sync_failed',
      error.message || 'Unable to load participant encryption keys.'
    );
  }

  const keyMap: Record<string, string> = {};
  (data || []).forEach((row) => {
    const typed = row as Record<string, unknown>;
    const id = typeof typed.id === 'string' ? typed.id : '';
    const key = typeof typed[PROFILE_PUBLIC_KEY_COLUMN] === 'string'
      ? typed[PROFILE_PUBLIC_KEY_COLUMN] as string
      : '';

    if (id && key) {
      keyMap[id] = key;
    }
  });

  return keyMap;
}

export function encryptMessageForRecipient(
  plaintext: string,
  recipientPublicKeyBase64: string,
  senderSecretKey: Uint8Array
): { ciphertextBase64: string; nonceBase64: string } {
  if (!recipientPublicKeyBase64) {
    throw new SecureMessagingError(
      'missing_public_key',
      'Recipient secure messaging key is missing.'
    );
  }

  let recipientPublicKey: Uint8Array;
  try {
    recipientPublicKey = decodeBase64(recipientPublicKeyBase64);
  } catch {
    throw new SecureMessagingError(
      'invalid_key',
      'Recipient secure messaging key is invalid.'
    );
  }

  if (recipientPublicKey.length !== nacl.box.publicKeyLength) {
    throw new SecureMessagingError(
      'invalid_key',
      'Recipient secure messaging key has an invalid length.'
    );
  }

  ensureNaclPrngInitialized();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageBytes = textEncoder.encode(plaintext);
  const ciphertext = nacl.box(messageBytes, nonce, recipientPublicKey, senderSecretKey);

  return {
    ciphertextBase64: encodeBase64(ciphertext),
    nonceBase64: encodeBase64(nonce),
  };
}

export function decryptMessageFromSender(
  ciphertextBase64: string,
  nonceBase64: string,
  senderPublicKeyBase64: string,
  recipientSecretKey: Uint8Array
): string | null {
  try {
    const ciphertext = decodeBase64(ciphertextBase64);
    const nonce = decodeBase64(nonceBase64);
    const senderPublicKey = decodeBase64(senderPublicKeyBase64);

    if (senderPublicKey.length !== nacl.box.publicKeyLength || nonce.length !== nacl.box.nonceLength) {
      return null;
    }

    const opened = nacl.box.open(ciphertext, nonce, senderPublicKey, recipientSecretKey);
    if (!opened) {
      return null;
    }

    return textDecoder.decode(opened);
  } catch {
    return null;
  }
}
