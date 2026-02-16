import * as FileSystem from 'expo-file-system';
import { supportsNativeMediaCompression } from '../../config/runtime';

type CompressorModule = {
  Image: {
    compress: (value: string, options?: Record<string, unknown>) => Promise<string>;
  };
  Video: {
    compress: (
      fileUrl: string,
      options?: Record<string, unknown>,
      onProgress?: (progress: number) => void,
    ) => Promise<string>;
  };
  getVideoMetaData: (filePath: string) => Promise<{
    duration?: number;
    width?: number;
    height?: number;
  }>;
};

let compressorModuleCache: CompressorModule | null = null;

function getCompressorModule(): CompressorModule {
  if (!supportsNativeMediaCompression) {
    throw new MediaCompressionError(
      'unsupported_runtime',
      'Media compression requires a development or production build. Expo Go is unsupported.',
    );
  }

  if (!compressorModuleCache) {
    // Lazy import so Expo Go can boot without loading an unlinked native module.
    compressorModuleCache = require('react-native-compressor') as CompressorModule;
  }

  return compressorModuleCache;
}

export const VIDEO_MAX_DURATION_MS = 60_000;
export const VIDEO_MAX_CIPHERTEXT_BYTES = 20 * 1024 * 1024;
export const VIDEO_TARGET_BITRATE = 1_800_000;
export const IMAGE_MAX_EDGE = 1600;
export const IMAGE_TARGET_QUALITY = 0.75;
export const IMAGE_MAX_BYTES = 3 * 1024 * 1024;

export class MediaCompressionError extends Error {
  code:
    | 'unsupported_runtime'
    | 'invalid_media'
    | 'duration_exceeded'
    | 'compression_failed'
    | 'size_exceeded';

  constructor(code: MediaCompressionError['code'], message: string) {
    super(message);
    this.name = 'MediaCompressionError';
    this.code = code;
  }
}

export type CompressedVideoResult = {
  uri: string;
  sizeBytes: number;
  durationMs: number;
};

export type CompressedImageResult = {
  uri: string;
  sizeBytes: number;
  width?: number;
  height?: number;
};

async function getFileSizeBytes(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || typeof info.size !== 'number') {
    throw new MediaCompressionError('invalid_media', 'Selected media file could not be read.');
  }
  return info.size;
}

function assertSupportedRuntimeForVideo(): void {
  if (!supportsNativeMediaCompression) {
    throw new MediaCompressionError(
      'unsupported_runtime',
      'Video messaging requires a development or production build. Expo Go is unsupported.',
    );
  }
}

export async function compressVideoForMessaging(
  sourceUri: string,
  providedDurationMs?: number,
): Promise<CompressedVideoResult> {
  assertSupportedRuntimeForVideo();
  if (!sourceUri) {
    throw new MediaCompressionError('invalid_media', 'Video URI is required.');
  }

  let durationMs = providedDurationMs || 0;
  const compressor = getCompressorModule();
  if (durationMs <= 0) {
    try {
      const metadata = await compressor.getVideoMetaData(sourceUri);
      durationMs = Math.max(0, Math.round(Number(metadata?.duration || 0) * 1000));
    } catch {
      // Metadata read failures should not block compression; duration is re-checked post-compress.
    }
  }

  if (durationMs > VIDEO_MAX_DURATION_MS) {
    throw new MediaCompressionError('duration_exceeded', 'Video must be 60 seconds or less.');
  }

  let compressedUri: string;
  try {
    compressedUri = await compressor.Video.compress(
      sourceUri,
      {
        compressionMethod: 'manual',
        bitrate: VIDEO_TARGET_BITRATE,
        // This library uses maxSize as a coarse upper bound; 720 helps maintain <=720p output in practice.
        maxSize: 720,
      },
      undefined,
    );
  } catch (error) {
    throw new MediaCompressionError(
      'compression_failed',
      error instanceof Error ? error.message : 'Video compression failed.',
    );
  }

  const compressedSizeBytes = await getFileSizeBytes(compressedUri);
  if (compressedSizeBytes > VIDEO_MAX_CIPHERTEXT_BYTES) {
    throw new MediaCompressionError(
      'size_exceeded',
      'Compressed video is larger than 20MB. Please choose a shorter or lower-motion clip.',
    );
  }

  if (durationMs <= 0) {
    try {
      const compressedMetadata = await compressor.getVideoMetaData(compressedUri);
      durationMs = Math.max(0, Math.round(Number(compressedMetadata?.duration || 0) * 1000));
    } catch {
      durationMs = providedDurationMs || 0;
    }
  }

  if (durationMs > VIDEO_MAX_DURATION_MS) {
    throw new MediaCompressionError('duration_exceeded', 'Video must be 60 seconds or less.');
  }

  return {
    uri: compressedUri,
    sizeBytes: compressedSizeBytes,
    durationMs,
  };
}

export async function compressImageForMessaging(sourceUri: string): Promise<CompressedImageResult> {
  if (!sourceUri) {
    throw new MediaCompressionError('invalid_media', 'Image URI is required.');
  }

  let compressedUri = sourceUri;
  if (supportsNativeMediaCompression) {
    try {
      const compressor = getCompressorModule();
      compressedUri = await compressor.Image.compress(sourceUri, {
        compressionMethod: 'manual',
        maxWidth: IMAGE_MAX_EDGE,
        maxHeight: IMAGE_MAX_EDGE,
        quality: IMAGE_TARGET_QUALITY,
        output: 'jpg',
        returnableOutputType: 'uri',
      });
    } catch (error) {
      throw new MediaCompressionError(
        'compression_failed',
        error instanceof Error ? error.message : 'Image compression failed.',
      );
    }
  }

  const compressedSizeBytes = await getFileSizeBytes(compressedUri);
  if (compressedSizeBytes > IMAGE_MAX_BYTES) {
    throw new MediaCompressionError(
      'size_exceeded',
      'Compressed image is larger than 3MB. Please choose a smaller image.',
    );
  }

  return {
    uri: compressedUri,
    sizeBytes: compressedSizeBytes,
  };
}
