import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { Base64 } from 'js-base64';
import nacl from 'tweetnacl';

export type EncryptedMediaPayload = {
  encryptedUri: string;
  mediaKeyBase64: string;
  mediaNonceBase64: string;
  ciphertextSizeBytes: number;
  originalSizeBytes: number;
  sha256: string;
};

export class MediaCryptoError extends Error {
  code:
    | 'read_failed'
    | 'encrypt_failed'
    | 'decrypt_failed'
    | 'write_failed'
    | 'invalid_payload';

  constructor(code: MediaCryptoError['code'], message: string) {
    super(message);
    this.name = 'MediaCryptoError';
    this.code = code;
  }
}

function encodeBase64(bytes: Uint8Array): string {
  return Base64.fromUint8Array(bytes);
}

function decodeBase64(value: string): Uint8Array {
  return Base64.toUint8Array(value);
}

function bytesLengthFromBase64(value: string): number {
  try {
    return decodeBase64(value).length;
  } catch {
    return 0;
  }
}

async function ensureCacheDirectory(): Promise<string> {
  const base = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}wingman-secure-media`;
  if (!base) {
    throw new MediaCryptoError('write_failed', 'Local filesystem cache directory is unavailable.');
  }

  const info = await FileSystem.getInfoAsync(base);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(base, { intermediates: true });
  }

  return base;
}

function generateOutputPath(cacheDirectory: string, suffix: string): string {
  return `${cacheDirectory}/${Date.now()}-${Crypto.randomUUID()}${suffix}`;
}

export async function encryptMediaFile(localUri: string): Promise<EncryptedMediaPayload> {
  if (!localUri) {
    throw new MediaCryptoError('invalid_payload', 'Media URI is required.');
  }

  try {
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo.exists || typeof fileInfo.size !== 'number') {
      throw new MediaCryptoError('read_failed', 'Media file could not be read.');
    }

    const base64Data = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mediaBytes = decodeBase64(base64Data);
    const mediaKey = Crypto.getRandomBytes(nacl.secretbox.keyLength);
    const mediaNonce = Crypto.getRandomBytes(nacl.secretbox.nonceLength);

    const encrypted = nacl.secretbox(mediaBytes, mediaNonce, mediaKey);
    if (!encrypted || encrypted.length === 0) {
      throw new MediaCryptoError('encrypt_failed', 'Media encryption failed.');
    }

    const encryptedBase64 = encodeBase64(encrypted);
    const cacheDirectory = await ensureCacheDirectory();
    const encryptedPath = generateOutputPath(cacheDirectory, '.enc');

    await FileSystem.writeAsStringAsync(encryptedPath, encryptedBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const sha256 = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      encryptedBase64,
      { encoding: Crypto.CryptoEncoding.HEX },
    );

    return {
      encryptedUri: encryptedPath,
      mediaKeyBase64: encodeBase64(mediaKey),
      mediaNonceBase64: encodeBase64(mediaNonce),
      ciphertextSizeBytes: bytesLengthFromBase64(encryptedBase64),
      originalSizeBytes: typeof fileInfo.size === 'number' ? fileInfo.size : mediaBytes.length,
      sha256,
    };
  } catch (error) {
    if (error instanceof MediaCryptoError) {
      throw error;
    }
    throw new MediaCryptoError('encrypt_failed', error instanceof Error ? error.message : 'Media encryption failed.');
  }
}

export async function decryptMediaFileToCache(params: {
  encryptedUri: string;
  mediaKeyBase64: string;
  mediaNonceBase64: string;
  outputExtension?: string;
}): Promise<string> {
  const { encryptedUri, mediaKeyBase64, mediaNonceBase64, outputExtension = '.bin' } = params;
  if (!encryptedUri || !mediaKeyBase64 || !mediaNonceBase64) {
    throw new MediaCryptoError('invalid_payload', 'Missing media decryption payload.');
  }

  try {
    const encryptedBase64 = await FileSystem.readAsStringAsync(encryptedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const encryptedBytes = decodeBase64(encryptedBase64);
    const mediaKey = decodeBase64(mediaKeyBase64);
    const mediaNonce = decodeBase64(mediaNonceBase64);

    const opened = nacl.secretbox.open(encryptedBytes, mediaNonce, mediaKey);
    if (!opened) {
      throw new MediaCryptoError('decrypt_failed', 'Unable to decrypt media for this device.');
    }

    const decryptedBase64 = encodeBase64(opened);
    const cacheDirectory = await ensureCacheDirectory();
    const outputPath = generateOutputPath(cacheDirectory, outputExtension.startsWith('.') ? outputExtension : `.${outputExtension}`);

    await FileSystem.writeAsStringAsync(outputPath, decryptedBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return outputPath;
  } catch (error) {
    if (error instanceof MediaCryptoError) {
      throw error;
    }
    throw new MediaCryptoError('decrypt_failed', error instanceof Error ? error.message : 'Media decryption failed.');
  }
}
