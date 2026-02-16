import * as ImagePicker from 'expo-image-picker';
import { VIDEO_MAX_DURATION_MS } from './compression';

export type PickedMediaAsset = {
  uri: string;
  kind: 'image' | 'video';
  width?: number;
  height?: number;
  durationMs?: number;
  fileSize?: number;
  mimeType?: string;
  fileName?: string;
};

export class MediaPickerError extends Error {
  code: 'permission_denied' | 'cancelled' | 'invalid_media' | 'duration_exceeded';

  constructor(code: MediaPickerError['code'], message: string) {
    super(message);
    this.name = 'MediaPickerError';
    this.code = code;
  }
}

function normalizeDurationMs(duration?: number): number | undefined {
  if (!duration || !Number.isFinite(duration)) {
    return undefined;
  }

  if (duration > 1000) {
    return Math.round(duration);
  }

  return Math.round(duration * 1000);
}

async function ensureLibraryPermission(): Promise<void> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) {
    return;
  }

  const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!requested.granted) {
    throw new MediaPickerError('permission_denied', 'Photo library permission is required to send media.');
  }
}

function mapAsset(asset: ImagePicker.ImagePickerAsset, expectedKind: 'image' | 'video'): PickedMediaAsset {
  const type = asset.type === 'video' ? 'video' : 'image';
  if (type !== expectedKind) {
    throw new MediaPickerError('invalid_media', `Please select a ${expectedKind} file.`);
  }

  const durationMs = normalizeDurationMs(asset.duration ?? undefined);
  if (type === 'video' && durationMs && durationMs > VIDEO_MAX_DURATION_MS) {
    throw new MediaPickerError('duration_exceeded', 'Video must be 60 seconds or less.');
  }

  return {
    uri: asset.uri,
    kind: type,
    width: asset.width,
    height: asset.height,
    durationMs,
    fileSize: asset.fileSize,
    mimeType: asset.mimeType ?? undefined,
    fileName: asset.fileName ?? undefined,
  };
}

export async function pickImageForMessaging(): Promise<PickedMediaAsset> {
  await ensureLibraryPermission();

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 1,
    selectionLimit: 1,
  });

  if (result.canceled || !result.assets?.[0]) {
    throw new MediaPickerError('cancelled', 'Image selection was cancelled.');
  }

  return mapAsset(result.assets[0], 'image');
}

export async function pickVideoForMessaging(): Promise<PickedMediaAsset> {
  await ensureLibraryPermission();

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    allowsEditing: false,
    quality: 1,
    selectionLimit: 1,
  });

  if (result.canceled || !result.assets?.[0]) {
    throw new MediaPickerError('cancelled', 'Video selection was cancelled.');
  }

  return mapAsset(result.assets[0], 'video');
}

