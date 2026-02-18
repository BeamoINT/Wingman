import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../supabase';
import {
  SafetyAudioCloudError,
  completeSafetyAudioAutoDownload,
  createSafetyAudioUploadUrl,
  downloadSafetyAudioCloudRecordingToLocalFile,
  getSafetyAudioDownloadUrl,
  listPendingSafetyAudioAutoDownloads,
  markSafetyAudioCloudUploadComplete,
  markSafetyAudioCloudUploadFailed,
  type SafetyAudioCloudRecording,
} from '../api/safetyAudioCloudApi';
import { trackEvent } from '../monitoring/events';
import type {
  SafetyAudioCloudSyncSnapshot,
  SafetyAudioRecording,
} from '../../types';
import {
  ensureSafetyAudioRootDirectory,
  persistSafetyAudioSegmentFromTemp,
  updateSafetyAudioRecordingCloudSync,
} from './safetyAudioStorage';

const UPLOAD_QUEUE_STORAGE_KEY = 'wingman.safety_audio.cloud.upload_queue.v1';
const AUTO_DOWNLOAD_DIRECTORY = 'cloud-auto-downloads';
const MAX_RETRY_ATTEMPTS = 6;
const BASE_RETRY_DELAY_MS = 15_000;

type QueueItemStatus = 'queued' | 'uploading' | 'failed';

type QueueItem = {
  localRecordingId: string;
  localUri: string;
  sizeBytes: number;
  durationMs: number;
  recordedAt: string;
  contextType: 'booking' | 'live_location' | 'manual';
  contextId: string | null;
  source: 'manual' | 'auto_booking' | 'auto_live_location' | 'restarted';
  status: QueueItemStatus;
  attemptCount: number;
  nextRetryAt: string | null;
  lastError: string | null;
  cloudRecordingId: string | null;
  updatedAt: string;
};

type CloudSyncConfig = {
  isProActive: boolean;
  hasCloudReadAccess: boolean;
  wifiOnlyUpload: boolean;
  isConnected: boolean;
  isWifi: boolean;
};

type QueueListener = (snapshot: SafetyAudioCloudSyncSnapshot) => void;

let config: CloudSyncConfig = {
  isProActive: false,
  hasCloudReadAccess: false,
  wifiOnlyUpload: false,
  isConnected: true,
  isWifi: true,
};

let queue: QueueItem[] = [];
let queueLoaded = false;
let processingPromise: Promise<void> | null = null;
let activeUploadLocalRecordingId: string | null = null;
let activeUploadProgress = 0;
let state: SafetyAudioCloudSyncSnapshot['state'] = 'idle';
let lastError: string | null = null;

const listeners = new Set<QueueListener>();

function nowIso(): string {
  return new Date().toISOString();
}

function parseIso(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeQueueItem(value: unknown): QueueItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const localRecordingId = typeof row.localRecordingId === 'string' ? row.localRecordingId.trim() : '';
  const localUri = typeof row.localUri === 'string' ? row.localUri.trim() : '';
  if (!localRecordingId || !localUri) {
    return null;
  }

  const status = row.status === 'uploading' || row.status === 'failed' ? row.status : 'queued';
  const contextType = row.contextType === 'booking' || row.contextType === 'live_location' ? row.contextType : 'manual';
  const source = row.source === 'auto_booking'
    || row.source === 'auto_live_location'
    || row.source === 'restarted'
    ? row.source
    : 'manual';

  return {
    localRecordingId,
    localUri,
    sizeBytes: Math.max(0, Number(row.sizeBytes || 0)),
    durationMs: Math.max(0, Number(row.durationMs || 0)),
    recordedAt: typeof row.recordedAt === 'string' && row.recordedAt ? row.recordedAt : nowIso(),
    contextType,
    contextId: typeof row.contextId === 'string' && row.contextId.trim().length > 0 ? row.contextId : null,
    source,
    status,
    attemptCount: Math.max(0, Number(row.attemptCount || 0)),
    nextRetryAt: typeof row.nextRetryAt === 'string' && row.nextRetryAt ? row.nextRetryAt : null,
    lastError: typeof row.lastError === 'string' ? row.lastError : null,
    cloudRecordingId: typeof row.cloudRecordingId === 'string' && row.cloudRecordingId.trim().length > 0
      ? row.cloudRecordingId
      : null,
    updatedAt: typeof row.updatedAt === 'string' && row.updatedAt ? row.updatedAt : nowIso(),
  };
}

function getSnapshot(): SafetyAudioCloudSyncSnapshot {
  const uploadingCount = queue.filter((item) => item.status === 'uploading').length;

  return {
    state,
    queueCount: queue.length,
    uploadingCount,
    activeUploadLocalRecordingId,
    activeUploadProgress,
    lastError,
  };
}

function notifyListeners(): void {
  const snapshot = getSnapshot();
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch {
      // ignore listener failures
    }
  }
}

async function persistQueue(): Promise<void> {
  await AsyncStorage.setItem(UPLOAD_QUEUE_STORAGE_KEY, JSON.stringify(queue));
}

async function loadQueue(): Promise<void> {
  if (queueLoaded) {
    return;
  }

  queueLoaded = true;
  try {
    const raw = await AsyncStorage.getItem(UPLOAD_QUEUE_STORAGE_KEY);
    if (!raw) {
      queue = [];
      return;
    }

    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) {
      queue = [];
      return;
    }

    queue = parsed
      .map(normalizeQueueItem)
      .filter((item): item is QueueItem => !!item)
      .sort((left, right) => parseIso(left.recordedAt) - parseIso(right.recordedAt));
  } catch {
    queue = [];
  }
}

function resolvePauseState(): SafetyAudioCloudSyncSnapshot['state'] | null {
  if (!config.isProActive) {
    return 'paused_non_pro';
  }

  if (!config.isConnected) {
    return 'paused_network';
  }

  if (config.wifiOnlyUpload && !config.isWifi) {
    return 'paused_wifi_only';
  }

  return null;
}

function isEligibleLocalRecording(recording: SafetyAudioRecording): boolean {
  return (
    recording.source !== 'cloud_download'
    && recording.uri.trim().length > 0
    && recording.cloudSyncState !== 'uploaded'
  );
}

function updateQueueItem(localRecordingId: string, patch: Partial<QueueItem>): void {
  queue = queue.map((item) => (
    item.localRecordingId === localRecordingId
      ? {
        ...item,
        ...patch,
        updatedAt: nowIso(),
      }
      : item
  ));
}

function removeQueueItem(localRecordingId: string): void {
  queue = queue.filter((item) => item.localRecordingId !== localRecordingId);
}

async function markLocalRecordingState(recordingId: string, patch: {
  cloudRecordingId?: string | null;
  cloudSyncState?: 'pending' | 'uploading' | 'uploaded' | 'failed' | 'paused' | null;
  cloudUploadedAt?: string | null;
  cloudLastError?: string | null;
}): Promise<void> {
  await updateSafetyAudioRecordingCloudSync(recordingId, patch);
}

async function enqueueFailure(item: QueueItem, error: Error): Promise<void> {
  lastError = error.message;
  state = 'error';

  const nextAttemptCount = item.attemptCount + 1;
  const retryDelay = Math.min(
    30 * 60 * 1000,
    BASE_RETRY_DELAY_MS * Math.pow(2, Math.max(0, nextAttemptCount - 1)) + Math.floor(Math.random() * 3_000),
  );

  const nextRetryAt = nextAttemptCount >= MAX_RETRY_ATTEMPTS
    ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
    : new Date(Date.now() + retryDelay).toISOString();

  updateQueueItem(item.localRecordingId, {
    status: 'failed',
    attemptCount: nextAttemptCount,
    nextRetryAt,
    lastError: error.message,
  });

  if (item.cloudRecordingId) {
    await markSafetyAudioCloudUploadFailed({
      recordingId: item.cloudRecordingId,
      errorCode: 'UPLOAD_FAILED',
      errorMessage: error.message,
    });
  }

  await markLocalRecordingState(item.localRecordingId, {
    cloudRecordingId: item.cloudRecordingId,
    cloudSyncState: 'failed',
    cloudLastError: error.message,
  });

  trackEvent('safety_audio_cloud_upload_failed', {
    attemptCount: nextAttemptCount,
  });

  await persistQueue();
  notifyListeners();
}

async function uploadQueueItem(item: QueueItem): Promise<void> {
  state = 'uploading';
  lastError = null;
  activeUploadLocalRecordingId = item.localRecordingId;
  activeUploadProgress = 0;
  updateQueueItem(item.localRecordingId, {
    status: 'uploading',
    nextRetryAt: null,
    lastError: null,
  });

  await markLocalRecordingState(item.localRecordingId, {
    cloudRecordingId: item.cloudRecordingId,
    cloudSyncState: 'uploading',
    cloudLastError: null,
  });

  await persistQueue();
  notifyListeners();

  trackEvent('safety_audio_cloud_upload_started', {});

  let uploadDescriptor;
  try {
    uploadDescriptor = await createSafetyAudioUploadUrl({
      localRecordingId: item.localRecordingId,
      sizeBytes: item.sizeBytes,
      durationMs: item.durationMs,
      recordedAt: item.recordedAt,
      contextType: item.contextType,
      contextId: item.contextId,
      source: item.source,
    });
  } catch (error) {
    if (
      error instanceof SafetyAudioCloudError
      && (error.code === 'PRO_REQUIRED' || error.code === 'GRACE_READ_ONLY')
    ) {
      state = 'paused_non_pro';
      lastError = error.message;
      updateQueueItem(item.localRecordingId, {
        status: 'queued',
        nextRetryAt: null,
        lastError: error.message,
      });
      await markLocalRecordingState(item.localRecordingId, {
        cloudSyncState: 'paused',
        cloudLastError: error.message,
      });
      await persistQueue();
      notifyListeners();
      trackEvent('safety_audio_cloud_upload_retry_scheduled', {
        reason: error.code,
      });
      return;
    }

    await enqueueFailure(item, error instanceof Error ? error : new Error('Unable to create upload URL.'));
    return;
  }

  updateQueueItem(item.localRecordingId, {
    cloudRecordingId: uploadDescriptor.recordingId,
  });
  await markLocalRecordingState(item.localRecordingId, {
    cloudRecordingId: uploadDescriptor.recordingId,
    cloudSyncState: 'uploading',
  });

  await persistQueue();
  notifyListeners();

  let progressStep = 0;

  try {
    const uploadTask = FileSystem.createUploadTask(
      uploadDescriptor.signedUrl,
      item.localUri,
      {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      },
      (progress) => {
        const total = Number(progress.totalBytesExpectedToSend || 0);
        const sent = Number(progress.totalBytesSent || 0);
        if (!Number.isFinite(total) || total <= 0) {
          return;
        }

        const ratio = Math.max(0, Math.min(1, sent / total));
        activeUploadProgress = ratio;
        notifyListeners();

        const step = Math.floor(ratio * 4);
        if (step > progressStep) {
          progressStep = step;
          trackEvent('safety_audio_cloud_upload_progress', {
            progressStep,
          });
        }
      },
    );

    const result = await uploadTask.uploadAsync();
    if (!result || result.status < 200 || result.status >= 300) {
      throw new Error(`Upload returned HTTP ${result?.status || 0}`);
    }

    const completeResult = await markSafetyAudioCloudUploadComplete({
      recordingId: uploadDescriptor.recordingId,
      sizeBytes: item.sizeBytes,
      durationMs: item.durationMs,
      mimeType: 'audio/mp4',
    });

    if (completeResult.error) {
      throw completeResult.error;
    }

    removeQueueItem(item.localRecordingId);
    activeUploadProgress = 1;

    await markLocalRecordingState(item.localRecordingId, {
      cloudRecordingId: uploadDescriptor.recordingId,
      cloudSyncState: 'uploaded',
      cloudUploadedAt: nowIso(),
      cloudLastError: null,
    });

    trackEvent('safety_audio_cloud_upload_succeeded', {});
    await persistQueue();
    notifyListeners();
  } catch (error) {
    await enqueueFailure({
      ...item,
      cloudRecordingId: uploadDescriptor.recordingId,
    }, error instanceof Error ? error : new Error('Cloud upload failed.'));
  }
}

async function processQueueInternal(): Promise<void> {
  await loadQueue();

  while (true) {
    const pauseState = resolvePauseState();
    if (pauseState) {
      state = pauseState;
      activeUploadLocalRecordingId = null;
      activeUploadProgress = 0;
      notifyListeners();
      return;
    }

    const nowMs = Date.now();
    const nextItem = queue.find((item) => (
      item.status === 'queued'
      || (
        item.status === 'failed'
        && (!item.nextRetryAt || parseIso(item.nextRetryAt) <= nowMs)
      )
    ));

    if (!nextItem) {
      state = 'idle';
      activeUploadLocalRecordingId = null;
      activeUploadProgress = 0;
      notifyListeners();
      return;
    }

    await uploadQueueItem(nextItem);
  }
}

export async function processSafetyAudioCloudUploadQueue(): Promise<void> {
  if (processingPromise) {
    await processingPromise;
    return;
  }

  processingPromise = (async () => {
    try {
      await processQueueInternal();
    } finally {
      processingPromise = null;
      activeUploadLocalRecordingId = null;
      activeUploadProgress = 0;
      if (queue.length === 0) {
        state = 'idle';
      }
      notifyListeners();
    }
  })();

  await processingPromise;
}

export async function configureSafetyAudioCloudSync(nextConfig: Partial<CloudSyncConfig>): Promise<void> {
  config = {
    ...config,
    ...nextConfig,
  };

  if (queue.length === 0) {
    state = resolvePauseState() || 'idle';
  }

  notifyListeners();
  if (config.isProActive) {
    void processSafetyAudioCloudUploadQueue();
  }
}

export async function reconcileSafetyAudioCloudUploadQueue(
  recordings: SafetyAudioRecording[],
): Promise<void> {
  await loadQueue();

  const byId = new Map(recordings.map((recording) => [recording.id, recording]));
  let changed = false;

  queue = queue.filter((item) => {
    const keep = byId.has(item.localRecordingId);
    if (!keep) {
      changed = true;
    }
    return keep;
  });

  for (const recording of recordings) {
    if (!isEligibleLocalRecording(recording)) {
      continue;
    }

    const exists = queue.some((item) => item.localRecordingId === recording.id);
    if (exists) {
      continue;
    }

    queue.push({
      localRecordingId: recording.id,
      localUri: recording.uri,
      sizeBytes: recording.sizeBytes,
      durationMs: recording.durationMs,
      recordedAt: recording.createdAt,
      contextType: recording.contextType,
      contextId: recording.contextId,
      source: recording.source === 'manual'
        ? 'manual'
        : recording.source === 'auto_booking'
          ? 'auto_booking'
          : recording.source === 'auto_live_location'
            ? 'auto_live_location'
            : 'restarted',
      status: 'queued',
      attemptCount: 0,
      nextRetryAt: null,
      lastError: null,
      cloudRecordingId: recording.cloudRecordingId || null,
      updatedAt: nowIso(),
    });

    await markLocalRecordingState(recording.id, {
      cloudRecordingId: recording.cloudRecordingId || null,
      cloudSyncState: 'pending',
    });

    changed = true;
  }

  if (!changed) {
    return;
  }

  queue.sort((left, right) => parseIso(left.recordedAt) - parseIso(right.recordedAt));
  await persistQueue();
  notifyListeners();

  if (config.isProActive) {
    void processSafetyAudioCloudUploadQueue();
  }
}

async function ensureAutoDownloadDirectory(): Promise<string> {
  const root = await ensureSafetyAudioRootDirectory();
  const directory = `${root}${AUTO_DOWNLOAD_DIRECTORY}/`;
  const info = await FileSystem.getInfoAsync(directory);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  }
  return directory;
}

async function autoDownloadRecording(recording: SafetyAudioCloudRecording): Promise<boolean> {
  const downloadUrl = await getSafetyAudioDownloadUrl(recording.id);
  const directory = await ensureAutoDownloadDirectory();
  const tempUri = `${directory}${recording.id}-${Date.now()}.m4a`;

  const downloadResult = await downloadSafetyAudioCloudRecordingToLocalFile({
    signedUrl: downloadUrl.signedUrl,
    targetUri: tempUri,
  });

  if (downloadResult.error || !downloadResult.uri) {
    return false;
  }

  await persistSafetyAudioSegmentFromTemp({
    tempUri: downloadResult.uri,
    sessionId: `cloud-auto-${recording.id}`,
    createdAtIso: recording.recorded_at,
    durationMs: Number(recording.duration_ms || 0),
    contextType: 'manual',
    contextId: null,
    source: 'cloud_download',
  });

  const bucket = String(recording.bucket || 'safety-audio-cloud').trim() || 'safety-audio-cloud';
  const objectPath = String(recording.object_path || '').trim();
  if (objectPath) {
    await supabase.storage.from(bucket).remove([objectPath]);
  }

  const completion = await completeSafetyAudioAutoDownload(recording.id);
  return completion.success;
}

export async function processSafetyAudioCloudAutoDownloads(): Promise<{
  downloadedCount: number;
  failedCount: number;
}> {
  if (!config.hasCloudReadAccess) {
    return {
      downloadedCount: 0,
      failedCount: 0,
    };
  }

  const { recordings, error } = await listPendingSafetyAudioAutoDownloads(20);
  if (error || recordings.length === 0) {
    return {
      downloadedCount: 0,
      failedCount: error ? recordings.length : 0,
    };
  }

  let downloadedCount = 0;
  let failedCount = 0;

  for (const recording of recordings) {
    trackEvent('safety_audio_cloud_download_started', {});
    const success = await autoDownloadRecording(recording);
    if (success) {
      downloadedCount += 1;
      trackEvent('safety_audio_cloud_download_succeeded', {});
      continue;
    }

    failedCount += 1;
    trackEvent('safety_audio_cloud_download_failed', {});
  }

  return {
    downloadedCount,
    failedCount,
  };
}

export function getSafetyAudioCloudSyncSnapshot(): SafetyAudioCloudSyncSnapshot {
  return getSnapshot();
}

export function subscribeSafetyAudioCloudSync(listener: QueueListener): () => void {
  listeners.add(listener);
  listener(getSnapshot());
  return () => {
    listeners.delete(listener);
  };
}

export async function clearSafetyAudioCloudSyncQueue(): Promise<void> {
  queue = [];
  state = 'idle';
  lastError = null;
  activeUploadLocalRecordingId = null;
  activeUploadProgress = 0;
  await persistQueue();
  notifyListeners();
}
