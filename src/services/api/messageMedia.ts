import * as FileSystem from 'expo-file-system/legacy';
import { invokeEdgeFunction } from '../supabase';

export type CreateMediaUploadUrlRequest = {
  conversationId: string;
  mediaKind: 'image' | 'video';
  ciphertextSizeBytes: number;
  durationMs?: number;
};

export type CreateMediaUploadUrlResponse = {
  bucket: string;
  objectPath: string;
  signedUrl: string;
  token?: string;
  path?: string;
  maxCiphertextBytes: number;
  maxVideoDurationMs: number;
};

export type GetMediaDownloadUrlResponse = {
  signedUrl: string;
  thumbnailSignedUrl?: string | null;
  expiresIn: number;
};

export class MessageMediaError extends Error {
  code:
    | 'upload_url_failed'
    | 'upload_failed'
    | 'download_url_failed'
    | 'download_failed'
    | 'report_failed';

  constructor(code: MessageMediaError['code'], message: string) {
    super(message);
    this.name = 'MessageMediaError';
    this.code = code;
  }
}

export async function createMediaUploadUrl(
  payload: CreateMediaUploadUrlRequest,
): Promise<CreateMediaUploadUrlResponse> {
  const { data, error } = await invokeEdgeFunction<CreateMediaUploadUrlResponse>(
    'create-media-upload-url',
    payload as unknown as Record<string, unknown>,
  );

  if (error || !data?.signedUrl || !data.objectPath || !data.bucket) {
    throw new MessageMediaError(
      'upload_url_failed',
      error?.message || 'Unable to prepare secure media upload.',
    );
  }

  return data;
}

export async function uploadEncryptedMediaFile(params: {
  encryptedUri: string;
  signedUrl: string;
}): Promise<void> {
  const { encryptedUri, signedUrl } = params;
  if (!encryptedUri || !signedUrl) {
    throw new MessageMediaError('upload_failed', 'Encrypted media payload is incomplete.');
  }

  try {
    const result = await FileSystem.uploadAsync(signedUrl, encryptedUri, {
      httpMethod: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Upload returned HTTP ${result.status}`);
    }
  } catch (error) {
    throw new MessageMediaError(
      'upload_failed',
      error instanceof Error ? error.message : 'Unable to upload encrypted media.',
    );
  }
}

export async function getMediaDownloadUrl(objectPath: string): Promise<GetMediaDownloadUrlResponse> {
  const { data, error } = await invokeEdgeFunction<GetMediaDownloadUrlResponse>(
    'get-media-download-url',
    { objectPath },
  );

  if (error || !data?.signedUrl) {
    throw new MessageMediaError(
      'download_url_failed',
      error?.message || 'Unable to fetch secure media URL.',
    );
  }

  return data;
}

export async function downloadEncryptedMediaToCache(signedUrl: string): Promise<string> {
  if (!signedUrl) {
    throw new MessageMediaError('download_failed', 'Signed download URL is required.');
  }

  try {
    const cacheDirectory = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}wingman-secure-media`;
    const cacheInfo = await FileSystem.getInfoAsync(cacheDirectory);
    if (!cacheInfo.exists) {
      await FileSystem.makeDirectoryAsync(cacheDirectory, { intermediates: true });
    }

    const fileUri = `${cacheDirectory}/${Date.now()}-${Math.round(Math.random() * 1_000_000)}.enc`;
    const result = await FileSystem.downloadAsync(signedUrl, fileUri);
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Download returned HTTP ${result.status}`);
    }

    return result.uri;
  } catch (error) {
    throw new MessageMediaError(
      'download_failed',
      error instanceof Error ? error.message : 'Unable to download encrypted media.',
    );
  }
}

export async function reportEncryptedMessage(payload: {
  reason: string;
  messageId?: string;
  conversationId?: string;
  notes?: string;
  disclosedPlaintext?: string;
  disclosedCiphertext?: string;
  disclosedAttachmentPaths?: string[];
}): Promise<{ reportId: string; createdAt: string; disclosureProvided: boolean }> {
  const { data, error } = await invokeEdgeFunction<{
    reportId: string;
    createdAt: string;
    disclosureProvided: boolean;
  }>('report-encrypted-message', payload as unknown as Record<string, unknown>);

  if (error || !data?.reportId) {
    throw new MessageMediaError(
      'report_failed',
      error?.message || 'Unable to submit encrypted report right now.',
    );
  }

  return data;
}
