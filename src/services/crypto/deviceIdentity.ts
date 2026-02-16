import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Base64 } from 'js-base64';
import nacl from 'tweetnacl';
import { supabase } from '../supabase';

type QueryError = {
  code?: string | null;
  message?: string | null;
};

type StoredDeviceIdentity = {
  version: string;
  deviceId: string;
  publicKey: string;
  secretKey: string;
};

export type DeviceIdentity = {
  userId: string;
  version: string;
  deviceId: string;
  publicKey: Uint8Array;
  secretKey: Uint8Array;
  publicKeyBase64: string;
};

export type DevicePublicIdentity = {
  userId: string;
  deviceId: string;
  publicKey: string;
  keyVersion: string;
};

export class DeviceIdentityError extends Error {
  code: 'schema_unavailable' | 'identity_unavailable' | 'invalid_identity' | 'sync_failed';

  constructor(code: DeviceIdentityError['code'], message: string) {
    super(message);
    this.name = 'DeviceIdentityError';
    this.code = code;
  }
}

const DEVICE_KEY_VERSION = 'x25519-xsalsa20poly1305-v2';
const DEVICE_ID_KEY_PREFIX = 'wingman_msg_device_id_v2_';
const IDENTITY_KEY_PREFIX = 'wingman_msg_device_identity_v2_';
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const identityCache = new Map<string, DeviceIdentity>();
let prngInitialized = false;

function ensureNaclPrngInitialized(): void {
  if (prngInitialized) {
    return;
  }

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

function getDeviceIdStoreKey(userId: string): string {
  return `${DEVICE_ID_KEY_PREFIX}${userId}`;
}

function getIdentityStoreKey(userId: string): string {
  return `${IDENTITY_KEY_PREFIX}${userId}`;
}

function normalizeQueryError(error: unknown): QueryError | null {
  if (!error || typeof error !== 'object') {
    return null;
  }
  return error as QueryError;
}

function isSchemaUnavailableError(error: unknown): boolean {
  const typed = normalizeQueryError(error);
  const code = String(typed?.code || '');
  if (code === '42P01' || code === '42703') {
    return true;
  }

  const message = String(typed?.message || '').toLowerCase();
  return message.includes('message_device_identities');
}

function validatePublicKey(publicKeyBase64: string): void {
  let decoded: Uint8Array;
  try {
    decoded = decodeBase64(publicKeyBase64);
  } catch {
    throw new DeviceIdentityError('invalid_identity', 'Invalid device key encoding.');
  }

  if (decoded.length !== nacl.box.publicKeyLength) {
    throw new DeviceIdentityError('invalid_identity', 'Invalid device key length.');
  }
}

async function getOrCreateDeviceId(userId: string): Promise<string> {
  const existing = await SecureStore.getItemAsync(getDeviceIdStoreKey(userId), SECURE_STORE_OPTIONS);
  if (existing && existing.trim()) {
    return existing.trim();
  }

  const created = Crypto.randomUUID();
  await SecureStore.setItemAsync(getDeviceIdStoreKey(userId), created, SECURE_STORE_OPTIONS);
  return created;
}

function toDeviceIdentity(userId: string, stored: StoredDeviceIdentity): DeviceIdentity {
  const publicKey = decodeBase64(stored.publicKey);
  const secretKey = decodeBase64(stored.secretKey);

  if (
    publicKey.length !== nacl.box.publicKeyLength
    || secretKey.length !== nacl.box.secretKeyLength
  ) {
    throw new DeviceIdentityError('invalid_identity', 'Invalid stored device identity.');
  }

  return {
    userId,
    version: stored.version,
    deviceId: stored.deviceId,
    publicKey,
    secretKey,
    publicKeyBase64: stored.publicKey,
  };
}

async function loadStoredIdentity(userId: string): Promise<DeviceIdentity | null> {
  const storedRaw = await SecureStore.getItemAsync(getIdentityStoreKey(userId), SECURE_STORE_OPTIONS);
  if (!storedRaw) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedRaw) as StoredDeviceIdentity;
    if (!parsed || parsed.version !== DEVICE_KEY_VERSION || !parsed.deviceId) {
      return null;
    }

    return toDeviceIdentity(userId, parsed);
  } catch {
    return null;
  }
}

async function storeIdentity(identity: DeviceIdentity): Promise<void> {
  const payload: StoredDeviceIdentity = {
    version: identity.version,
    deviceId: identity.deviceId,
    publicKey: identity.publicKeyBase64,
    secretKey: encodeBase64(identity.secretKey),
  };

  await SecureStore.setItemAsync(
    getIdentityStoreKey(identity.userId),
    JSON.stringify(payload),
    SECURE_STORE_OPTIONS,
  );
}

function createIdentity(userId: string, deviceId: string): DeviceIdentity {
  ensureNaclPrngInitialized();
  const keypair = nacl.box.keyPair();

  return {
    userId,
    version: DEVICE_KEY_VERSION,
    deviceId,
    publicKey: keypair.publicKey,
    secretKey: keypair.secretKey,
    publicKeyBase64: encodeBase64(keypair.publicKey),
  };
}

async function syncIdentity(identity: DeviceIdentity): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('message_device_identities')
    .upsert(
      {
        user_id: identity.userId,
        device_id: identity.deviceId,
        public_key: identity.publicKeyBase64,
        key_version: identity.version,
        last_seen_at: now,
        revoked_at: null,
      },
      { onConflict: 'user_id,device_id' },
    );

  if (!error) {
    return;
  }

  if (isSchemaUnavailableError(error)) {
    throw new DeviceIdentityError(
      'schema_unavailable',
      'Messaging device identity schema is not available yet. Apply latest Supabase migrations.',
    );
  }

  throw new DeviceIdentityError('sync_failed', error.message || 'Failed to sync messaging device identity.');
}

export function getMessageV2EncryptionVersion(): string {
  return DEVICE_KEY_VERSION;
}

export async function getOrCreateDeviceIdentity(
  userId: string,
  options: { sync?: boolean } = {},
): Promise<DeviceIdentity> {
  const sync = options.sync !== false;
  if (!userId) {
    throw new DeviceIdentityError('identity_unavailable', 'User is not authenticated.');
  }

  const cached = identityCache.get(userId);
  if (cached) {
    if (sync) {
      await syncIdentity(cached);
    }
    return cached;
  }

  const deviceId = await getOrCreateDeviceId(userId);
  const stored = await loadStoredIdentity(userId);
  const identity = stored || createIdentity(userId, deviceId);

  if (!stored) {
    await storeIdentity(identity);
  }

  if (identity.deviceId !== deviceId) {
    const rebasedIdentity: DeviceIdentity = {
      ...identity,
      deviceId,
    };
    await storeIdentity(rebasedIdentity);
    identityCache.set(userId, rebasedIdentity);
    if (sync) {
      await syncIdentity(rebasedIdentity);
    }
    return rebasedIdentity;
  }

  identityCache.set(userId, identity);
  if (sync) {
    await syncIdentity(identity);
  }

  return identity;
}

export async function heartbeatDeviceIdentity(userId: string): Promise<void> {
  const identity = await getOrCreateDeviceIdentity(userId, { sync: false });
  await syncIdentity(identity);
}

export async function fetchRecipientDeviceIdentities(userIds: string[]): Promise<DevicePublicIdentity[]> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('message_device_identities')
    .select('user_id,device_id,public_key,key_version')
    .in('user_id', uniqueUserIds)
    .is('revoked_at', null);

  if (error) {
    if (isSchemaUnavailableError(error)) {
      throw new DeviceIdentityError(
        'schema_unavailable',
        'Messaging device identity schema is not available yet. Apply latest Supabase migrations.',
      );
    }

    throw new DeviceIdentityError('sync_failed', error.message || 'Failed to fetch recipient device identities.');
  }

  return (data || []).flatMap((row) => {
    const record = row as Record<string, unknown>;
    const userId = typeof record.user_id === 'string' ? record.user_id : '';
    const deviceId = typeof record.device_id === 'string' ? record.device_id : '';
    const publicKey = typeof record.public_key === 'string' ? record.public_key : '';
    const keyVersion = typeof record.key_version === 'string' ? record.key_version : DEVICE_KEY_VERSION;

    if (!userId || !deviceId || !publicKey) {
      return [];
    }

    validatePublicKey(publicKey);
    return [{ userId, deviceId, publicKey, keyVersion }];
  });
}

