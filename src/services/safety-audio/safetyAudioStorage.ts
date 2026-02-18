import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type {
  SafetyAudioRecording,
  SafetyAudioStorageStatus,
} from '../../types';

const SAFETY_AUDIO_INDEX_KEY = 'wingman.safety_audio.index.v1';
const SAFETY_AUDIO_DIRECTORY_NAME = 'safety-audio';
const WARNING_THRESHOLD_BYTES = 500 * 1024 * 1024;
const CRITICAL_THRESHOLD_BYTES = 200 * 1024 * 1024;
const RETENTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type SafetyAudioContextType = SafetyAudioRecording['contextType'];
type SafetyAudioSource = SafetyAudioRecording['source'];

function getBaseDirectory(): string {
  const base = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
  if (!base) {
    throw new Error('Safety audio storage directory is unavailable on this device.');
  }
  return base;
}

export function getSafetyAudioRootDirectory(): string {
  return `${getBaseDirectory()}${SAFETY_AUDIO_DIRECTORY_NAME}/`;
}

export async function ensureSafetyAudioRootDirectory(): Promise<string> {
  const rootDirectory = getSafetyAudioRootDirectory();
  const info = await FileSystem.getInfoAsync(rootDirectory);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(rootDirectory, { intermediates: true });
  }
  return rootDirectory;
}

export async function ensureSafetyAudioSessionDirectory(sessionId: string): Promise<string> {
  const rootDirectory = await ensureSafetyAudioRootDirectory();
  const normalizedSessionId = sessionId.trim() || 'default';
  const sessionDirectory = `${rootDirectory}${normalizedSessionId}/`;
  const info = await FileSystem.getInfoAsync(sessionDirectory);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(sessionDirectory, { intermediates: true });
  }
  return sessionDirectory;
}

function parseTimestamp(value: unknown): number {
  const parsed = new Date(String(value || '')).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecordContextType(value: unknown): value is SafetyAudioContextType {
  return value === 'booking' || value === 'live_location' || value === 'manual';
}

function isRecordSource(value: unknown): value is SafetyAudioSource {
  return (
    value === 'manual'
    || value === 'auto_booking'
    || value === 'auto_live_location'
    || value === 'restarted'
  );
}

function normalizeRecording(value: unknown): SafetyAudioRecording | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  const uri = typeof row.uri === 'string' ? row.uri : '';
  const createdAt = typeof row.createdAt === 'string' ? row.createdAt : '';
  const expiresAt = typeof row.expiresAt === 'string' ? row.expiresAt : '';
  const durationMs = Number(row.durationMs || 0);
  const sizeBytes = Number(row.sizeBytes || 0);
  const contextType = row.contextType;
  const source = row.source;

  if (!id || !uri || !createdAt || !expiresAt || !isRecordContextType(contextType) || !isRecordSource(source)) {
    return null;
  }

  return {
    id,
    uri,
    createdAt,
    expiresAt,
    durationMs: Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0,
    sizeBytes: Number.isFinite(sizeBytes) && sizeBytes >= 0 ? sizeBytes : 0,
    contextType,
    contextId: typeof row.contextId === 'string' && row.contextId.trim().length > 0
      ? row.contextId
      : null,
    source,
  };
}

function sortRecordings(recordings: SafetyAudioRecording[]): SafetyAudioRecording[] {
  return [...recordings].sort((left, right) => parseTimestamp(right.createdAt) - parseTimestamp(left.createdAt));
}

async function writeIndex(recordings: SafetyAudioRecording[]): Promise<void> {
  await AsyncStorage.setItem(SAFETY_AUDIO_INDEX_KEY, JSON.stringify(sortRecordings(recordings)));
}

export async function readSafetyAudioIndex(): Promise<SafetyAudioRecording[]> {
  try {
    const raw = await AsyncStorage.getItem(SAFETY_AUDIO_INDEX_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortRecordings(parsed.map(normalizeRecording).filter((item): item is SafetyAudioRecording => !!item));
  } catch (error) {
    console.error('Unable to read local safety audio index', error);
    return [];
  }
}

export async function listSafetyAudioRecordings(): Promise<SafetyAudioRecording[]> {
  const recordings = await readSafetyAudioIndex();
  return sortRecordings(recordings);
}

export async function saveSafetyAudioIndex(recordings: SafetyAudioRecording[]): Promise<void> {
  await writeIndex(recordings);
}

export async function addSafetyAudioRecording(recording: SafetyAudioRecording): Promise<SafetyAudioRecording[]> {
  const existing = await readSafetyAudioIndex();
  const next = [
    recording,
    ...existing.filter((item) => item.id !== recording.id),
  ];
  await writeIndex(next);
  return sortRecordings(next);
}

export async function deleteSafetyAudioFile(uri: string): Promise<void> {
  if (!uri) {
    return;
  }

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch (error) {
    console.error('Unable to delete local safety audio file', error);
  }
}

export async function removeSafetyAudioRecording(
  recordingId: string,
  options: { deleteFile?: boolean } = {},
): Promise<SafetyAudioRecording[]> {
  const existing = await readSafetyAudioIndex();
  const target = existing.find((item) => item.id === recordingId) || null;
  const next = existing.filter((item) => item.id !== recordingId);
  await writeIndex(next);

  if (target && options.deleteFile !== false) {
    await deleteSafetyAudioFile(target.uri);
  }

  return sortRecordings(next);
}

export async function removeSafetyAudioRecordingsByIds(
  recordingIds: string[],
  options: { deleteFiles?: boolean } = {},
): Promise<SafetyAudioRecording[]> {
  if (recordingIds.length === 0) {
    return listSafetyAudioRecordings();
  }

  const targetIds = new Set(recordingIds);
  const existing = await readSafetyAudioIndex();
  const toRemove = existing.filter((item) => targetIds.has(item.id));
  const next = existing.filter((item) => !targetIds.has(item.id));
  await writeIndex(next);

  if (options.deleteFiles !== false) {
    await Promise.allSettled(toRemove.map((item) => deleteSafetyAudioFile(item.uri)));
  }

  return sortRecordings(next);
}

export function computeSafetyAudioExpiryIso(createdAtIso: string): string {
  const createdAtMs = parseTimestamp(createdAtIso);
  const safeCreatedAtMs = createdAtMs > 0 ? createdAtMs : Date.now();
  return new Date(safeCreatedAtMs + RETENTION_WINDOW_MS).toISOString();
}

export async function persistSafetyAudioSegmentFromTemp(params: {
  tempUri: string;
  sessionId: string;
  createdAtIso?: string;
  durationMs?: number;
  contextType: SafetyAudioContextType;
  contextId?: string | null;
  source: SafetyAudioSource;
}): Promise<SafetyAudioRecording> {
  const createdAtIso = params.createdAtIso || new Date().toISOString();
  const sessionDirectory = await ensureSafetyAudioSessionDirectory(params.sessionId);
  const safeTimestamp = createdAtIso.replace(/[:.]/g, '-');
  const recordingId = `safety-audio-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
  const nextUri = `${sessionDirectory}${safeTimestamp}-${recordingId}.m4a`;

  await FileSystem.moveAsync({
    from: params.tempUri,
    to: nextUri,
  });

  const fileInfo = await FileSystem.getInfoAsync(nextUri);
  const sizeBytes = fileInfo.exists && typeof fileInfo.size === 'number'
    ? fileInfo.size
    : 0;

  const recording: SafetyAudioRecording = {
    id: recordingId,
    uri: nextUri,
    createdAt: createdAtIso,
    expiresAt: computeSafetyAudioExpiryIso(createdAtIso),
    durationMs: Number.isFinite(params.durationMs) && Number(params.durationMs) > 0
      ? Number(params.durationMs)
      : 0,
    sizeBytes,
    contextType: params.contextType,
    contextId: params.contextId || null,
    source: params.source,
  };

  await addSafetyAudioRecording(recording);

  return recording;
}

export async function removeMissingSafetyAudioFiles(): Promise<{
  removedCount: number;
  remaining: SafetyAudioRecording[];
}> {
  const existing = await readSafetyAudioIndex();
  if (existing.length === 0) {
    return { removedCount: 0, remaining: [] };
  }

  const checks = await Promise.all(existing.map(async (recording) => {
    const info = await FileSystem.getInfoAsync(recording.uri);
    return {
      recording,
      exists: !!info.exists,
    };
  }));

  const missingIds = checks
    .filter((item) => !item.exists)
    .map((item) => item.recording.id);

  if (missingIds.length === 0) {
    return {
      removedCount: 0,
      remaining: sortRecordings(existing),
    };
  }

  const remaining = await removeSafetyAudioRecordingsByIds(missingIds, { deleteFiles: false });
  return {
    removedCount: missingIds.length,
    remaining,
  };
}

export async function getSafetyAudioStorageStatus(): Promise<SafetyAudioStorageStatus> {
  let freeBytes: number | null = null;

  try {
    const value = await FileSystem.getFreeDiskStorageAsync();
    freeBytes = Number.isFinite(value) ? Number(value) : null;
  } catch (error) {
    console.error('Unable to determine free disk space for safety audio recording', error);
  }

  return {
    freeBytes,
    warning: typeof freeBytes === 'number' ? freeBytes < WARNING_THRESHOLD_BYTES : false,
    critical: typeof freeBytes === 'number' ? freeBytes < CRITICAL_THRESHOLD_BYTES : false,
    warningThresholdBytes: WARNING_THRESHOLD_BYTES,
    criticalThresholdBytes: CRITICAL_THRESHOLD_BYTES,
  };
}

