import * as Crypto from 'expo-crypto';
import { Base64 } from 'js-base64';
import nacl from 'tweetnacl';
import type { DeviceIdentity } from './deviceIdentity';
import { getMessageV2EncryptionVersion } from './deviceIdentity';

export type RecipientDevice = {
  userId: string;
  deviceId: string;
  publicKey: string;
  keyVersion: string;
};

export type MessageKeyBoxPayload = {
  recipient_user_id: string;
  recipient_device_id: string;
  wrapped_key: string;
  wrapped_key_nonce: string;
  sender_public_key: string;
  sender_key_version: string;
};

export type EncryptedMessageEnvelope = {
  ciphertext: string;
  ciphertextNonce: string;
  ciphertextVersion: string;
  previewCiphertext?: string;
  previewNonce?: string;
  keyBoxes: MessageKeyBoxPayload[];
};

export class MessageCryptoV2Error extends Error {
  code:
    | 'invalid_recipient'
    | 'invalid_payload'
    | 'decrypt_failed'
    | 'missing_key_box';

  constructor(code: MessageCryptoV2Error['code'], message: string) {
    super(message);
    this.name = 'MessageCryptoV2Error';
    this.code = code;
  }
}

let prngInitialized = false;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

function validateRecipient(recipient: RecipientDevice): void {
  if (!recipient.userId || !recipient.deviceId || !recipient.publicKey) {
    throw new MessageCryptoV2Error('invalid_recipient', 'Recipient device identity is incomplete.');
  }

  let decoded: Uint8Array;
  try {
    decoded = decodeBase64(recipient.publicKey);
  } catch {
    throw new MessageCryptoV2Error('invalid_recipient', 'Recipient device public key is invalid.');
  }

  if (decoded.length !== nacl.box.publicKeyLength) {
    throw new MessageCryptoV2Error('invalid_recipient', 'Recipient device public key has an invalid length.');
  }
}

function encryptWithSymmetricKey(
  plaintext: string,
  key: Uint8Array,
): { ciphertext: string; nonce: string } {
  ensureNaclPrngInitialized();
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const payload = textEncoder.encode(plaintext);
  const encrypted = nacl.secretbox(payload, nonce, key);

  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

function decryptWithSymmetricKey(
  ciphertextBase64: string,
  nonceBase64: string,
  key: Uint8Array,
): string | null {
  try {
    const ciphertext = decodeBase64(ciphertextBase64);
    const nonce = decodeBase64(nonceBase64);
    const opened = nacl.secretbox.open(ciphertext, nonce, key);
    if (!opened) {
      return null;
    }
    return textDecoder.decode(opened);
  } catch {
    return null;
  }
}

function buildPreviewText(plaintext: string): string {
  const trimmed = plaintext.trim();
  if (trimmed.length <= 80) {
    return trimmed;
  }
  return `${trimmed.slice(0, 77)}...`;
}

export function createClientMessageId(): string {
  return Crypto.randomUUID();
}

export function createEncryptedMessageEnvelope(params: {
  plaintext: string;
  senderIdentity: DeviceIdentity;
  recipients: RecipientDevice[];
  includeEncryptedPreview?: boolean;
}): EncryptedMessageEnvelope {
  const { plaintext, senderIdentity, recipients, includeEncryptedPreview = true } = params;
  const normalizedPlaintext = plaintext.trim();
  if (!normalizedPlaintext) {
    throw new MessageCryptoV2Error('invalid_payload', 'Message plaintext cannot be empty.');
  }

  if (!senderIdentity.publicKeyBase64 || !senderIdentity.secretKey) {
    throw new MessageCryptoV2Error('invalid_payload', 'Sender device identity is not initialized.');
  }

  const uniqueRecipients = Array.from(
    new Map(recipients.map((recipient) => [`${recipient.userId}:${recipient.deviceId}`, recipient])).values(),
  );

  if (uniqueRecipients.length === 0) {
    throw new MessageCryptoV2Error('invalid_recipient', 'At least one recipient device is required.');
  }

  uniqueRecipients.forEach(validateRecipient);
  ensureNaclPrngInitialized();

  const contentKey = nacl.randomBytes(nacl.secretbox.keyLength);
  const encryptedMessage = encryptWithSymmetricKey(normalizedPlaintext, contentKey);

  const keyBoxes: MessageKeyBoxPayload[] = uniqueRecipients.map((recipient) => {
    const recipientPublicKey = decodeBase64(recipient.publicKey);
    const wrapNonce = nacl.randomBytes(nacl.box.nonceLength);
    const wrapped = nacl.box(contentKey, wrapNonce, recipientPublicKey, senderIdentity.secretKey);

    return {
      recipient_user_id: recipient.userId,
      recipient_device_id: recipient.deviceId,
      wrapped_key: encodeBase64(wrapped),
      wrapped_key_nonce: encodeBase64(wrapNonce),
      sender_public_key: senderIdentity.publicKeyBase64,
      sender_key_version: senderIdentity.version || getMessageV2EncryptionVersion(),
    };
  });

  if (!includeEncryptedPreview) {
    return {
      ciphertext: encryptedMessage.ciphertext,
      ciphertextNonce: encryptedMessage.nonce,
      ciphertextVersion: getMessageV2EncryptionVersion(),
      keyBoxes,
    };
  }

  const encryptedPreview = encryptWithSymmetricKey(buildPreviewText(normalizedPlaintext), contentKey);

  return {
    ciphertext: encryptedMessage.ciphertext,
    ciphertextNonce: encryptedMessage.nonce,
    ciphertextVersion: getMessageV2EncryptionVersion(),
    previewCiphertext: encryptedPreview.ciphertext,
    previewNonce: encryptedPreview.nonce,
    keyBoxes,
  };
}

export function decryptMessageEnvelopeForDevice(params: {
  ciphertext: string;
  ciphertextNonce: string;
  senderPublicKey: string;
  wrappedKey: string;
  wrappedKeyNonce: string;
  recipientSecretKey: Uint8Array;
}): string {
  const {
    ciphertext,
    ciphertextNonce,
    senderPublicKey,
    wrappedKey,
    wrappedKeyNonce,
    recipientSecretKey,
  } = params;

  let senderPublicKeyBytes: Uint8Array;
  let wrappedKeyBytes: Uint8Array;
  let wrappedKeyNonceBytes: Uint8Array;

  try {
    senderPublicKeyBytes = decodeBase64(senderPublicKey);
    wrappedKeyBytes = decodeBase64(wrappedKey);
    wrappedKeyNonceBytes = decodeBase64(wrappedKeyNonce);
  } catch {
    throw new MessageCryptoV2Error('invalid_payload', 'Message key box is malformed.');
  }

  if (
    senderPublicKeyBytes.length !== nacl.box.publicKeyLength
    || wrappedKeyNonceBytes.length !== nacl.box.nonceLength
  ) {
    throw new MessageCryptoV2Error('invalid_payload', 'Message key box contains invalid key lengths.');
  }

  const contentKey = nacl.box.open(
    wrappedKeyBytes,
    wrappedKeyNonceBytes,
    senderPublicKeyBytes,
    recipientSecretKey,
  );

  if (!contentKey) {
    throw new MessageCryptoV2Error('decrypt_failed', 'Unable to unwrap message key for this device.');
  }

  const decrypted = decryptWithSymmetricKey(ciphertext, ciphertextNonce, contentKey);
  if (decrypted === null) {
    throw new MessageCryptoV2Error('decrypt_failed', 'Unable to decrypt message content for this device.');
  }

  return decrypted;
}

